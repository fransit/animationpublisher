import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "rbx_session";
const alg = "HS256";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET missing");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch seconds
  user?: any;
};

export async function signSession(payload: SessionPayload) {
  const jwt = await new SignJWT(payload as any)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
  return jwt;
}

export async function readSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as any;
  } catch {
    return null;
  }
}

export function cookieName() {
  return COOKIE_NAME;
}
