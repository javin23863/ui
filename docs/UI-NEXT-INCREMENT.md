# TraderCockpit UI — next increment (post-P6)

**Status:** plan. No implementation yet. Filed 2026-08-05 from operator direction.
**Why this document exists:** `UI-PARITY-SPEC.md` ends at P6 and defines no P7. plan-warden ruled
that once P6 is signed off the plan is exhausted and the next increment must come from the operator
rather than being picked. It now has. This is that increment.

**Still UI only.** No engine is connected by anything below. Where a surface needs data it does not
have, it is specified to *say so* rather than to render a plausible number — the same rule §8c/§8d
already gate on.

---

## Where these ideas came from

Operator, 2026-08-05, verbatim intents:

1. Users should be able to **save good strategies** — "not junk and waste" — with history.
2. **Apollo's orb must be movable** so it cannot cover something the user needs.
3. **How do we handle indicator types, and strategies for TradingView and MetaTrader?**
   Clarified by the operator 2026-08-05: this is about **the script languages a strategy is
   delivered in**, not about embedding anyone's platform. The code pane today renders **Pine
   only**. Traders use TradingView (Pine) *and* MetaTrader 5 (MQL5), so a strategy that exists in
   one language is unusable to half the audience.
4. **What is the Screeners tab actually screening?** Proposal: the edgeful model — the historical
   statistical probability of *this setup, for this indicator, on this asset, at this moment, in
   this part of the chart* — combined with what we already use that works with our own data.

**Item 2 is already built.** `ApolloOrb.tsx` drags on pointer events, clamps to the viewport, and
suppresses the click when the pointer moved. Nothing to do unless the *feel* is wrong; that would
be a tuning note, not a work item.

---

## §15. Strategy Library — saving the good ones

The reference has `Share chat` and a star icon and nothing behind either. This is ours.

**The design problem is not storage, it is judgement.** "Save my good strategies, not junk" cannot
be satisfied by a save button, because at save time the user does not yet know which is which. Two
mechanisms, and the second is the one that matters:

**15a. Explicit save.** Star a run → it enters the library with the exact context needed to
re-open it: instrument, timeframe, date range, the strategy source, and the run's own numbers.
A saved run is **immutable**; editing the strategy creates a new entry that records its parent.
Without that, "my good strategy" silently becomes a different strategy with the old result attached.

**15b. The library refuses to flatter.** Every card carries the same adequacy chips the
`Trades Analysis` tab already computes — `Thin sample`, `Sparse`, `Top-3 carries N% of net`,
`No holdout`, `Costs not modelled`. **A run that cannot support its own headline number must show
that on the card, not only on the detail page.** Sorting defaults to *most trustworthy*, not
*highest return*, and the sort control names that explicitly.

> This is the whole product argument applied to the user's own history. A library sorted by return
> is a machine for promoting the luckiest overfit run the user ever produced.

**15c. Junk drawer, not deletion.** Runs the user abandons go to an `Archived` filter rather than
disappearing. A strategy that failed is evidence; deleting it is how someone re-derives the same
dead end in three months.

**Empty states:** no saved runs yet → explain what a saved run captures, do not show a fake one.
A saved run whose fixture no longer exists → say the run is unavailable and why; never re-render it
against different data.

**Backend seam (NOT this increment):** persistence. Until it exists the library is fixture-backed
and must say so on screen — a save that silently evaporates on reload is worse than no save button.

---

## §16. Screeners — what we are actually screening

**Answer: not instruments. Conditions.** A conventional screener returns "stocks over their
200-day MA". Ours returns **how a named setup has historically resolved, for this asset, in this
session, at this point in the chart** — and refuses to state a rate it cannot support.

The model is edgeful's report surface (evidence:
`Documents/tradercockpit/research/evidence/edgeful-conditional-market-statistics/`, 9 frames,
captured 2026-08-02, SHA-256 per frame in that folder's README). What their surface gets right, and
we copy: the **denominator is on screen** — `103 out of 124 days` sits directly under `83.06%` —
and the **settings that define the claim** (IB timeframe, candle timeframe, breakout measured by
wick) sit under the chart, because the claim is not meaningful without them.

### What we add that they do not show

We already own the contract for this: **Concept Behavior Atlas v1**
(`Documents/tradercockpit/research/edgeful-concept-behavior-atlas-spec-2026-08-02.md`). The screener
is that spec's front end, and it obliges us to render things the reference surface does not:

| Atlas rule | What the UI must show |
|---|---|
| §9 — denominator labels are explicit | `eventual_single_break_sessions_n`, never a generic "sample size". The label is part of the claim. |
| §9 — censoring declared | Unresolved / censored / excluded counts shown **separately**. If no censoring policy is declared, the panel refuses. |
| §9 — categorical completeness | All mutually exclusive classes **and** the total. A derived class shows its exact expression, e.g. `single_break + double_break`. |
| §11.2 — baseline and lift | Every conditional rate ships beside its **baseline**, `absolute_lift`, `relative_lift`, and `sample_retention`. **A bare conditional rate is not a claim.** |
| §11.2 — division by zero | Returns `null` with a reason; the UI renders the **reason**, not a dash. |
| §11.3 — dependence | `raw_event_n` **and** `independent_n` both visible, with the independent-unit rule named. Overlapping windows inflate n, and an inflated n is how a 60% rate looks significant. |
| §8 — point-in-time | The panel states whether a report conditions on *eventual* completion. A post-hoc timing distribution is not an open-of-session forecast, and must not be dressed as one. |

