import { useEffect, useRef, useState } from "react";
import {
  BaselineSeries,
  createChart,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

const T = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));

// ─────────────────────────────────────────────────────────────────────────────
// Time-indexed charts → lightweight-charts (§10 split table)
// ─────────────────────────────────────────────────────────────────────────────

/** Equity curve. Baseline series so the sub-water stretch renders in --loss. */
export function EquityCurve({
  data,
  height,
  compact = false,
  apolloId,
}: {
  data: { time: number; value: number; n?: number; side?: string }[];
  height: number;
  compact?: boolean;
  apolloId: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; n?: number; side?: string; v: number; t: number } | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const c: IChartApi = createChart(host.current, {
      layout: { background: { color: "transparent" }, textColor: T("--color-text-muted"), fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, visible: !compact, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, visible: !compact, timeVisible: false },
      crosshair: compact
        ? { horzLine: { visible: false }, vertLine: { visible: false } }
        : {
            vertLine: { color: T("--color-border-strong"), style: 3, labelVisible: false },
            horzLine: { visible: false },
          },
      handleScroll: !compact,
      handleScale: !compact,
      autoSize: true,
    });

    const s = c.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: T("--color-profit"),
      topFillColor1: "rgba(14,158,143,0.26)",
      topFillColor2: "rgba(14,158,143,0.02)",
      bottomLineColor: T("--color-loss"),
      bottomFillColor1: "rgba(206,64,64,0.02)",
      bottomFillColor2: "rgba(206,64,64,0.26)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
    c.timeScale().fitContent();

    if (!compact) {
      c.subscribeCrosshairMove((p) => {
        const v = p.seriesData.get(s) as { value: number } | undefined;
        if (!p.point || v === undefined) return setTip(null);
        const row = data.find((d) => d.time === (p.time as number));
        setTip({ x: p.point.x, y: p.point.y, n: row?.n, side: row?.side, v: v.value, t: p.time as number });
      });
    }
    return () => c.remove();
  }, [data, compact]);

  return (
    <div className="relative" style={{ height }}>
      <div
        ref={host}
        className="h-full w-full"
        data-apollo-id={apolloId}
        data-apollo-series={JSON.stringify({ kind: "equity", points: data.length, final: data.at(-1)?.value })}
      />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-[150px] rounded-md border border-border bg-bg-elevated p-2.5 shadow-lg"
          style={{ left: Math.min(tip.x + 12, 640), top: Math.max(4, tip.y - 40) }}
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-medium">Trade #{tip.n}</span>
            {tip.side && (
              <span className={`rounded px-1 py-px text-[10px] ${tip.side === "Long" ? "bg-profit/18 text-profit" : "bg-loss/18 text-loss"}`}>
                {tip.side}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="size-1.5 rounded-full bg-profit" /> Cumulative P&amp;L
          </div>
          <div className={`tnum text-[14px] ${tip.v >= 0 ? "text-profit" : "text-loss"}`}>
            {tip.v >= 0 ? "$ " : "-$ "}
            {fmt(Math.abs(tip.v))}
          </div>
          <div className="mt-1 text-[10px] text-text-muted">
            {new Date(tip.t * 1000).toUTCString().slice(0, 16)} (UTC)
          </div>
        </div>
      )}
    </div>
  );
}

