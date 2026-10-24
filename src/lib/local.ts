import fs from "node:fs";
import path from "node:path";
import type { SheetPayload } from "./types";
import { listTabs, pickTab, readWorkbook, workbookToPayload } from "./workbook";

function titleFromFile(file: string): string {
  if (/contanier|container|tracker/i.test(file)) return "Karam Al Arab Container Tracker";
  if (/load/i.test(file)) return "WM New Load Plan";
  return file.replace(/\.xlsx$/i, "");
}

export function loadLocalPayload(
  tab: string | null,
  range: { from: string; to: string },
): SheetPayload {
  const dataDir = path.join(process.cwd(), "data");
  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.toLowerCase().endsWith(".xlsx") && !file.startsWith("~$"));
  const workbooks = files.map((file) => {
    const wb = readWorkbook(fs.readFileSync(path.join(dataDir, file)));
    return { title: titleFromFile(file), file, wb, tabs: listTabs(wb) };
  });

  if (!workbooks.length) {
    throw new Error("No Excel files found in /data.");
  }

  const allTabs = workbooks.flatMap((item) => item.tabs);
  const wantAll = !tab || tab === "all";
  const owner =
    workbooks.find((item) => item.tabs.some((name) => /^(sea goods|air shipment)$/i.test(name))) ??
    workbooks.find((item) => item.tabs.includes(pickTab(allTabs, tab))) ??
    workbooks[0];

  const payload = workbookToPayload(owner.wb, {
    source: "local",
    title: owner.title,
    tab: wantAll ? "all" : tab,
    from: range.from,
    to: range.to,
    warning:
      "Live Google Sheet is not connected yet. Showing the downloaded Excel for this date range. Paste the sheet link above and share it as Anyone with the link → Viewer.",
  });
  payload.tabs = [...new Set(allTabs)];
  return payload;
}
