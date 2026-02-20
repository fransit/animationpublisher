import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, oauthResources, oauthUserInfo } from "@/lib/roblox";
import { signSession, cookieName } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const verifier = req.cookies.get("rbx_pkce_verifier")?.value;
  const expectedState = req.cookies.get("rbx_oauth_state")?.value;

  if (!code || !verifier) return NextResponse.json({ error: "missing code/verifier" }, { status: 400 });
  if (expectedState && state !== expectedState) return NextResponse.json({ error: "bad state" }, { status: 400 });

  const token = await exchangeCodeForToken({ code, code_verifier: verifier });
  const access = token.access_token as string;

  // optional: store userinfo + resources for UI
  let user: any = null;
  let resources: any = null;
  try { user = await oauthUserInfo(access); } catch {}
  try { resources = await oauthResources(access); } catch {}

  const sessionJwt = await signSession({
    access_token: access,
    refresh_token: token.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (token.expires_in ?? 900),
    user,
    resources,
  } as any);

  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(new URL("/dashboard", appUrl));
  res.cookies.set(cookieName(), sessionJwt, {
    httpOnly: true,
    secure: appUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
  });

  // cleanup
  res.cookies.set("rbx_pkce_verifier", "", { httpOnly: true, expires: new Date(0), path: "/" });
  res.cookies.set("rbx_oauth_state", "", { httpOnly: true, expires: new Date(0), path: "/" });

  return res;
}
