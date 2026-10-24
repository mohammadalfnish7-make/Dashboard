import { NextResponse } from "next/server";
import {
  authCredentials,
  createSessionToken,
  credentialsMatch,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  clientKey,
  loginRateLimitMessage,
  recordLoginFailure,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authCredentials().configured) {
    return NextResponse.json(
      { error: "Login is not configured. Set AUTH_EMAIL and AUTH_PASSWORD." },
      { status: 500 },
    );
  }

  const key = `login:${clientKey(request)}`;
  const limit = checkLoginRateLimit(key);
  if (!limit.ok) {
    return NextResponse.json(
      { error: loginRateLimitMessage(limit.retryAfterSec) },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      },
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
    recordLoginFailure(key);
    const after = checkLoginRateLimit(key);
    if (!after.ok) {
      return NextResponse.json(
        { error: loginRateLimitMessage(after.retryAfterSec) },
        {
          status: 429,
          headers: {
            "Retry-After": String(after.retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Wrong email or password." },
      {
        status: 401,
        headers: { "X-RateLimit-Remaining": String(after.remaining) },
      },
    );
  }

  clearLoginRateLimit(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    sessionCookieName(),
    await createSessionToken(email.trim().toLowerCase()),
    sessionCookieOptions(),
  );
  return response;
}
