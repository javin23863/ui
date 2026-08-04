import { useState } from "react";
import { ChevronDown, Clock, Hexagon, PencilLine, Radar, Sparkles, User } from "lucide-react";
import ChatPane, { type Turn } from "./components/ChatPane";
import Workspace from "./components/Workspace";
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

  const send = (text: string) => {
    setTurns((t) => [...t, { id: `u${t.length}`, source: "user", text }, ...(t.length === 0 ? SCRIPT : [])]);
  };

  const hasStrategy = turns.length > 0;

  return (
    <div className="flex h-full bg-bg-app">
      <nav className="flex w-10 shrink-0 flex-col items-center pt-3.5" aria-label="Primary">
        <Hexagon size={19} className="mb-6 text-accent" />
        {RAIL.map((r) => (
          <button
            key={r.label}
            data-apollo-id={`rail-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
            aria-label={r.label}
            title={r.label}
            className="grid h-11 w-full place-items-center text-icon-idle transition-colors hover:text-text-primary"
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
            <ChatPane turns={turns} onSend={send} />
          </div>
          <div className={cx("w-px shrink-0 bg-border", collapsed && "hidden")} />
          <div className="min-h-0 min-w-0 flex-1 pl-4">
            <Workspace
              title={hasStrategy ? "Sweep and Engulf Strategy" : "My script"}
              hasStrategy={hasStrategy}
              chatCollapsed={collapsed}
              onCollapseChat={() => setCollapsed((c) => !c)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
