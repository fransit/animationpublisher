import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";
import { getOperation } from "@/lib/roblox";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const form = await req.formData();
  const uploadId = String(form.get("uploadId") || "").trim();
  const returnTo = String(form.get("returnTo") || "/dashboard/uploads");
  const responseMode = String(form.get("responseMode") || "");

  if (!uploadId) return NextResponse.json({ error: "missing uploadId" }, { status: 400 });

  const userId = String((session as any).user?.sub ?? (session as any).user?.userId ?? "unknown");
  const supa = supabaseAdmin();

  const { data: row, error: rowErr } = await supa
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("user_id", userId)
    .single();

  if (rowErr || !row) return NextResponse.json({ error: "upload not found" }, { status: 404 });
  if (!row.operation_path) return NextResponse.json({ error: "upload has no operation path to retry" }, { status: 400 });

  try {
    const op = await getOperation(session.access_token, row.operation_path);
    const assetId =
      op?.response?.assetId ??
      op?.response?.asset?.assetId ??
      op?.response?.asset?.id ??
      op?.response?.id ??
      null;

    if (op?.done && assetId) {
      await supa.from("uploads").update({ status: "DONE", asset_id: assetId, error: null }).eq("id", uploadId);
      if (responseMode === "json") return NextResponse.json({ ok: true, status: "DONE", assetId });
      return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
    }

    await supa.from("uploads").update({ status: "PROCESSING", error: null }).eq("id", uploadId);
    if (responseMode === "json") return NextResponse.json({ ok: true, status: "PROCESSING" });
    return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
  } catch (e: any) {
    const errText = typeof e?.message === "string" ? e.message : String(e);
    await supa.from("uploads").update({ status: "ERROR", error: errText }).eq("id", uploadId);
    if (responseMode === "json") return NextResponse.json({ ok: false, status: "ERROR", error: errText }, { status: 500 });
    return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
  }
}
