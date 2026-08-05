# Handoff — start here

**Written 2026-08-05.** You are picking up a UI build. Read this page, then `hot.md`, then the spec
that covers what you are about to touch. Nothing below needs the previous session's context.

---

## The 60-second version

`javin23863/ui` is a **trading cockpit UI, reproduced against a competitor teardown** (LuxAlgo
Quant). It is **UI only** — there is no LLM, no Pine compilation, no market data and no backtest
engine, deliberately. Everything renders from one seeded fixture.

The parity plan is **finished**: P0–P6, all merged to `main`, all gates green. Of the next
increment, **§15 Strategy Library is built** on `feat/strategy-library` (unmerged); §16 and §17 are
specced but not built.

```bash
git clone https://github.com/javin23863/ui && cd ui
npm i && npm run dev      # → http://localhost:5199
```

---

## Documents, in reading order

| # | Document | What it is |
|---|---|---|
| 1 | [`docs/hot.md`](hot.md) | **Live state.** What is built, what is green, the traps already paid for. Read first, every session. |
| 2 | [`docs/UI-PARITY-SPEC.md`](UI-PARITY-SPEC.md) | The parity plan, **complete**. §0 divergences · §8c/§8d our two tabs · §11 phases + gates · §12 gap dispositions · §13 Apollo forward-context. |
| 3 | [`docs/UI-NEXT-INCREMENT.md`](UI-NEXT-INCREMENT.md) | **What to build next.** §15 Strategy Library · §16 Screeners · §17 strategy languages + indicator families. |
| 4 | [`docs/parity/README.md`](parity/README.md) | How the seven side-by-side sheets are produced and what the gate actually checks. |

**Reference material outside this repo** (same machine):

| Path | What it is |
|---|---|
| `Documents/tradercockpit/research/edgeful-concept-behavior-atlas-spec-2026-08-02.md` | **The screener's backend contract.** §9 denominators · §10 outcome families · §11.2 baseline+lift · §11.3 dependence. §16 is this spec's front end. |
| `Documents/tradercockpit/research/edgeful-concept-behavior-atlas-plan-2026-08-02.md` | Implementation plan for the same. |
| `Documents/tradercockpit/research/edgeful-conditional-market-statistics-2026-08-02.md` | The research report behind both. |
| `Documents/tradercockpit/research/evidence/edgeful-conditional-market-statistics/` | **9 screenshots of the surface §16 is modelled on**, with per-frame SHA-256 in its README. Already captured — do not ask for them again. |
| `Desktop/Obsidian Vault From VPS/tradercockpit/tradercockpit/Notes/TraderCockpit UI — Parity Build Status.md` | Ops-vault view: what this is worth, and where the backend line sits. |
| `~/.graphify/ui/` | Code knowledge graph — 353 nodes / 485 edges / 28 communities. `graphify query "<question>"` before grepping. |

**Board cards** (`py Documents/Manager/manager.py show --json`), all under `cap.consumer-shell`:

| Card | State |
|---|---|
| `consumer.ui-parity-spec` | **verify** — operator moves to done |
| `consumer.ui-p6-gates` | **active** — PR #3 merged, awaiting the same |
| `consumer.ui-strategy-library` | **active** — §15 built on `feat/strategy-library` |
| `consumer.ui-screeners` | **ready** — §16 |
| `consumer.ui-indicator-representation` | **ready** — §17 |

---

## Run the gates before you change anything

```bash
npm run check:palette   # colour system, 20/20
npx tsc -b              # clean
npm run build           # clean
```

These three also run in CI (`.github/workflows/gates.yml`). **There is no branch protection**, so a
red run is *detected and recorded*, not blocking — read it before merging.

The two browser gates need `npm run dev` on 5199 **and** a Chrome on CDP 9333:

```bash
chrome --remote-debugging-port=9333 --user-data-dir=<scratch> --window-size=1920,1080
node scripts/reflow.mjs   # 1440 + 1280, asserts, exits non-zero
node scripts/sweep.mjs    # 15-row empty-state sweep, asserts, exits non-zero
node scripts/parity.mjs   # regenerates the seven side-by-side sheets
```

---

## The five things that will cost you a day if you rediscover them

1. **Unlayered CSS beats every Tailwind utility.** A bare `button { background: none }` outside
   `@layer base` silently overrode `bg-*`/`text-*` on every button in the app. Invisible in source;
   found only by reading computed style (`scripts/probe.mjs`).
2. **A clean Greptile pass creates no review object and no inline comments.** Polling
   `pulls/N/reviews` for a pass waits forever on a PR that already passed. The PR **body** is the
   only always-updating surface, and its `Greptile Review` *check* can read "fail" while the review
   succeeded — that check reflects a confidence threshold, not a verdict. Auto-review also stops
   after ~7 rounds; the body carries a re-trigger link that works over plain `curl -L`.
3. **CDP `addScriptToEvaluateOnNewDocument` handlers outlive the process.** A killed script leaves
   the tab with `SpeechRecognition` deleted and `getUserMedia` stubbed, and every later load renders
   **blank with no exception** — indistinguishable from a broken dev server. `sweep.mjs` opens its
   own tab and closes it in `finally`; do not "simplify" that away. Closing the *last* CDP tab exits
   Chrome.
4. **The defect class of this build is a label that moves without its data.** Bought six times —
   ticker, timeframe, trade focus, asset badge, then hardcoded fixture aggregates that contradicted
   the ledger they summarised. **The label and the data come from the same call.** When §17 adds a
   second strategy language, `Copy` copying `pineSource` unconditionally is this defect again.
5. **An invalid mutation test is worse than none.** Removing `overflow-x-auto` left the reflow gate
   green *correctly* — CSS computes the other axis to `auto` and an outer container absorbs the
   scroll. Recording "gate proven" on that would have been a false receipt. Mutate something that
   genuinely breaks.

---

## House rules that apply to this repo

- **A card before the code.** A card filed after the work is a receipt, not a plan.
- **Every panel must be able to say no.** A panel that renders a number for an input that cannot
  support one has failed. New panels get a `scripts/sweep.mjs` row *before* they ship.
- **Prose gates do not run.** Three §11 checks sat declared-and-unexecuted for a day. If a rule
  matters, it is a script that exits non-zero.
- **Regenerate the parity sheets in the same commit as any visual change.** A gate artifact that
  disagrees with the build is worse than none, because it is trusted.
- **Capabilities stay out of scope** until the operator says otherwise: no LLM, no compilation, no
  market data, no engine.

---

## Where the backend line sits

Everything renders from `src/fixtures/market.ts`. The chat reply is scripted and does not read what
you type; the "backtest" is 47 trades computed in-browser over a synthetic series; nothing persists.

The next backend seams, none of which should be started without their own card: **persistence** for
the Strategy Library, a real **event ledger** behind the screener (Atlas spec §6), live indicator
computation, and any TradingView/MetaTrader data path.
