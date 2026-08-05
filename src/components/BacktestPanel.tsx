import { useState } from "react";
import { Minimize2, Star } from "lucide-react";
import { CategoryBars, DailyPnl, EquityCurve } from "./charts";
import { AssetBadge, Card, cx, KpiStrip, Legend, Signed } from "../ui";
import { asPresented, dailyPnl, equity, metricsFor, type SideFilter, statsFor, summary, trades, weekdayPnlFor } from "../fixtures/market";
import type { Profile } from "../runs";
import TradesAnalysis from "./TradesAnalysis";
import TradesLog from "./TradesLog";

const TABS = ["Performance", "Trades Analysis", "Trades Log"] as const;
export type Tab = (typeof TABS)[number];

/** `costsModelled` defaults true: the dock always shows the run as executed. */
export function summaryKpis(costsModelled = true) {
  const s = statsFor(asPresented(trades, costsModelled));
  return [
    { label: "Net Profit", value: <Signed value={s.netProfit} unit="USD" /> },
    { label: "Trades", value: <span className="tnum">{s.trades}</span> },
    {
      label: "Win Rate",
      value: <span className="tnum">{s.winRate.toFixed(2)}%</span>,
      sub: `${s.wins} | ${s.losses}`,
    },
    {
      label: "Max Drawdown",
      value: <span className="tnum">{s.maxDrawdown.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</span>,
      sub: `${s.maxDrawdownPct.toFixed(2)}%`,
    },
    {
      label: "Profit Factor",
      value: <span className={cx("tnum", s.profitFactor > 1 ? "text-profit" : "text-loss")}>{s.profitFactor.toFixed(3)}</span>,
    },
  ];
}

export default function BacktestPanel({
  onCollapse,
  onShowOnChart,
  onSaveRun,
  isRunSaved,
}: {
  onCollapse: () => void;
  onShowOnChart?: (t: { n: number; entryTime: number; exitTime: number }) => void;
  /** §15a — saves the run AS SHOWN, so the entry's numbers and its adequacy
   *  chips come from the same profile the reader is looking at. */
  onSaveRun?: (profile: Profile) => void;
  /** Asked per profile, not once: switching profile changes which run this is. */
  isRunSaved?: (profile: Profile) => boolean;
}) {
  const [tab, setTab] = useState<Tab>("Performance");
  // Owned here so every tab sees the same run (§11 empty-state sweep).
  const [profile, setProfile] = useState<Profile>("full");
  const runSaved = isRunSaved?.(profile) ?? false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-3">
        <span className="flex h-7 items-center gap-1.5 rounded-md bg-bg-panel px-2 text-[13px]">
          <AssetBadge symbol={summary.symbol} />
          {summary.symbol}
        </span>
        <span className="flex h-7 items-center rounded-md bg-bg-panel px-2 text-[13px] text-text-muted">{summary.timeframe}</span>
        <h2 className="ml-1 text-[13px] font-semibold">Backtest Results</h2>
        <span className="text-[12px] text-text-muted">{summary.rangeLabel}</span>
        <button
          data-apollo-id="favourite-run"
          aria-label={runSaved ? "Saved to library" : "Save run to library"}
          title={runSaved ? "Saved to library" : "Save run to library"}
          aria-pressed={runSaved}
          onClick={() => onSaveRun?.(profile)}
          className={cx(runSaved ? "text-accent" : "text-text-muted hover:text-text-primary")}
        >
          <Star size={13} fill={runSaved ? "currentColor" : "none"} />
        </button>
        {runSaved && <span className="text-[11px] text-text-muted">Saved</span>}
        <button
          data-apollo-id="collapse-backtest"
          aria-label="Collapse"
          onClick={onCollapse}
          className="ml-auto text-text-muted hover:text-text-primary"
        >
          <Minimize2 size={14} />
        </button>
      </header>

      <nav className="flex shrink-0 gap-5 px-4 pt-3" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            data-apollo-id={`tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setTab(t)}
            className={cx(
              "-mb-px border-b-2 pb-2 text-[13px] font-medium transition-colors",
              tab === t ? "border-text-primary text-text-secondary" : "border-transparent text-text-muted hover:text-text-secondary",
            )}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="shrink-0 border-b border-border" />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {tab === "Performance" && <Performance costsModelled={profile !== "no-costs"} />}
        {tab === "Trades Analysis" && <TradesAnalysis profile={profile} setProfile={setProfile} />}
        {tab === "Trades Log" && (
          <TradesLog costsModelled={profile !== "no-costs"} regimesTagged={profile !== "no-regimes"} onShowOnChart={onShowOnChart} />
        )}
      </div>
    </div>
  );
}

function Performance({ costsModelled }: { costsModelled: boolean }) {
  // Two independent slices — the weekday card and the metrics table each carry
  // their own control in the reference, so neither drives the other.
  const [metricsSide, setMetricsSide] = useState<SideFilter>("All");
  const [weekdaySide, setWeekdaySide] = useState<SideFilter>("All");

  return (
    <>
      <div className="pt-2">
        <EquityCurve data={equity} height={255} apolloId="equity-expanded" />
      </div>
      <KpiStrip items={summaryKpis(costsModelled)} />

      <h2 className="mt-6 mb-3 text-[16px] font-semibold">Performance</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "64fr 36fr" }}>
        <Card title="Net Daily PNL (USD)">
          <DailyPnl data={dailyPnl} />
          <Legend items={[{ label: "Profit", color: "var(--color-profit)" }, { label: "Loss", color: "var(--color-loss)" }]} />
        </Card>
        <Card title="Weekday Performance (USD)">
          <CategoryBars data={weekdayPnlFor(weekdaySide)} yLabel="Weekday P&L" apolloId="weekday-performance" />
          <Legend items={[{ label: "Profit", color: "var(--color-profit)" }, { label: "Loss", color: "var(--color-loss)" }]} />
          {/* The reference carries a control-shaped "All" under this card's
              legend and nothing at the same spot under Net Daily PNL, so the
              control belongs to this card (§12.2). */}
          <SideTabs value={weekdaySide} onChange={setWeekdaySide} idPrefix="weekday-filter" center />
        </Card>
      </div>

      <div className="mt-5">
        <div className="flex justify-end pb-1">
          <SideTabs value={metricsSide} onChange={setMetricsSide} idPrefix="metrics-filter" />
        </div>
        <dl>
          {metricsFor(metricsSide, costsModelled).map((m) => (
            <div key={m.label} className="flex items-center justify-between border-t border-border py-2">
              <dt className="text-[13px]">{m.label}</dt>
              <dd className={cx("tnum text-[13px]", m.tone === "profit" && "text-profit", m.tone === "loss" && "text-loss")}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

/**
 * All / Long / Short. These buttons used to be static markup with the first one
 * permanently styled active and no handler at all — a control that looks like it
 * filters and does not is worse than no control, because the reader trusts the
 * number beside it.
 */
function SideTabs({
  value,
  onChange,
  idPrefix,
  center,
}: {
  value: SideFilter;
  onChange: (v: SideFilter) => void;
  idPrefix: string;
  center?: boolean;
}) {
  return (
    <div className={cx("flex gap-1 text-[11px]", center && "justify-center pt-1")} role="group">
      {(["All", "Long", "Short"] as const).map((f) => (
        <button
          key={f}
          data-apollo-id={`${idPrefix}-${f.toLowerCase()}`}
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className={cx(
            "rounded px-2 py-0.5",
            value === f ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary",
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
