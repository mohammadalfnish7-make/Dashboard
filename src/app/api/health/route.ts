import { NextResponse } from "next/server";
import { startDailyReportCron } from "@/lib/report-cron";

export const dynamic = "force-dynamic";

export async function GET() {
  startDailyReportCron();
  return NextResponse.json({ ok: true });
}
