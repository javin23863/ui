# ui — hot state

Live source of truth for this repo. The next session reads this first.
**New here? Read [`docs/HANDOFF.md`](HANDOFF.md) — it links every document and names the
traps that cost a day each.**
**Delete what stops being true. A finished item still marked `▶` is a lie.**

**This file carries no line counts, shas, or revision numbers.** An earlier version did, and they
were wrong within a day — a review caught it claiming 917 lines at a commit two revisions stale.
Facts that rot by construction do not belong in a hand-maintained doc. Run
`git log -1 -- <path>` when you need one.

---

## ▶ §15 Strategy Library — on `feat/strategy-library`, not yet merged

| | |
|---|---|
| Branch | `feat/strategy-library`, worktree `C:\tmp\ui-strategy-library` |
| Spec | `docs/UI-NEXT-INCREMENT.md` §15 |
| Card | `consumer.ui-strategy-library` — **active** |
| plan-warden | ON PLAN WITH CORRECTIONS, all four applied (see below) |
| Gates | sweep **19/19**, palette 20/20, `tsc -b` clean, `build` clean, parity sheets regenerated |
| Greptile | rounds 1–4 found **five P1s, all real, all fixed** — see below |

Reachable from the rail's `History` button. Star in the backtest header saves the run **as shown**,
so an entry's numbers and its adequacy chips come from the same profile the reader is looking at.

**The one thing to carry forward:** the five §15b adequacy signals now live in `src/runs.ts` and
nowhere else. Only two of them were ever chips — `Thin sample` and `Sparse`. Top-3 concentration was
a coloured KPI column and `Costs not modelled` / `No holdout` were full-card refusal messages, so
"reuse the chips Trades Analysis already computes" was true of two of five and the other three would
have been re-derived by hand. `RunFacts` is the input rather than `Profile`, because a live run
derives its facts from the fixture while a saved run carries the facts it was saved with — same
thresholds, two fact sources. **`holdout` is three states, not a boolean**: declared-but-empty is a
different claim from never-declared and the panel already said so in two different sentences.

There is **no "open this run" action**, deliberately. Re-opening a saved run needs a data path this
build does not have, and a button that quietly returned to the loaded fixture under another run's
name is the label-without-its-data defect. The saved source is shown instead.

Nothing persists. The panel says so on screen — §15's rule is that a save must not evaporate
*silently*, not that it must not evaporate.

**The seeded library excludes the currently-loaded run on purpose.** The star is captured by the
`p5-backtest` parity sheet; seeding the loaded run rendered it already-saved in that frame, which
would have been a parity divergence introduced by a demo fixture rather than by a decision.

**Greptile round 1 found the defect class again, in the code that was written to prevent it.**
Two P1s, both real:

1. **`captureCurrentRun` took `facts` from the selected profile but `netProfit`, `winRate`,
   `profitFactor`, `maxDrawdown` and `rangeLabel` from the full-run `summary`.** Saving under the
   thin profile produced a card reading *11 trades* beside the whole ledger's +1,999.70 over the
   whole ledger's date range. **The docstring on that function claimed "numbers come from the same
   call the panel reads" while the body did the opposite** — the comment asserted the property it
   was breaking, which is worse than no comment. Fixed by computing every saved metric from
   `statsFor(rowsFor(profile))`, the same slice `factsForProfile` uses, and deriving the range from
   the slice's own first entry and last exit. `statsFor` is now exported from `market.ts` rather
   than reimplemented.
2. **The saved-run identity omitted the profile**, so after saving `Full run` the star stayed filled
   under `Costs not modelled` and silently dropped the second save. `profile` is now part of
   `SavedRun` and of the identity check, and because the profile lives in the backtest panel the
   check is passed down as `isRunSaved(profile)` rather than resolved as a boolean in `App`.

