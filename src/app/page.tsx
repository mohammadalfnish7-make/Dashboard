"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, ColumnChart, MarkLabel, formatKg } from "./Charts";
import {
  dateKey,
  defaultDateRange,
  fillWorkingDays,
  monthRange,
  canShiftNext,
  shiftMonth,
  shiftWeek,
  weekRange,
} from "@/lib/parse";
import type { SheetPayload, SheetRow } from "@/lib/types";

const STORAGE_KEY = "karam.googleSheetUrl";
const LINES_KEY = "karam.showLineCharts";

const LANES = [
  { id: "all", label: "All" },
  { id: "SEA GOODS", label: "Sea" },
  { id: "AIR SHIPMENT", label: "Air" },
] as const;

const TOPICS = [
  { id: "warehouse", label: "Warehouse" },
  { id: "received", label: "Received" },
  { id: "deliveries", label: "Deliveries" },
  { id: "marks", label: "Marks" },
  { id: "shipments", label: "Shipments" },
] as const;

type Topic = (typeof TOPICS)[number]["id"];
type View = "charts" | "details";
type Period = "custom" | "month" | "week";

export default function Page() {
  const [url, setUrl] = useState("");
  const [sheet, setSheet] = useState("all");
  const [data, setData] = useState<SheetPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [topic, setTopic] = useState<Topic>("warehouse");
  const [view, setView] = useState<View>("charts");
  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [period, setPeriod] = useState<Period>("custom");
  const [showLineCharts, setShowLineCharts] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setUrl(saved);
    setShowLineCharts(window.localStorage.getItem(LINES_KEY) === "1");
    void load(saved, "all", from, to);
    // First paint uses last-30-days defaults; later changes go through applyRange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleLineCharts() {
    setShowLineCharts((current) => {
      const next = !current;
      window.localStorage.setItem(LINES_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function load(
    nextUrl: string,
    nextSheet: string,
    nextFrom: string,
    nextTo: string,
    fresh = false,
  ) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (nextUrl) params.set("url", nextUrl);
    params.set("tab", nextSheet || "all");
    if (fresh) params.set("fresh", "1");
    try {
      const res = await fetch(`/api/sheet?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load the sheet.");
      setData(json);
      if (json.tab) setSheet(json.tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the sheet.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function connect(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    void load(trimmed, sheet, from, to, true);
  }

  function applyRange(nextFrom: string, nextTo: string, nextPeriod: Period = "custom") {
    setFrom(nextFrom);
    setTo(nextTo);
    setPeriod(nextPeriod);
    if (nextFrom && nextTo) void load(url, sheet, nextFrom, nextTo);
  }

  function resetLast30() {
    const next = defaultDateRange();
    applyRange(next.from, next.to, "custom");
  }

  function applyMonth() {
    const next = monthRange();
    applyRange(next.from, next.to, "month");
  }

  function applyWeek() {
    const next = weekRange();
    applyRange(next.from, next.to, "week");
  }

  function shiftPeriod(delta: number) {
    if (period === "week") {
      if (delta > 0 && !canShiftNext("week", from)) return;
      const next = shiftWeek(from, delta);
      applyRange(next.from, next.to, "week");
      return;
    }
    if (period === "month") {
      if (delta > 0 && !canShiftNext("month", from)) return;
      const next = shiftMonth(from, delta);
      applyRange(next.from, next.to, "month");
    }
  }

  const nextEnabled =
    (period === "week" || period === "month") && canShiftNext(period, from);

  const when = data
    ? `${data.rangeLabel} · ${data.usedRows} lines · ${laneLabel(data.tab)} · ${data.source === "google" ? "live" : "file"}`
    : "";

  return (
    <main className="board">
      <header className="topbar">
        <a className="brand" href="https://karam-alarab.com" target="_blank" rel="noreferrer" aria-label="KARAM AL ARAB">
          <img src="/karam-logo.svg" alt="KARAM AL ARAB" />
        </a>
        <div className="topbar-actions">
          <button className="ghost" type="button" onClick={() => setSetup((v) => !v)}>
            {setup ? "Hide setup" : "Setup"}
          </button>
          <button className="ghost" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <header className="mast">
        <p className="who">Live operations</p>
        <h1>{data?.headline ?? "Reading the live sheet…"}</h1>
      </header>

      {setup ? (
        <section className="setup">
          <form onSubmit={connect}>
            <input
              type="url"
              name="sheet"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-label="Google Sheet URL"
            />
            <button className="primary" type="submit">Read live sheet</button>
            <button type="button" onClick={() => void load(url, sheet, from, to, true)}>Refresh</button>
          </form>
          <div className="tabs" role="tablist" aria-label="Other sheets">
            {(data?.tabs ?? []).filter((name) => !LANES.some((lane) => lane.id === name)).map((name) => (
              <button
                key={name}
                type="button"
                className={name === data?.tab ? "active" : undefined}
                onClick={() => {
                  setSheet(name);
                  void load(url, name, from, to);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {data?.warning ? <p className="warn">{data.warning}</p> : null}
          {error ? <p className="warn">{error}</p> : null}
        </section>
      ) : null}

      <form className="range" onSubmit={(event) => event.preventDefault()}>
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => applyRange(event.target.value, to)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => applyRange(from, event.target.value)}
          />
        </label>
        <button type="button" onClick={resetLast30}>
          Last 30 days
        </button>
        <span className="grain" role="group" aria-label="By month or week">
          <button type="button" className={period === "month" ? "active" : undefined} onClick={applyMonth}>
            Month
          </button>
          <button type="button" className={period === "week" ? "active" : undefined} onClick={applyWeek}>
            Week
          </button>
        </span>
        {period === "month" || period === "week" ? (
          <span className="grain-nav">
            <button type="button" onClick={() => shiftPeriod(-1)} aria-label={period === "week" ? "Previous week" : "Previous month"}>
              Previous
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              disabled={!nextEnabled}
              aria-label={period === "week" ? "Next week" : "Next month"}
            >
              Next
            </button>
          </span>
        ) : null}
      </form>

      <nav className="lanes" aria-label="Sea or air">
        {LANES.filter((lane) => lane.id === "all" || (data?.tabs ?? []).includes(lane.id)).map((lane) => (
          <button
            key={lane.id}
            type="button"
            className={sheet === lane.id ? "active" : undefined}
            onClick={() => {
              setSheet(lane.id);
              void load(url, lane.id, from, to);
            }}
          >
            {lane.label}
          </button>
        ))}
      </nav>

      <nav className="topics" aria-label="Topics">
        {TOPICS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={topic === item.id ? "active" : undefined}
            onClick={() => {
              setTopic(item.id);
              setView("charts");
            }}
          >
            {item.label}
          </button>
        ))}
        <span className="view-toggle">
          <button type="button" className={view === "charts" ? "active" : undefined} onClick={() => setView("charts")}>
            Charts
          </button>
          <button type="button" className={view === "details" ? "active" : undefined} onClick={() => setView("details")}>
            Details
          </button>
          {view === "charts" ? (
            <button
              type="button"
              className={showLineCharts ? "active" : undefined}
              onClick={toggleLineCharts}
              aria-pressed={showLineCharts}
            >
              {showLineCharts ? "Hide lines" : "Show lines"}
            </button>
          ) : null}
        </span>
      </nav>

      {data ? (
        <>
          {topic === "warehouse" ? <WarehouseTab data={data} view={view} showLineCharts={showLineCharts} /> : null}
          {topic === "received" ? <ReceivedTab data={data} view={view} when={when} period={period} /> : null}
          {topic === "deliveries" ? (
            <DeliveriesTab data={data} view={view} when={when} period={period} showLineCharts={showLineCharts} />
          ) : null}
          {topic === "marks" ? <MarksTab data={data} view={view} when={when} /> : null}
          {topic === "shipments" ? (
            <ShipmentsTab data={data} view={view} when={when} showLineCharts={showLineCharts} />
          ) : null}
          <p className="source">
            Source: {data.title}
            {loading ? " · refreshing…" : ""}
            {" · "}
            {new Date(data.fetchedAt).toLocaleString()}
            {" · "}
            {data.usedRows} of {data.totalRows} lines in {data.rangeLabel}
          </p>
        </>
      ) : null}
    </main>
  );
}

function WarehouseTab({
  data,
  view,
  showLineCharts,
}: {
  data: SheetPayload;
  view: View;
  showLineCharts: boolean;
}) {
  const wh = data.metrics.warehouse;
  if (view === "details") {
    return (
      <DetailTable
        caption={`${wh.lines} warehouse lines · ${formatKg(wh.kg)} · ${data.rangeLabel}`}
        rows={data.warehouseRows ?? []}
        extra
      />
    );
  }
  return (
    <>
      <section className="kpis warehouse" aria-label="Warehouse">
        <Kpi value={formatKg(wh.kg)} label="Kg in warehouse" tone="attention" />
        <Kpi value={wh.lines} label="Lines in warehouse" tone="attention" />
        <Kpi value={wh.cartons.toLocaleString()} label="Cartons in warehouse" />
        <Kpi value={wh.markCount} label="Marks in warehouse" />
      </section>
      <section className="grid2">
        <BarChart
          title="Kg in warehouse, by mark"
          when={`${data.rangeLabel} · ${wh.lines} lines`}
          items={wh.marks.filter((item) => item.label !== "Other").map((item) => ({
            label: item.label,
            value: item.kg,
          }))}
        />
        <BarChart
          title="Kg in warehouse, by lane"
          when={`${data.rangeLabel} · SEA GOODS and AIR SHIPMENT`}
          items={wh.byLane.map((item) => ({ label: item.label, value: item.kg }))}
        />
        {showLineCharts ? (
          <>
            <BarChart
              title="Lines in warehouse, by mark"
              when={`${data.rangeLabel} · ${wh.lines} lines`}
              unit="rows"
              items={wh.marks.filter((item) => item.label !== "Other").map((item) => ({
                label: item.label,
                value: item.rows,
              }))}
            />
            <BarChart
              title="Lines in warehouse, by lane"
              when={`${data.rangeLabel} · SEA GOODS and AIR SHIPMENT`}
              unit="rows"
              items={wh.byLane.map((item) => ({ label: item.label, value: item.rows }))}
            />
          </>
        ) : null}
      </section>
    </>
  );
}

function ReceivedTab({
  data,
  view,
  when,
  period,
}: {
  data: SheetPayload;
  view: View;
  when: string;
  period: Period;
}) {
  const days = useMemo(() => {
    const filled = fillWorkingDays(data.from, data.to, data.metrics.byDay, period === "week" ? "week" : "month");
    const split = new Map(filled.map((day) => [day.key, { sea: 0, air: 0 }]));
    for (const row of data.rows) {
      const key = dateKey(row.date);
      const slot = key ? split.get(key) : undefined;
      if (!slot) continue;
      const kg = row.kg ?? 0;
      if (/air/i.test(row.lane ?? "")) slot.air += kg;
      else slot.sea += kg;
    }
    const showSplit = (data.metrics.byLane ?? []).length > 1;
    return filled.map((day) => {
      const slot = split.get(day.key) ?? { sea: 0, air: 0 };
      return {
        label: day.label.replace(" ", "\u00a0"),
        value: slot.sea + slot.air || day.kg,
        parts: showSplit
          ? [
              { label: "SEA GOODS", value: slot.sea },
              { label: "AIR SHIPMENT", value: slot.air },
            ]
          : undefined,
      };
    });
  }, [data.from, data.to, data.metrics.byDay, data.metrics.byLane, data.rows, period]);
  if (view === "details") {
    return (
      <DetailTable
        caption={`${data.usedRows} ${laneLabel(data.tab)} lines · ${data.rangeLabel}`}
        rows={data.rows}
        extra={data.tab === "all"}
      />
    );
  }
  return (
    <>
      <section className="kpis" aria-label="Received">
        <Kpi value={formatKg(data.metrics.totalKg)} label="Kg received" />
        <Kpi value={data.usedRows} label="Lines received" />
        <Kpi value={data.metrics.shipments} label="Shipments that exist" />
        <Kpi value={data.metrics.open} label="Still open" tone={data.metrics.open ? "attention" : undefined} />
      </section>
      <section className="hero">
        <ColumnChart
          title={period === "week" ? "Kg received, Mon–Sat" : "Kg received, by day"}
          when={
            period === "week"
              ? `6 receiving days · ${data.rangeLabel} · ${laneLabel(data.tab)} · ${data.source === "google" ? "live" : "file"}`
              : when
          }
          items={days}
        />
      </section>
      <section className="grid2">
        <BarChart
          title="Kg received, by lane"
          when={when}
          items={(data.metrics.byLane ?? []).map((item) => ({ label: item.label, value: item.kg }))}
        />
        <BarChart
          title="Kg received, by mark"
          when={when}
          items={data.metrics.marksTop
            .filter((item) => item.mark !== "Other")
            .map((item) => ({ label: item.mark, value: item.kg }))}
        />
      </section>
    </>
  );
}

function DeliveriesTab({
  data,
  view,
  when,
  period,
  showLineCharts,
}: {
  data: SheetPayload;
  view: View;
  when: string;
  period: Period;
  showLineCharts: boolean;
}) {
  const delivered = data.rows.filter((row) => row.delivered);
  const days = useMemo(
    () => fillWorkingDays(data.from, data.to, data.metrics.byDay, period === "week" ? "week" : "month"),
    [data.from, data.to, data.metrics.byDay, period],
  );
  const byMark = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of delivered) map.set(row.mark, (map.get(row.mark) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [delivered]);
  if (view === "details") {
    const open = data.rows.length - delivered.length;
    return (
      <DetailTable
        caption={`${delivered.length} delivered · ${open} still open · ${data.rangeLabel}`}
        rows={data.rows}
        extra={data.tab === "all"}
      />
    );
  }
  return (
    <>
      <section className="kpis" aria-label="Deliveries">
        <Kpi value={data.metrics.deliveries} label="Delivered" tone="good" />
        <Kpi value={data.metrics.open} label="Still open" tone={data.metrics.open ? "attention" : undefined} />
        <Kpi
          value={`${data.usedRows ? Math.round((data.metrics.deliveries / data.usedRows) * 100) : 0}%`}
          label="Delivered share"
        />
        <Kpi value={data.usedRows} label="Lines in range" />
      </section>
      <section className="grid2">
        <BarChart
          title="Delivered vs open"
          when={when}
          unit="rows"
          items={[
            { label: "Delivered", value: data.metrics.deliveries },
            { label: "Open", value: data.metrics.open },
          ]}
        />
        {showLineCharts ? (
          <BarChart
            title="Delivered lines, by mark"
            when={when}
            unit="rows"
            items={byMark.map(([label, value]) => ({ label, value }))}
          />
        ) : null}
        <ColumnChart
          title={period === "week" ? "Lines in vs delivered, Mon–Sat" : "Lines in vs delivered, by day"}
          when={`By date received · ${when}`}
          unit="rows"
          items={days.map((item) => ({
            label: item.label.replace(" ", "\u00a0"),
            value: item.rows,
            parts: [
              { label: "Delivered", value: item.deliveries },
              { label: "Still open", value: Math.max(0, item.rows - item.deliveries) },
            ],
          }))}
        />
      </section>
    </>
  );
}

function MarksTab({ data, view, when }: { data: SheetPayload; view: View; when: string }) {
  if (view === "details") {
    return (
      <table className="details">
        <caption>Marks · {data.rangeLabel}</caption>
        <thead>
          <tr>
            <th>Mark</th>
            <th className="num">Kg</th>
            <th className="num">Lines</th>
            <th className="num">Deliveries</th>
            <th className="num">Shipments</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.marks.map((mark) => (
            <tr key={mark.mark}>
              <td><MarkLabel value={mark.mark} /></td>
              <td className="num">{formatKg(mark.kg)}</td>
              <td className="num">{mark.rows}</td>
              <td className="num">{mark.deliveries}</td>
              <td className="num">{mark.shipments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <section className="grid2">
      <BarChart
        title="Kg received, by mark"
        when={when}
        items={data.metrics.marksTop
          .filter((item) => item.mark !== "Other")
          .map((item) => ({ label: item.mark, value: item.kg }))}
      />
      <BarChart
        title="Kg in warehouse, by mark"
        when={data.rangeLabel}
        items={data.metrics.warehouse.marks
          .filter((item) => item.label !== "Other")
          .map((item) => ({ label: item.label, value: item.kg }))}
      />
    </section>
  );
}

function ShipmentsTab({
  data,
  view,
  when,
  showLineCharts,
}: {
  data: SheetPayload;
  view: View;
  when: string;
  showLineCharts: boolean;
}) {
  if (view === "details") {
    return (
      <table className="details">
        <caption>Shipments · {data.rangeLabel}</caption>
        <thead>
          <tr>
            <th>Shipment</th>
            <th className="num">Kg</th>
            <th className="num">Lines</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.byShipment.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td className="num">{formatKg(item.kg)}</td>
              <td className="num">{item.rows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <section className="grid2">
      <BarChart
        title="Kg on shipments that exist"
        when={when}
        items={data.metrics.byShipment.map((item) => ({ label: item.label, value: item.kg }))}
      />
      {showLineCharts ? (
        <BarChart
          title="Lines on shipments that exist"
          when={when}
          unit="rows"
          items={data.metrics.byShipment.map((item) => ({ label: item.label, value: item.rows }))}
        />
      ) : null}
    </section>
  );
}

function Kpi({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: "good" | "attention";
}) {
  return (
    <article>
      <div className={`value ${tone ?? ""}`}>{value}</div>
      <div className="label">{label}</div>
    </article>
  );
}

function DetailTable({
  caption,
  rows,
  extra,
}: {
  caption: string;
  rows: SheetRow[];
  extra?: boolean;
}) {
  const ordered = [...rows].reverse();
  return (
    <div className="details-wrap">
      <table className="details">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Date</th>
            {extra ? <th>Lane</th> : null}
            <th>Shipment</th>
            <th>Mark</th>
            <th className="num">Kg</th>
            <th className="num">Cartons</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, index) => (
            <tr key={`${row.lane}-${row.shipment}-${row.date}-${index}`}>
              <td>{row.date || "—"}</td>
              {extra ? <td>{row.lane || "—"}</td> : null}
              <td>{row.shipment || "—"}</td>
              <td><MarkLabel value={row.mark} /></td>
              <td className="num">{row.kg == null ? "—" : formatKg(row.kg)}</td>
              <td className="num">{row.cartons == null ? "—" : row.cartons}</td>
              <td>{row.status || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function laneLabel(tab: string): string {
  if (tab === "all") return "SEA + AIR";
  return tab;
}
