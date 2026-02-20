import { NextResponse } from "next/server";
import { cookieName } from "@/lib/session";

export async function GET() {
  const res = NextResponse.redirect(new URL("/", process.env.APP_URL));
  res.cookies.set(cookieName(), "", { httpOnly: true, expires: new Date(0), path: "/" });
  return res;
}
