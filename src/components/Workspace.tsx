import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, ChevronsLeft, Code2, Copy, LineChart, Play, Settings, Star, TrendingUp, X } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import ChartPane from "./ChartPane";
import BacktestPanel, { summaryKpis } from "./BacktestPanel";
import { EquityCurve } from "./charts";
import SettingsModal from "./SettingsModal";
import TickerPicker from "./TickerPicker";
import { AssetBadge, cx, KpiStrip, useDismiss } from "../ui";
import type { Profile } from "../runs";
import { equity, RUN_SYMBOL, RUN_TIMEFRAME, summary } from "../fixtures/market";
import { CANONICAL, isDerived, LANGUAGES, languageFor, NO_EQUIVALENT, type LanguageId } from "../languages";

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
  // §17a. Lifted to the workspace because the header's Copy/Run and the pane
  // below it must act on the SAME selection. Keeping it inside CodeView is how
  // Copy ends up wired to a buffer the pane is not showing.
  const [lang, setLang] = useState<LanguageId>(CANONICAL);
  const active = languageFor(lang);
  const derived = isDerived(lang);
  const [tfOpen, setTfOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const setTimeframe = onTimeframe;
  const setSymbol = onSymbol;
  // Trade the chart is focused on, set by a Trades Log row click (§8d).
  const [focus, setFocus] = useState<{ n: number; entryTime: number; exitTime: number } | null>(null);

  const langBox = useRef<HTMLDivElement>(null);
  const tfBox = useRef<HTMLDivElement>(null);
  useDismiss(langBox, langOpen, useCallback(() => setLangOpen(false), []));
  useDismiss(tfBox, tfOpen, useCallback(() => setTfOpen(false), []));
  // A dropdown left open on one view is still open when its view comes back,
  // because the state outlives the control that renders it. Closing both on any
  // view change is one rule rather than a clear at each of the several places
  // that call `setView`.
  useEffect(() => {
    setLangOpen(false);
    setTfOpen(false);
  }, [view]);

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
              {/* §17a — a list, not hardcoded buttons, and §0g declares it as a
                  third control in a header §7 observed as carrying two. */}
              <div className="relative" ref={langBox}>
                <button
                  data-apollo-id="code-language"
                  aria-haspopup="listbox"
                  aria-expanded={langOpen}
                  onClick={() => setLangOpen((o) => !o)}
                  className="flex h-8 items-center gap-1 rounded-md bg-bg-panel px-2 text-[13px] hover:bg-bg-hover"
                >
                  {active.label}
                  <ChevronDown size={12} className="text-text-muted" />
                </button>
                {langOpen && (
                  <div
                    role="listbox"
                    className="absolute top-9 left-0 z-20 w-36 rounded-md border border-border bg-bg-elevated py-1 shadow-lg"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.id}
                        role="option"
                        aria-selected={l.id === lang}
                        data-apollo-id={`code-language-${l.id}`}
                        onClick={() => {
                          setLang(l.id);
                          setLangOpen(false);
                        }}
                        className={cx(
                          "block w-full px-2.5 py-1 text-left text-[13px] hover:bg-bg-hover",
                          l.id === lang ? "text-text-primary" : "text-text-secondary",
                        )}
                      >
                        {l.label}
                        {l.id === CANONICAL && <span className="ml-1.5 text-[11px] text-text-muted">canonical</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                data-apollo-id="copy-code"
                // The Clipboard API is absent outside a secure context and can be
                // denied by policy. Unhandled, the rejection escapes and the
                // button silently keeps saying "Copy" — the failure has to be
                // visible, since the user's next move depends on it having worked.
                onClick={async () => {
                  try {
                    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
                    // §17a — what the pane is SHOWING. This read `pineSource`
                    // unconditionally, which was correct only while one
                    // language existed and became the label-without-its-data
                    // defect the moment a second did.
                    await navigator.clipboard.writeText(active.source.trim());
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
                //
                // §17a/§17b — and on a DERIVED language it refuses. The chart it
                // switches to shows the canonical run; leaving Run live under a
                // translation would be the layout claiming that translation
                // produced what appears next. That is the sharpest place on this
                // surface to imply an execution that never happened.
                disabled={derived}
                onClick={() => setView("chart")}
                className={cx(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px]",
                  derived ? "cursor-not-allowed bg-bg-panel text-text-muted" : "bg-bg-elevated",
                )}
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
        <CodeView lang={lang} />
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
            <div className="relative" ref={tfBox}>
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

function CodeView({ lang }: { lang: LanguageId }) {
  const l = languageFor(lang);
  const derived = isDerived(lang);
  const canonicalLabel = languageFor(CANONICAL).label;
  const source = l.source.trim();

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4">
      {/* §17b — the canonical/derived LABEL. This is a positive requirement in
          its own right, not something the absence of numbers on this view
          satisfies by accident: "which language is canonical" is a fact the
          trader cannot infer from a layout that simply shows nothing. */}
      <div
        data-apollo-id="code-provenance"
        className={cx(
          "mb-3 rounded-md border px-3 py-2 text-[11px] leading-[1.6]",
          derived ? "border-warning/40 bg-warning/10" : "border-border bg-bg-elevated",
        )}
      >
        <strong className={derived ? "text-warning" : "text-text-primary"}>
          {l.label} — {derived ? "derived translation" : "canonical"}
        </strong>{" "}
        <span className="text-text-secondary">
          {derived ? (
            <>
              Hand-written from the {canonicalLabel} source and never executed. Every number recorded
              against this run was produced from {canonicalLabel}, not from this text, and{" "}
              <code>Run</code> is unavailable here for that reason.
            </>
          ) : (
            <>This is the source the run was executed from. The numbers recorded against it came from this text.</>
          )}
        </span>
        <div className="mt-1 text-text-muted">{l.highlightNote}</div>
      </div>

      <Highlight theme={themes.vsDark} code={source} language={l.highlight}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="font-mono text-[12px] leading-[1.5]" data-apollo-id="code-editor">
            {tokens.map((line, i) => {
              // §17b — the refusal is rendered AT THE LINE, not as a banner over
              // the pane. Read from the buffer's own text, so the pane cannot
              // mark a line the clipboard does not carry.
              // Joined, not per-token: Prism may split a comment across tokens
              // (it already does on Pine's licence URL), and a per-token test
              // would miss a marker that straddles the boundary.
              const refuses = line.map((t) => t.content).join("").includes(NO_EQUIVALENT);
              return (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  data-apollo-id={refuses ? "code-no-equivalent" : undefined}
                  // The left rule is on EVERY line, transparent when the line
                  // has an equivalent — otherwise marked lines shift 2px and
                  // the observed right-aligned gutter (§7) stops lining up.
                  className={cx(
                    "flex border-l-2",
                    i === 0 && "bg-[#1b2333]",
                    refuses ? "border-warning bg-warning/10" : "border-transparent",
                  )}
                >
                  <span className="w-11 shrink-0 pr-3 text-right text-text-muted select-none">{i + 1}</span>
                  <span className="whitespace-pre">
                    {line.map((token, k) => (
                      <span key={k} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
