import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSession } from "@/lib/session";

export const runtime = "nodejs";

function collectGroupCandidates(input: unknown, out: { id: string; name: string }[] = []) {
  if (!input) return out;
  if (Array.isArray(input)) {
    for (const item of input) collectGroupCandidates(item, out);
    return out;
  }
  if (typeof input !== "object") return out;

  const node = input as Record<string, unknown>;
  const groupNode = typeof node.group === "object" && node.group !== null ? (node.group as Record<string, unknown>) : null;
  const groupId = node.groupId ?? node.id ?? groupNode?.id;
  const groupName = node.groupName ?? node.name ?? groupNode?.name;
  if (groupId && (node.groupId || node.group || node.groupName || node.group_id)) {
    out.push({ id: String(groupId), name: String(groupName ?? `Group ${groupId}`) });
  }

  for (const value of Object.values(node)) collectGroupCandidates(value, out);
  return out;
}

function creatorsFromResources(resources: any, user: any) {
  const creators: { key: string; label: string; type: "USER"|"GROUP"; id: string }[] = [];
  const seen = new Set<string>();

  // Always include user itself (safe default)
  const userId = user?.sub || user?.userId || user?.id;
  const userLabel = user?.preferred_username || user?.name || "User";
  if (userId) {
    const key = `USER:${userId}`;
    creators.push({ key, label: `${userLabel} (You)`, type: "USER", id: String(userId) });
    seen.add(key);
  }

  // Best-effort parse resources (shape may change), then dedupe.
  for (const g of collectGroupCandidates(resources)) {
    const key = `GROUP:${g.id}`;
    if (!seen.has(key)) {
      creators.push({ key, label: `${g.name} (Group)`, type: "GROUP", id: g.id });
      seen.add(key);
    }
  }

  // Fallback if nothing parsed from resources.
  const fallbackGroups = resources?.resources?.groups || resources?.resources?.group || resources?.groups;
  if (Array.isArray(fallbackGroups)) {
    for (const g of fallbackGroups) {
      const id = g.groupId ?? g.id;
      const name = g.name ?? g.groupName ?? `Group ${id}`;
      const key = `GROUP:${id}`;
      if (id && !seen.has(key)) {
        creators.push({ key, label: `${name} (Group)`, type: "GROUP", id: String(id) });
        seen.add(key);
      }
    }
  }
  return creators;
}

async function appendGroupsFromMembershipApi(creators: { key: string; label: string; type: "USER"|"GROUP"; id: string }[], user: any) {
  const userId = user?.sub || user?.userId || user?.id;
  if (!userId) return creators;

  const seen = new Set(creators.map((c) => c.key));
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, { cache: "no-store" });
    if (!res.ok) return creators;
    const data = await res.json();
    const groups = Array.isArray(data?.data) ? data.data : [];
    for (const row of groups) {
      const g = row?.group;
      const id = g?.id;
      if (!id) continue;
      const key = `GROUP:${id}`;
      if (seen.has(key)) continue;
      creators.push({
        key,
        label: `${g?.name ?? `Group ${id}`} (Group)`,
        type: "GROUP",
        id: String(id),
      });
      seen.add(key);
    }
  } catch {
    // ignore fallback fetch failures
  }
  return creators;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const session = await readSession(token);
  if (!session?.access_token) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const creators = await appendGroupsFromMembershipApi(
    creatorsFromResources((session as any).resources, (session as any).user),
    (session as any).user
  );
  return NextResponse.json({
    user: (session as any).user,
    creators: creators.map(c => ({ key: c.key, label: c.label })),
    defaultCreatorKey: creators[0]?.key ?? "",
  });
}
