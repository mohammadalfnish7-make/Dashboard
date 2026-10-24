import type { DayStat, MarkStat, NamedStat, SheetRow } from "./types";

const DATE_HEADERS = ["date", "date received", "date of submission", "дата"];
const SHIP_HEADERS = [
  "inv no",
  "shipment number",
  "ref no",
  "invoice no",
  "inv number",
];
const MARK_HEADERS = [
  "mark",
  "company name",
  "supplier name/buyer name",
  "supplier",
  "vendor",
];
const MARK_FALLBACK = ["info / инфо", "info"];
/** Load-plan Customer column: mark codes (4455, EM5565, MO001). */
const CUSTOMER_HEADERS = ["customer"];
const KG_HEADERS = ["net weight", "kgs", "wt(kg)", "gross weight"];
const CARTON_HEADERS = ["number of cartons", "carton", "crtn", "cartons"];
const STATUS_HEADERS = ["status", "stage", "comment"];

const MARK_ALIASES: Array<[RegExp, string]> = [
  [/lat+afa/i, "LATTAFA"],
  [/french\s*e?\s*avenue/i, "FRENCH AVENUE"],
  [/french\s*e?\s*fragrance/i, "FRENCH FRAGRANCE"],
  [/ard\s*al\s*zaa?faran/i, "ARD AL ZAAFARAN"],
  [/emaross|emarose/i, "EMAROSS"],
  [/jizan/i, "JIZAN"],
  [/omega/i, "OMEGA"],
  [/sterling/i, "STERLING"],
  [/wadi\s*siji/i, "WADI SIJI"],
  [/k-?aarab|karam al/i, "KARAM AL ARAB"],
  [/brand\s*luxury/i, "BRAND LUXURY"],
  [/top\s*luxury/i, "TOP LUXURY"],
  [/smell\s*attract/i, "SMELL ATTRACTIVE"],
  [/unlimited/i, "PERFUME UNLIMITED"],
  [/spare\s*parts?|spar\s*parts?/i, "SPARE PARTS"],
  [/fragrance\s*world/i, "FRAGRANCE WORLD"],
  [/\bem\s*5565\b/i, "EM5565"],
  [/\bem\s*5550\b/i, "EM5550"],
  [/\bem\s*599\b/i, "EM599"],
  [/\bem\s*601\b/i, "EM601"],
  [/\bem\s*511\b/i, "EM511"],
];

function normHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const i = headers.findIndex((h) => h === name || h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

function empty(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim();
  return text === "" || text === "-" || text === "—";
}

export function parseNumber(value: unknown): number | null {
  if (empty(value)) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value)
    .replace(/\s/g, "")
    .replace(/kg/gi, "")
    .replace(/[^\d.,-]/g, "");
  if (!raw || raw === "-" || raw === "." || raw === ",") return null;

  // 20.417.5 → 20417.5 (EU thousands + decimal)
  if ((raw.match(/\./g) || []).length > 1 && !raw.includes(",")) {
    const parts = raw.split(".");
    return toFinite(`${parts.slice(0, -1).join("")}.${parts.at(-1)}`);
  }
  // 20.832 or 23.027 → 20832 / 23027 (EU thousands, no decimal)
  if (/^\d{1,3}\.\d{3}$/.test(raw)) {
    return toFinite(raw.replace(".", ""));
  }
  if (raw.includes(",") && raw.includes(".")) {
    return toFinite(raw.replace(/,/g, ""));
  }
  if (raw.includes(",") && !raw.includes(".")) {
    return toFinite(raw.replace(",", "."));
  }
  return toFinite(raw);
}

function toFinite(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatDate(value: unknown): string {
  if (empty(value)) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    return formatDate(new Date(utc));
  }
  return String(value).trim();
}

export function isDelivered(status: string): boolean {
  const t = status.toLowerCase();
  return t.includes("deliver") || t.includes("доставле");
}