**Round 2 found a third P1, and it was not mine — it was pre-existing on `main`.** Under the
`no-costs` profile the Trades Log totalled **+2,587.70** ("Costs not modelled — Net equals Gross",
which is what it says on screen) while the Performance metrics table two clicks away said
**+1,999.70** for the same run. Both were on screen at once and they disagreed by exactly the costs
the profile claimed were not modelled. **The run profile drove the Trades Log and Trades Analysis
but never reached the Performance tab** — the gap PR #3's "make the run profile drive every tab"
left behind. The saved card had simply inherited the wrong side of a contradiction that was already
there.

Fixed at the root rather than at the card: `asPresented(rows, costsModelled)` in `market.ts` is now
the one place that decides what a run reports when it does not model costs, and `metricsFor`,
`summaryKpis` and `captureCurrentRun` all read it. **Under the `full` profile every number is
byte-identical, so no parity surface moved** — verified by regenerating all seven sheets. Row
`no-costs net agrees everywhere` asserts the log total, the metrics table and the saved card state
the same net; mutating `Performance` back to ignoring the profile reproduces
`log=+2,587.70 panel=+1999.70` exactly.

**Round 3 found the same defect one level down, in the round-2 fix.** The saved headline was now
cost-free (+2,587.70) but `factsForProfile` still derived `top3Share` from the cost-deducted rows,
so the card paired that headline with `Top-3 carries 249% of net` — a percentage computed against a
net that was no longer on the card. **A number and the warning that qualifies it have to come from
the same representation of the run, not merely from the same slice of it.** `presentedRowsFor`
(slice *and* cost treatment) is now the single call, and `factsForProfile` and `captureCurrentRun`
both take their rows from it. Correct value is 194%.

> **The first version of that gate could not fail, and the mutation is what proved it.** It compared
> the panel's Top-3 against the card's Top-3 — but both read the same `factsForProfile`, so pointing
> that function at the wrong rows moved them together and they agreed on 249% while agreeing with
> nothing else on screen. The mutation passed, which is the only reason the hole was visible. The
> row now **recomputes the Top-3 share from the rendered Trades Log** and requires the panel and the
> card each to match the ledger, not each other: clean reads `ledger=194% panel=194% card=194%`,
> mutated reads `ledger=194% panel=249% card=249%` and fails. **Two surfaces agreeing is not
> evidence when one call feeds both.**

**Round 4 found the last one, in the same tab as the round-2 fix.** `TradesAnalysis` still took its
rows from `rowsFor(profile)`, so under `no-costs` the IS/OOS split summed to **+1,999.70** directly
below a KPI strip reading **+2,587.70** — cost-free headline over a cost-deducted table, in one
view. The panel now reads `presentedRowsFor(profile)` like everything else. Row
`no-costs IS/OOS sums to the run` asserts the two halves reconcile to the run's own net; mutated it
reads `IS=2555.22 + OOS=-555.52 = 1999.70 vs Net Profit 2587.7 → DISAGREE`.

> **Four of the five findings were the same defect, and each fix revealed the next one.** The
> profile changed which rows a surface should read, and every surface that had quietly kept its own
> copy of "the rows" surfaced in turn: the saved card, the Performance tab, the saved facts, the
> IS/OOS table. `presentedRowsFor(profile)` — slice **and** cost treatment — is now the only
> answer to "which rows is this run". If a sixth surface ever needs rows, that is the call, and a
> new `rowsFor`/`trades` reference in a panel should be read as a bug on sight.

**Swept the rest of the class rather than waiting for round 5.** The Performance tab's equity curve,
Net Daily PNL bars and weekday card all read the module-level full-run consts, so under `no-costs`
the curve ended at the cost-deducted total directly beneath a cost-free Net Profit. `equityFor`,
`dailyPnlFor` and `weekdayPnlFor` now take rows, and `summaryKpis` takes rows instead of a boolean,
so the caller says which run it is describing. `equityFor` **recomputes** cumulative net rather than
reading the precomputed `t.cum`, which is what a cost-free presentation requires.

