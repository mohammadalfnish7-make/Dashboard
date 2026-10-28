import "server-only";
import { cronConfig, cronEnabled, dubaiDateRange, dubaiNow, shouldSendDaily } from "@/lib/dubai";
import { loadSheetPayload } from "@/lib/load-sheet";
import { maytapiConfig, sendWhatsAppToMany } from "@/lib/maytapi";
import { loadCronState, loadRecipientNumbers, markCronSent } from "@/lib/recipients";
import { buildManagerMessage } from "@/lib/report";

const INTERVAL_MS = 20_000;
const MAX_MESSAGE = 4000;

type DailySendResult = {
  skipped?: string;
  date?: string;
  sent?: number;
  failed?: number;
  results?: Awaited<ReturnType<typeof sendWhatsAppToMany>>;
};

let sending = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function sendDailyReport(options?: { force?: boolean }): Promise<DailySendResult> {
  if (sending) return { skipped: "already sending" };
  const today = dubaiNow().date;
  const { lastSentDate } = loadCronState();
  if (!options?.force && !shouldSendDaily(new Date(), lastSentDate)) {
    return { skipped: lastSentDate === today ? "already sent today" : "outside 6:15 Dubai window" };
  }
  if (!maytapiConfig().configured) return { skipped: "WhatsApp is not configured" };

  const numbers = loadRecipientNumbers();
  if (!numbers.length) return { skipped: "no recipient numbers" };

  sending = true;
  try {
    const range = dubaiDateRange(30);
    const payload = await loadSheetPayload({ tab: "all", from: range.from, to: range.to });
    const message = buildManagerMessage(payload).slice(0, MAX_MESSAGE);
    const results = await sendWhatsAppToMany(numbers, message);
    const sent = results.filter((item) => item.ok).length;
    if (sent > 0) markCronSent(today);
    return { date: today, sent, failed: results.length - sent, results };
  } finally {
    sending = false;
  }
}

export function startDailyReportCron() {
  const globalFlag = globalThis as typeof globalThis & { __karamReportCron?: boolean };
  if (globalFlag.__karamReportCron || !cronEnabled()) return;
  globalFlag.__karamReportCron = true;
  const { hour, minute, timeZone } = cronConfig();
  console.info(`[report-cron] daily WhatsApp at ${hour}:${String(minute).padStart(2, "0")} ${timeZone}`);
  const tick = () => {
    void sendDailyReport().then((result) => {
      if (result.skipped || result.sent == null) return;
      console.info(`[report-cron] sent ${result.sent}, failed ${result.failed ?? 0}`);
    }).catch((error) => {
      console.error("[report-cron]", error instanceof Error ? error.message : error);
    });
  };
  tick();
  timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
}
