import type { SavedRun } from "./runs";
import { REPORTS } from "./fixtures/reports";

/**
 * §18b — the Screener. The ACTIONABLE half of the screening surface.
 *
 * `Conditional Rates` answers "what usually happened after this setup?". This
 * answers "did the setup happen?" — for the instrument on the chart, across the
 * timeframes the app offers, using the setups the user saved in their library.
 *
 * There is no market data and no engine, so there is no live evaluation here and
 * this file contains no clock. Every stamp below is read from the fixture; a
 * page that derived freshness from `Date.now()` would be claiming a feed it does
 * not have, and that lie is worse on an actionable page than anywhere else in
 * the build.
 */

/**
 * 1m is deliberately absent. Standing multi-timeframe directive: 1m is a SOURCE
 * resolution used to build higher timeframes, and is not traded. A column
 * offering an actionable setup on 1m is an instruction to trade it.
 */
export const SCREEN_TIMEFRAMES = ["5m", "15m", "1h", "4h", "D", "W"] as const;
export type ScreenTimeframe = (typeof SCREEN_TIMEFRAMES)[number];

/**
 * Past tense, always. No state here says a setup IS active — that is a
 * pre-outcome claim over descriptive fixture data, and it is the wording class
 * the Atlas contract prohibits. A cell reports what was observed at a recorded
 * time, or reports that nothing was.
 */
export type CellState = "matched" | "no-match" | "not-evaluated";

export type Cell = {
  state: CellState;
  /** From the fixture, never from the machine clock. Null only when unevaluated. */
  evaluatedAt: string | null;
  note: string | null;
  /** Why it was never evaluated. Required when `state` is `not-evaluated`. */
  reason: string | null;
};

export type ScreenCell = Cell & {
  /** Carried with the cell so a cell can never drift from the column it sits in. */
  timeframe: ScreenTimeframe;
  /**
   * The `Conditional Rates` report backing THIS observation, or null. A match
   * with no support is not hidden and not dressed up — it is labelled. A
   * trigger a trader cannot check is the thing this build exists to refuse.
   */
  supportReportId: string | null;
};

export type ScreenRow = {
  runId: string;
  setup: string;
  symbol: string;
  /**
   * The timeframe the saved run was CAPTURED on (§15a). A saved run's scope is
   * immutable: this row never re-scopes its result onto another timeframe, and
   * no cell displays the run's numbers. The row carries it so the reader can see
   * which column the historical support actually belongs to.
   */
  capturedTimeframe: string;
  /**
   * §15a made the run profile part of a saved run's IDENTITY: the same strategy
   * on the same instrument and timeframe under a different profile is a
   * different run with different trades. It is shown so two rows sharing a
   * strategy name are told apart rather than one being dropped.
   */
  profile: string;
  cells: ScreenCell[];
};

/** Observations, keyed run id → timeframe. Fixture; nothing evaluates live. */
export const OBSERVATIONS: Record<string, Partial<Record<ScreenTimeframe, Cell>>> = {
  "run-liquidity-sweep": {
    "15m": { state: "no-match", evaluatedAt: "2026-08-05 14:20 UTC", note: null, reason: null },
    "1h": {
      state: "matched",
      evaluatedAt: "2026-08-05 14:20 UTC",
      note: "London low swept, close back above",
      reason: null,
    },
    "4h": {
      state: "matched",
      evaluatedAt: "2026-08-05 12:00 UTC",
      note: "swept prior 4h low",
      reason: null,
    },
    D: { state: "no-match", evaluatedAt: "2026-08-05 00:00 UTC", note: null, reason: null },
    W: {
      state: "not-evaluated",
      evaluatedAt: null,
      note: null,
      reason: "the saved run's date range is shorter than one weekly bar",
    },
  },
  "run-liquidity-sweep-v2": {
    "5m": { state: "no-match", evaluatedAt: "2026-08-05 14:20 UTC", note: null, reason: null },
    "15m": { state: "no-match", evaluatedAt: "2026-08-05 14:20 UTC", note: null, reason: null },
    "1h": {
      state: "matched",
      evaluatedAt: "2026-08-05 14:20 UTC",
      note: "same sweep, wider stop still open",
      reason: null,
    },
    "4h": { state: "no-match", evaluatedAt: "2026-08-05 12:00 UTC", note: null, reason: null },
  },
};