> **OPEN, pre-existing, NOT fixed here — needs its own card.** The `thin` profile slices
> `Trades Analysis` to 11 trades, but the **Trades Log still lists all 47** and the Performance tab
> still totals all 47. Only the cost treatment was unified in this PR; the row-count slicing was
> deliberately left alone, because slicing the Performance tab on its own would have traded a cost
> inconsistency for a row-count one against the log sitting next to it. Fixing it properly means
> threading the profile's rows through `TradesLog` too, which is §8 work, not §15.

> **Do not read "this profile is only a demo switch" as permission to leave it inconsistent.** The
> profile switch is what makes every refusal in this build demonstrable. A run profile that two
> panels disagree about is a broken instrument, and it stayed broken because nothing asserted
> agreement BETWEEN panels — only that each panel said no on its own.

Greptile ran all five in a browser and attached the recordings; **our own sweep had 15 green rows
and caught none of them**. Four rows added so none can come back — `save keeps its own profile numbers`,
`another profile saves separately`, `no-costs figures agree everywhere` and
`no-costs IS/OOS sums to the run` — each mutation-proven by restoring the exact bug it guards.
The lesson is narrow and worth keeping: **every row of the sweep asserted a refusal, and not one of
the five defects was a refusal.** A panel that says no correctly can still put the wrong number on
the screen, and two panels can each be correct on their own while contradicting each other.

**Proven by mutation 2026-08-05**, all five original rows at once: seed unconditionally → `cards=5`;
flip `fixtureAvailable` → `rendersNumbersAnyway=true`; default sort to `return` → `ordersDiffer=false`;
gut the notice → row fails on its text; drop the archived filter → `inActiveView=true`. Exactly the
five new rows flipped and the ten pre-existing rows stayed green, which is what makes it a valid
mutation rather than a broken app failing everything.

---

## UI build — MERGED TO MAIN 2026-08-05

| | |
|---|---|
| Spec | `docs/UI-PARITY-SPEC.md` — the parity plan, P0-P6, **complete** |
| Next increment | `docs/UI-NEXT-INCREMENT.md` — Strategy Library (§15), Screeners (§16), indicators + TV/MT5 (§17). Operator-directed 2026-08-05, plan only |
| `main` | carries **everything**: spec, `src/`, `scripts/`, `docs/parity/`, `docs/reference/` |
| PR #1 | `docs/ui-parity-spec` → MERGED |
| PR #2 | `feat/ui-build` → **MERGED** at `7fefff7`, Greptile 5/5 with zero findings at that head |
| PR #3 | `feat/p6-gates` → **MERGED** at `ce0a457`. Zero findings at head; Confidence 4/5 against a repo-configured 5/5 bar, so the check read "fail" while the review itself succeeded. **Operator ruled 4/5-with-zero-findings a pass.** |
| Board cards | `consumer.ui-parity-spec` **verify** · `consumer.ui-p6-gates` **active** — operator moves both to done |

`npm i && npm run dev` → http://localhost:5199.

### What is built

Shell · chat pane with markdown transcript and voice dictation · chart pane · **symbol picker and
timeframe dropdown** (`1m 5m 15m 1h 4h D W`, matching §9 — this list previously omitted them, which
read as work still owed) · Pine code view · collapsed backtest dock · expanded backtest panel with
independent `All`/`Long`/`Short` filters on the metrics table and the weekday card ·
`Trades Analysis` · `Trades Log` · settings modal · Apollo presence orb (recorded as divergence
§0e — it shipped before anyone wrote it down).

Everything renders from `src/fixtures/market.ts`, seeded so screenshots are reproducible.
**No LLM, no Pine compilation, no market data, no backtest engine** — capabilities are out of scope
by design, so the chat reply is a scripted fixture that does not respond to what you type.

### Gates — green on `main`

