/** Digits only, with country code. UAE local 05x becomes 9715x. */
export function normalizePhone(raw: string): string | null {
  let value = raw.trim().replace(/[^\d+]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  if (value.startsWith("00")) value = value.slice(2);
  if (value.startsWith("0") && value.length >= 9 && value.length <= 11) {
    value = `971${value.slice(1)}`;
  }
  if (!/^\d{8,15}$/.test(value)) return null;
  return value;
}

export function normalizePhones(values: unknown): { ok: string[]; invalid: string[] } {
  const list = Array.isArray(values) ? values : [];
  const ok: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const raw = String(item ?? "").trim();
    if (!raw) continue;
    const phone = normalizePhone(raw);
    if (!phone) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    ok.push(phone);
  }
  return { ok, invalid };
}
