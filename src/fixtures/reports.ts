import { type Censoring, type Dependence, type Report, totalFor } from "../rates";

/**
 * Fixture reports for §16.
 *
 * Counts come from the captured evidence frames
 * (`Documents/tradercockpit/research/evidence/edgeful-conditional-market-statistics/`,
 * SHA-256 per frame in that folder's README) so the numbers on screen reconcile
 * the way the reference's did — 103 + 12 + 9 = 124, 62 + 3 = 65.
 *
 * The refusing reports are real entries in the selector, not a hidden debug
 * switch. Same reason `Trades Analysis` carries its run profiles: a refusal
 * nobody can reach is a claim, not a gate.
 */

const perSession = (n: number): Dependence => ({
  rawEventN: n,
  independentN: n,
  independentUnit: "one observation per session",
  adjustment: null,
});

const declared = (unresolvedN: number, censoredN: number, excludedN: number): Censoring => ({
  declared: true,
  policy: "unresolved sessions are reported, never folded into the denominator",
  unresolvedN,
  censoredN,
  excludedN,
});

export const REPORTS: Report[] = [
  {
    id: "ib-breakout",
    label: "Initial balance breakout",
    subreport: "standard",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 28, 2026 – Jul 27, 2026",
    settings: [
      { label: "IB timeframe", value: "60 min" },
      { label: "Candle timeframe", value: "5 min" },
      { label: "Breakout measured by", value: "wick" },
    ],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 124,
    classes: [
      { id: "single", label: "single break", k: 103 },
      { id: "double", label: "double break", k: 12 },
      { id: "none", label: "no break", k: 9 },
      // Atlas §9: a derived class is not a measured class, and says what it is.
      { id: "any", label: "at least one break", k: 115, expression: "single + double" },
    ],
    censoring: declared(0, 0, 6),
    dependence: perSession(124),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no IB condition", rate: 71.4, n: 640 },
  },
  {
    /**
     * The flagship case. The reference shows 95.38% and the sentence "price
     * breaks by 10:30 95% of the time" — over a denominator of days that
     * EVENTUALLY produced a single break. Atlas §15 lists that phrasing as
     * prohibited and §8 is why: a post-hoc timing distribution is not an
     * open-of-session forecast.
     */
    id: "orb-timing",
    label: "Opening range breakout — timing",
    subreport: "by time",
    symbol: "YM",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Feb 2, 2026 – Jul 31, 2026",
    settings: [
      { label: "ORB timeframe", value: "15 min" },
      { label: "Breakout measured by", value: "wick" },
      { label: "Cut-off", value: "10:30 ET" },
    ],
    denominatorLabel: "eventual_single_break_sessions_n",
    eligibleResolvedN: 65,
    classes: [
      { id: "before", label: "single break before 10:30", k: 62 },
      { id: "after", label: "single break at or after 10:30", k: 3 },
    ],
    censoring: declared(0, 0, 0),
    dependence: perSession(65),
    conditionsOnEventualCompletion: true,
    eventualNote:
      "This report conditions on sessions that eventually produced a single break. The denominator is those 65 sessions, not every session in the window — so it describes when the break landed on days it happened, and cannot be read at the open as how often a break will happen.",
    baseline: { label: "all sessions, no eventual condition", rate: 46.2, n: 128 },
  },
  {
    id: "gap-fill",
    label: "Gap fill",
    subreport: "standard",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [
      { label: "Gap measured from", value: "prior session close" },
      { label: "Minimum gap", value: "0.10%" },
      { label: "Fill measured by", value: "wick" },
    ],
    denominatorLabel: "eligible_resolved_gap_sessions_n",
    eligibleResolvedN: 96,
    classes: [
      { id: "filled-same", label: "filled same session", k: 61 },
      { id: "filled-later", label: "filled within 3 sessions", k: 21 },
      { id: "unfilled", label: "unfilled at 3 sessions", k: 14 },
      { id: "any-fill", label: "filled at all", k: 82, expression: "filled-same + filled-later" },
    ],
    // 8 gapped sessions never resolved inside the horizon. They are reported,
    // not quietly removed from the 96.
    censoring: declared(8, 3, 11),
    dependence: perSession(96),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no gap condition", rate: 58.9, n: 519 },
  },
  {
    // Measured on the instrument the cockpit currently has loaded, so
    // chart-linked mode has something to resolve to rather than only ever
    // refusing.
    id: "gold-london-sweep",
    label: "London open sweep",
    subreport: "standard",
    symbol: "XAUUSD",
    session: "London 08:00–16:30 UK",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [
      { label: "Sweep window", value: "first 60 min" },
      { label: "Sweep measured by", value: "wick" },
    ],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 142,
    classes: [
      { id: "reversed", label: "swept then reversed", k: 74 },
      { id: "continued", label: "swept then continued", k: 41 },
      { id: "no-sweep", label: "no sweep", k: 27 },
    ],
    censoring: declared(4, 0, 9),
    dependence: perSession(142),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no sweep condition", rate: 49.3, n: 604 },
  },
  {
    /**
     * Baseline cohort exists but its rate is zero, so relative lift is undefined
     * rather than infinite. Atlas §11.2 says the null travels with a reason and
     * the UI renders the reason — this report is what makes that rule reachable.
     * Without it the rule would be real code nobody could ever see fire.
     */
    id: "zero-baseline",
    label: "Limit-up close after gap",
    subreport: "standard",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [{ label: "Threshold", value: "session close at limit" }],
    denominatorLabel: "eligible_resolved_gap_sessions_n",
    eligibleResolvedN: 96,
    classes: [
      { id: "limit", label: "closed at limit", k: 3 },
      { id: "not", label: "did not close at limit", k: 93 },
    ],
    censoring: declared(0, 0, 0),
    dependence: perSession(96),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    // No unconditioned session in the window closed at limit.
    baseline: { label: "all sessions, no gap condition", rate: 0, n: 519 },
  },
  {
    id: "no-sessions",
    label: "IB breakout — Tuesday only",
    subreport: "by weekday",
    symbol: "RTY",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Aug 1, 2026 – Aug 5, 2026",
    settings: [{ label: "Weekday", value: "Tuesday" }],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 0,
    classes: [],
    censoring: declared(0, 0, 0),
    dependence: perSession(0),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no weekday condition", rate: 71.4, n: 640 },
  },
  {
    id: "thin",
    label: "IB breakout — first session of month",
    subreport: "standard",
    symbol: "ES",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [{ label: "Session filter", value: "first trading day of month" }],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 7,
    classes: [
      { id: "single", label: "single break", k: 6 },
      { id: "none", label: "no break", k: 1 },
    ],
    censoring: declared(0, 0, 0),
    dependence: perSession(7),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no calendar condition", rate: 71.4, n: 640 },
  },
  {
    id: "undeclared-censoring",
    label: "Prior-day high retest",
    subreport: "standard",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [{ label: "Retest measured by", value: "wick" }],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 118,
    classes: [
      { id: "retested", label: "retested", k: 78 },
      { id: "not", label: "not retested", k: 40 },
    ],
    censoring: { declared: false, policy: null, unresolvedN: 0, censoredN: 0, excludedN: 0 },
    dependence: perSession(118),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all sessions, no prior-day condition", rate: 61.0, n: 640 },
  },
  {
    id: "no-baseline",
    label: "IB breakout — four conditions joined",
    subreport: "confluence",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [
      { label: "Conditions", value: "prior-day high · IB order · opening candle · IB break" },
      { label: "Join", value: "intersection of eligible event ids" },
    ],
    denominatorLabel: "eligible_resolved_sessions_n",
    eligibleResolvedN: 41,
    classes: [
      { id: "hit", label: "continued", k: 31 },
      { id: "miss", label: "did not continue", k: 10 },
    ],
    censoring: declared(0, 0, 0),
    dependence: perSession(41),
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: null,
  },
  {
    id: "overlapping",
    label: "Intraday sweep — rolling 30-minute windows",
    subreport: "by time",
    symbol: "NQ",
    session: "New York 09:30–16:00 ET",
    rangeLabel: "Jan 2, 2026 – Jul 31, 2026",
    settings: [
      { label: "Window", value: "30 min, rolling every 5 min" },
      { label: "Sweep measured by", value: "wick" },
    ],
    denominatorLabel: "raw_window_observations_n",
    eligibleResolvedN: 412,
    classes: [
      { id: "swept", label: "swept", k: 249 },
      { id: "not", label: "not swept", k: 163 },
    ],
    censoring: declared(0, 0, 0),
    dependence: { rawEventN: 412, independentN: 118, independentUnit: null, adjustment: null },
    conditionsOnEventualCompletion: false,
    eventualNote: null,
    baseline: { label: "all windows, no sweep condition", rate: 52.0, n: 1980 },
  },
];

/**
 * Runs on every dev boot, like the ledger invariants in `market.ts`. A
 * distribution whose measured classes do not add up to its own denominator, or
 * a derived class whose stated expression does not evaluate to its own count,
 * is arithmetic the reader can check by hand — so it fails here rather than on
 * screen.
 */
if (import.meta.env.DEV) {
  for (const r of REPORTS) {
    const t = totalFor(r);
    if (!t.complete)
      throw new Error(`${r.id}: measured classes sum to ${t.k}, ${r.denominatorLabel} is ${t.n}`);
    for (const c of r.classes) {
      if (!c.expression) continue;
      const parts = c.expression.split("+").map((s) => s.trim());
      let sum = 0;
      for (const p of parts) {
        const m = r.classes.find((x) => x.id === p);
        if (!m) throw new Error(`${r.id}: derived class "${c.label}" names unknown class "${p}"`);
        sum += m.k;
      }
      if (sum !== c.k)
        throw new Error(`${r.id}: derived class "${c.label}" claims ${c.k} but ${c.expression} is ${sum}`);
    }
  }
}