```
npm run check:palette     # reads hexes out of src/tokens.css, 20/20
npx tsc -b                # clean
npm run build             # clean
node scripts/parity.mjs   # regenerates all seven parity sheets
node scripts/reflow.mjs   # P6 reflow gate, 1440 + 1280, asserts and exits non-zero
node scripts/sweep.mjs    # empty-state sweep, 19 rows, asserts and exits non-zero
```

The last three need `npm run dev` on 5199 AND a Chrome on CDP 9333:

```
chrome --remote-debugging-port=9333 --user-data-dir=<scratch> --window-size=1920,1080
```

The first three also run in CI (`.github/workflows/gates.yml`) on every push to main and every PR.
**No branch protection on this repo**, so a red run is detected and recorded, not blocking — read
it before merging.

> **`sweep.mjs` opens its own Chrome tab and closes it in `finally`. Do not change that.** Its
> voice rows register `Page.addScriptToEvaluateOnNewDocument` handlers that survive navigation and
> outlive the process. A killed run leaves the tab with `SpeechRecognition` deleted and
> `getUserMedia` stubbed, and every later load renders BLANK with no exception — indistinguishable
> from a broken dev server.
>
> **A run that FAILS a row can poison the next run the same way** (observed 2026-08-05). The
> `finally` block cannot complete when the process dies on an unsettled top-level await, so the
> handlers are never removed. The next run then hangs at `await click("mic")` and reports
> `Detected unsettled top-level await` — which reads exactly like a bug in whatever you just
> changed, and is not. **Restart Chrome on a fresh `--user-data-dir` after any failed sweep**
> before believing its next result.

Three fixture invariants also run on every dev boot (`src/fixtures/market.ts`): weekday total equals
net profit, gross profit minus gross loss equals net profit, wins plus losses equals the trade
count. **Proven by mutation 2026-08-05, not just written** — dropping Wednesday from the weekday
derivation throws `weekday P&L sums to -1927.15, net profit is 1999.7` and the app refuses to
render. An assertion nobody has watched fail is not yet a gate.

`docs/parity/` holds the seven side-by-side sheets, `docs/reflow/` the ten reflow captures and
`docs/sweep/` the ten empty-state captures. All on `main`. All pass on §11's terms.

> **A `Greptile Review` check can read "fail" while the review passed.** The check reflects a
> confidence threshold, not a verdict — read `.output.summary` on the check run
> (`gh api repos/javin23863/ui/commits/<sha>/check-runs`) before treating it as a finding. Zero
> inline comments anchored to the head is the real signal.

### Traps already bought — do not re-derive these

1. **`lightweight-charts` is time-indexed** and fights anything that is not. `Weekday Performance`
   is category-indexed **and is in the parity set**, so the inline-SVG split in §10 is required
   regardless of our own tabs. An early draft claimed one library covered every chart. It does not.
2. **Base element styles must sit in `@layer base`.** An unlayered `button { background: none }`
   beat every Tailwind `bg-*`/`text-*` utility on every button in the app — active pills, tab
   underlines, the settings modal. Invisible in source; found by reading computed style.
3. **A line series cannot carry per-segment colour.** Masking two series with whitespace does not
   work either — the series draws straight across the gap, rendering as two crossing lines. The
   slope-coloured EMA lives in the SVG overlay.
4. **An area series cannot express a box.** TP/SL zones are real rects in the overlay, projected
   through `timeToCoordinate` / `priceToCoordinate`.
5. **`priceToCoordinate` returns null outside the current scale, and the auto-scale has not settled
   on the frame `fitContent()` runs.** Projecting there silently clips. Re-project on the next
   animation frame.
6. **Reference frames at 360p are unreadable** for UI text. `see-video` defaults to
   `best[height<=720]` → 640×360. Pull 1080p explicitly.

### Runbook — next steps, in order

