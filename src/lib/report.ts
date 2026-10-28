import { parseLang, type ReportLang } from "@/lib/i18n";
import type { SheetPayload, SheetRow } from "@/lib/types";

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
} as const;

const COPY = {
  ar: {
    title: "كرام العرب — تقرير العمليات",
    lastEntry: "آخر إدخال في الشيت",
    received: "الوارد",
    lines: "سطر",
    shipments: "شحنة",
    sea: "بحري",
    air: "جوي",
    delivered: "تم التسليم",
    open: "لا يزال مفتوحاً",
    warehouse: "في المستودع (يحتاج إجراء)",
    cartons: "كرتون",
    topWarehouse: "الأكبر في المستودع",
    loading: "قيد التحميل",
    noShipment: "بدون رقم شحنة",
    inTransit: "في الطريق (ليس مشكلة مستودع)",
    stage3: "مرحلة 3",
    note: (date: string, kg: string) =>
      `ملاحظة: لا يوجد تسليم مسجّل اعتباراً من ${date} (${kg} وردت منذ ذلك التاريخ). قد يكون تأخيراً بحرياً طبيعياً، أو الشيت غير محدّث.`,
    need: "المطلوب",
    askLoad: (names: string) => `تأكيد موعد انتهاء تحميل ${names}`,
    askWh: (kg: string) => `تفريغ / حجز ${kg} في المستودع`,
    askSheet: "التأكد إن كانت تسليمات لاحقة حصلت ولم تُكتب في الشيت",
    empty: "لا توجد أسطر في هذه الفترة.",
    emptyHint: "آخر يوم في الشيت قد يكون أقدم من الفترة المختارة.",
    currentLoad: "الحاوية الحالية",
    ton: "طن",
    kg: "كجم",
    listJoin: "، ",
    pct: "٪",
  },
  en: {
    title: "KARAM AL ARAB — operations report",
    lastEntry: "Last sheet entry",
    received: "Received",
    lines: "lines",
    shipments: "shipments",
    sea: "Sea",
    air: "Air",
    delivered: "Delivered",
    open: "Still open",
    warehouse: "In warehouse (needs action)",
    cartons: "cartons",
    topWarehouse: "Biggest in warehouse",
    loading: "Loading now",
    noShipment: "no shipment no.",
    inTransit: "On the way (not a warehouse problem)",
    stage3: "Stage 3",
    note: (date: string, kg: string) =>
      `Note: no delivery recorded from ${date} (${kg} received since then). This may be normal sea transit, or the sheet is not updated.`,
    need: "Need from you",
    askLoad: (names: string) => `Confirm loading finish date for ${names}`,
    askWh: (kg: string) => `Clear / book ${kg} in the warehouse`,
    askSheet: "Confirm whether later deliveries happened but were not written in the sheet",
    empty: "No lines in this period.",
    emptyHint: "The last day in the sheet may be older than this date range.",
    currentLoad: "the current container",
    ton: "t",
    kg: "kg",
    listJoin: ", ",
    pct: "%",
  },
  ru: {
    title: "КАРАМ АЛЬ АРАБ — операционный отчёт",
    lastEntry: "Последняя запись в таблице",
    received: "Поступило",
    lines: "строк",
    shipments: "отгрузок",
    sea: "Море",
    air: "Авиа",
    delivered: "Доставлено",
    open: "Ещё открыто",
    warehouse: "На складе (нужно действие)",
    cartons: "коробок",
    topWarehouse: "Крупнейшие на складе",
    loading: "Идёт погрузка",
    noShipment: "без номера отгрузки",
    inTransit: "В пути (не склад)",
    stage3: "Этап 3",
    note: (date: string, kg: string) =>
      `Примечание: нет зафиксированной доставки с ${date} (с тех пор поступило ${kg}). Это может быть обычная морская задержка или таблица не обновлена.`,
    need: "Нужно от вас",
    askLoad: (names: string) => `Подтвердить дату окончания погрузки ${names}`,
    askWh: (kg: string) => `Разгрузить / забронировать ${kg} на складе`,
    askSheet: "Проверить, были ли поздние доставки, которые не записаны в таблице",
    empty: "Нет строк за этот период.",
    emptyHint: "Последний день в таблице может быть раньше выбранного периода.",
    currentLoad: "текущего контейнера",
    ton: "т",
    kg: "кг",
    listJoin: ", ",
    pct: "%",
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

function groupKg(rows: SheetRow[], key: (row: SheetRow) => string) {
  const map = new Map<string, { kg: number; rows: number }>();
  for (const row of rows) {
    const name = key(row) || "—";
    const current = map.get(name) ?? { kg: 0, rows: 0 };
    current.kg += row.kg ?? 0;
    current.rows += 1;
    map.set(name, current);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].kg - a[1].kg)
    .filter(([, value]) => value.kg > 0)
    .map(([label, value]) => ({ label, kg: value.kg, rows: value.rows }));
}

function lastSheetDay(payload: SheetPayload): string | null {
  return payload.metrics.byDay.at(-1)?.key ?? null;
}

function deliveryStall(payload: SheetPayload): { from: string; kg: number; rows: number } | null {
  const days = payload.metrics.byDay;
  if (!days.length) return null;
  let lastDelivered = -1;
  for (let i = 0; i < days.length; i += 1) {
    if (days[i].deliveries > 0) lastDelivered = i;
  }
  const tail = days.slice(lastDelivered + 1).filter((day) => day.rows > 0);
  if (!tail.length) return null;
  return {
    from: tail[0].key,
    kg: tail.reduce((sum, day) => sum + day.kg, 0),
    rows: tail.reduce((sum, day) => sum + day.rows, 0),
  };
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
  const lastDay = lastSheetDay(payload);
  const lines: string[] = [t.title, formatRange(payload.from, payload.to, lang)];
  if (lastDay && lastDay < payload.to) {
    lines.push(`${t.lastEntry}: ${prettyIso(lastDay, lang)}`);
  }
  lines.push("");
  lines.push(`${t.received}: ${formatKg(m.totalKg, lang)}  ·  ${payload.usedRows} ${t.lines}  ·  ${m.shipments} ${t.shipments}`);
  if (m.byLane.length) {
    lines.push(m.byLane.map((lane) => `${laneName(lane.label, lang)} ${formatKg(lane.kg, lang)}`).join("  |  "));
  }
  lines.push("");
  const pct = payload.usedRows ? Math.round((m.deliveries / payload.usedRows) * 100) : 0;
  lines.push(`${t.delivered}: ${m.deliveries} ${t.lines} (${pct}${t.pct})`);
  lines.push(`${t.open}: ${m.open} ${t.lines}`);

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

  const loading = payload.rows.filter((row) => /load/i.test(row.status));
  if (loading.length) {
    const ships = groupKg(loading, (row) => row.shipment || t.noShipment).slice(0, 4);
    lines.push("");
    lines.push(t.loading);
    for (const ship of ships) {
      lines.push(`• ${ship.label} — ${formatKg(ship.kg, lang)} / ${ship.rows} ${t.lines}`);
    }
  }

  const stage3 = payload.rows.filter((row) => /stage\s*3|этап\s*3/i.test(row.status));
  if (stage3.length) {
    const ships = groupKg(stage3, (row) => row.shipment || t.noShipment).slice(0, 3);
    const kg = stage3.reduce((sum, row) => sum + (row.kg ?? 0), 0);
    lines.push("");
    lines.push(t.inTransit);
    lines.push(`${t.stage3}: ${formatKg(kg, lang)} / ${stage3.length} ${t.lines}`);
    for (const ship of ships) lines.push(`• ${ship.label} — ${formatKg(ship.kg, lang)}`);
  }

  const stall = deliveryStall(payload);
  if (stall) {
    lines.push("");
    lines.push(t.note(prettyIso(stall.from, lang), formatKg(stall.kg, lang)));
  }

  const asks: string[] = [];
  if (loading.length) {
    const names = [...new Set(loading.map((row) => row.shipment).filter(Boolean))];
    asks.push(t.askLoad(names.slice(0, 3).join(t.listJoin) || t.currentLoad));
  }
  if (wh.lines) asks.push(t.askWh(formatKg(wh.kg, lang)));
  if (stall) asks.push(t.askSheet);
  if (asks.length) {
    lines.push("");
    lines.push(`${t.need}:`);
    asks.forEach((ask, index) => lines.push(`${index + 1}) ${ask}`));
  }

  return lines.join("\n");
}
