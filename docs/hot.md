# ui — hot state

Live source of truth for this repo. The next session reads this first.
**Delete what stops being true. A finished item still marked `▶` is a lie.**

**This file carries no line counts, shas, or revision numbers.** An earlier version did, and they
were wrong within a day — a review caught it claiming 917 lines at a commit two revisions stale.
Facts that rot by construction do not belong in a hand-maintained doc. Run
`git log -1 -- <path>` when you need one.

---

## ▶ UI build — SPEC LANDED, UI BUILT, NEITHER MERGED

**As of 2026-08-05.**

| | |
|---|---|
| Spec | `docs/UI-PARITY-SPEC.md` — read it; this file does not restate it |
| Branches | `docs/ui-parity-spec` → PR #1 · `feat/ui-build` → PR #2, **stacked on #1** |
| `main` | still only the 4-byte README — merge #1 first, then #2 |
| Board card | `consumer.ui-parity-spec` under `cap.consumer-shell`, **verify** |
| Build | **exists and runs.** `npm i && npm run dev` → http://localhost:5199 |

### What is built

Shell · chat pane with markdown transcript and voice dictation · chart pane · Pine code view ·
collapsed backtest dock · expanded backtest panel · `Trades Analysis` · `Trades Log` ·
settings modal · ticker picker · Apollo presence orb.

Everything renders from `src/fixtures/market.ts`, seeded so screenshots are reproducible.
**No LLM, no Pine compilation, no market data, no backtest engine** — capabilities are out of scope
by design, so the chat reply is a scripted fixture that does not respond to what you type.

### Gates — all currently green

```
npm run check:palette     # reads hexes out of src/tokens.css, 20/20
npx tsc -b                # clean
npm run build             # clean
```

`docs/parity/` holds the seven side-by-side sheets. All seven pass on §11's terms.

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

1. Clear Greptile on both PRs, then **merge #1 before #2** (#2 is based on #1, not on `main`).
2. Operator moves the board card `verify → done`. Only the operator does this.
3. Restart the dev server if screenshots are needed: `npm run dev`, then
   `SEED=1 node scripts/shoot.mjs <out.png> [clickSelector ...]`.
   `node scripts/probe.mjs "<js>"` reads computed style off the running page — use it when
   something looks wrong but the source looks right.

### Open — do not re-derive these either

Six unknowns in §12. Two block full sign-off on the Performance tab:

- The metrics table below the fold — only `Net Profit` and `Open PnL` are legible in the footage;
  the third row is partly visible (`~12.45%`). Full row list unknown.
- `Weekday Performance` card's right edge is webcam-occluded in **every** frame. Width and whether
  it has its own filter row are inferred.

Closing either needs another capture pass or one screenshot from a logged-in session.

### Stated ceilings

- **Price axis renders ~35 tick labels where the reference shows ~5.** `lightweight-charts` derives
  tick count from pane height with no public control; coarsening `minMove` would round displayed
  prices. Disclosed rather than worked around.
- `Trades Analysis` / `Trades Log` have **no reference footage** — they are ours (§8c, §8d), exempt
  from the parity diff, gated by the empty-state sweep instead.
- **Apollo's visual is provisional.** §13 is forward context, not a UI spec. Research established
  that the reference product moved voice *out* of a floating orb and into the chat thread in
  Nov 2025, and that the Jul 2026 release was a voice model with no visual redesign — so an
  ever-present orb is our own choice. No public source documents its animation at an implementable
  level; the constants in `ApolloOrb.tsx`'s `MOTION` table are ours.
- Bundle is ~525 kB, over Vite's 500 kB warning. Not split.

### Graphs

No code graph for this repo yet. Build one when the branches land on `main`; there is now code
worth indexing. The ops-vault graph was current as of this wave's `vault_sync`.
