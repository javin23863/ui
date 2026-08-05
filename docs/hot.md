# ui — hot state

Live source of truth for this repo. The next session reads this first.
**Delete what stops being true. A finished item still marked `▶` is a lie.**

**This file carries no line counts, shas, or revision numbers.** An earlier version did, and they
were wrong within a day — a review caught it claiming 917 lines at a commit two revisions stale.
Facts that rot by construction do not belong in a hand-maintained doc. Run
`git log -1 -- <path>` when you need one.

---

## UI build — MERGED TO MAIN 2026-08-05

| | |
|---|---|
| Spec | `docs/UI-PARITY-SPEC.md` — read it; this file does not restate it |
| `main` | carries **everything**: spec, `src/`, `scripts/`, `docs/parity/`, `docs/reference/` |
| PR #1 | `docs/ui-parity-spec` → MERGED |
| PR #2 | `feat/ui-build` → **MERGED** at `7fefff7`, Greptile 5/5 with zero findings at that head |
| Board card | `consumer.ui-parity-spec` under `cap.consumer-shell`, **verify** — operator moves to done |

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
node scripts/sweep.mjs    # P6 empty-state sweep, 10 rows, asserts and exits non-zero
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

Three fixture invariants also run on every dev boot (`src/fixtures/market.ts`): weekday total equals
net profit, gross profit minus gross loss equals net profit, wins plus losses equals the trade
count. **Proven by mutation 2026-08-05, not just written** — dropping Wednesday from the weekday
derivation throws `weekday P&L sums to -1927.15, net profit is 1999.7` and the app refuses to
render. An assertion nobody has watched fail is not yet a gate.

`docs/parity/` holds the seven side-by-side sheets — **also `feat/ui-build` only**. All seven pass
on §11's terms.

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

No code graph for this repo yet. Build one when the branches land on `main`; there is now code
worth indexing. The ops-vault graph was current as of this wave's `vault_sync`.