function aliasMark(value: unknown): string | null {
  if (empty(value)) return null;
  const text = String(value).replace(/🚛/g, "").trim();
  for (const [pattern, name] of MARK_ALIASES) {
    if (pattern.test(text)) return name;
  }
  return null;
}

export function normalizeMark(value: unknown): string | null {
  const aliased = aliasMark(value);
  if (aliased) return aliased;
  if (empty(value)) return null;
  const cleaned = String(value).replace(/🚛/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (
    cleaned.length <= 28 &&
    /[A-Z]/.test(cleaned) &&
    !/^(DONE|YES|NO|OK|UNMARKED)$/.test(cleaned) &&
    !/^(PERFUME|DEODORANT|COSMETIC|SOAP|GILLETTE)\b/.test(cleaned)
  ) {
    return cleaned;
  }
  return null;
}

function pickShop(primary: unknown, fallback: unknown, shipment: string): string | null {
  return (
    normalizeMark(primary) ||
    aliasMark(fallback) ||
    aliasMark(shipment) ||
    null
  );
}

/** Pure digit marks get a TL prefix: 5544 → TL-5544. EM/MO codes stay as-is. */
function withTlPrefix(code: string): string {
  return /^\d+$/.test(code) ? `TL-${code}` : code;
}

/** Customer-column mark codes: digits, EM*, MO*, and Excel date-coerced numbers. */
export function formatMarkCode(value: unknown): string | null {
  if (empty(value)) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    // Excel often turns numeric marks like 4017 into bogus dates with that year.
    if (year > 2100 && year < 100000) return withTlPrefix(String(year));
    const serial = Math.round((value.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
    if (serial > 0 && serial < 100000) return withTlPrefix(String(serial));
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return withTlPrefix(String(Math.trunc(value)));
  }
  let text = String(value).replace(/🚛/g, "").trim();
  if (!text || /^\.+$/.test(text)) return null;
  const dateLike = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateLike) {
    const year = Number(dateLike[1]);
    if (year > 2100 && year < 100000) return withTlPrefix(String(year));
  }
  text = text.replace(/\s+/g, " ").toUpperCase();
  text = text.replace(/\(CHANGED\)/gi, "").trim();
  if (!/[A-Z0-9]/.test(text)) return null;
  return withTlPrefix(text);
}

export function formatMarkLabel(shop: string | null, code: string | null): string {
  if (shop && code) return `${code} · ${shop}`;
  return code || shop || "UNMARKED";
}

export function parseSheetMatrix(matrix: unknown[][]): SheetRow[] {
  if (!matrix.length) return [];
  const headers = (matrix[0] ?? []).map(normHeader);
  const dateCol = findCol(headers, DATE_HEADERS);
  const shipCol = findCol(headers, SHIP_HEADERS);
  const markCol = findCol(headers, MARK_HEADERS);
  const markFb = findCol(headers, MARK_FALLBACK);
  const customerCol = findCol(headers, CUSTOMER_HEADERS);
  const kgCol = findCol(headers, KG_HEADERS);
  const ctnCol = findCol(headers, CARTON_HEADERS);
  const statusCol = findCol(headers, STATUS_HEADERS);

  const rows: SheetRow[] = [];
  for (const raw of matrix.slice(1)) {
    const cells = raw ?? [];
    const shipment = shipCol >= 0 && !empty(cells[shipCol])
      ? String(cells[shipCol]).replace(/🚛/g, "").trim()
      : "";
    const date = dateCol >= 0 ? formatDate(cells[dateCol]) : "";
    const status = statusCol >= 0 && !empty(cells[statusCol])
      ? String(cells[statusCol]).trim()
      : "";
    const kg = kgCol >= 0 ? parseNumber(cells[kgCol]) : null;
    const cartons = ctnCol >= 0 ? parseNumber(cells[ctnCol]) : null;
    const primary = markCol >= 0 ? cells[markCol] : null;
    const fallback = markFb >= 0 ? cells[markFb] : null;
    const shop = pickShop(primary, fallback, shipment);
    const markCode = customerCol >= 0 ? formatMarkCode(cells[customerCol]) : null;
    if (!shipment && !date && kg == null && !status) continue;
    rows.push({
      date,
      shipment,
      shop: shop ?? undefined,
      markCode: markCode ?? undefined,
      mark: formatMarkLabel(shop, markCode),
      kg,
      cartons,
      status,
      delivered: isDelivered(status),
    });
  }
  return rows;
}

export function lastRows(rows: SheetRow[], limit: number): SheetRow[] {
  return rows.slice(-limit);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocal(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function defaultDateRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function clampToToday(to: string): string {
  const today = isoDate(new Date());
  return to > today ? today : to;
}

export function monthRange(anchor: Date = new Date()): { from: string; to: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: isoDate(start), to: clampToToday(isoDate(last)) };
}

export function weekRange(anchor: Date = new Date()): { from: string; to: string } {
  const date = new Date(anchor);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { from: isoDate(monday), to: clampToToday(isoDate(saturday)) };
}

export function shiftMonth(from: string, delta: number): { from: string; to: string } {
  const date = parseLocal(from);
  const next = monthRange(new Date(date.getFullYear(), date.getMonth() + delta, 1));
  if (delta > 0) {
    const current = monthRange();
    if (next.from > current.from) return current;
  }
  return next;
}

export function shiftWeek(from: string, delta: number): { from: string; to: string } {
  const date = parseLocal(from);
  date.setDate(date.getDate() + delta * 7);
  const next = weekRange(date);
  if (delta > 0) {
    const current = weekRange();
    if (next.from > current.from) return current;
  }
  return next;
}

/** True when Next would leave the current week/month that contains today. */
export function canShiftNext(period: "month" | "week", from: string): boolean {
  const current = period === "week" ? weekRange() : monthRange();
  return from < current.from;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fillWorkingDays(
  from: string,
  to: string,
  days: Array<{ key: string; label: string; kg: number; rows: number; deliveries: number }>,
  grain: "month" | "week",
): Array<{ key: string; label: string; kg: number; rows: number; deliveries: number }> {
  const map = new Map(days.map((item) => [item.key, item]));
  const filled: Array<{ key: string; label: string; kg: number; rows: number; deliveries: number }> = [];
  const cursor = parseLocal(from);
  const today = isoDate(new Date());
  const end = parseLocal(to < today ? to : today);
  while (cursor <= end) {
    const weekday = cursor.getDay();
    if (grain !== "week" || weekday !== 0) {
      const key = isoDate(cursor);
      const found = map.get(key);
      filled.push({
        key,
        label:
          grain === "week"
            ? `${WEEKDAYS[weekday]} ${cursor.getDate()}`
            : `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`,
        kg: found?.kg ?? 0,
        rows: found?.rows ?? 0,
        deliveries: found?.deliveries ?? 0,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return filled;
}

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function resolveDateRange(fromValue?: string | null, toValue?: string | null): { from: string; to: string } {
  const fallback = defaultDateRange();
  let from = parseIsoDate(fromValue) ?? fallback.from;
  let to = parseIsoDate(toValue) ?? fallback.to;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export function formatRangeLabel(from: string, to: string): string {
  const start = prettyIso(from);
  const end = prettyIso(to);
  if (!start || !end) return `${from} – ${to}`;
  if (start.year === end.year) return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
  return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
}

function prettyIso(value: string): { day: number; month: string; year: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { day: Number(match[3]), month: MONTHS[month - 1], year: Number(match[1]) };
}

export function filterRowsByDate(rows: SheetRow[], from: string, to: string): SheetRow[] {
  return rows.filter((row) => {
    const key = dateParts(row.date)?.key;
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    return key >= from && key <= to;
  });
}

function dateParts(value: string): { key: string; label: string } | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value ? { key: value, label: value } : null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12) return { key: value, label: value };
  return {
    key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: `${day} ${MONTHS[month - 1]}`,
  };
}

export function dateKey(value: string): string | null {
  const parts = dateParts(value);
  if (!parts || !/^\d{4}-\d{2}-\d{2}$/.test(parts.key)) return null;
  return parts.key;
}

export function isWarehouse(row: SheetRow): boolean {
  if (row.delivered) return false;
  const text = row.status.toLowerCase();
  return text.includes("wh") || text.includes("warehouse");
}

function statusBucket(row: SheetRow): string {
  if (row.delivered) return "Delivered";
  const text = row.status.toLowerCase();
  if (text.includes("load")) return "Loading";
  if (text.includes("wh") || text.includes("warehouse")) return "Warehouse";
  if (/stage\s*1|этап\s*1/.test(text)) return "Stage 1";
  if (/stage\s*2|этап\s*2/.test(text)) return "Stage 2";
  if (/stage\s*3|этап\s*3/.test(text)) return "Stage 3";
  if (/stage\s*4|этап\s*4|iran|иране/.test(text)) return "In transit";
  if (/stage\s*5|этап\s*5|рф|рб/.test(text)) return "In transit";
  if (!text) return "No status";
  return "Open";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function topNamed(items: NamedStat[], limit: number): NamedStat[] {
  const sorted = [...items].sort((a, b) => b.kg - a.kg || b.rows - a.rows);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  head.push({
    label: "Other",
    kg: round1(rest.reduce((sum, item) => sum + item.kg, 0)),
    rows: rest.reduce((sum, item) => sum + item.rows, 0),
  });
  return head;
}

export function buildMetrics(rows: SheetRow[]) {
  const shipments = new Set(rows.map((r) => r.shipment).filter(Boolean));
  const byMark = new Map<
    string,
    { kg: number; rows: number; deliveries: number; ships: Set<string> }
  >();
  const dayMap = new Map<string, DayStat>();
  const statusMap = new Map<string, NamedStat>();
  const shipMap = new Map<string, NamedStat>();
  const laneMap = new Map<string, NamedStat>();

  for (const row of rows) {
    const current = byMark.get(row.mark) ?? {
      kg: 0,
      rows: 0,
      deliveries: 0,
      ships: new Set<string>(),
    };
    current.rows += 1;
    current.kg += row.kg ?? 0;
    if (row.delivered) current.deliveries += 1;
    if (row.shipment) current.ships.add(row.shipment);
    byMark.set(row.mark, current);

    const parts = dateParts(row.date);
    if (parts) {
      const day = dayMap.get(parts.key) ?? { key: parts.key, label: parts.label, kg: 0, rows: 0, deliveries: 0 };
      day.kg += row.kg ?? 0;
      day.rows += 1;
      if (row.delivered) day.deliveries += 1;
      dayMap.set(parts.key, day);
    }

    const bucket = statusBucket(row);
    const status = statusMap.get(bucket) ?? { label: bucket, kg: 0, rows: 0 };
    status.kg += row.kg ?? 0;
    status.rows += 1;
    statusMap.set(bucket, status);

    if (row.shipment) {
      const ship = shipMap.get(row.shipment) ?? { label: row.shipment, kg: 0, rows: 0 };
      ship.kg += row.kg ?? 0;
      ship.rows += 1;
      shipMap.set(row.shipment, ship);
    }

    const laneName = row.lane || "Sheet";
    const lane = laneMap.get(laneName) ?? { label: laneName, kg: 0, rows: 0 };
    lane.kg += row.kg ?? 0;
    lane.rows += 1;
    laneMap.set(laneName, lane);
  }

  const marks: MarkStat[] = [...byMark.entries()]
    .map(([mark, value]) => ({
      mark,
      kg: round1(value.kg),
      rows: value.rows,
      deliveries: value.deliveries,
      shipments: value.ships.size,
    }))
    .sort((a, b) => b.kg - a.kg || b.rows - a.rows);

  const marksTop = topNamed(
    marks.map((item) => ({ label: item.mark, kg: item.kg, rows: item.rows })),
    8,
  ).map((item) => {
    if (item.label === "Other") {
      return { mark: "Other", kg: item.kg, rows: item.rows, deliveries: 0, shipments: 0 };
    }
    return marks.find((mark) => mark.mark === item.label) ?? {
      mark: item.label,
      kg: item.kg,
      rows: item.rows,
      deliveries: 0,
      shipments: 0,
    };
  });

  const kgValues = rows.map((r) => r.kg).filter((n): n is number => n != null);
  const deliveries = rows.filter((r) => r.delivered).length;

  return {
    deliveries,
    open: rows.length - deliveries,
    totalKg: round1(kgValues.reduce((sum, n) => sum + n, 0)),
    kgRows: kgValues.length,
    shipments: shipments.size,
    marks,
    marksTop,
    byDay: [...dayMap.values()]
      .map((item) => ({ ...item, kg: round1(item.kg) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    byStatus: [...statusMap.values()]
      .map((item) => ({ ...item, kg: round1(item.kg) }))
      .sort((a, b) => b.rows - a.rows),
    byShipment: topNamed(
      [...shipMap.values()].map((item) => ({ ...item, kg: round1(item.kg) })),
      8,
    ),
    byLane: [...laneMap.values()]
      .map((item) => ({ ...item, kg: round1(item.kg) }))
      .sort((a, b) => b.kg - a.kg),
    warehouse: buildWarehouse(rows),
  };
}

export function buildHeadline(
  tab: string,
  usedRows: number,
  metrics: ReturnType<typeof buildMetrics>,
  rangeLabel: string,
): string {
  if (!usedRows) return `No ${tab} lines dated ${rangeLabel}`;
  const top = metrics.marksTop[0];
  const kg = formatBriefKg(metrics.totalKg);
  if (metrics.deliveries === 0) {
    return `${kg} received ${rangeLabel} — none delivered yet`;
  }
  const pct = usedRows ? Math.round((metrics.deliveries / usedRows) * 100) : 0;
  const lead = top ? `. ${top.mark} leads at ${formatBriefKg(top.kg)}` : "";
  return `${metrics.deliveries} of ${usedRows} ${tab} lines delivered ${rangeLabel} (${pct}%). ${kg} total${lead}`;
}

function formatBriefKg(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} t`;
  return `${Math.round(value)} kg`;
}

export function buildWarehouse(rows: SheetRow[]) {
  const stock = rows.filter(isWarehouse);
  const byMark = new Map<string, NamedStat>();
  const byLane = new Map<string, NamedStat>();
  for (const row of stock) {
    const current = byMark.get(row.mark) ?? { label: row.mark, kg: 0, rows: 0 };
    current.kg += row.kg ?? 0;
    current.rows += 1;
    byMark.set(row.mark, current);
    const laneName = row.lane || "Sheet";
    const lane = byLane.get(laneName) ?? { label: laneName, kg: 0, rows: 0 };
    lane.kg += row.kg ?? 0;
    lane.rows += 1;
    byLane.set(laneName, lane);
  }
  return {
    kg: round1(stock.reduce((sum, row) => sum + (row.kg ?? 0), 0)),
    lines: stock.length,
    cartons: round1(stock.reduce((sum, row) => sum + (row.cartons ?? 0), 0)),
    markCount: byMark.size,
    marks: topNamed(
      [...byMark.values()].map((item) => ({ ...item, kg: round1(item.kg) })),
      8,
    ),
    byLane: [...byLane.values()]
      .map((item) => ({ ...item, kg: round1(item.kg) }))
      .sort((a, b) => b.kg - a.kg),
  };
}

export function extractSheetId(url: string): string | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}
