import "server-only";
import fs from "fs";
import path from "path";
import { normalizePhones } from "@/lib/phone";

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

function envNumbers() {
  return normalizePhones((process.env.MAYTAPI_TO_NUMBERS ?? "").split(/[,\s]+/)).ok;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function loadRecipientNumbers(): string[] {
  const stored = readJson<{ numbers?: unknown }>(phonesPath(), {});
  const fromFile = normalizePhones(stored.numbers).ok;
  const merged = [...fromFile];
  for (const phone of envNumbers()) {
    if (!merged.includes(phone)) merged.push(phone);
  }
  return merged.slice(0, MAX_NUMBERS);
}

export function saveRecipientNumbers(values: unknown) {
  const parsed = normalizePhones(values);
  if (parsed.invalid.length) {
    throw new Error(`Invalid numbers: ${parsed.invalid.join(", ")}`);
  }
  if (parsed.ok.length > MAX_NUMBERS) {
    throw new Error(`Maximum ${MAX_NUMBERS} numbers.`);
  }
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(phonesPath(), `${JSON.stringify({ numbers: parsed.ok }, null, 2)}\n`);
  return parsed.ok;
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

export { MAX_NUMBERS };
