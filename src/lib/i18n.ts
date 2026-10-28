export const REPORT_LANGS = ["ar", "en", "ru"] as const;
export type ReportLang = (typeof REPORT_LANGS)[number];

export type ReportRecipient = {
  phone: string;
  language: ReportLang;
  name?: string;
};

export function parseLang(value: unknown): ReportLang {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "en" || raw === "english") return "en";
  if (raw === "ru" || raw === "russian" || raw === "рус") return "ru";
  return "ar";
}

export function langLabel(language: ReportLang): string {
  if (language === "en") return "English";
  if (language === "ru") return "Русский";
  return "العربية";
}
