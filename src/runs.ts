import { asPresented, summary, pineSource, statsFor, trades } from "./fixtures/market";

/**
 * The run model, and the ONE place the adequacy thresholds live.
 *
 * §15b requires the library card to carry "the same adequacy chips Trades
 * Analysis already computes". Only two of the five were ever chips — `Thin
 * sample` and `Sparse`. Top-3 concentration was a coloured KPI column, and
 * `Costs not modelled` / `No holdout` were full-card refusal messages. Copying
 * those three thresholds into library code would be this build's defect class
 * for the seventh time: a label that moves without its data. So the thresholds
 * are declared once here and every surface reads them.
 *
 * `RunFacts` is deliberately the input, not `Profile`. A live run derives its
 * facts from the fixture; a SAVED run carries the facts it was saved with. Same
 * thresholds, two fact sources — which is what makes a saved card and the panel
 * incapable of disagreeing.
 */

export type Profile = "full" | "no-costs" | "no-holdout" | "thin" | "no-regimes";

export const PROFILES: { id: Profile; label: string }[] = [
  { id: "full", label: "Full run" },
  { id: "no-costs", label: "Costs not modelled" },
  { id: "no-holdout", label: "No holdout" },
  { id: "thin", label: "Thin sample" },
  { id: "no-regimes", label: "Untagged regimes" },
];

export const THIN_TRADES = 30;
export const SPARSE_PER_MONTH = 2;
export const CONCENTRATED_TOP3_PCT = 40;

/** Months the full ledger spans. The thin profile is a 12-month slice of it. */
const FULL_MONTHS = 37;
const THIN_MONTHS = 12;

/**
 * Three states, not a boolean. A holdout that is DECLARED but that no trade
 * lands in is not the same claim as one that was never declared, and the panel
 * already says so in two different sentences. Collapsing them here would make
 * the library card unable to tell them apart — gate on the data, not on the
 * declaration.
 */
export type HoldoutState = "ok" | "undeclared" | "declared-empty";

export type RunFacts = {
  trades: number;
  perMonth: number;
  top3Share: number;
  costsModelled: boolean;
  holdout: HoldoutState;
};

export type Warning = { id: string; label: string };

/**
 * The five §15b signals, in one call. Not six: §15b names a closed set, and
 * untagged regimes — which Trades Analysis does refuse on — is deliberately not
 * in it.
 */
export function warningsFor(f: RunFacts): Warning[] {
  const w: Warning[] = [];
  if (f.trades < THIN_TRADES) w.push({ id: "thin", label: "Thin sample" });
  if (f.perMonth < SPARSE_PER_MONTH) w.push({ id: "sparse", label: "Sparse" });
  if (f.top3Share > CONCENTRATED_TOP3_PCT)
    w.push({ id: "top3", label: `Top-3 carries ${f.top3Share.toFixed(0)}% of net` });
  if (!f.costsModelled) w.push({ id: "costs", label: "Costs not modelled" });
  if (f.holdout === "undeclared") w.push({ id: "holdout", label: "No holdout" });
  if (f.holdout === "declared-empty") w.push({ id: "holdout", label: "Holdout declared, no trade in it" });
  return w;
}

export const rowsFor = (profile: Profile) => (profile === "thin" ? trades.slice(0, 11) : trades);

export const costsModelledFor = (profile: Profile) => profile !== "no-costs";

/**
 * The rows a profile PRESENTS — slice and cost treatment together.
 *
 * Everything downstream reads this one call. Fixing the saved headline to be
 * cost-free while `factsForProfile` still derived `top3Share` from the
 * cost-deducted rows put a cost-free Net beside a Top-3 percentage computed
 * against a different net — the same defect one level down from where it was
 * just fixed. A number and the warning that qualifies it have to come from the
 * same representation of the run, not merely from the same slice of it.
 */
export const presentedRowsFor = (profile: Profile) =>
  asPresented(rowsFor(profile), costsModelledFor(profile));

