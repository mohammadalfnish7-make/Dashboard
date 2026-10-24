import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken, sessionCookieName } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/health"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(sessionCookieName())?.value);
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session || isPublic) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.png|karam-logo.svg).*)"],
};