/** Net daily P&L — time-indexed histogram, coloured by sign about a zero baseline. */
export function DailyPnl({ data, height = 190 }: { data: { time: number; value: number }[]; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      layout: { background: { color: "transparent" }, textColor: T("--color-text-muted"), fontSize: 9, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: { horzLine: { visible: false }, vertLine: { color: T("--color-border-strong"), style: 3, labelVisible: false } },
      autoSize: true,
    });
    const s = c.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
    s.setData(
      data.map((d) => ({
        time: d.time as Time,
        value: d.value,
        color: d.value >= 0 ? T("--color-profit") : T("--color-loss"),
      })),
    );
    c.timeScale().fitContent();
    return () => c.remove();
  }, [data]);
  return (
    <div
      ref={host}
      style={{ height }}
      data-apollo-id="daily-pnl"
      data-apollo-series={JSON.stringify({ kind: "daily-pnl", bars: data.length })}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-time-indexed charts → inline SVG (§10). All static: no zoom, no pan.
// ─────────────────────────────────────────────────────────────────────────────

const W = 520;
const H = 190;
const PAD = { l: 34, r: 8, t: 10, b: 20 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

function Axis({ ticks, fmtT }: { ticks: number[]; fmtT: (n: number) => string }) {
  return (
    <>
      {ticks.map((t, i) => (
        <text key={i} x={PAD.l - 6} y={t} textAnchor="end" dominantBaseline="middle" className="fill-text-muted text-[9px]">
          {fmtT(t)}
        </text>
      ))}
    </>
  );
}

/** Category-indexed bars — used by Weekday Performance, which is in the PARITY set. */
export function CategoryBars({
  data,
  yLabel,
  apolloId,
}: {
  data: { label: string; value: number }[];
  yLabel: string;
  apolloId: string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value))) || 1;
  const zero = PAD.t + plotH / 2;
  const bw = plotW / data.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={yLabel}
      data-apollo-id={apolloId}
      data-apollo-series={JSON.stringify({ kind: "category-bars", data })}
    >
      <line x1={PAD.l} x2={W - PAD.r} y1={zero} y2={zero} className="stroke-border" strokeWidth={1} />
      {[-max, -max / 2, 0, max / 2, max].map((v, i) => (
        <text key={i} x={PAD.l - 6} y={zero - (v / max) * (plotH / 2)} textAnchor="end" dominantBaseline="middle" className="fill-text-muted text-[9px]">
          {fmt(v)}
        </text>
      ))}
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * (plotH / 2);
        const x = PAD.l + i * bw + bw * 0.28;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={d.value >= 0 ? zero - h : zero}
              width={bw * 0.44}
              height={Math.max(h, d.value === 0 ? 0 : 1)}
              rx={2}
              className={d.value >= 0 ? "fill-profit" : "fill-loss"}
            >
              <title>{`${d.label}: ${d.value.toFixed(2)}`}</title>
            </rect>
            <text x={PAD.l + i * bw + bw / 2} y={H - 5} textAnchor="middle" className="fill-text-muted text-[9px]">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Cost sensitivity — x is dollars per round turn, not time (§8c.2). */
export function CostCurve({
  points,
  modelled,
  breakeven,
  apolloId,
}: {
  points: { cost: number; net: number }[];
  modelled: number;
  breakeven: number | null;
  apolloId: string;
}) {
  const xs = points.map((p) => p.cost);
  const ys = points.map((p) => p.net);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys);
  const X = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const Y = (v: number) => PAD.t + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  // Draw each polarity only where it actually exists. Clamping every point into
  // both paths would paint a flat line along zero for the polarity that never
  // occurs — a series the data does not contain.
  const seg = (above: boolean) => {
    const pts = points.filter((p) => (above ? p.net >= 0 : p.net <= 0));
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.cost)},${Y(p.net)}`).join(" ");
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Net profit against modelled cost per round turn"
      data-apollo-id={apolloId}
      data-apollo-series={JSON.stringify({ kind: "cost-sensitivity", modelled, breakeven, points })}
    >
      <Axis ticks={[Y(yMax), Y((yMax + yMin) / 2), Y(yMin)]} fmtT={(t) => fmt(yMin + ((PAD.t + plotH - t) / plotH) * (yMax - yMin))} />
      <line x1={PAD.l} x2={W - PAD.r} y1={Y(0)} y2={Y(0)} className="stroke-border" />
      <path d={seg(true)} fill="none" className="stroke-profit" strokeWidth={2} />
      <path d={seg(false)} fill="none" className="stroke-loss" strokeWidth={2} />
      {[
        { v: modelled, label: "Modelled", cls: "stroke-text-muted" },
        ...(breakeven !== null && breakeven <= xMax ? [{ v: breakeven, label: "Breakeven", cls: "stroke-warning" }] : []),
      ].map((m) => (
        <g key={m.label}>
          <line x1={X(m.v)} x2={X(m.v)} y1={PAD.t} y2={PAD.t + plotH} className={m.cls} strokeWidth={1} strokeDasharray="3 3" />
          <text x={X(m.v) + 4} y={PAD.t + 9} className="fill-text-muted text-[9px]">
            {m.label}
          </text>
        </g>
      ))}
      <text x={W - PAD.r} y={H - 5} textAnchor="end" className="fill-text-muted text-[9px]">
        ${xMax.toFixed(0)}/RT
      </text>
      <text x={PAD.l} y={H - 5} className="fill-text-muted text-[9px]">
        $0
      </text>
    </svg>
  );
}

/** Per-trade R distribution — bins, not time (§8c.4). */
export function RDistribution({ values, apolloId }: { values: number[]; apolloId: string }) {
  const BIN = 0.25;
  const lo = Math.floor(Math.min(...values) / BIN) * BIN;
  const hi = Math.ceil(Math.max(...values) / BIN) * BIN;
  const bins: { x: number; n: number }[] = [];
  for (let x = lo; x < hi; x += BIN) bins.push({ x, n: values.filter((v) => v >= x && v < x + BIN).length });
  const maxN = Math.max(...bins.map((b) => b.n)) || 1;
  const X = (v: number) => PAD.l + ((v - lo) / (hi - lo || 1)) * plotW;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Distribution of per-trade return in R"
      data-apollo-id={apolloId}
      data-apollo-series={JSON.stringify({ kind: "r-distribution", bin: BIN, mean, median, bins })}
    >
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="stroke-border" />
      {bins.map((b) => {
        const h = (b.n / maxN) * plotH;
        return (
          <rect
            key={b.x}
            x={X(b.x) + 0.5}
            y={PAD.t + plotH - h}
            width={Math.max(1, plotW / bins.length - 1.5)}
            height={h}
            rx={2}
            className={b.x >= 0 ? "fill-profit" : "fill-loss"}
          >
            <title>{`${b.x.toFixed(2)}R to ${(b.x + BIN).toFixed(2)}R: ${b.n} trades`}</title>
          </rect>
        );
      })}
      {[
        { v: mean, label: "mean" },
        { v: median, label: "median" },
      ].map((m) => (
        <g key={m.label}>
          <line x1={X(m.v)} x2={X(m.v)} y1={PAD.t} y2={PAD.t + plotH} className="stroke-text-muted" strokeDasharray="3 3" />
          <text x={X(m.v) + 3} y={PAD.t + 8} className="fill-text-muted text-[9px]">
            {m.label}
          </text>
        </g>
      ))}
      <text x={X(0)} y={H - 5} textAnchor="middle" className="fill-text-muted text-[9px]">
        0R
      </text>
    </svg>
  );
}

/** MAE / MFE scatter — R on both axes (§8c.5). ~40 lines, no library. */
export function MaeMfeScatter({
  points,
  apolloId,
}: {
  points: { mae: number; mfe: number; win: boolean }[];
  apolloId: string;
}) {
  const maxMfe = Math.max(...points.map((p) => p.mfe), 1);
  const minMae = Math.min(...points.map((p) => p.mae), -1);
  const X = (v: number) => PAD.l + ((v - minMae) / (0 - minMae || 1)) * plotW;
  const Y = (v: number) => PAD.t + plotH - (v / maxMfe) * plotH;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Maximum adverse against maximum favourable excursion, per trade"
      data-apollo-id={apolloId}
      data-apollo-series={JSON.stringify({ kind: "mae-mfe", points })}
    >
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="stroke-border" />
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="stroke-border" />
      {points.map((p, i) => (
        <circle key={i} cx={X(p.mae)} cy={Y(p.mfe)} r={3} className={p.win ? "fill-profit" : "fill-loss"} opacity={0.55}>
          <title>{`MAE ${p.mae.toFixed(2)}R · MFE ${p.mfe.toFixed(2)}R`}</title>
        </circle>
      ))}
      <text x={PAD.l + 2} y={PAD.t + 8} className="fill-text-muted text-[9px]">
        MFE (R)
      </text>
      <text x={W - PAD.r} y={H - 5} textAnchor="end" className="fill-text-muted text-[9px]">
        MAE (R) → 0
      </text>
    </svg>
  );
}

/** Overlaid duration histograms, winners against losers (§8c.6). */
export function DurationHistogram({ wins, losses, apolloId }: { wins: number[]; losses: number[]; apolloId: string }) {
  const all = [...wins, ...losses];
  const hi = Math.max(...all);
  const BINS = 12;
  const step = hi / BINS;
  const count = (arr: number[], i: number) => arr.filter((v) => v >= i * step && v < (i + 1) * step).length;
  const maxN = Math.max(...Array.from({ length: BINS }, (_, i) => Math.max(count(wins, i), count(losses, i)))) || 1;
  const bw = plotW / BINS;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Bars held, winners against losers"
      data-apollo-id={apolloId}
      data-apollo-series={JSON.stringify({ kind: "duration", bins: BINS, step })}
    >
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="stroke-border" />
      {Array.from({ length: BINS }, (_, i) => (
        <g key={i}>
          {(
            [
              [count(wins, i), "fill-profit"],
              [count(losses, i), "fill-loss"],
            ] as const
          ).map(([n, cls], k) => (
            <rect
              key={k}
              x={PAD.l + i * bw + 1}
              y={PAD.t + plotH - (n / maxN) * plotH}
              width={bw - 2}
              height={(n / maxN) * plotH}
              rx={2}
              className={cls}
              opacity={0.45}
            />
          ))}
        </g>
      ))}
      <text x={PAD.l} y={H - 5} className="fill-text-muted text-[9px]">
        0 bars
      </text>
      <text x={W - PAD.r} y={H - 5} textAnchor="end" className="fill-text-muted text-[9px]">
        {hi} bars
      </text>
    </svg>
  );
}
