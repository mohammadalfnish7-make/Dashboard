import { NextResponse } from "next/server";
import { loadSheetPayload } from "@/lib/load-sheet";
import { maytapiConfig, sendWhatsAppToMany } from "@/lib/maytapi";
import { normalizePhones } from "@/lib/phone";
import { checkLoginRateLimit, clientKey, recordLoginFailure } from "@/lib/rate-limit";
import { buildManagerMessage } from "@/lib/report";

export const dynamic = "force-dynamic";

const MAX_NUMBERS = 20;
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
    return NextResponse.json({
      configured: maytapiConfig().configured,
      message: buildManagerMessage(payload),
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

  let body: { numbers?: unknown; url?: unknown; tab?: unknown; from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const phones = normalizePhones(body.numbers);
  if (phones.invalid.length) {
    return NextResponse.json(
      { error: `Invalid numbers: ${phones.invalid.join(", ")}` },
      { status: 400 },
    );
  }
  if (!phones.ok.length) {
    return NextResponse.json({ error: "Add at least one WhatsApp number." }, { status: 400 });
  }
  if (phones.ok.length > MAX_NUMBERS) {
    return NextResponse.json({ error: `Maximum ${MAX_NUMBERS} numbers per send.` }, { status: 400 });
  }

  try {
    const payload = await loadSheetPayload({
      url: typeof body.url === "string" ? body.url : undefined,
      tab: typeof body.tab === "string" ? body.tab : "all",
      from: typeof body.from === "string" ? body.from : undefined,
      to: typeof body.to === "string" ? body.to : undefined,
    });
    const message = buildManagerMessage(payload).slice(0, MAX_MESSAGE);
    recordLoginFailure(limitKey);
    const results = await sendWhatsAppToMany(phones.ok, message);
    const sent = results.filter((item) => item.ok).length;
    return NextResponse.json({
      ok: sent === results.length,
      sent,
      failed: results.length - sent,
      message,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
