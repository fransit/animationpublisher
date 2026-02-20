import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession, signSession } from "@/lib/session";
import { createAsset, getOperation, refreshAccessToken } from "@/lib/roblox";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseCreatorKey(key: string) {
  const numericOnly = key.trim().match(/^(\d+)$/);
  if (numericOnly) {
    return { type: "GROUP" as const, id: numericOnly[1] };
  }
  const match = key.trim().match(/^(USER|GROUP)\s*:\s*(\d+)$/i);
  if (!match) return null;
  const type = match[1].toUpperCase() as "USER" | "GROUP";
  const id = match[2];
  return { type, id };
}

function normalizeAssetType(input: string): "ANIMATION" | "AUDIO" {
  return input === "AUDIO" ? "AUDIO" : "ANIMATION";
}

function removeExt(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

async function pollOperation(accessToken: string, operationPath: string, timeoutMs = 60_000) {
  const started = Date.now();
  let last: any = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const op = await getOperation(accessToken, operationPath);
      last = op;

      if (op?.done) return op;
    } catch (e) {
      // ignore transient
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  return last;
}

export async function POST(req: NextRequest) {
  const baseUrl = process.env.APP_URL ?? req.nextUrl.origin;
  let responseMode = "";

  try {
    const token = req.cookies.get(cookieName())?.value;
    if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

    const session = await readSession(token);
    if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });
    let accessToken = session.access_token;
    let refreshToken = (session as any).refresh_token as string | undefined;
    let expiresAt = (session as any).expires_at as number | undefined;
    let sessionUpdated = false;

    const form = await req.formData();
    responseMode = String(form.get("responseMode") || "");
    const selectedCreatorKey = String(form.get("creatorKey") || "");
    const overrideCreatorKey = String(form.get("creatorIdOverride") || "").trim();
    const creatorKey = overrideCreatorKey || selectedCreatorKey;
    const parsedCreator = parseCreatorKey(creatorKey);
    if (!parsedCreator) {
      return NextResponse.json(
        { error: "Invalid creator format. Use USER:123456 or GROUP:123456" },
        { status: 400 },
      );
    }
    const { type, id } = parsedCreator;
    const assetType = normalizeAssetType(String(form.get("assetType") || "ANIMATION"));
    const assetNamePrefix = String(form.get("assetNamePrefix") || "").trim();
    const files = form
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);

    // Backward compatibility for old form name.
    const fallbackFile = form.get("file");
    if (files.length === 0 && fallbackFile instanceof File && fallbackFile.size > 0) {
      files.push(fallbackFile);
    }

    if (!creatorKey || files.length === 0) {
      return NextResponse.json({ error: "missing creator/files" }, { status: 400 });
    }

    const supa = supabaseAdmin();
    const userId = String((session as any).user?.sub ?? (session as any).user?.userId ?? "unknown");

    const results: Array<{
      assetName: string;
      uploadId?: string;
      status: "DONE" | "PROCESSING" | "ERROR";
      assetId?: string | number | null;
      error?: string;
    }> = [];

    for (const file of files) {
      const fileBaseName = removeExt(file.name || "asset");
      const assetName = assetNamePrefix ? `${assetNamePrefix}${fileBaseName}` : fileBaseName;

      const { data: inserted, error: insErr } = await supa
        .from("uploads")
        .insert({
          user_id: userId,
          creator_type: type,
          creator_id: id,
          asset_name: assetName,
          asset_type: assetType,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (insErr || !inserted?.id) {
        results.push({
          assetName,
          status: "ERROR",
          error: insErr?.message ?? "Failed to create upload row",
        });
        continue;
      }

      try {
        let createRes: any;
        try {
          createRes = await createAsset({
            accessToken,
            creatorType: type,
            creatorId: id,
            assetName,
            assetType,
            file,
            expectedPrice: 0,
          });
        } catch (assetErr: any) {
          const assetErrText = typeof assetErr?.message === "string" ? assetErr.message : String(assetErr);
          const needsRefresh = /invalid token/i.test(assetErrText);
          if (!needsRefresh || !refreshToken) throw assetErr;

          const refreshed = await refreshAccessToken(refreshToken);
          if (!refreshed?.access_token) throw assetErr;
          accessToken = refreshed.access_token;
          refreshToken = refreshed.refresh_token ?? refreshToken;
          expiresAt = Math.floor(Date.now() / 1000) + Number(refreshed.expires_in ?? 900);
          sessionUpdated = true;

          createRes = await createAsset({
            accessToken,
            creatorType: type,
            creatorId: id,
            assetName,
            assetType,
            file,
            expectedPrice: 0,
          });
        }

        const operationPath = createRes?.path || createRes?.operationPath || createRes?.operation || null;
        if (!operationPath) throw new Error("No operation path returned from Roblox");

        await supa.from("uploads").update({ operation_path: operationPath }).eq("id", inserted.id);

        const op = await pollOperation(accessToken, operationPath, 90_000);
        const assetId =
          op?.response?.assetId ??
          op?.response?.asset?.assetId ??
          op?.response?.asset?.id ??
          op?.response?.id ??
          null;

        if (op?.done && assetId) {
          await supa.from("uploads").update({ status: "DONE", asset_id: assetId }).eq("id", inserted.id);
          results.push({ assetName, uploadId: inserted.id, status: "DONE", assetId });
        } else {
          await supa.from("uploads").update({ status: "PROCESSING" }).eq("id", inserted.id);
          results.push({ assetName, uploadId: inserted.id, status: "PROCESSING", assetId: null });
        }
      } catch (e: any) {
        const errText = typeof e?.message === "string" ? e.message : String(e);
        await supa
          .from("uploads")
          .update({ status: "ERROR", error: errText })
          .eq("id", inserted.id);
        results.push({ assetName, uploadId: inserted.id, status: "ERROR", error: errText });
      }
    }

    const attachSessionCookie = async (res: NextResponse) => {
      if (!sessionUpdated) return res;
      const updatedJwt = await signSession({
        ...(session as any),
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      });
      res.cookies.set(cookieName(), updatedJwt, {
        httpOnly: true,
        secure: baseUrl.startsWith("https"),
        sameSite: "lax",
        path: "/",
      });
      return res;
    };

    if (responseMode === "json") {
      return attachSessionCookie(NextResponse.json({ ok: true, results }));
    }

    return attachSessionCookie(NextResponse.redirect(new URL("/dashboard/uploads", baseUrl)));
  } catch (e: any) {
    const message = typeof e?.message === "string" ? e.message : String(e);
    if (responseMode === "json") {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.redirect(new URL(`/dashboard/uploads?error=${encodeURIComponent(message)}`, baseUrl));
  }
}
