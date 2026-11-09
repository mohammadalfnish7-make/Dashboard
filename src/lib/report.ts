import { parseLang, type ReportLang } from "@/lib/i18n";
import type { SheetPayload } from "@/lib/types";

const COPY = {
  ar: {
    title: "كرم العرب — تقرير العمليات",
    received: "الوارد",
    lines: "سطر",
    deliveries: "تسليم",
    sea: "بحري",
    air: "جوي",
    warehouse: "في المستودع (يحتاج إجراء)",
    cartons: "كرتون",
    topWarehouse: "الأكبر في المستودع",
    empty: "لا توجد أسطر في هذه الفترة.",
    emptyHint: "آخر يوم في الشيت قد يكون أقدم من الفترة المختارة.",
    ton: "طن",
    kg: "كجم",
  },
  en: {
    title: "KARAM AL ARAB — operations report",
    received: "Received",
    lines: "lines",
    deliveries: "deliveries",
    sea: "Sea",
    air: "Air",
    warehouse: "In warehouse (needs action)",
    cartons: "cartons",
    topWarehouse: "Biggest in warehouse",
    empty: "No lines in this period.",
    emptyHint: "The last day in the sheet may be older than this date range.",
    ton: "t",
    kg: "kg",
  },
  ru: {
    title: "КАРАМ АЛЬ АРАБ — операционный отчёт",
    received: "Поступило",
    lines: "строк",
    deliveries: "доставок",
    sea: "Море",
    air: "Авиа",
    warehouse: "На складе (нужно действие)",
    cartons: "коробок",
    topWarehouse: "Крупнейшие на складе",
    empty: "Нет строк за этот период.",
    emptyHint: "Последний день в таблице может быть раньше выбранного периода.",
    ton: "т",
    kg: "кг",
  },
} as const;

function formatKg(value: number, lang: ReportLang): string {
  const t = COPY[lang];
  if (value >= 1000) return `${(value / 1000).toFixed(1)} ${t.ton}`;
  return `${Math.round(value)} ${t.kg}`;
}

/** Sheet dates are day/month/year. Same month → (1->9 /11/ 2026). */
export function formatReportRange(from: string, to: string): string {
  const start = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return `${from} – ${to}`;
  const startDay = Number(start[3]);
  const endDay = Number(end[3]);
  const startMonth = Number(start[2]);
  const endMonth = Number(end[2]);
  const startYear = start[1];
  const endYear = end[1];
  if (startYear === endYear && startMonth === endMonth) {
    return `(${startDay}->${endDay} /${startMonth}/ ${startYear})`;
  }
  if (startYear === endYear) {
    return `(${startDay}/${startMonth} -> ${endDay}/${endMonth}/ ${endYear})`;
  }
  return `(${startDay}/${startMonth}/${startYear} -> ${endDay}/${endMonth}/${endYear})`;
}

function laneName(label: string, lang: ReportLang): string {
  const t = COPY[lang];
  if (/air/i.test(label)) return t.air;
  if (/sea/i.test(label)) return t.sea;
  return label;
}

export function buildManagerMessage(payload: SheetPayload, language: ReportLang | string = "ar"): string {
  const lang = parseLang(language);
  const t = COPY[lang];
  if (!payload.usedRows) {
    return [t.title, formatReportRange(payload.from, payload.to), "", t.empty, payload.metrics.byDay.length ? "" : t.emptyHint]
      .filter(Boolean)
      .join("\n");
  }

  const m = payload.metrics;
  const wh = m.warehouse;
  const lines: string[] = [t.title, formatReportRange(payload.from, payload.to), ""];
  lines.push(
    `${t.received}: ${formatKg(m.totalKg, lang)}  ·  ${payload.usedRows} ${t.lines}  ·  ${m.deliveries} ${t.deliveries}`,
  );
  if (m.byLane.length) {
    lines.push(m.byLane.map((lane) => `${laneName(lane.label, lang)} ${formatKg(lane.kg, lang)}`).join("  |  "));
  }

  if (wh.lines) {
    lines.push("");
    lines.push(t.warehouse);
    lines.push(`${formatKg(wh.kg, lang)}  ·  ${wh.lines} ${t.lines}  ·  ${Math.round(wh.cartons)} ${t.cartons}`);
    if (wh.byLane.length) {
      lines.push(wh.byLane.map((lane) => `${laneName(lane.label, lang)} ${formatKg(lane.kg, lang)}`).join("  |  "));
    }
    const topWh = wh.marks.filter((item) => item.label !== "Other").slice(0, 3);
    if (topWh.length) {
      lines.push(`${t.topWarehouse}:`);
      for (const item of topWh) lines.push(`• ${item.label} — ${formatKg(item.kg, lang)}`);
    }
  }

  return lines.join("\n");
}
