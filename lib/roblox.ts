const OAUTH_BASE = "https://apis.roblox.com/oauth";
const ASSETS_BASE = "https://apis.roblox.com/assets";

export function oauthAuthorizeUrl(params: Record<string, string>) {
  const url = new URL(`${OAUTH_BASE}/v1/authorize`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export async function exchangeCodeForToken(args: {
  code: string;
  code_verifier: string;
}) {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", process.env.ROBLOX_CLIENT_ID!);
  body.set("client_secret", process.env.ROBLOX_CLIENT_SECRET!);
  body.set("code", args.code);
  body.set("code_verifier", args.code_verifier);

  const res = await fetch(`${OAUTH_BASE}/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function oauthUserInfo(accessToken: string) {
  const res = await fetch(`${OAUTH_BASE}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function oauthResources(accessToken: string) {
  const res = await fetch(`${OAUTH_BASE}/v1/token/resources`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function createAsset(args: {
  accessToken: string;
  creatorType: "USER" | "GROUP";
  creatorId: string;
  assetName: string;
  assetType: "ANIMATION" | "AUDIO";
  file: File;
  expectedPrice?: number;
}) {
  const form = new FormData();
  const requestPayload: any = {
    assetType: args.assetType,
    displayName: args.assetName,
    description: "",
    creationContext: {
      creator: args.creatorType === "GROUP" ? { groupId: Number(args.creatorId) } : { userId: Number(args.creatorId) },
      expectedPrice: args.expectedPrice ?? 0
    }
  };

  form.append("request", JSON.stringify(requestPayload));
  form.append("fileContent", args.file, args.file.name);

  const res = await fetch(`${ASSETS_BASE}/v1/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}` },
    body: form as any,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data; // usually contains path to operation
}

export async function getOperation(accessToken: string, operationPath: string) {
  const url = operationPath.startsWith("http")
    ? operationPath
    : `${ASSETS_BASE}${operationPath.startsWith("/v1") ? "" : ""}${operationPath}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}
