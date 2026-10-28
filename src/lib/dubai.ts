const TIME_ZONE = "Asia/Dubai";

export function cronEnabled() {
  if (process.env.REPORT_CRON === "0") return false;
  if (process.env.REPORT_CRON === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function cronConfig() {
  const hour = Number(process.env.REPORT_CRON_HOUR ?? 6);
  const minute = Number(process.env.REPORT_CRON_MINUTE ?? 15);
  return {
    timeZone: TIME_ZONE,
    hour: Number.isFinite(hour) ? hour : 6,
    minute: Number.isFinite(minute) ? minute : 15,
  };
}

export function dubaiNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function dubaiDateRange(days = 30): { from: string; to: string } {
  const to = dubaiNow().date;
  const [year, month, day] = to.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - (days - 1)));
  return { from: start.toISOString().slice(0, 10), to };
}

/** Send once in the 06:15–06:59 Dubai window. No late catch-up after 07:00. */
export function shouldSendDaily(now = new Date(), lastSentDate: string | null) {
  const current = dubaiNow(now);
  const { hour, minute } = cronConfig();
  if (current.date === lastSentDate) return false;
  if (current.hour !== hour) return false;
  return current.minute >= minute;
}

export function nextCronLabel(now = new Date(), lastSentDate: string | null) {
  const current = dubaiNow(now);
  const { hour, minute } = cronConfig();
  const clock = `${hour}:${String(minute).padStart(2, "0")}`;
  const stillToday =
    current.date !== lastSentDate &&
    (current.hour < hour || (current.hour === hour && current.minute < minute));
  return stillToday ? `اليوم ${clock}` : `غداً ${clock}`;
}
