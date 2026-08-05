import { useState } from "react";
import { ChevronDown, Clock, Hexagon, PencilLine, Radar, Sparkles, User } from "lucide-react";
import ChatPane, { type Turn } from "./components/ChatPane";
import Workspace from "./components/Workspace";
import StrategyLibrary from "./components/StrategyLibrary";
import ApolloOrb from "./components/ApolloOrb";
import { ApolloContext, type ApolloState } from "./components/useApollo";
import { captureCurrentRun, type Profile, type SavedRun, SEEDED_RUNS } from "./runs";
import { summary } from "./fixtures/market";
import { cx } from "./ui";

const RAIL = [
  { icon: PencilLine, label: "New chat" },
  { icon: Sparkles, label: "Indicators" },
  { icon: Radar, label: "Screener" },
  { icon: Clock, label: "History" },
];

// Scripted exchange — capabilities are out of scope, so the "reply" is a
// fixture. The Apollo turn is included to prove the transcript's speaker model
// and observation attribution render (§13.4), not to imply a live copilot.
const SCRIPT: Turn[] = [
  {
    id: "a1",
    source: "apollo",
    text: `I have written the strategy from your description.

Here is how it identifies the pattern:

- **Bullish sweep:** the current candle's low goes below the previous candle's low, then closes above its high.
- **Bearish sweep:** the current candle's high goes above the previous candle's high, then closes below its low.

The stop sits at \`close - atr * atrMult\` and the target at the risk/reward multiple of that distance. Order size is 1 unit per trade, entries are market orders on the next bar open, so there is no repainting risk.

Check the metrics below the chart and tell me what to filter.`,
    saw: "your chart, 4h XAUUSD",
  },
];

// ?seed=1 starts with the exchange already on screen. Deterministic screenshots
// for the parity gate (§11) — it does not depend on typing timing.
const SEEDED = new URLSearchParams(location.search).has("seed");

export default function App() {
  const [turns, setTurns] = useState<Turn[]>(
    SEEDED ? [{ id: "u0", source: "user", text: "Build a sweep and engulf strategy on gold, 4h." }, ...SCRIPT] : [],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [apollo, setApollo] = useState<ApolloState>("idle");
  const [level, setLevel] = useState(0);
  // §15 — fixture-backed until persistence exists, which is its own card. The
  // library says on screen that these are lost on reload; a save that
  // evaporates SILENTLY is the failure, not one that evaporates.
  const [runs, setRuns] = useState<SavedRun[]>(SEEDED ? SEEDED_RUNS : []);
  const [library, setLibrary] = useState(false);

  // Identity includes the PROFILE. The same strategy, instrument and timeframe
  // under a different profile is a different run with different trades and
  // different numbers, so it must be separately keepable — and the star must
  // not report it as already saved. The profile lives in the backtest panel, so
  // the check is passed down rather than resolved here.
  const isRunSaved = (profile: Profile) =>
    runs.some(
      (r) =>
        r.strategy === summary.strategy &&
        r.symbol === summary.symbol &&
        r.timeframe === summary.timeframe &&
        r.profile === profile,
    );

  const saveRun = (profile: Profile) => {
    if (isRunSaved(profile)) return;
    setRuns((rs) => [captureCurrentRun(profile), ...rs]);
  };

  const send = (text: string) => {
    setTurns((t) => [...t, { id: `u${t.length}`, source: "user", text }, ...(t.length === 0 ? SCRIPT : [])]);
    // Apollo visibly works before it answers. No model runs — capabilities are
    // out of scope — so this only exercises the presence states.
    setApollo("thinking");
    setTimeout(() => setApollo("idle"), 1400);
  };

  const hasStrategy = turns.length > 0;

  return (
    <ApolloContext.Provider
      value={{ state: apollo, level, saw: hasStrategy ? "your chart, 4h XAUUSD" : null, setState: setApollo }}
    >
      <div className="flex h-full bg-bg-app">
      <nav className="flex w-10 shrink-0 flex-col items-center pt-3.5" aria-label="Primary">
        <Hexagon size={19} className="mb-6 text-accent" />
        {RAIL.map((r) => (
          <button
            key={r.label}
            data-apollo-id={`rail-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
            aria-label={r.label}
            title={r.label}
            aria-pressed={r.label === "History" ? library : undefined}
            onClick={r.label === "History" ? () => setLibrary((l) => !l) : undefined}
            className={cx(
              "grid h-11 w-full place-items-center transition-colors hover:text-text-primary",
              r.label === "History" && library ? "text-accent" : "text-icon-idle",
            )}
          >
            <r.icon size={17} />
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[46px] shrink-0 items-center justify-end gap-3 pr-4">
          {hasStrategy && (
            <button data-apollo-id="share-chat" className="h-8 rounded-full bg-bg-panel px-3 text-[13px]">
              Share chat
            </button>
          )}
          <span className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] text-accent">
            <span className="tnum">264,368</span>
          </span>
          <button data-apollo-id="account" aria-label="Account" className="flex items-center gap-1">
            <span className="grid size-7 place-items-center rounded-full bg-bg-elevated">
              <User size={14} className="text-text-muted" />
            </span>
            <ChevronDown size={13} className="text-text-muted" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 gap-0 pr-4 pb-4">
          <div
            className={cx(
              "min-h-0 shrink-0 overflow-hidden transition-[width] duration-200",
              collapsed ? "w-0" : "w-[545px]",
            )}
          >
            <ChatPane turns={turns} onSend={send} onVoice={(s, l) => (setApollo(s), setLevel(l))} />
          </div>
          <div className={cx("w-px shrink-0 bg-border", collapsed && "hidden")} />
          <div className="min-h-0 min-w-0 flex-1 pl-4">
            {library ? (
              <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-bg-panel">
                <StrategyLibrary
                  runs={runs}
                  onArchive={(id, archived) =>
                    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, archived } : r)))
                  }
                />
              </section>
            ) : (
              <Workspace
                title={hasStrategy ? "Sweep and Engulf Strategy" : "My script"}
                hasStrategy={hasStrategy}
                chatCollapsed={collapsed}
                onCollapseChat={() => setCollapsed((c) => !c)}
                onSaveRun={saveRun}
                isRunSaved={isRunSaved}
              />
            )}
          </div>
        </div>
      </div>

      <ApolloOrb
        state={apollo}
        level={level}
        label={apollo === "thinking" ? "Reading your chart…" : null}
        onClick={() => setApollo((s) => (s === "idle" ? "listening" : "idle"))}
      />
      </div>
    </ApolloContext.Provider>
  );
}
