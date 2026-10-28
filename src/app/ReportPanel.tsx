"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { normalizePhone } from "@/lib/phone";
import { buildManagerMessage } from "@/lib/report";
import type { SheetPayload } from "@/lib/types";

const PHONES_KEY = "karam.managerPhones";

type SendResult = { phone: string; ok: boolean; error?: string };
type CronInfo = {
  enabled: boolean;
  timeZone: string;
  hour: number;
  minute: number;
  lastSentDate: string | null;
  nextLabel: string;
};

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
  const [phones, setPhones] = useState<string[]>([]);
  const [cron, setCron] = useState<CronInfo | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
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
      const serverNumbers = Array.isArray(json.numbers) ? json.numbers.map(String) : [];
      let local: string[] = [];
      try {
        local = JSON.parse(window.localStorage.getItem(PHONES_KEY) ?? "[]");
      } catch {
        local = [];
      }
      if (!serverNumbers.length && Array.isArray(local) && local.length) {
        await persist(local.map(String));
        return;
      }
      setPhones(serverNumbers);
      window.localStorage.setItem(PHONES_KEY, JSON.stringify(serverNumbers));
      setCron(json.cron ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر قراءة الأرقام.");
    }
  }

  async function persist(next: string[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/report/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر حفظ الأرقام.");
      const saved = Array.isArray(json.numbers) ? json.numbers.map(String) : next;
      setPhones(saved);
      setCron(json.cron ?? null);
      window.localStorage.setItem(PHONES_KEY, JSON.stringify(saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الأرقام.");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(() => (data ? buildManagerMessage(data) : ""), [data]);
  const clock = cron
    ? `${cron.hour}:${String(cron.minute).padStart(2, "0")}`
    : "6:15";

  function addPhone(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResults(null);
    const phone = normalizePhone(draft);
    if (!phone) {
      setError("أدخل رقماً مع رمز الدولة، مثل 971501234567");
      return;
    }
    if (phones.includes(phone)) {
      setDraft("");
      return;
    }
    setDraft("");
    void persist([...phones, phone]);
  }

  async function send() {
    if (!phones.length || sending) return;
    setSending(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers: phones,
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
      setSending(false);
    }
  }

  return (
    <section className="setup report" dir="rtl" lang="ar">
      <p className="report-lead">
        يُرسل تلقائياً كل يوم الساعة {clock} صباحاً بتوقيت دبي
        {cron?.nextLabel ? ` · التالي: ${cron.nextLabel}` : ""}
        {cron?.lastSentDate ? ` · آخر إرسال: ${cron.lastSentDate}` : ""}
        {cron && !cron.enabled ? " · الجدولة متوقفة على هذا السيرفر" : ""}
      </p>
      <p className="report-empty">أضف أرقام واتساب هنا مرة واحدة. الإرسال اليومي يستخدم هذه القائمة حتى لو أغلقت اللوحة.</p>
      <form onSubmit={addPhone}>
        <input
          type="tel"
          inputMode="tel"
          name="phone"
          placeholder="971501234567"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="رقم واتساب"
        />
        <button className="primary" type="submit" disabled={saving}>
          إضافة رقم
        </button>
        <button
          className="primary"
          type="button"
          onClick={() => void send()}
          disabled={!phones.length || !data || sending}
        >
          {sending ? "جارٍ الإرسال…" : `إرسال الآن${phones.length ? ` (${phones.length})` : ""}`}
        </button>
      </form>
      {phones.length ? (
        <ul className="phone-list">
          {phones.map((phone) => (
            <li key={phone}>
              <span>{phone}</span>
              <button
                type="button"
                disabled={saving}
                onClick={() => void persist(phones.filter((item) => item !== phone))}
                aria-label={`حذف ${phone}`}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="report-empty">لا أرقام بعد. أضف رقماً واحداً على الأقل ليصل التقرير اليومي.</p>
      )}
      {preview ? (
        <pre className="report-preview" aria-label="نص التقرير">
          {preview}
        </pre>
      ) : null}
      {error ? <p className="warn">{error}</p> : null}
      {results ? (
        <ul className="send-results">
          {results.map((item) => (
            <li key={item.phone} className={item.ok ? "ok" : "fail"}>
              {item.phone} — {item.ok ? "تم الإرسال" : item.error || "فشل"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
