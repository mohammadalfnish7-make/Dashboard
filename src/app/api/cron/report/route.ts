import { NextResponse } from "next/server";
import { sendDailyReport } from "@/lib/report-cron";

export const dynamic = "force-dynamic";

function cronSecretOk(request: Request) {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-cron-secret")?.trim() ?? "";
  return bearer === expected || alt === expected;
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  try {
    const result = await sendDailyReport({ force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron send failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
