import { useState } from "react";
import { Minimize2, Star } from "lucide-react";
import { CategoryBars, DailyPnl, EquityCurve } from "./charts";
import { Card, cx, KpiStrip, Legend, Signed } from "../ui";
import { dailyPnl, equity, metrics, summary, weekdayPnl } from "../fixtures/market";
import TradesAnalysis from "./TradesAnalysis";
import TradesLog from "./TradesLog";

const TABS = ["Performance", "Trades Analysis", "Trades Log"] as const;
export type Tab = (typeof TABS)[number];

export function summaryKpis() {
  return [
    { label: "Net Profit", value: <Signed value={summary.netProfit} unit="USD" /> },
    { label: "Trades", value: <span className="tnum">{summary.trades}</span> },
    {
      label: "Win Rate",
      value: <span className="tnum">{summary.winRate.toFixed(2)}%</span>,
      sub: `${summary.wins} | ${summary.losses}`,
    },
    {
      label: "Max Drawdown",
      value: <span className="tnum">{summary.maxDrawdown.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</span>,
      sub: `${summary.maxDrawdownPct.toFixed(2)}%`,
    },
    {
      label: "Profit Factor",
      value: <span className={cx("tnum", summary.profitFactor > 1 ? "text-profit" : "text-loss")}>{summary.profitFactor.toFixed(3)}</span>,
    },
  ];
}

export default function BacktestPanel({
  onCollapse,
  onShowOnChart,
}: {
  onCollapse: () => void;
  onShowOnChart?: (t: { n: number; entryTime: number; exitTime: number }) => void;
}) {
  const [tab, setTab] = useState<Tab>("Performance");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-3">
        <span className="flex h-7 items-center gap-1.5 rounded-md bg-bg-panel px-2 text-[13px]">
          <span className="grid size-4 place-items-center rounded-full bg-warning/25 text-[8px] text-warning">Au</span>
          {summary.symbol}
        </span>
        <span className="flex h-7 items-center rounded-md bg-bg-panel px-2 text-[13px] text-text-muted">{summary.timeframe}</span>
        <h2 className="ml-1 text-[13px] font-semibold">Backtest Results</h2>
        <span className="text-[12px] text-text-muted">{summary.rangeLabel}</span>
        <button data-apollo-id="favourite-run" aria-label="Favourite" className="text-text-muted hover:text-text-primary">
          <Star size={13} />
        </button>
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
        {tab === "Performance" && <Performance />}
        {tab === "Trades Analysis" && <TradesAnalysis />}
        {tab === "Trades Log" && <TradesLog onShowOnChart={onShowOnChart} />}
      </div>
    </div>
  );
}

function Performance() {
  return (
    <>
      <div className="pt-2">
        <EquityCurve data={equity} height={255} apolloId="equity-expanded" />
      </div>
      <KpiStrip items={summaryKpis()} />

      <h2 className="mt-6 mb-3 text-[16px] font-semibold">Performance</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "64fr 36fr" }}>
        <Card title="Net Daily PNL (USD)">
          <DailyPnl data={dailyPnl} />
          <Legend items={[{ label: "Profit", color: "var(--color-profit)" }, { label: "Loss", color: "var(--color-loss)" }]} />
        </Card>
        <Card title="Weekday Performance (USD)">
          <CategoryBars data={weekdayPnl} yLabel="Weekday P&L" apolloId="weekday-performance" />
          <Legend items={[{ label: "Profit", color: "var(--color-profit)" }, { label: "Loss", color: "var(--color-loss)" }]} />
        </Card>
      </div>

      <div className="mt-5">
        <div className="flex justify-end pb-1">
          <div className="flex gap-1 text-[11px]">
            {["All", "Long", "Short"].map((f, i) => (
              <button
                key={f}
                data-apollo-id={`metrics-filter-${f.toLowerCase()}`}
                className={cx("rounded px-2 py-0.5", i === 0 ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <dl>
          {metrics.map((m) => (
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
