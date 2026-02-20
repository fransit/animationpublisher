import { NextResponse } from "next/server";
import { oauthAuthorizeUrl } from "@/lib/roblox";
import { randomVerifier, sha256Base64Url } from "@/lib/pkce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const verifier = randomVerifier(64);
  const challenge = await sha256Base64Url(verifier);
  const state = crypto.randomUUID();

  const redirectUri = process.env.ROBLOX_REDIRECT_URI;
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const appUrl = process.env.APP_URL ?? "";
  if (!redirectUri || !clientId) {
    return NextResponse.json({ error: "Missing Roblox OAuth environment variables" }, { status: 500 });
  }

  const url = oauthAuthorizeUrl({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile asset:write asset:read",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const res = NextResponse.redirect(url);

  res.cookies.set("rbx_pkce_verifier", verifier, { httpOnly: true, secure: appUrl.startsWith("https"), sameSite: "lax", path: "/" });
  res.cookies.set("rbx_oauth_state", state, { httpOnly: true, secure: appUrl.startsWith("https"), sameSite: "lax", path: "/" });

  return res;
}
