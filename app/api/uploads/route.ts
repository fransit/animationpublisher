import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const userId = String((session as any).user?.sub ?? (session as any).user?.userId ?? "unknown");
  const q = new URL(req.url).searchParams.get("q")?.trim();

  const supa = supabaseAdmin();
  let query = supa.from("uploads").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);

  if (q) query = query.ilike("asset_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ uploads: data ?? [] });
}
