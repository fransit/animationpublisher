import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";
import { createAsset, getOperation } from "@/lib/roblox";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseCreatorKey(key: string) {
  const [type, id] = key.split(":");
  if (type !== "USER" && type !== "GROUP") throw new Error("Invalid creator type");
  if (!id) throw new Error("Invalid creator id");
  return { type: type as "USER" | "GROUP", id };
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
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const form = await req.formData();
  const selectedCreatorKey = String(form.get("creatorKey") || "");
  const overrideCreatorKey = String(form.get("creatorIdOverride") || "").trim();
  const creatorKey = overrideCreatorKey || selectedCreatorKey;
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

  const { type, id } = parseCreatorKey(creatorKey);

  const supa = supabaseAdmin();
  const userId = String((session as any).user?.sub ?? (session as any).user?.userId ?? "unknown");

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
      continue;
    }

    try {
      const createRes = await createAsset({
        accessToken: session.access_token,
        creatorType: type,
        creatorId: id,
        assetName,
        assetType,
        file,
        expectedPrice: 0,
      });

      const operationPath = createRes?.path || createRes?.operationPath || createRes?.operation || null;
      if (!operationPath) throw new Error("No operation path returned from Roblox");

      await supa.from("uploads").update({ operation_path: operationPath }).eq("id", inserted.id);

      const op = await pollOperation(session.access_token, operationPath, 90_000);
      const assetId =
        op?.response?.assetId ??
        op?.response?.asset?.assetId ??
        op?.response?.asset?.id ??
        op?.response?.id ??
        null;

      if (op?.done && assetId) {
        await supa.from("uploads").update({ status: "DONE", asset_id: assetId }).eq("id", inserted.id);
      } else {
        await supa.from("uploads").update({ status: "PROCESSING" }).eq("id", inserted.id);
      }
    } catch (e: any) {
      await supa
        .from("uploads")
        .update({ status: "ERROR", error: typeof e?.message === "string" ? e.message : String(e) })
        .eq("id", inserted.id);
    }
  }

  return NextResponse.redirect(new URL("/dashboard/uploads", baseUrl));
}
