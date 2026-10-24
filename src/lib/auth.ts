const COOKIE_NAME = "karam_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

export function sessionCookieName() {
  return COOKIE_NAME;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

export function authCredentials() {
  const email = (process.env.AUTH_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.AUTH_PASSWORD ?? "";
  return { email, password, configured: Boolean(email && password) };
}

function sessionSecret() {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit) return explicit;
  const { email, password } = authCredentials();
  return `karam-ops:${email}:${password}`;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const byte of raw) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createSessionToken(email: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${email}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function readSessionToken(token: string | undefined | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  const signature = parts.pop() ?? "";
  const exp = parts.pop() ?? "";
  const email = parts.join(".");
  const payload = `${email}.${exp}`;
  if (!timingSafeEqual(signature, await sign(payload))) return null;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return null;
  return { email };
}

export async function credentialsMatch(email: string, password: string) {
  const expected = authCredentials();
  if (!expected.configured) return false;
  const emailOk = timingSafeEqual(email.trim().toLowerCase(), expected.email);
  const passwordOk = timingSafeEqual(password, expected.password);
  return emailOk && passwordOk;
}
