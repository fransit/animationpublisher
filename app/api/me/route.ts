import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";

export const runtime = "nodejs";

type Creator = { key: string; label: string; type: "USER"|"GROUP"; id: string };

function collectCreatorIdsFromResources(input: unknown, out = new Set<string>()) {
  if (!input) return out;
  if (Array.isArray(input)) {
    for (const item of input) collectCreatorIdsFromResources(item, out);
    return out;
  }
  if (typeof input !== "object") return out;

  const node = input as Record<string, unknown>;
  const creatorNode =
    typeof node.creator === "object" && node.creator !== null
      ? (node.creator as Record<string, unknown>)
      : null;
  const ids = creatorNode?.ids;
  if (Array.isArray(ids)) {
    for (const raw of ids) {
      if (typeof raw === "string" || typeof raw === "number") {
        out.add(String(raw));
      }
    }
  }

  for (const value of Object.values(node)) collectCreatorIdsFromResources(value, out);
  return out;
}

async function buildCreatorsFromPermissions(resources: any, user: any) {
  const creators: Creator[] = [];
  const seen = new Set<string>();

  const userId = user?.sub || user?.userId || user?.id;
  const userLabel = user?.preferred_username || user?.name || "User";
  const creatorIds = collectCreatorIdsFromResources(resources);

  if (userId && (creatorIds.has("U") || creatorIds.has(String(userId)))) {
    const key = `USER:${userId}`;
    creators.push({ key, label: `${userLabel} (You)`, type: "USER", id: String(userId) });
    seen.add(key);
  }

  // Only allow numeric creator IDs from OAuth resources (permission-aware list).
  const allowedGroupIds = [...creatorIds].filter((id) => /^\d+$/.test(id));
  if (!allowedGroupIds.length) return creators;

  const allowedGroupSet = new Set(allowedGroupIds);
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, { cache: "no-store" });
    if (!res.ok) return creators;
    const data = await res.json();
    const groups = Array.isArray(data?.data) ? data.data : [];
    for (const row of groups) {
      const g = row?.group;
      const id = g?.id;
      if (!id) continue;
      if (!allowedGroupSet.has(String(id))) continue;
      const key = `GROUP:${id}`;
      if (seen.has(key)) continue;
      creators.push({ key, label: `${g?.name ?? `Group ${id}`} (Group)`, type: "GROUP", id: String(id) });
      seen.add(key);
    }
  } catch {
    // ignore lookup failures
  }

  // If group name lookup fails, still expose IDs we know are authorized.
  for (const groupId of allowedGroupIds) {
    const key = `GROUP:${groupId}`;
    if (!seen.has(key)) {
      creators.push({ key, label: `Group ${groupId} (Group)`, type: "GROUP", id: groupId });
      seen.add(key);
    }
  }

  return creators;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const creators = await buildCreatorsFromPermissions((session as any).resources, (session as any).user);
  return NextResponse.json({
    user: (session as any).user,
    creators: creators.map(c => ({ key: c.key, label: c.label })),
    defaultCreatorKey: creators.find((c) => c.type === "USER")?.key ?? creators[0]?.key ?? "",
  });
}
