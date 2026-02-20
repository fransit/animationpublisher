import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";
import { createAssetRbxm, getOperation } from "@/lib/roblox";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseCreatorKey(key: string) {
  const [type, id] = key.split(":");
  if (type !== "USER" && type !== "GROUP") throw new Error("Invalid creator type");
  if (!id) throw new Error("Invalid creator id");
  return { type: type as "USER" | "GROUP", id };
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
  const creatorKey = String(form.get("creatorKey") || "");
  const assetName = String(form.get("assetName") || "").trim();
  const file = form.get("file");

  if (!creatorKey || !assetName || !(file instanceof File)) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { type, id } = parseCreatorKey(creatorKey);

  const supa = supabaseAdmin();
  const userId = String((session as any).user?.sub ?? (session as any).user?.userId ?? "unknown");

  // Create a DB row first
  const { data: inserted, error: insErr } = await supa
    .from("uploads")
    .insert({
      user_id: userId,
      creator_type: type,
      creator_id: id,
      asset_name: assetName,
      asset_type: "MODEL",
      status: "PROCESSING",
    })
    .select()
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    const createRes = await createAssetRbxm({
      accessToken: session.access_token,
      creatorType: type,
      creatorId: id,
      assetName,
      file,
      expectedPrice: 0,
    });

    const operationPath = createRes?.path || createRes?.operationPath || createRes?.operation || null;
    if (!operationPath) throw new Error("No operation path returned from Roblox");

    await supa.from("uploads").update({ operation_path: operationPath }).eq("id", inserted.id);

    const op = await pollOperation(session.access_token, operationPath, 90_000);

    // Operation response formats vary, best-effort parse:
    const assetId =
      op?.response?.assetId ??
      op?.response?.asset?.assetId ??
      op?.response?.asset?.id ??
      op?.response?.id ??
      null;

    if (op?.done && assetId) {
      await supa.from("uploads").update({ status: "DONE", asset_id: assetId }).eq("id", inserted.id);
      return NextResponse.redirect(new URL("/dashboard/uploads", baseUrl));
    }

    await supa.from("uploads").update({ status: "PROCESSING" }).eq("id", inserted.id);
    return NextResponse.redirect(new URL("/dashboard/uploads", baseUrl));
  } catch (e: any) {
    await supa
      .from("uploads")
      .update({ status: "ERROR", error: typeof e?.message === "string" ? e.message : String(e) })
      .eq("id", inserted.id);

    return NextResponse.redirect(new URL("/dashboard/uploads", baseUrl));
  }
}
