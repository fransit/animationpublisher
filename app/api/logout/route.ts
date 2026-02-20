import { NextResponse } from "next/server";
import { cookieName } from "@/lib/session";

export async function GET(req: Request) {
  const baseUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/", baseUrl));
  res.cookies.set(cookieName(), "", { httpOnly: true, expires: new Date(0), path: "/" });
  return res;
}
