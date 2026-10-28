import { NextResponse } from "next/server";
import { parseLang } from "@/lib/i18n";
import { loadSheetPayload } from "@/lib/load-sheet";
import { maytapiConfig, sendWhatsAppMessages } from "@/lib/maytapi";
import { normalizePhone } from "@/lib/phone";
import { checkLoginRateLimit, clientKey, recordLoginFailure } from "@/lib/rate-limit";
import { loadRecipients, MAX_NUMBERS } from "@/lib/recipients";
import { buildManagerMessage } from "@/lib/report";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 4000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const payload = await loadSheetPayload({
      url: searchParams.get("url"),
      tab: searchParams.get("tab"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    const language = parseLang(searchParams.get("lang"));
    return NextResponse.json({
      configured: maytapiConfig().configured,
      language,
      message: buildManagerMessage(payload, language),
      rangeLabel: payload.rangeLabel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!maytapiConfig().configured) {
    return NextResponse.json(
      { error: "WhatsApp is not configured. Set MAYTAPI_PRODUCT_ID, MAYTAPI_TOKEN, and MAYTAPI_PHONE_ID." },
      { status: 500 },
    );
  }

  const limitKey = `report:${clientKey(request)}`;
  const limit = checkLoginRateLimit(limitKey);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many WhatsApp sends. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: { phone?: unknown; url?: unknown; tab?: unknown; from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const stored = loadRecipients();
  const only = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const targets = only
    ? stored.filter((item) => item.phone === only)
    : stored;
  if (!targets.length) {
    return NextResponse.json({ error: "Add at least one WhatsApp number." }, { status: 400 });
  }
  if (targets.length > MAX_NUMBERS) {
    return NextResponse.json({ error: `Maximum ${MAX_NUMBERS} numbers per send.` }, { status: 400 });
  }

  try {
    const payload = await loadSheetPayload({
      url: typeof body.url === "string" ? body.url : undefined,
      tab: typeof body.tab === "string" ? body.tab : "all",
      from: typeof body.from === "string" ? body.from : undefined,
      to: typeof body.to === "string" ? body.to : undefined,
    });
    recordLoginFailure(limitKey);
    const results = await sendWhatsAppMessages(
      targets.map((person) => ({
        phone: person.phone,
        name: person.name,
        language: person.language,
        message: buildManagerMessage(payload, person.language).slice(0, MAX_MESSAGE),
      })),
    );
    const sent = results.filter((item) => item.ok).length;
    return NextResponse.json({
      ok: sent === results.length,
      sent,
      failed: results.length - sent,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
