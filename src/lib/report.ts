import { parseLang, type ReportLang } from "@/lib/i18n";
import type { SheetPayload } from "@/lib/types";

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
} as const;

const COPY = {
  ar: {
    title: "كرم العرب — تقرير العمليات",
    received: "الوارد",
    lines: "سطر",
    shipments: "شحنة",
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
    shipments: "shipments",
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
    shipments: "отгрузок",
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

function prettyIso(iso: string, lang: ReportLang): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  return `${Number(match[3])} ${MONTHS[lang][month - 1]} ${match[1]}`;
}

function formatRange(from: string, to: string, lang: ReportLang): string {
  const start = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return `${from} – ${to}`;
  const startMonth = Number(start[2]);
  const endMonth = Number(end[2]);
  if (start[1] === end[1] && startMonth === endMonth) {
    return `${Number(start[3])}–${Number(end[3])} ${MONTHS[lang][endMonth - 1]} ${end[1]}`;
  }
  if (start[1] === end[1]) {
    return `${Number(start[3])} ${MONTHS[lang][startMonth - 1]} – ${Number(end[3])} ${MONTHS[lang][endMonth - 1]} ${end[1]}`;
  }
  return `${prettyIso(from, lang)} – ${prettyIso(to, lang)}`;
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
    return [t.title, formatRange(payload.from, payload.to, lang), "", t.empty, payload.metrics.byDay.length ? "" : t.emptyHint]
      .filter(Boolean)
      .join("\n");
  }

  const m = payload.metrics;
  const wh = m.warehouse;
  const lines: string[] = [t.title, formatRange(payload.from, payload.to, lang), ""];
  lines.push(`${t.received}: ${formatKg(m.totalKg, lang)}  ·  ${payload.usedRows} ${t.lines}  ·  ${m.shipments} ${t.shipments}`);
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
