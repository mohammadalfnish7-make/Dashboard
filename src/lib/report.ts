import type { SheetPayload, SheetRow } from "@/lib/types";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function formatKgAr(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} طن`;
  return `${Math.round(value)} كجم`;
}

function prettyIsoAr(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  return `${Number(match[3])} ${MONTHS_AR[month - 1]} ${match[1]}`;
}

export function formatRangeAr(from: string, to: string): string {
  const start = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return `${from} – ${to}`;
  const startMonth = Number(start[2]);
  const endMonth = Number(end[2]);
  if (start[1] === end[1] && startMonth === endMonth) {
    return `${Number(start[3])}–${Number(end[3])} ${MONTHS_AR[endMonth - 1]} ${end[1]}`;
  }
  if (start[1] === end[1]) {
    return `${Number(start[3])} ${MONTHS_AR[startMonth - 1]} – ${Number(end[3])} ${MONTHS_AR[endMonth - 1]} ${end[1]}`;
  }
  return `${prettyIsoAr(from)} – ${prettyIsoAr(to)}`;
}

function laneAr(label: string): string {
  if (/air/i.test(label)) return "جوي";
  if (/sea/i.test(label)) return "بحري";
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
  const start = lastDelivered + 1;
  const tail = days.slice(start).filter((day) => day.rows > 0);
  if (!tail.length) return null;
  return {
    from: tail[0].key,
    kg: tail.reduce((sum, day) => sum + day.kg, 0),
    rows: tail.reduce((sum, day) => sum + day.rows, 0),
  };
}

export function buildManagerMessage(payload: SheetPayload): string {
  if (!payload.usedRows) {
    return [
      "كرام العرب — تقرير العمليات",
      formatRangeAr(payload.from, payload.to),
      "",
      "لا توجد أسطر في هذه الفترة.",
      payload.metrics.byDay.length
        ? ""
        : "آخر يوم في الشيت قد يكون أقدم من الفترة المختارة.",
    ]
      .filter((line) => line !== undefined)
      .join("\n")
      .trim();
  }

  const m = payload.metrics;
  const wh = m.warehouse;
  const lastDay = lastSheetDay(payload);
  const lines: string[] = [
    "كرام العرب — تقرير العمليات",
    formatRangeAr(payload.from, payload.to),
  ];
  if (lastDay && lastDay < payload.to) {
    lines.push(`آخر إدخال في الشيت: ${prettyIsoAr(lastDay)}`);
  }
  lines.push("");
  lines.push(
    `الوارد: ${formatKgAr(m.totalKg)}  ·  ${payload.usedRows} سطر  ·  ${m.shipments} شحنة`,
  );
  if (m.byLane.length) {
    lines.push(m.byLane.map((lane) => `${laneAr(lane.label)} ${formatKgAr(lane.kg)}`).join("  |  "));
  }
  lines.push("");
  const pct = payload.usedRows ? Math.round((m.deliveries / payload.usedRows) * 100) : 0;
  lines.push(`تم التسليم: ${m.deliveries} سطر (${pct}٪)`);
  lines.push(`لا يزال مفتوحاً: ${m.open} سطر`);

  if (wh.lines) {
    lines.push("");
    lines.push("في المستودع (يحتاج إجراء)");
    lines.push(
      `${formatKgAr(wh.kg)}  ·  ${wh.lines} سطر  ·  ${Math.round(wh.cartons)} كرتون`,
    );
    if (wh.byLane.length) {
      lines.push(wh.byLane.map((lane) => `${laneAr(lane.label)} ${formatKgAr(lane.kg)}`).join("  |  "));
    }
    const topWh = wh.marks.filter((item) => item.label !== "Other").slice(0, 3);
    if (topWh.length) {
      lines.push("الأكبر في المستودع:");
      for (const item of topWh) {
        lines.push(`• ${item.label} — ${formatKgAr(item.kg)}`);
      }
    }
  }

  const loading = payload.rows.filter((row) => /load/i.test(row.status));
  if (loading.length) {
    const ships = groupKg(loading, (row) => row.shipment || "بدون رقم شحنة").slice(0, 4);
    lines.push("");
    lines.push("قيد التحميل");
    for (const ship of ships) {
      lines.push(`• ${ship.label} — ${formatKgAr(ship.kg)} / ${ship.rows} سطر`);
    }
  }

  const stage3 = payload.rows.filter((row) => /stage\s*3|этап\s*3/i.test(row.status));
  if (stage3.length) {
    const ships = groupKg(stage3, (row) => row.shipment || "بدون رقم شحنة").slice(0, 3);
    const kg = stage3.reduce((sum, row) => sum + (row.kg ?? 0), 0);
    lines.push("");
    lines.push("في الطريق (ليس مشكلة مستودع)");
    lines.push(`مرحلة 3: ${formatKgAr(kg)} / ${stage3.length} سطر`);
    for (const ship of ships) {
      lines.push(`• ${ship.label} — ${formatKgAr(ship.kg)}`);
    }
  }

  const stall = deliveryStall(payload);
  if (stall) {
    lines.push("");
    lines.push(
      `ملاحظة: لا يوجد تسليم مسجّل اعتباراً من ${prettyIsoAr(stall.from)} (${formatKgAr(stall.kg)} وردت منذ ذلك التاريخ). قد يكون تأخيراً بحرياً طبيعياً، أو الشيت غير محدّث.`,
    );
  }

  const asks: string[] = [];
  if (loading.length) {
    const names = [...new Set(loading.map((row) => row.shipment).filter(Boolean))];
    asks.push(`تأكيد موعد انتهاء تحميل ${names.slice(0, 3).join("، ") || "الحاوية الحالية"}`);
  }
  if (wh.lines) {
    asks.push(`تفريغ / حجز ${formatKgAr(wh.kg)} في المستودع`);
  }
  if (stall) {
    asks.push("التأكد إن كانت تسليمات لاحقة حصلت ولم تُكتب في الشيت");
  }
  if (asks.length) {
    lines.push("");
    lines.push("المطلوب:");
    asks.forEach((ask, index) => {
      lines.push(`${index + 1}) ${ask}`);
    });
  }

  return lines.join("\n");
}
