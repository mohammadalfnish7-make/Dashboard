import type * as XLSX from "xlsx";
import { extractSheetId } from "./parse";
import { readWorkbook } from "./workbook";

const CACHE_MS = 60_000;
const workbookCache = new Map<string, { wb: XLSX.WorkBook; at: number }>();

export function googleExportUrl(sheetUrl: string): string {
  const id = extractSheetId(sheetUrl);
  if (!id) {
    throw new Error("That is not a Google Sheet link.");
  }
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

export async function fetchGoogleWorkbook(sheetUrl: string, options?: { fresh?: boolean }) {
  const id = extractSheetId(sheetUrl);
  if (!id) {
    throw new Error("That is not a Google Sheet link.");
  }
  const cached = workbookCache.get(id);
  if (!options?.fresh && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.wb;
  }

  const exportUrl = googleExportUrl(sheetUrl);
  const response = await fetch(exportUrl, {
    redirect: "follow",
    cache: "no-store",
    headers: { "User-Agent": "KaramOpsDashboard/1.0" },
    signal: AbortSignal.timeout(12000),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(
      `Google returned ${response.status}. Share the sheet: Anyone with the link → Viewer.`,
    );
  }
  if (contentType.includes("text/html")) {
    throw new Error(
      "Google asked for a login. Open the sheet → Share → Anyone with the link → Viewer, then try again.",
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error("Google returned an empty file.");
  }
  const wb = readWorkbook(buffer);
  workbookCache.set(id, { wb, at: Date.now() });
  return wb;
}
