import { NextResponse } from "next/server";
import { fetchGoogleWorkbook } from "@/lib/google";
import { loadLocalPayload } from "@/lib/local";
import { extractSheetId, resolveDateRange } from "@/lib/parse";
import { workbookToPayload } from "@/lib/workbook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");
  const fresh = searchParams.get("fresh") === "1";
  const range = resolveDateRange(searchParams.get("from"), searchParams.get("to"));
  const requestedUrl = (searchParams.get("url") ?? process.env.GOOGLE_SHEET_URL ?? "").trim();

  try {
    if (requestedUrl) {
      if (!extractSheetId(requestedUrl)) {
        return NextResponse.json(
          { error: "Paste a full Google Sheet URL (docs.google.com/spreadsheets/d/...)." },
          { status: 400 },
        );
      }
      try {
        const wb = await fetchGoogleWorkbook(requestedUrl, { fresh });
        const payload = workbookToPayload(wb, {
          source: "google",
          title: wb.SheetNames.includes("SEA GOODS")
            ? "WM Load Plan"
            : wb.SheetNames.includes("Cont Tracker")
              ? "Container Tracker"
              : "Live Google Sheet",
          tab,
          from: range.from,
          to: range.to,
        });
        return NextResponse.json(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read the Google Sheet.";
        const fallback = loadLocalPayload(tab, range);
        fallback.warning = `${message} Showing the last downloaded Excel instead.`;
        return NextResponse.json(fallback);
      }
    }

    return NextResponse.json(loadLocalPayload(tab, range));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
