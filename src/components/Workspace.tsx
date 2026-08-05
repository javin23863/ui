import { useState } from "react";
import { Camera, Check, ChevronDown, ChevronsLeft, Code2, Copy, LineChart, Play, Settings, Star, TrendingUp, X } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import ChartPane from "./ChartPane";
import BacktestPanel, { summaryKpis } from "./BacktestPanel";
import { EquityCurve } from "./charts";
import SettingsModal from "./SettingsModal";
import TickerPicker from "./TickerPicker";
import { AssetBadge, cx, KpiStrip } from "../ui";
import type { Profile } from "../runs";
import { equity, pineSource, RUN_SYMBOL, RUN_TIMEFRAME, summary } from "../fixtures/market";

type View = "chart" | "code" | "backtest";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "D", "W"] as const;

export default function Workspace({
  title,
  hasStrategy,
  onCollapseChat,
  chatCollapsed,
  onSaveRun,
  isRunSaved,
  symbol,
  timeframe,
  onSymbol,
  onTimeframe,
}: {
  title: string;
  hasStrategy: boolean;
  onCollapseChat: () => void;
  chatCollapsed: boolean;
  /** The chart identity is owned by App: the Screener's "scope to the loaded
   *  chart" has to mean the chart actually on screen, not a seeded constant. */
  symbol: string;
  timeframe: string;
  onSymbol: (s: string) => void;
  onTimeframe: (t: string) => void;
  onSaveRun?: (profile: Profile) => void;
  isRunSaved?: (profile: Profile) => boolean;
}) {
  const [view, setView] = useState<View>("chart");
  const [settings, setSettings] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [tfOpen, setTfOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const setTimeframe = onTimeframe;
  const setSymbol = onSymbol;
  // Trade the chart is focused on, set by a Trades Log row click (§8d).
  const [focus, setFocus] = useState<{ n: number; entryTime: number; exitTime: number } | null>(null);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-bg-panel">
      <header className="flex h-9 shrink-0 items-center gap-3 px-4 pt-1">
        <button
          data-apollo-id="collapse-chat"
          aria-label={chatCollapsed ? "Show chat" : "Hide chat"}
          onClick={onCollapseChat}
          className="text-text-muted hover:text-text-primary"
        >
          <ChevronsLeft size={14} className={cx("transition-transform", chatCollapsed && "rotate-180")} />
        </button>
        <div className="flex items-center gap-2.5">
          {(
            [
              ["chart", LineChart],
              ["code", Code2],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              data-apollo-id={`view-${v}`}
              aria-label={`${v} view`}
              aria-pressed={view === v || (v === "chart" && view === "backtest")}
              onClick={() => setView(v)}
              className={cx(
                "transition-colors",
                view === v || (v === "chart" && view === "backtest") ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
              )}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <h2 className="text-[15px] font-medium">{title}</h2>
        {hasStrategy && (
          <button data-apollo-id="strategy-settings" aria-label="Strategy settings" onClick={() => setSettings(true)} className="text-text-muted hover:text-text-primary">
            <Settings size={13} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {view === "code" ? (
            <>
              <button
                data-apollo-id="copy-code"
                // The Clipboard API is absent outside a secure context and can be
                // denied by policy. Unhandled, the rejection escapes and the
                // button silently keeps saying "Copy" — the failure has to be
                // visible, since the user's next move depends on it having worked.
                onClick={async () => {
                  try {
                    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
                    await navigator.clipboard.writeText(pineSource.trim());
                    setCopyState("ok");
                  } catch {
                    setCopyState("fail");
                  }
                  setTimeout(() => setCopyState("idle"), 2000);
                }}
                className={cx(
                  "flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] hover:text-text-primary",
                  copyState === "fail" ? "text-loss" : "text-text-secondary",
                )}
              >
                {copyState === "ok" ? (
                  <Check size={13} className="text-profit" />
                ) : copyState === "fail" ? (
                  <X size={13} />
                ) : (
                  <Copy size={13} />
                )}
                {copyState === "ok" ? "Copied" : copyState === "fail" ? "Copy failed" : "Copy"}
              </button>
              <button
                data-apollo-id="run-code"
                // Applies the script to the chart, which is what Run does here.
                // It does not compile Pine — capabilities are out of scope — so it
                // must not imply a compile step it cannot perform.
                onClick={() => setView("chart")}
                className="flex h-8 items-center gap-1.5 rounded-md bg-bg-elevated px-3 text-[13px]"
              >
                <Play size={13} /> Run
              </button>
            </>
          ) : (
            hasStrategy &&
            view === "chart" && (
              <button
                data-apollo-id="open-backtest"
                onClick={() => setView("backtest")}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-text-secondary hover:text-text-primary"
              >
                <TrendingUp size={13} /> Backtest
              </button>
            )
          )}
          <button data-apollo-id="snapshot" aria-label="Snapshot" className="text-text-muted hover:text-text-primary">
            <Camera size={15} />
          </button>
        </div>
      </header>

      {view === "backtest" ? (
        <BacktestPanel
          onCollapse={() => setView("chart")}
          onSaveRun={onSaveRun}
          isRunSaved={isRunSaved}
          onShowOnChart={(t) => {
            // A trade only exists on the chart it was taken on, so go there
            // rather than pointing at its timestamps on whatever is loaded.
            setSymbol(RUN_SYMBOL);
            setTimeframe(RUN_TIMEFRAME);
            setFocus(t);
            setView("chart");
          }}
        />
      ) : view === "code" ? (
        <CodeView />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex items-center gap-2 px-4 pt-3 pb-1">
            <button
              data-apollo-id="symbol-picker"
              onClick={() => setPicker((p) => !p)}
              className="flex h-8 items-center gap-1.5 rounded-md bg-bg-panel px-2 text-[13px] hover:bg-bg-hover"
            >
              <AssetBadge symbol={symbol} />
              {symbol}
              <span className="size-1.5 rounded-full bg-profit" />
              <ChevronDown size={12} className="text-text-muted" />
            </button>
            <div className="relative">
              <button
                data-apollo-id="timeframe"
                onClick={() => setTfOpen((o) => !o)}
                className="flex h-8 items-center gap-1 rounded-md bg-bg-panel px-2 text-[13px] hover:bg-bg-hover"
              >
                {timeframe}
                <ChevronDown size={12} className="text-text-muted" />
              </button>
              {tfOpen && (
                <ul className="absolute top-9 left-0 z-30 w-20 rounded-lg border border-border bg-bg-elevated p-1 shadow-xl">
                  {TIMEFRAMES.map((tf) => (
                    <li key={tf}>
                      <button
                        data-apollo-id={`tf-${tf}`}
                        onClick={() => {
                          setTimeframe(tf);
                          if (tf !== RUN_TIMEFRAME) setFocus(null);
                          setTfOpen(false);
                        }}
                        className={cx(
                          "w-full rounded px-2 py-1 text-left text-[13px] hover:bg-bg-hover",
                          tf === timeframe && "text-accent",
                        )}
                      >
                        {tf}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button data-apollo-id="indicators" aria-label="Indicators" className="grid size-8 place-items-center rounded-md text-text-muted hover:text-text-primary">
              <LineChart size={14} />
            </button>
            <button data-apollo-id="chart-settings" aria-label="Chart settings" className="grid size-8 place-items-center rounded-md text-text-muted hover:text-text-primary">
              <Settings size={14} />
            </button>
            {picker && (
              <TickerPicker
                current={symbol}
                onPick={(s) => {
                  setSymbol(s);
                  // A focused trade belongs to the run's chart; leaving it set
                  // would keep claiming "Showing trade #N" on a different market.
                  if (s !== RUN_SYMBOL) setFocus(null);
                  setPicker(false);
                }}
                onClose={() => setPicker(false)}
              />
            )}
          </div>

          {focus && (
            <div className="mx-4 mb-1 flex items-center gap-2 rounded-md bg-bg-elevated px-3 py-1.5 text-[11px]">
              <span className="text-text-muted">Showing trade</span>
              <span className="tnum">#{focus.n}</span>
              <button
                data-apollo-id="clear-trade-focus"
                onClick={() => setFocus(null)}
                className="ml-auto text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
            </div>
          )}
          {hasStrategy && (symbol !== RUN_SYMBOL || timeframe !== RUN_TIMEFRAME) && (
            <div className="mx-4 mb-1 rounded-md bg-bg-elevated px-3 py-1.5 text-[11px] text-text-muted">
              Showing {symbol} {timeframe}. The backtest below was run on {RUN_SYMBOL} {RUN_TIMEFRAME}
              — its trades are not drawn here.
            </div>
          )}
          <div className="min-h-0 flex-1">
            <ChartPane symbol={symbol} timeframe={timeframe} withTrades={hasStrategy} focus={focus} />
          </div>

          {hasStrategy && (
            <button
              data-apollo-id="backtest-dock"
              onClick={() => setView("backtest")}
              className="shrink-0 cursor-pointer border-t border-border pt-3 text-left"
            >
              <div className="flex items-center gap-2 px-4">
                <h3 className="text-[13px] font-semibold">Backtest Summary</h3>
                <span className="text-[12px] text-text-muted">{summary.rangeLabel}</span>
                <Star size={13} className="text-text-muted" />
              </div>
              <KpiStrip items={summaryKpis().slice(0, 4)} />
              <EquityCurve data={equity} height={70} compact apolloId="equity-dock" />
            </button>
          )}
        </div>
      )}

      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </section>
  );
}

function CodeView() {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4">
      <Highlight theme={themes.vsDark} code={pineSource.trim()} language="javascript">
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="font-mono text-[12px] leading-[1.5]" data-apollo-id="code-editor">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className={cx("flex", i === 0 && "bg-[#1b2333]")}>
                <span className="w-11 shrink-0 pr-3 text-right text-text-muted select-none">{i + 1}</span>
                <span className="whitespace-pre">
                  {line.map((token, k) => (
                    <span key={k} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
