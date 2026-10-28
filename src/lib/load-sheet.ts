import { fetchGoogleWorkbook } from "@/lib/google";
import { loadLocalPayload } from "@/lib/local";
import { extractSheetId, resolveDateRange } from "@/lib/parse";
import type { SheetPayload } from "@/lib/types";
import { workbookToPayload } from "@/lib/workbook";

export async function loadSheetPayload(options: {
  url?: string | null;
  tab?: string | null;
  from?: string | null;
  to?: string | null;
  fresh?: boolean;
}): Promise<SheetPayload> {
  const range = resolveDateRange(options.from, options.to);
  const requestedUrl = (options.url ?? process.env.GOOGLE_SHEET_URL ?? "").trim();
  const tab = options.tab ?? null;

  if (!requestedUrl) return loadLocalPayload(tab, range);
  if (!extractSheetId(requestedUrl)) {
    throw new Error("Paste a full Google Sheet URL (docs.google.com/spreadsheets/d/...).");
  }

  try {
    const wb = await fetchGoogleWorkbook(requestedUrl, { fresh: options.fresh });
    return workbookToPayload(wb, {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the Google Sheet.";
    const fallback = loadLocalPayload(tab, range);
    fallback.warning = `${message} Showing the last downloaded Excel instead.`;
    return fallback;
  }
}