/** The live fixture's facts under a given run profile. */
export function factsForProfile(profile: Profile): RunFacts {
  const rows = presentedRowsFor(profile);
  const net = rows.reduce((s, t) => s + t.net, 0);
  const top3 = [...rows].sort((a, b) => b.net - a.net).slice(0, 3).reduce((s, t) => s + t.net, 0);
  const is = rows.filter((t) => t.sample === "IS").length;
  const oos = rows.filter((t) => t.sample === "OOS").length;
  const declared = profile !== "no-holdout";
  return {
    trades: rows.length,
    perMonth: rows.length / (profile === "thin" ? THIN_MONTHS : FULL_MONTHS),
    top3Share: net > 0 ? (top3 / net) * 100 : 0,
    costsModelled: costsModelledFor(profile),
    holdout: !declared ? "undeclared" : is > 0 && oos > 0 ? "ok" : "declared-empty",
  };
}

export type SavedRun = {
  id: string;
  savedAt: number;
  /** Everything needed to re-open the run — §15a. */
  symbol: string;
  timeframe: string;
  rangeLabel: string;
  strategy: string;
  /**
   * Part of the run's IDENTITY, not decoration. The same strategy on the same
   * instrument and timeframe is a different run under a different profile — it
   * has different trades and different numbers — so two such saves must both be
   * keepable, and the star must not report the second one as already saved.
   */
  profile: Profile;
  source: string;
  /** The facts as they were AT SAVE TIME. A saved run is immutable. */
  facts: RunFacts;
  netProfit: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  /** Editing the strategy creates a new entry that records its parent (§15a). */
  parentId: string | null;
  /** §15c — abandoned runs are archived, never deleted. */
  archived: boolean;
  /**
   * The fixture this run was computed from is still loadable. When false the
   * card states that the run is unavailable and shows NO numbers — re-rendering
   * a saved result against whatever data is loaded now is the failure §15
   * names explicitly.
   */
  fixtureAvailable: boolean;
};

/**
 * Fewest warnings first. Not a score — §15 needs no new statistics.
 *
 * A run whose data is gone sorts last whatever its saved facts say: its card
 * shows no numbers and no chips, so ranking it as the most trustworthy thing in
 * the library would be a claim nobody can see the basis for.
 */
export const byTrust = (a: SavedRun, b: SavedRun) =>
  Number(!a.fixtureAvailable) - Number(!b.fixtureAvailable) ||
  warningsFor(a.facts).length - warningsFor(b.facts).length ||
  b.savedAt - a.savedAt;

export const SORTS = [
  { id: "trust", label: "Most trustworthy", compare: byTrust },
  { id: "return", label: "Highest return", compare: (a: SavedRun, b: SavedRun) => b.netProfit - a.netProfit },
  { id: "recent", label: "Most recent", compare: (a: SavedRun, b: SavedRun) => b.savedAt - a.savedAt },
] as const;

export type SortId = (typeof SORTS)[number]["id"];

