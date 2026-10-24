import { NextResponse } from "next/server";
import {
  authCredentials,
  createSessionToken,
  credentialsMatch,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authCredentials().configured) {
    return NextResponse.json(
      { error: "Login is not configured. Set AUTH_EMAIL and AUTH_PASSWORD." },
      { status: 500 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter email and password." }, { status: 400 });
  }

  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  if (!(await credentialsMatch(email, password))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), await createSessionToken(email.trim().toLowerCase()), sessionCookieOptions());
  return response;
}
