type BarPart = { label: string; value: number };
type BarItem = { label: string; value: number; note?: string; parts?: BarPart[] };

const PART_CLASS: Record<string, string> = {
  "SEA GOODS": "col-sea",
  "AIR SHIPMENT": "col-air",
  Delivered: "col-good",
  "Still open": "col-open",
};

const PART_DOT: Record<string, string> = {
  "SEA GOODS": "sea",
  "AIR SHIPMENT": "air",
  Delivered: "good",
  "Still open": "open",
};

export function formatKg(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} t`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function formatAxisKg(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} t`;
  return `${Math.round(value)}`;
}

function formatBarKg(value: number): string {
  if (value <= 0) return "";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${Math.round(value)}`;
}

export function ColumnChart({
  title,
  when,
  items,
  unit = "kg",
}: {
  title: string;
  when: string;
  items: BarItem[];
  unit?: "kg" | "rows";
}) {
  const max = Math.max(
    ...items.map((item) => item.parts?.reduce((sum, part) => sum + part.value, 0) ?? item.value),
    1,
  );
  const width = 720;
  const height = 260;
  const left = 52;
  const bottom = 36;
  const top = 22;
  const innerW = width - left - 8;
  const innerH = height - top - bottom;
  const gap = items.length > 12 ? 2 : 6;
  const barW = items.length ? Math.max(6, innerW / items.length - gap) : 0;
  const stacked = items.some((item) => item.parts && item.parts.length > 1);
  const axisTicks = [0, 0.25, 0.5, 0.75, 1];
  const legend = [...new Set(items.flatMap((item) => item.parts?.map((part) => part.label) ?? []))];
  const formatValue = unit === "rows"
    ? (value: number) => (value > 0 ? `${Math.round(value)}` : "")
    : formatBarKg;
  const formatAxis = unit === "rows"
    ? (value: number) => `${Math.round(value)}`
    : formatAxisKg;

  return (
    <figure className="chart" aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        <span>{when}</span>
      </figcaption>
      {legend.length > 1 ? (
        <p className="chart-legend">
          {legend.map((label) => (
            <span key={label}>
              <span className={`dot ${PART_DOT[label] ?? "sea"}`} /> {label === "SEA GOODS" ? "Sea" : label === "AIR SHIPMENT" ? "Air" : label}
            </span>
          ))}
        </p>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <text x={12} y={14} className="axis-title">
          {unit === "rows" ? "lines" : "kg"}
        </text>
        {axisTicks.map((tick) => {
          const y = top + innerH - innerH * tick;
          const value = max * tick;
          return (
            <g key={tick}>
              <line x1={left} x2={width - 8} y1={y} y2={y} className="grid" />
              <text x={left - 6} y={y + 3} textAnchor="end" className="axis">
                {formatAxis(value)}
              </text>
            </g>
          );
        })}
        {items.map((item, index) => {
          const parts = item.parts?.filter((part) => part.value > 0) ?? [];
          const total = parts.reduce((sum, part) => sum + part.value, 0) || item.value;
          const h = (total / max) * innerH;
          const x = left + index * (barW + gap);
          const y = top + innerH - h;
          const step = items.length > 14 ? Math.ceil(items.length / 10) : 1;
          const showTick = index % step === 0 || index === items.length - 1;
          let offset = 0;
          return (
            <g key={`${item.label}-${index}`}>
              {parts.length ? (
                parts.map((part) => {
                  const partH = (part.value / max) * innerH;
                  const partY = y + h - offset - partH;
                  offset += partH;
                  return (
                    <rect
                      key={part.label}
                      x={x}
                      y={partY}
                      width={barW}
                      height={partH}
                      rx={2}
                      className={PART_CLASS[part.label] ?? "col"}
                    />
                  );
                })
              ) : (
                <rect x={x} y={y} width={barW} height={h} rx={3} className="col" />
              )}
              {total > 0 ? (
                <text
                  x={x + barW / 2}
                  y={Math.max(10, y - 4)}
                  textAnchor="middle"
                  className="bar-value"
                >
                  {formatValue(total)}
                </text>
              ) : null}
              {showTick ? (
                <text
                  x={x + barW / 2}
                  y={height - 12}
                  textAnchor="middle"
                  className="tick"
                >
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function BarChart({
  title,
  when,
  items,
  unit = "kg",
}: {
  title: string;
  when: string;
  items: BarItem[];
  unit?: "kg" | "rows";
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        <span>{when}</span>
      </figcaption>
      <div className="hbar-list">
        {items.map((item) => (
          <div className="hbar" key={item.label}>
            <div className="hbar-label">{item.label}</div>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <div className="hbar-value">
              {unit === "kg" ? formatKg(item.value) : item.value}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function SplitChart({
  title,
  when,
  delivered,
  open,
}: {
  title: string;
  when: string;
  delivered: number;
  open: number;
}) {
  const total = delivered + open || 1;
  const deliveredPct = Math.round((delivered / total) * 100);
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        <span>{when}</span>
      </figcaption>
      <div className="split-nums">
        <div>
          <b className="good">{delivered}</b>
          <span>Delivered</span>
        </div>
        <div>
          <b className="attention">{open}</b>
          <span>Still open</span>
        </div>
      </div>
      <div className="split-track" aria-hidden>
        <span className="good" style={{ width: `${(delivered / total) * 100}%` }} />
        <span className="attention" style={{ width: `${(open / total) * 100}%` }} />
      </div>
      <p className="split-note">{deliveredPct}% of the last 100 lines are delivered</p>
    </figure>
  );
}