/**
 * Which `Conditional Rates` report supports a given setup at a given timeframe.
 *
 * Scoped on purpose. `gold-london-sweep` was measured on the London session at
 * the run's own timeframe; it does not become evidence for a 4h observation
 * just because the same setup name appears there.
 */
const SUPPORT: Record<string, Partial<Record<ScreenTimeframe, string>>> = {
  "run-liquidity-sweep": { "1h": "gold-london-sweep" },
  "run-liquidity-sweep-v2": { "1h": "gold-london-sweep" },
};

const NEVER_EVALUATED: Cell = {
  state: "not-evaluated",
  evaluatedAt: null,
  note: null,
  reason: "this setup has not been evaluated on this timeframe",
};

/**
 * ONE call builds a row. The cell's state, its stamp, its timeframe and the
 * report backing it leave here together, because a cell that showed a match
 * beside support fetched somewhere else is this build's defect class — bought
 * in every wave so far, most recently as a checkbox whose label was over a
 * constant.
 */
export function screenRowsFor(symbol: string, runs: SavedRun[]): ScreenRow[] {
  const rows: ScreenRow[] = [];
  for (const r of runs) {
    // Archived runs are abandoned work (§15c) and must not supply live rows.
    if (r.archived || r.symbol !== symbol) continue;
    // Keyed by RUN, never by strategy name. An earlier version suppressed every
    // later run sharing a name, which silently dropped a saved run the user had
    // deliberately kept — §15's own rule is that a save must not evaporate, and
    // dropping it from the screener is the same evaporation one surface over.
    const obs = OBSERVATIONS[r.id] ?? {};
    rows.push({
      runId: r.id,
      setup: r.strategy,
      symbol: r.symbol,
      capturedTimeframe: r.timeframe,
      profile: r.profile,
      cells: SCREEN_TIMEFRAMES.map((tf) => ({
        ...(obs[tf] ?? NEVER_EVALUATED),
        timeframe: tf,
        supportReportId: SUPPORT[r.id]?.[tf] ?? null,
      })),
    });
  }
  return rows;
}

/** Matched observations, for the summary line. Counted from the rendered rows. */
export const matchCount = (rows: ScreenRow[]) =>
  rows.reduce((n, r) => n + r.cells.filter((c) => c.state === "matched").length, 0);

/** Matches with nothing behind them — the number that should worry a reader. */
export const unsupportedMatchCount = (rows: ScreenRow[]) =>
  rows.reduce(
    (n, r) => n + r.cells.filter((c) => c.state === "matched" && !c.supportReportId).length,
    0,
  );

if (import.meta.env.DEV) {
  const reportIds = new Set(REPORTS.map((r) => r.id));
  const tfs = new Set<string>(SCREEN_TIMEFRAMES);
  for (const [runId, byTf] of Object.entries(OBSERVATIONS)) {
    for (const [tf, cell] of Object.entries(byTf)) {
      if (!tfs.has(tf)) throw new Error(`${runId}: observation on unknown timeframe "${tf}"`);
      if (tf === "1m") throw new Error(`${runId}: 1m is a source resolution and is never screened`);
      if (cell.state !== "not-evaluated" && !cell.evaluatedAt)
        throw new Error(`${runId}/${tf}: state "${cell.state}" with no evaluated-at stamp`);
      if (cell.state === "not-evaluated" && !cell.reason)
        throw new Error(`${runId}/${tf}: unevaluated with no reason`);
    }
  }
  for (const [runId, byTf] of Object.entries(SUPPORT))
    for (const [tf, id] of Object.entries(byTf)) {
      if (!reportIds.has(id))
        throw new Error(`${runId}/${tf}: support names report "${id}" which does not exist`);
      if (OBSERVATIONS[runId]?.[tf as ScreenTimeframe]?.state !== "matched")
        throw new Error(`${runId}/${tf}: support declared for a cell that did not match`);
    }
}