const day = (t: number) =>
  new Date(t * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Capture the run that is on screen.
 *
 * EVERY number here comes from the same row slice the panel is showing. An
 * earlier version took `facts` from the selected profile but `netProfit`,
 * `winRate`, `profitFactor`, `maxDrawdown` and `rangeLabel` from the full-run
 * `summary`, so saving under the thin profile produced a card reading "11
 * trades" beside the full ledger's net over the full ledger's date range. That
 * is the defect this build has bought six times wearing a new hat, and the
 * comment on this function asserted the property it was breaking.
 */
export function captureCurrentRun(profile: Profile, parentId: string | null = null): SavedRun {
  // As PRESENTED: a no-costs run reports net equal to gross, so the saved
  // headline must be the one the panel showed, not the cost-deducted one — and
  // the facts beside it come from the very same rows.
  const rows = presentedRowsFor(profile);
  const s = statsFor(rows);
  return {
    id: `run-${Date.now()}`,
    savedAt: Date.now(),
    symbol: summary.symbol,
    timeframe: summary.timeframe,
    // The slice's own span, not the whole ledger's.
    rangeLabel: rows.length ? `${day(rows[0].entryTime)} – ${day(rows[rows.length - 1].exitTime)}` : "No trades",
    strategy: summary.strategy,
    profile,
    source: pineSource,
    facts: factsForProfile(profile),
    netProfit: s.netProfit,
    winRate: s.winRate,
    profitFactor: s.profitFactor,
    maxDrawdown: s.maxDrawdown,
    parentId,
    archived: false,
    fixtureAvailable: true,
  };
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 6, 20) as number;

/**
 * Seeded library, on `?seed=1` only — the same switch App.tsx already uses for
 * deterministic screenshots. Without it the library is genuinely empty, so the
 * "nothing saved yet" state is the real default rather than a state nobody can
 * reach.
 *
 * The set is chosen so the default sort can FAIL a check: `Martingale Grid` has
 * by far the highest net and by far the least support, so sorting by trust and
 * sorting by return put a different card first. A seed where both orders agree
 * would make the sort assertion unable to fail.
 *
 * None of these is the run currently loaded in the workspace, deliberately. The
 * star in the backtest header is captured by the `p5-backtest` parity sheet, and
 * seeding the loaded run would render it already-saved in that frame — a
 * divergence from the reference introduced by a demo fixture rather than by a
 * design decision.
 */
export const SEEDED_RUNS: SavedRun[] = [
  {
    id: "run-liquidity-sweep",
    savedAt: T0,
    symbol: "XAUUSD",
    timeframe: "1h",
    rangeLabel: "Jan 3, 2024 – Jul 15, 2026",
    strategy: "Liquidity Sweep Reversal",
    profile: "full",
    source: pineSource,
    facts: { trades: 138, perMonth: 4.2, top3Share: 18, costsModelled: true, holdout: "ok" },
    netProfit: 5240.75,
    winRate: 47.83,
    profitFactor: 1.28,
    maxDrawdown: 2447.9,
    parentId: null,
    archived: false,
    fixtureAvailable: true,
  },
  {
    id: "run-martingale-grid",
    savedAt: T0 - 3 * DAY,
    symbol: "BTCUSD",
    timeframe: "15m",
    rangeLabel: "Feb 1, 2026 – Jul 15, 2026",
    strategy: "Martingale Grid",
    profile: "full",
    source: pineSource,
    // Highest headline in the library and the least able to support it.
    facts: { trades: 9, perMonth: 1.6, top3Share: 88, costsModelled: false, holdout: "undeclared" },
    netProfit: 41_820.5,
    winRate: 88.89,
    profitFactor: 7.412,
    maxDrawdown: 6104.2,
    parentId: null,
    archived: false,
    fixtureAvailable: true,
  },
  {
    id: "run-liquidity-sweep-v2",
    savedAt: T0 - 1 * DAY,
    symbol: "XAUUSD",
    timeframe: "1h",
    rangeLabel: "Jan 3, 2024 – Jul 15, 2026",
    strategy: "Liquidity Sweep Reversal (wider stop)",
    profile: "full",
    source: pineSource,
    facts: { trades: 41, perMonth: 1.1, top3Share: 34, costsModelled: true, holdout: "declared-empty" },
    netProfit: 1204.35,
    winRate: 39.02,
    profitFactor: 1.11,
    maxDrawdown: 2011.8,
    // Forked from the run above — the parent link is what stops a good result
    // ending up attached to a strategy that did not produce it.
    parentId: "run-liquidity-sweep",
    archived: false,
    fixtureAvailable: true,
  },
  {
    id: "run-orb-eurusd",
    savedAt: T0 - 9 * DAY,
    symbol: "EURUSD",
    timeframe: "5m",
    rangeLabel: "Jan 2, 2026 – Mar 28, 2026",
    strategy: "Opening Range Breakout",
    profile: "full",
    source: pineSource,
    facts: { trades: 212, perMonth: 70.6, top3Share: 12, costsModelled: true, holdout: "ok" },
    netProfit: -884.1,
    winRate: 44.34,
    profitFactor: 0.94,
    maxDrawdown: 1902.44,
    parentId: null,
    archived: true,
    fixtureAvailable: true,
  },
  {
    id: "run-vwap-fade",
    savedAt: T0 - 14 * DAY,
    symbol: "WTIUSD",
    timeframe: "1h",
    rangeLabel: "Sep 1, 2025 – Dec 19, 2025",
    strategy: "VWAP Fade",
    profile: "full",
    source: pineSource,
    facts: { trades: 63, perMonth: 15.8, top3Share: 21, costsModelled: true, holdout: "ok" },
    netProfit: 3117.6,
    winRate: 51.2,
    profitFactor: 1.34,
    maxDrawdown: 1288.05,
    parentId: null,
    archived: false,
    // Its data is gone. The card must say so instead of showing these numbers.
    fixtureAvailable: false,
  },
];
