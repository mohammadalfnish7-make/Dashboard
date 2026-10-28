import "server-only";
import fs from "fs";
import path from "path";
import { parseLang, type ReportLang, type ReportRecipient } from "@/lib/i18n";
import { normalizePhone } from "@/lib/phone";

const MAX_NUMBERS = 20;

function stateDir() {
  return process.env.REPORT_STATE_DIR?.trim() || path.join(process.cwd(), "state");
}

function phonesPath() {
  return path.join(stateDir(), "manager-phones.json");
}

function cronStatePath() {
  return path.join(stateDir(), "report-cron.json");
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function parseRecipient(value: unknown): ReportRecipient | null {
  if (typeof value === "string") {
    const parts = value.split(":");
    const phone = normalizePhone(parts[0] ?? "");
    if (!phone) return null;
    const language = parseLang(parts[1]);
    const name = parts.slice(2).join(":").trim() || undefined;
    return { phone, language, name };
  }
  if (!value || typeof value !== "object") return null;
  const row = value as { phone?: unknown; number?: unknown; language?: unknown; lang?: unknown; name?: unknown };
  const phone = normalizePhone(String(row.phone ?? row.number ?? ""));
  if (!phone) return null;
  const name = String(row.name ?? "").trim() || undefined;
  return { phone, language: parseLang(row.language ?? row.lang), name };
}

function envRecipients(): ReportRecipient[] {
  return (process.env.MAYTAPI_TO_NUMBERS ?? "")
    .split(/[,\s]+/)
    .map((item) => parseRecipient(item))
    .filter((item): item is ReportRecipient => Boolean(item));
}

export function loadRecipients(): ReportRecipient[] {
  const stored = readJson<{ recipients?: unknown; numbers?: unknown }>(phonesPath(), {});
  const fromFile = Array.isArray(stored.recipients)
    ? stored.recipients
    : Array.isArray(stored.numbers)
      ? stored.numbers
      : [];
  const merged: ReportRecipient[] = [];
  const seen = new Set<string>();
  for (const item of [...fromFile.map(parseRecipient), ...envRecipients()]) {
    if (!item || seen.has(item.phone)) continue;
    seen.add(item.phone);
    merged.push(item);
  }
  return merged.slice(0, MAX_NUMBERS);
}

export function saveRecipients(values: unknown) {
  const list = Array.isArray(values) ? values : [];
  const saved: ReportRecipient[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const parsed = parseRecipient(item);
    if (!parsed) {
      invalid.push(typeof item === "string" ? item : JSON.stringify(item));
      continue;
    }
    if (seen.has(parsed.phone)) continue;
    seen.add(parsed.phone);
    saved.push(parsed);
  }
  if (invalid.length) throw new Error(`Invalid numbers: ${invalid.join(", ")}`);
  if (saved.length > MAX_NUMBERS) throw new Error(`Maximum ${MAX_NUMBERS} numbers.`);
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(phonesPath(), `${JSON.stringify({ recipients: saved }, null, 2)}\n`);
  return saved;
}

export function findRecipient(phone: string): ReportRecipient | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return loadRecipients().find((item) => item.phone === normalized) ?? null;
}

export function loadCronState(): { lastSentDate: string | null } {
  const stored = readJson<{ lastSentDate?: string | null }>(cronStatePath(), {});
  return { lastSentDate: stored.lastSentDate ?? null };
}

export function markCronSent(date: string) {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(
    cronStatePath(),
    `${JSON.stringify({ lastSentDate: date, sentAt: new Date().toISOString() }, null, 2)}\n`,
  );
}

export type { ReportLang, ReportRecipient };
export { MAX_NUMBERS };