**That table is the differentiator.** Their surface shows `83.06%`. Ours shows `83.06%` next to
what it would have been anyway, how much sample was spent to get there, and whether the sessions
were independent.

### Layout (from the frames, adapted)

- **Left rail:** report + subreport selector, asset & ticker, date range, session window.
- **Centre:** the distribution — categorical classes as a chart, with the **custom settings that
  define the measurement printed underneath**, not hidden in a modal.
- **Right:** the insight stack — one card per class: rate, class name, and `k out of n` with the
  labelled denominator.
- **Below:** baseline / lift / retention / dependence. **This block is not collapsible.**
- **Chart-linked mode:** the same report scoped to where the user is looking — "this setup, this
  asset, this session, this point in the chart". This is the operator's idea and the reason the
  screener belongs in the cockpit rather than in a separate tool.

**Empty and refusing states are the gate**, exactly as §8c/§8d: no eligible sessions; denominator
below a stated floor; censoring undeclared; baseline cohort unavailable; overlapping windows with
no independent-unit rule.

---

## §17. Strategy languages, and indicator families

**Operator clarification 2026-08-05:** the TradingView / MetaTrader question is about **the
language a strategy ships in**. The code pane renders **Pine only** right now (`pineSource`,
one buffer, one syntax). Traders use TradingView (**Pine**) and MetaTrader 5 (**MQL5**). A strategy
that exists only in Pine is unusable to every MT5 trader, which is half the point of having a code
pane at all.

### 17a. The code pane becomes multi-language

- A **language selector** on the code pane: `Pine v6` · `MQL5`. Extensible — the selector is a list,
  not two hardcoded buttons.
- Each language is a **first-class buffer with its own syntax highlighting**, not a re-labelled
  copy of the same text. `prism-react-renderer` already backs the pane; MQL5 highlights adequately
  as C-like, and that substitution must be recorded rather than silently relied upon.
- `Copy` and `Run` act on the **selected** language. The existing `Copy` copies `pineSource`
  unconditionally — the moment a second language exists that becomes the label-without-its-data
  defect this build has already bought six times. **The button copies what the pane is showing.**

### 17b. A translation is a translation, and must say so

This is the honesty rule for the whole surface. When a strategy is shown in a language it was not
authored in:

- Label which language is **canonical** (the one the run was executed from) and which is
  **derived**.
- **Never show backtest numbers beside a derived language as if they were produced by it.** The
  numbers belong to the canonical run. A trader who pastes derived MQL5 into MT5 and gets different
  results has been misled by our layout, not by their broker.
- Where a construct has no faithful equivalent, the pane says so **at the line** rather than
  emitting code that looks right and behaves differently. Silent approximation in a strategy
  language is the worst failure mode available here.

**Out of scope for this increment:** actually *compiling* or *executing* either language, and any
automated Pine→MQL5 transpiler. Capabilities remain out of scope (§0). The UI work is the selector,
the per-language buffers, the canonical/derived labelling, and the refusals.

### 17c. Indicator families we render ourselves

Overlay (EMA, VWAP, bands), pane (RSI, MACD), level (prior-day high/low, IB, opening range), and
zone (gaps, value area). Each needs a defined render form **and a defined refusal** — an indicator
with insufficient lookback must draw nothing and say why, not draw a truncated line that looks like
a signal.

### 17d. We do not embed their platforms

Separate from the language question, and still true: no TradingView iframe or widget in the
cockpit. Their frame cannot carry the `data-apollo-series` hooks §13 requires, and a third-party
frame is an availability dependency we do not control. Live TradingView captures come from the
operator's own logged-in session — a capture workflow, not a product surface.

MetaTrader has an adapter lane outside this repo; the UI question is only that a run **sourced**
from it is labelled with its engine, so a user can never mistake which engine produced a number.

## Sequencing

1. **§15 Strategy Library** — smallest, no new statistics, and it is where "save my good ones"
   becomes visible. Fixture-backed, labelled as such.
2. **§16 Screeners** — largest. Needs the Atlas contract rendered honestly. Build the refusal states
   *first*; they are the gate.
3. **§17 Indicators** — 17a is UI work; 17b is a decision to record; 17c is mostly labelling rules.

**Gate for all three, same as §11:** each panel gets an empty-state sweep row before it ships, and
`scripts/sweep.mjs` grows to cover it. A panel that renders a number for an input that cannot
support one has failed.

## What would need backend, and is deliberately not here

Persistence for the library; a real event ledger behind the screener (the Atlas spec's §6 contract);
live indicator computation; any TradingView or MetaTrader data path. All of it is out of scope for
this increment and none of it should be started without its own card.
