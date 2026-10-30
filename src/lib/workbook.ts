import * as XLSX from "xlsx";
import {
  buildHeadline,
  buildMetrics,
  buildWarehouse,
  filterRowsByDate,
  formatRangeLabel,
  isWarehouse,
  parseSheetMatrix,
} from "./parse";
import type { SheetPayload, SheetRow } from "./types";

const PREFERRED_TABS = [
  "Cont Tracker",
  "SEA GOODS",
  "AIR SHIPMENT",
  "Air Shipment Tracker",
  "EXIT TRACKER",
];

const SKIP_TABS = new Set([
  "api credentials",
  "form responses 1",
  "flight schedule",
]);

export function listTabs(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames.filter((name) => !SKIP_TABS.has(name.toLowerCase()));
}

export function pickTab(tabs: string[], requested?: string | null): string {
  if (requested === "all") return "all";
  if (requested && tabs.includes(requested)) return requested;
  for (const name of PREFERRED_TABS) {
    if (tabs.includes(name)) return name;
  }
  return tabs[0] ?? "";
}

function isGoodsTab(name: string): boolean {
  return /^(sea goods|air shipment)$/i.test(name);
}

const goodsRowsCache = new WeakMap<XLSX.WorkBook, SheetRow[]>();

function goodsRowsFrom(wb: XLSX.WorkBook, tabs: string[]) {
  const cached = goodsRowsCache.get(wb);
  if (cached) return cached;
  const rows = tabs.filter(isGoodsTab).flatMap((name) => {
    const goods = wb.Sheets[name];
    if (!goods) return [];
    return parseSheetMatrix(
      XLSX.utils.sheet_to_json(goods, { header: 1, raw: true, defval: null }) as unknown[][],
    ).map((row) => ({ ...row, lane: name }));
  });
  goodsRowsCache.set(wb, rows);
  return rows;
}

export function workbookToPayload(
  wb: XLSX.WorkBook,
  options: {
    source: SheetPayload["source"];
    title: string;
    tab?: string | null;
    from: string;
    to: string;
    warning?: string;
  },
): SheetPayload {
  const { from, to } = options;
  const rangeLabel = formatRangeLabel(from, to);
  const tabs = listTabs(wb);
  const goodsRows = goodsRowsFrom(wb, tabs);
  const requested = options.tab?.trim() || "all";
  const matchedGoods = tabs.find((name) => name.toLowerCase() === requested.toLowerCase() && isGoodsTab(name));
  const tab = goodsRows.length
    ? requested === "all" || isGoodsTab(requested)
      ? matchedGoods ?? "all"
      : pickTab(tabs, requested)
    : pickTab(tabs, requested === "all" ? null : requested);

  const sourceAll =
    goodsRows.length && (tab === "all" || isGoodsTab(tab))
      ? tab === "all"
        ? goodsRows
        : goodsRows.filter((row) => row.lane === tab)
      : parseSheetMatrix(
          tab && wb.Sheets[tab]
            ? (XLSX.utils.sheet_to_json(wb.Sheets[tab], { header: 1, raw: true, defval: null }) as unknown[][])
            : [],
        );
  const rows = filterRowsByDate(sourceAll, from, to);
  const metrics = buildMetrics(rows);
  const warehouseRows = rows.filter(isWarehouse);
  metrics.warehouse = buildWarehouse(rows);
  const warehouse = metrics.warehouse;
  const laneName = tab === "all" ? "SEA + AIR" : tab;
  const headline = warehouse.lines
    ? `${warehouse.kg >= 1000 ? `${(warehouse.kg / 1000).toFixed(1)} t` : `${Math.round(warehouse.kg)} kg`} in warehouse · ${warehouse.lines} lines · ${rangeLabel}`
    : buildHeadline(laneName, rows.length, metrics, rangeLabel);

  return {
    source: options.source,
    title: options.title,
    tab,
    tabs,
    fetchedAt: new Date().toISOString(),
    from,
    to,
    rangeLabel,
    totalRows: sourceAll.length,
    usedRows: rows.length,
    warning: options.warning,
    headline,
    metrics,
    rows,
    warehouseRows,
  };
}

export function readWorkbook(buffer: Buffer | ArrayBuffer): XLSX.WorkBook {
  // Keep date cells as Excel serials. cellDates shifts them by a timezone
  // and hides the month/day swap corrected in formatDate.
  return XLSX.read(buffer, { type: "buffer", cellDates: false });
}
