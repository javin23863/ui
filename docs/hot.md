# ui — hot state

Live source of truth for this repo. The next session reads this first.
**Delete what stops being true. A finished item still marked `▶` is a lie.**

---

## ▶ UI parity spec — SPEC LANDED, BUILD NOT STARTED

**As of 2026-08-05.**

| | |
|---|---|
| Spec | `docs/UI-PARITY-SPEC.md` v3, 917 lines |
| Commit | `c9f286303b1fbaeda758b944784221061e26998b` |
| Branch | `docs/ui-parity-spec`, pushed, **not merged** |
| `main` | still only the 4-byte README |
| Board card | `consumer.ui-parity-spec` under `cap.consumer-shell`, **verify** @ rev 6760 |
| Implementation | **none — zero source files exist** |

### What is decided

- Both reference videos are the **same product**, LuxAlgo Quant. The back half of `TdgiAZG-Xhs`
  (~28:00 on) is TradingView, not the product, and is out of scope.
- Seven 1920×1080 reference frames are **tracked** in `docs/reference/` so the parity gate runs on
  a fresh clone without re-downloading ~220MB of video.
- Four deliberate divergences from the reference, recorded in §0: our colour system, voice input,
  and both the `Trades Analysis` and `Trades Log` tabs.
- Stack: React + Vite + Tailwind v4 + `lightweight-charts` + `lucide-react` +
  `prism-react-renderer`. **No second charting library** — the five non-time-indexed charts are
  inline SVG.

### The trap this spec exists to record

`lightweight-charts` is **time-indexed** and fights anything that is not. `Weekday Performance` is
category-indexed **and it is in the parity set**, so the SVG split is required at P4 regardless of
our own tabs. The first draft of this spec claimed one library covered every chart; it does not.
§10 carries the corrected table — read it before reaching for Recharts.

### Runbook — exact next steps, in order

1. **Operator accepts or rejects the spec.** Card sits in `verify`; only the operator moves it to
   `done`. Nothing below starts before that.
2. File the **P0 build card** before any source file is created. A card filed after the work is a
   receipt, not a plan.
3. `git checkout main && git merge docs/ui-parity-spec` (or merge the PR) so the spec is on `main`
   before the build branches off it.
4. P0: tokens + shell. `@theme` block straight from §2b — do not retype the hexes, copy them.
5. Wire the colour gate into CI at P0, not later:
   ```
   node scripts/validate_palette.js "#3D86E0,#9A7420,#9B7BE8" --mode dark --surface "#101319"
   ```

### Open — do not re-derive these

Six unknowns in §12. The two that block P4 sign-off:

- The Performance-tab metrics table below the fold — only `Net Profit` and `Open PnL` are legible
  in the footage; the third row is partly visible (`~12.45%`). Full row list unknown.
- `Weekday Performance` card's right edge is webcam-occluded in **every** frame. Width and whether
  it has its own filter row are inferred.

Closing both needs either another capture pass or one screenshot from a logged-in session.

### Ceilings, stated

- Capabilities are **out of scope by design**. No LLM, no Pine compilation, no market data, no
  backtest engine. Everything renders from fixtures in `src/fixtures/`.
- `Trades Analysis` / `Trades Log` (§8c, §8d) have **no reference footage** — they are ours. They
  are exempt from the parity diff and gated by the empty-state sweep in §11 instead.
- §13 (Apollo) is **forward context, not a deliverable**. It constrains P0–P6; it specifies no UI.

### Graphs

No code graph exists for this repo and none is needed yet — there is no code. Build one at P0 when
source files first land. The ops-vault graph is current as of this wave's `vault_sync` run.
