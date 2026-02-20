import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";

export const runtime = "nodejs";

function creatorsFromResources(resources: any, user: any) {
  const creators: { key: string; label: string; type: "USER"|"GROUP"; id: string }[] = [];

  // Always include user itself (safe default)
  const userId = user?.sub || user?.userId || user?.id;
  const userLabel = user?.preferred_username || user?.name || "User";
  if (userId) creators.push({ key: `USER:${userId}`, label: `${userLabel} (You)`, type: "USER", id: String(userId) });

  // Best-effort parse resources (shape may change)
  const groups = resources?.resources?.groups || resources?.resources?.group || resources?.groups;
  if (Array.isArray(groups)) {
    for (const g of groups) {
      const id = g.groupId ?? g.id;
      const name = g.name ?? g.groupName ?? `Group ${id}`;
      if (id) creators.push({ key: `GROUP:${id}`, label: `${name} (Group)`, type: "GROUP", id: String(id) });
    }
  }
  return creators;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const creators = creatorsFromResources((session as any).resources, (session as any).user);
  return NextResponse.json({
    user: (session as any).user,
    creators: creators.map(c => ({ key: c.key, label: c.label })),
    defaultCreatorKey: creators[0]?.key ?? "",
  });
}
