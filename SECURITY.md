# Security findings — fix later

Staff review of frontend + backend (auth, API, Docker/Coolify).  
Status: **open** — address before treating this as hardened production.

## High

### 1. Rate-limit IP spoofing via `X-Forwarded-For`
- **Where:** `src/lib/rate-limit.ts` (`clientKey`)
- **Issue:** Trusts the first `X-Forwarded-For` value. If Coolify/proxy does not overwrite client-supplied headers, an attacker can rotate fake IPs and bypass the 5-attempt lockout.
- **Fix later:**
  - Prefer the rightmost trusted hop, or use Coolify’s real client IP header only.
  - Document that the reverse proxy must strip/overwrite `X-Forwarded-For`.
  - Optionally key by `X-Real-IP` when set by the proxy alone.

### 2. Weak / missing `AUTH_SECRET`
- **Where:** `src/lib/auth.ts` (`sessionSecret`)
- **Issue:** If `AUTH_SECRET` is empty, the session HMAC is derived from `AUTH_EMAIL` + `AUTH_PASSWORD`. Password leak then also forges sessions.
- **Fix later:**
  - Require `AUTH_SECRET` at startup in production (fail boot if missing).
  - Generate a long random secret in Coolify; never derive it from the password.
  - Update `.env.example` to mark `AUTH_SECRET` as required for deploy.

## Medium

### 3. Authenticated Google Sheet URL override
- **Where:** `src/app/api/sheet/route.ts` (`url` query param)
- **Issue:** Any signed-in user can pass `url=` and pull any public Google Sheet ID into the app (data access + SheetJS parse DoS).
- **Fix later:**
  - In production, ignore client `url` and only use `GOOGLE_SHEET_URL` from env.
  - Or allowlist sheet IDs.
  - Keep Setup UI for local/dev only.

### 4. In-memory login rate limit
- **Where:** `src/lib/rate-limit.ts`
- **Issue:** Counter lives in process memory. Restarts clear it; multiple replicas do not share state.
- **Fix later:**
  - Shared store (Redis) if you scale replicas, or accept single-instance Coolify and document it.
  - Consider Coolify/proxy-level rate limits as a second layer.

### 5. Missing security headers
- **Where:** `next.config.ts` (none set)
- **Issue:** No CSP, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, or app-level HSTS.
- **Fix later:**
  - Add `headers()` in `next.config.ts` (or Coolify/proxy equivalents).
  - Start with: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), tighten CSP after testing.

### 6. Excel data baked into Docker image
- **Where:** `Dockerfile` (`COPY ... /app/data`), `data/*.xlsx`
- **Issue:** Warehouse snapshots ship inside the image; registry/image access bypasses login.
- **Fix later:**
  - Stop copying `data/` into production images, or use a non-sensitive sample only.
  - Prefer live Google Sheet only in prod; local files for offline/dev.

### 7. Single shared plaintext env password
- **Where:** `AUTH_EMAIL` / `AUTH_PASSWORD` env; `src/lib/auth.ts`
- **Issue:** One shared gate account, no MFA, no per-user audit trail. Acceptable as a thin gate, not as full IAM.
- **Fix later (if needed):**
  - Per-user accounts / SSO / Coolify basic auth in front.
  - Rotate password on a schedule; store only in Coolify secrets.

## Low

### 8. Post-login `next` redirect
- **Where:** `src/app/login/page.tsx`
- **Issue:** Mostly safe (`/` and not `//`), but edge path forms can still be tricky.
- **Fix later:** Allow only `next` matching `^/[a-zA-Z0-9/_-]*$` (no `\\`, `@`, encoded tricks).

### 9. Public `/api/health`
- **Where:** `src/middleware.ts`, `src/app/api/health/route.ts`
- **Issue:** Public by design for Coolify. Fine while the body is `{ ok: true }` only.
- **Fix later:** Never add secrets, versions, or env dumps to the health response.

### 10. Login body size / input caps
- **Where:** `src/app/api/auth/login/route.ts`
- **Issue:** No max length on email/password JSON fields.
- **Fix later:** Reject bodies over a small size; cap email/password string length.

## Already in good shape (do not regress)

- Middleware protects pages and `/api/sheet`
- HttpOnly + `SameSite=Lax` cookie; `Secure` when `NODE_ENV=production`
- HMAC session token + expiry + timing-safe credential compare
- Login failure rate limit (5 / 15 min) when IP keying is honest
- Google fetch builds only `docs.google.com/.../export` from sheet id
- Non-root container user; Compose `expose` only (no host port publish)

## Coolify deploy checklist (ops)

- [ ] Set long random `AUTH_SECRET`
- [ ] Set strong unique `AUTH_PASSWORD`
- [ ] Confirm proxy overwrites `X-Forwarded-For` / sets real client IP
- [ ] HTTPS on the domain (HSTS at proxy if possible)
- [ ] Google Sheet: Anyone with the link → Viewer only
- [ ] Decide whether Setup URL override stays enabled in production

## Suggested fix order

1. Require `AUTH_SECRET` in production  
2. Harden rate-limit IP source  
3. Lock sheet URL to env in production  
4. Add security headers  
5. Drop or slim `data/` in production image  
6. Tighten login `next` + body caps  
