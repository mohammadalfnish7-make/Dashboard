"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { langLabel, parseLang, REPORT_LANGS, type ReportLang, type ReportRecipient } from "@/lib/i18n";
import { normalizePhone } from "@/lib/phone";
import { buildManagerMessage } from "@/lib/report";
import type { SheetPayload } from "@/lib/types";

const PHONES_KEY = "karam.managerRecipients";

type SendResult = { phone: string; ok: boolean; error?: string; language?: string; name?: string };
type CronInfo = {
  enabled: boolean;
  timeZone: string;
  hour: number;
  minute: number;
  lastSentDate: string | null;
  nextLabel: string;
};

function asRecipients(value: unknown): ReportRecipient[] {
  if (!Array.isArray(value)) return [];
  const out: ReportRecipient[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === "string") {
      const phone = normalizePhone(item);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      out.push({ phone, language: "ar" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as { phone?: unknown; language?: unknown; name?: unknown };
    const phone = normalizePhone(String(row.phone ?? ""));
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      phone,
      language: parseLang(row.language),
      name: String(row.name ?? "").trim() || undefined,
    });
  }
  return out;
}

export function ReportPanel({
  data,
  url,
  sheet,
  from,
  to,
}: {
  data: SheetPayload | null;
  url: string;
  sheet: string;
  from: string;
  to: string;
}) {
  const [people, setPeople] = useState<ReportRecipient[]>([]);
  const [cron, setCron] = useState<CronInfo | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draft, setDraft] = useState("");
  const [draftLang, setDraftLang] = useState<ReportLang>("ar");
  const [previewLang, setPreviewLang] = useState<ReportLang>("ar");
  const [error, setError] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  useEffect(() => {
    void loadRecipients();
  }, []);

  async function loadRecipients() {
    try {
      const res = await fetch("/api/report/recipients", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر قراءة الأرقام.");
      const server = asRecipients(json.recipients ?? json.numbers);
      let local: ReportRecipient[] = [];
      try {
        local = asRecipients(JSON.parse(window.localStorage.getItem(PHONES_KEY) ?? "[]"));
      } catch {
        local = [];
      }
      if (!server.length && local.length) {
        await persist(local);
        return;
      }
      setPeople(server);
      window.localStorage.setItem(PHONES_KEY, JSON.stringify(server));
      setCron(json.cron ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر قراءة الأرقام.");
    }
  }

  async function persist(next: ReportRecipient[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/report/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر حفظ الأرقام.");
      const saved = asRecipients(json.recipients ?? next);
      setPeople(saved);
      setCron(json.cron ?? null);
      window.localStorage.setItem(PHONES_KEY, JSON.stringify(saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الأرقام.");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(
    () => (data ? buildManagerMessage(data, previewLang) : ""),
    [data, previewLang],
  );
  const clock = cron ? `${cron.hour}:${String(cron.minute).padStart(2, "0")}` : "6:15";

  function addPhone(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResults(null);
    const phone = normalizePhone(draft);
    if (!phone) {
      setError("أدخل رقماً مع رمز الدولة، مثل 971501234567");
      return;
    }
    if (people.some((item) => item.phone === phone)) {
      setDraft("");
      return;
    }
    const name = draftName.trim() || undefined;
    setDraft("");
    setDraftName("");
    void persist([...people, { phone, language: draftLang, name }]);
  }

  async function send(phone?: string) {
    if (!people.length || sending) return;
    setSending(phone ?? "all");
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          url,
          tab: sheet,
          from,
          to,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر إرسال التقرير.");
      setResults(json.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال التقرير.");
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="setup report" dir="rtl" lang="ar">
      <p className="report-lead">
        يُرسل تلقائياً كل يوم الساعة {clock} صباحاً بتوقيت دبي. كل رقم يستلم التقرير بلغته: كرام إنجليزي، صدام عربي أو روسي.
        {cron?.nextLabel ? ` · التالي: ${cron.nextLabel}` : ""}
        {cron?.lastSentDate ? ` · آخر إرسال: ${cron.lastSentDate}` : ""}
        {cron && !cron.enabled ? " · الجدولة متوقفة على هذا السيرفر" : ""}
      </p>
      <form onSubmit={addPhone} className="report-add">
        <input
          type="text"
          name="name"
          placeholder="الاسم · Karam / Saddam"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          aria-label="الاسم"
        />
        <input
          type="tel"
          inputMode="tel"
          name="phone"
          placeholder="971501234567"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="رقم واتساب"
        />
        <select
          aria-label="لغة التقرير"
          value={draftLang}
          onChange={(event) => setDraftLang(parseLang(event.target.value))}
        >
          {REPORT_LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {langLabel(lang)}
            </option>
          ))}
        </select>
        <button className="primary" type="submit" disabled={saving}>
          إضافة
        </button>
        <button
          className="primary"
          type="button"
          onClick={() => void send()}
          disabled={!people.length || !data || Boolean(sending)}
        >
          {sending === "all" ? "جارٍ الإرسال…" : `إرسال للجميع (${people.length})`}
        </button>
      </form>
      {people.length ? (
        <ul className="phone-list">
          {people.map((person) => (
            <li key={person.phone}>
              <span>
                {person.name ? `${person.name} · ` : ""}
                {person.phone}
              </span>
              <select
                aria-label={`لغة ${person.name || person.phone}`}
                value={person.language}
                disabled={saving}
                onChange={(event) => {
                  const language = parseLang(event.target.value);
                  setPreviewLang(language);
                  void persist(
                    people.map((item) => (item.phone === person.phone ? { ...item, language } : item)),
                  );
                }}
              >
                {REPORT_LANGS.map((lang) => (
                  <option key={lang} value={lang}>
                    {langLabel(lang)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!data || Boolean(sending)}
                onClick={() => {
                  setPreviewLang(person.language);
                  void send(person.phone);
                }}
              >
                {sending === person.phone ? "…" : "إرسال له"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void persist(people.filter((item) => item.phone !== person.phone))}
                aria-label={`حذف ${person.phone}`}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="report-empty">لا أرقام بعد. أضف كرام بالإنجليزي وصدام بالعربي أو الروسي.</p>
      )}
      <div className="preview-langs" role="tablist" aria-label="معاينة اللغة">
        {REPORT_LANGS.map((lang) => (
          <button
            key={lang}
            type="button"
            className={previewLang === lang ? "active" : undefined}
            onClick={() => setPreviewLang(lang)}
          >
            {langLabel(lang)}
          </button>
        ))}
      </div>
      {preview ? (
        <pre className="report-preview" aria-label="نص التقرير" dir={previewLang === "ar" ? "rtl" : "ltr"}>
          {preview}
        </pre>
      ) : null}
      {error ? <p className="warn">{error}</p> : null}
      {results ? (
        <ul className="send-results">
          {results.map((item) => (
            <li key={item.phone} className={item.ok ? "ok" : "fail"}>
              {item.name ? `${item.name} · ` : ""}
              {item.phone}
              {item.language ? ` · ${langLabel(parseLang(item.language))}` : ""} —{" "}
              {item.ok ? "تم الإرسال" : item.error || "فشل"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
