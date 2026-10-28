import { NextResponse } from "next/server";
import { cronConfig, cronEnabled, nextCronLabel } from "@/lib/dubai";
import { loadCronState, loadRecipientNumbers, saveRecipientNumbers } from "@/lib/recipients";

export const dynamic = "force-dynamic";

function payload() {
  const { hour, minute, timeZone } = cronConfig();
  const { lastSentDate } = loadCronState();
  return {
    numbers: loadRecipientNumbers(),
    cron: {
      enabled: cronEnabled(),
      timeZone,
      hour,
      minute,
      lastSentDate,
      nextLabel: nextCronLabel(new Date(), lastSentDate),
    },
  };
}

export async function GET() {
  return NextResponse.json(payload());
}

export async function PUT(request: Request) {
  let body: { numbers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  try {
    saveRecipientNumbers(body.numbers);
    return NextResponse.json(payload());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save numbers.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