1. Operator moves the board card `verify → done`. Only the operator does this.
2. Start the dev server for screenshots: `npm run dev`, then
   `SEED=1 node scripts/shoot.mjs <out.png> [clickSelector ...]`, which needs Chrome on CDP 9333
   (`chrome --remote-debugging-port=9333 --user-data-dir=<scratch> --window-size=1920,1080`).
   `node scripts/probe.mjs "<js>"` reads computed style off the running page — use it when
   something looks wrong but the source looks right.

> **Reading a Greptile verdict — this cost an hour on 2026-08-05.** A CLEAN pass creates **no
> review object and no inline comments**, so polling `pulls/N/reviews` for one waits forever on a
> PR that already passed. The only always-updating surface is the PR body:
> `gh pr view N --json body -q '.body' | grep -o "Reviews ([0-9]*): Last reviewed commit"`.
> PASS = that commit equals the head AND zero comments anchored to it.
> **Auto-review also stops after ~7 rounds** — the body carries a `Re-trigger Greptile` link that
> works over plain `curl -L`. Four unreviewed pushes looked exactly like latency.
> `node scripts/findings.mjs <pr> <branch>` reports the FAIL side; it cannot see a pass.

### Open — do not re-derive these either

Six unknowns in §12. **Gaps 1 and 2 are now closed as UNRECOVERABLE, not merely unobserved** — a
second full capture pass over both videos at native 1080p (2026-08-05) established:

- The metrics panel appears only in `oxZj1kSye-g`, is on screen from 19:10 to the end at 33:06, and
  is **never scrolled, resized or expanded** in that entire span. `Net Profit` and `Open PnL` are
  the only labelled rows; a third row is cut by the recording's own bottom edge at y=1080, leaving
  glyph tips no crop can recover. **Do not invent rows here.**
- The webcam **never moves** off the `Weekday Performance` card — fixed position in 100% of ~35
  sampled frames across the card's whole on-screen life. Mon–Sat are permanently occluded.
  One fact did come out: a control-shaped `All` sits under that card's legend with nothing at the
  same position under `Net Daily PNL`, so the control belongs to that card. Shipped as
  `All / Long / Short` on the strength of *a control being there*, not of it being a filter.

**Another capture pass will not help.** Only a screenshot from a logged-in session moves these.
Gaps 3–6 remain genuinely open.

### Stated ceilings

- **Price axis renders ~20 tick labels where the reference shows ~5.** Tick spacing scales with
  `layout.fontSize` — measured 2026-08-05, raising it 10 → 22 halves the tick count. Reaching ~5
  needs roughly 40, and that setting is global to both axes, so a 40px time axis would be the worse
  defect. A chosen trade-off, not a library limit. This entry previously claimed the library exposed
  no control and that `minMove` was the only lever; both were asserted without measuring.
- `Trades Analysis` / `Trades Log` have **no reference footage** — they are ours (§8c, §8d), exempt
  from the parity diff, gated by the empty-state sweep instead.
- **Apollo's visual is provisional** (`feat/ui-build`). §13 is forward context, not a UI spec. Research established
  that the reference product moved voice *out* of a floating orb and into the chat thread in
  Nov 2025, and that the Jul 2026 release was a voice model with no visual redesign — so an
  ever-present orb is our own choice. No public source documents its animation at an implementable
  level; the constants in `ApolloOrb.tsx`'s `MOTION` table are ours.
- Bundle is ~525 kB, over Vite's 500 kB warning. Not split.

### Graphs

**A code graph exists**: `~/.graphify/ui/graphify-out/graph.json` — 353 nodes / 485 edges / 28
communities, built 2026-08-05. Query it before grepping:

```
graphify query "<question>" --graph C:/Users/MSI/.graphify/ui/graphify-out/graph.json
```

It indexes `src/`, `scripts/` and the spec documents together, so it answers "which panel computes
this" in one hop. It does **not** index the ops vault — that is a separate graph and returns a
confident nothing for code questions. This entry previously said no graph existed; it did, and the
line was already stale when it was read.
