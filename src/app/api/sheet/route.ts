import { NextResponse } from "next/server";
import { loadSheetPayload } from "@/lib/load-sheet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const payload = await loadSheetPayload({
      url: searchParams.get("url"),
      tab: searchParams.get("tab"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      fresh: searchParams.get("fresh") === "1",
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sheet.";
    const status = /google sheet url/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
