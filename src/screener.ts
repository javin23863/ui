/**
 * §16 Screeners — the report model.
 *
 * This is the front end for Concept Behavior Atlas v1
 * (`Documents/tradercockpit/research/edgeful-concept-behavior-atlas-spec-2026-08-02.md`).
 * It renders that contract; it does not implement it. No event ledger, no
 * `materialize`/`evaluate`, no Wilson computation, no typed-error taxonomy —
 * those are the engine's and are out of scope for this increment.
 *
 * What a screener screens is CONDITIONS, not instruments: how a named setup has
 * historically resolved, for this asset, in this session — and it refuses to
 * state a rate it cannot support.
 */

/**
 * A number the report may not have. Atlas §11.2: division by zero "returns null
 * with a reason", and the UI renders the REASON, not a dash.
 *
 * Modelled as a type rather than a convention so a missing value cannot be
 * rendered as an em dash by accident — there is nowhere to put one.
 */
export type Quantity = { value: number } | { value: null; reason: string };

export const known = (value: number): Quantity => ({ value });
export const unknown = (reason: string): Quantity => ({ value: null, reason });

/** Atlas §9 — censored and excluded counts are shown SEPARATELY, never folded in. */
export type Censoring = {
  declared: boolean;
  policy: string | null;
  unresolvedN: number;
  censoredN: number;
  excludedN: number;
};

/** Atlas §11.3 — raw vs independent n, and the rule that produced the difference. */
export type Dependence = {
  rawEventN: number;
  independentN: number;
  /** The independent-unit RULE, named. Null means we cannot claim independence. */
  independentUnit: string | null;
  adjustment: string | null;
};

export type OutcomeClass = {
  id: string;
  label: string;
  k: number;
  /**
   * Atlas §9 — a DERIVED class carries the exact expression it is composed from.
   * "at least one break" is not a measured class; `single_break + double_break`
   * is what it actually is, and the reader has to be able to see that.
   */
  expression?: string;
};

export type Baseline = { label: string; rate: number; n: number } | null;

export type Report = {
  id: string;
  label: string;
  subreport: string;
  symbol: string;
  session: string;
  rangeLabel: string;
  /** Printed UNDER the chart — the claim is not meaningful without them. */
  settings: { label: string; value: string }[];
  /**
   * Atlas §9 — the denominator's own label. Never a generic "sample size":
   * `eventual_single_break_sessions_n` says what the 65 actually counts.
   */
  denominatorLabel: string;
  eligibleResolvedN: number;
  classes: OutcomeClass[];
  censoring: Censoring;
  dependence: Dependence;
  /**
   * Atlas §8 — does this report condition on EVENTUAL completion? A post-hoc
   * timing distribution is not an open-of-session forecast and must not be
   * dressed as one.
   */
  conditionsOnEventualCompletion: boolean;
  eventualNote: string | null;
  baseline: Baseline;
};

/** The denominator floor this surface will state a rate at, and says so when it refuses. */
export const DENOMINATOR_FLOOR = 30;

export type Refusal = { id: string; headline: string; detail: string };

/**
 * The five refusal states, in one place, checked BEFORE any number renders.
 * §16 is explicit that these are the gate, and the card's next action was to
 * build them before any happy path.
 */
export function refusalFor(r: Report): Refusal | null {
  if (r.eligibleResolvedN === 0)
    return {
      id: "no-eligible-sessions",
      headline: "No eligible sessions in this window.",
      detail: `Nothing met the report's conditions between ${r.rangeLabel}. A rate over zero sessions is not a low rate, it is no measurement.`,
    };
  if (r.eligibleResolvedN < DENOMINATOR_FLOOR)
    return {
      id: "below-denominator-floor",
      headline: `Denominator below the stated floor of ${DENOMINATOR_FLOOR}.`,
      detail: `${r.denominatorLabel} is ${r.eligibleResolvedN}. The floor is a declared limit of this surface, not a property of the market — the sessions exist, we will not state a rate on this few.`,
    };
  if (!r.censoring.declared)
    return {
      id: "censoring-undeclared",
      headline: "No censoring policy declared for this report.",
      detail:
        "Sessions that never resolved have to be counted somewhere. Without a declared policy there is no way to tell whether they were dropped, and a rate that quietly drops its unresolved cases reads higher than it is.",
    };
  if (!r.baseline)
    return {
      id: "baseline-unavailable",
      headline: "Baseline cohort unavailable.",
      detail:
        "A conditional rate on its own is not a claim — it has to sit beside what the rate would have been anyway. Without the simpler cohort there is nothing to compare against.",
    };
  if (r.dependence.rawEventN !== r.dependence.independentN && !r.dependence.independentUnit)
    return {
      id: "no-independent-unit-rule",
      headline: "Overlapping observations with no independent-unit rule.",
      detail: `${r.dependence.rawEventN} raw events do not reduce to a stated independent unit. Overlapping windows inflate n, and an inflated n is how a 60% rate looks significant.`,
    };
  return null;
}

export type ClassRow = {
  id: string;
  label: string;
  k: number;
  n: number;
  denominatorLabel: string;
  rate: number;
  expression?: string;
};

/**
 * ONE call. Every class row carries its rate, its k, its n AND the denominator's
 * label together, because they are one claim.
 *
 * The §15 wave bought this lesson at the cost of eight review findings: a label
 * rendered beside a number sourced from somewhere else is this build's defect
 * class. `83.06%` and `103 out of 124` and `eventual_single_break_sessions_n`
 * are the same sentence, so they leave here in the same object.
 */
export function classRowsFor(r: Report): ClassRow[] {
  return r.classes.map((c) => ({
    id: c.id,
    label: c.label,
    k: c.k,
    n: r.eligibleResolvedN,
    denominatorLabel: r.denominatorLabel,
    rate: r.eligibleResolvedN ? (c.k / r.eligibleResolvedN) * 100 : 0,
    expression: c.expression,
  }));
}

/** Atlas §9 — the classes and THE TOTAL. A distribution that does not add up is a defect on screen. */
export function totalFor(r: Report) {
  const measured = r.classes.filter((c) => !c.expression);
  const k = measured.reduce((s, c) => s + c.k, 0);
  return { k, n: r.eligibleResolvedN, complete: k === r.eligibleResolvedN, denominatorLabel: r.denominatorLabel };
}

export type Lift = {
  baselineRate: Quantity;
  absolute: Quantity;
  relative: Quantity;
  retention: Quantity;
};

/**
 * Atlas §11.2. Every conditional rate ships beside its baseline, its lift and
 * its sample retention. Where a quotient is undefined the REASON travels in
 * place of the number.
 */
export function liftFor(r: Report, conditionalRate: number, conditionalN: number): Lift {
  const b = r.baseline;
  if (!b)
    return {
      baselineRate: unknown("no baseline cohort declared"),
      absolute: unknown("no baseline cohort declared"),
      relative: unknown("no baseline cohort declared"),
      retention: unknown("no baseline cohort declared"),
    };
  return {
    baselineRate: known(b.rate),
    absolute: known(conditionalRate - b.rate),
    // Atlas §11.2 names this case explicitly: the reason is the output.
    relative:
      b.rate === 0
        ? unknown("baseline rate is 0 — relative lift is undefined, not infinite")
        : known((conditionalRate / b.rate - 1) * 100),
    retention:
      b.n === 0
        ? unknown("baseline cohort is empty — retention is undefined")
        : known((conditionalN / b.n) * 100),
  };
}
