# TraderCockpit UI — Parity Spec v3

**Status:** built. This document stays the *specification* — it says what the UI must be, not what
the code currently does. Live build state is `docs/hot.md`; where the two disagree, this file is
the target and the build is the defect.
**Scope:** visual + interaction-shape parity with the reference, **plus four deliberate
divergences** (§0). **Capabilities explicitly out of scope** — no real LLM, no Pine compilation, no
live market data, no real backtest engine. Everything renders from fixtures.
**Written:** 2026-08-05 · **v2:** the two tabs become ours + voice input · **v3:** our own
validated color system (§2) + Apollo forward-context (§13). All same day.
**Repo:** `javin23863/ui` (was empty at `256d8f2` — this is the build target, not a reference)

---

## 0. Divergences from the reference

Parity is the default. These four are not, and are called out so the parity gate never flags them
as defects and no one later "corrects" them back toward LuxAlgo.

| § | Divergence | Why |
|---|---|---|
| §2b | **The whole color system is ours** — our surfaces, our semantics, brand separated from P&L | Layout is the thing worth copying; the palette is identity. Ours is also CVD-validated, which the reference's is not. |
| §4a | **Voice input** — mic in the composer, dictation into the box | Reference is type-only. Operator: "he has to type." |
| §8c | **`Trades Analysis` tab is ours** — sample adequacy, cost sensitivity, IS/OOS split, R-distribution, MAE/MFE, duration/streaks, regime | Never opened in either video. Nothing to copy, so it carries our information instead. |
| §8d | **`Trades Log` tab is ours** — 17-column auditable ledger, `Gross`/`Costs`/`Net` split out, `IS`/`OOS` per trade, cross-link to chart | Same. |

The two tabs share one design rule: **every panel must be able to say "no."** The reference's
backtest surface has no way to express "this result is thin", "costs were never modelled", or
"there was no holdout". Ours does, and P6 gates on it (§11).

**Parity means geometry, hierarchy and interaction shape — not pixels.** Layout, spacing, element
order and behaviour match the reference; color does not, and §13 is a fifth axis the reference has
no answer to at all.

---

## 1. What the references actually are

Both videos are the **same product**: **LuxAlgo Quant**, at `luxalgo.com/quant/`.

| Source | Length | What it shows |
|---|---|---|
| `TdgiAZG-Xhs` | 32:48 | Quant empty state → chat → indicator on chart → Pine code view → **exports to TradingView** for the back half |
| `oxZj1kSye-g` | 33:06 | Quant chat → indicator → **converts to strategy → full Backtest Results panel** |

The back half of video 1 (from ~28:00) is **TradingView desktop, not the product**. It is *not* a
parity target. Anything sourced from there is marked `[TV — not in scope]` below.

Video 2 is the primary reference for the backtest graphics. Video 1 is the primary reference for
the empty state and the code view.

Frames captured at 1920×1080 in `docs/reference/`:

| File | Source | Timestamp | Shows |
|---|---|---|---|
| `01-empty-state.png` | vid1 | 02:00 | Empty workspace, "What do you want to create?" |
| `02-chart-indicator.png` | vid2 | 06:40 | Chat + chart with signal markers |
| `03-code-view.png` | vid1 | 11:00 | Pine Script editor pane, Copy/Run |
| `04-chart-trades-summary-dock.png` | vid2 | 23:00 | Chart with TP/SL boxes + collapsed Backtest Summary dock |
| `05-backtest-performance.png` | vid2 | 21:40 | Expanded Backtest Results, Performance tab |
| `06-settings-modal.png` | vid2 | 24:20 | Strategy settings modal |
| `07-ticker-picker.png` | vid2 | 31:00 | Symbol search dropdown |

**Branding caveat:** copy the *layout and visual system*, not the identity. TraderCockpit ships its
own wordmark, logo, product name, and empty-state copy. No LuxAlgo mark, no LuxAlgo strings.

---

## 2. Design tokens

Geometry and type are measured from the reference. **Color is ours** — §2b.
Dark only; the reference has no light mode and neither do we.

### 2a. The reference's colors — documentation, not tokens

Sampled from `05-backtest-performance.png` so the parity diff has a baseline to compare against.
**Do not use these values.** They appear nowhere else in this spec.

| Role | LuxAlgo | Ours (§2b) |
|---|---|---|
| page | `#0F1015` neutral grey | `#0A0C10` cooler, deeper |
| panel | `#121316` | `#101319` |
| elevated | `#222328` | `#1A1F27` |
| profit | `#0A9276` teal | `#0E9E8F` |
| loss | `#DE365A` pink-red | `#CE4040` |
| down candle | `#EA3657` | `#CE4040` (same as loss — we don't split it) |
| accent | `#0A9276` — **same hue as profit** | `#3D86E0` blue — deliberately not a P&L hue |

The last row is the substantive change, not a taste one. LuxAlgo's brand accent *is* its profit
color, so a teal chip anywhere on screen is ambiguous — brand, or money? Ours separates them: blue
is identity and interaction, teal-green only ever means profit.

### 2b. TraderCockpit color — validated, not picked

Every value below was run through the dataviz validator against our own dark surface `#101319`
(OKLab ΔE ×100, Machado–Oliveira–Fernandes CVD simulation at severity 1.0). Numbers are in §2c.
**Do not substitute an eyeballed hex into any of these slots** — re-run the validator instead.

This block is the real `src/tokens.css`, not a paraphrase of it — valid CSS, copy-pasteable.
The `--color-*` prefix is required: Tailwind v4 derives its utilities from that namespace inside
`@theme`, so `--color-profit` is what makes `text-profit` and `bg-profit` exist. Dropping the
prefix silently yields no utilities at all.

```css
@theme {
  /* surfaces — cockpit-at-night, cooler and deeper than the reference's neutral grey */
  --color-bg-app: #0a0c10; /* page + left rail (same value, no seam) */
  --color-bg-panel: #101319; /* workspace panel, cards, KPI strip · THE CHART SURFACE */
  --color-bg-elevated: #1a1f27; /* user bubble, dropdowns, Run button, sticky footer */
  --color-bg-hover: #151a21; /* table + list row hover */
  --color-border: #1e242d; /* 1px dividers, panel edges, card outlines */
  --color-border-strong: #2b3340; /* IS/OOS split rule, crosshair, scrollbar thumb */
  --color-icon-idle: #3a4351; /* left-rail icons at rest */

  /* ink */
  --color-text-primary: #f2f5fa; /* body copy, chat text, values */
  --color-text-secondary: #c3cad6; /* active tab label */
  --color-text-muted: #8a94a3; /* KPI labels, idle tabs, axis ticks, placeholders */

  /* semantics — reserved, never used for identity */
  --color-profit: #0e9e8f; /* up candles, positive values, equity above water · 5.58:1 */
  --color-loss: #ce4040; /* down candles, negative values, equity under water · 3.92:1 */
  --color-warning: #d9a227; /* Thin sample / Sparse chips, cost-headroom alert · 8.10:1 */

  /* brand — identity and interaction only, never a P&L value */
  --color-accent: #3d86e0; /* token pill, focus ring, active pill, mic, OOS chip · 5.03:1 */

  /* series slots — see §2d. Fixed order, assigned in sequence, never cycled. */
  --color-series-1: #3d86e0;
  --color-series-2: #9a7420;
  --color-series-3: #9b7be8;
}
```

Chart-derived fills. These are plain custom properties on `:root`, **not** `@theme` entries —
they are composite values (alpha, gradients) rather than colours Tailwind should build utilities
from:

```css
:root {
  --tp-box-fill: rgba(14, 158, 143, 0.2); /* target zone */
  --sl-box-fill: rgba(206, 64, 64, 0.2); /* stop zone */
  --scrim: rgba(10, 12, 16, 0.6); /* modal backdrop, no blur */
}
```

The equity area gradient and the two EMA polarity colours are applied at their draw sites from
`--color-profit` / `--color-loss` rather than aliased here — one fewer name to keep in sync.

**Naming, so shorthand is not mistaken for a missing token.** The block above is the complete set;
nothing else is defined. Prose elsewhere in this document writes `--profit`, `--loss`, `--accent`,
`--border` and so on as shorthand for the `--color-`-prefixed token of that name. If a reference
appears that does *not* resolve to a row above, it is a defect in this document — the token set
does not grow to match the prose.

**One cascade rule that is not optional.** Base element styles must sit inside `@layer base`:

```css
@layer base {
  button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
}
```

Unlayered rules beat layered ones, and Tailwind utilities live in a layer. An unlayered
`button { background: none }` silently overrides every `bg-*` and `text-*` utility on every button
in the app. This shipped once and was caught only by reading computed style off the running page.

### 2c. Validator results — the receipts

| Check | Result |
|---|---|
| profit ↔ loss, CVD | **ΔE 10.8** (deutan) — clears the ≥8 target |
| profit ↔ loss, normal vision | **ΔE 28.9** — clears the ≥15 floor |
| lightness band, both | inside dark band L 0.48–0.67 |
| contrast on `#101319` | profit 5.58 · loss 3.92 · warning 8.10 · accent 5.03 — all ≥3:1 |

**Why profit is teal-green and loss is crimson, not the obvious green and red.** Conventional
trading green/red **fails** the CVD gate — the `#22B07A`/`#E24868` pair I first tried measures
**ΔE 4.0** under deuteranopia, i.e. roughly 1 in 12 men cannot separate a winning trade from a
losing one by color. Every green-family candidate was ranked; the best achievable is teal-green
↔ crimson at 10.8. That is why profit is pushed toward teal and loss toward crimson: it is the
furthest the pair can move *and still read as green and red to a trader*.

**Sign is mandatory anyway.** Color is never the only carrier of polarity: every signed value
renders its `+` or `−`, every histogram bar sits above or below a visible zero baseline, and the
Trades Log has a `Side` chip with a text label. If someone strips the color, the numbers still read.

### 2d. Series identity — regimes are NOT a categorical palette

With profit, loss and warning occupying the green, red and amber regions, sRGB at the dark
lightness band **does not have room** for a 5-hue categorical set that also stays clear of the
semantics. Measured, not assumed: every orange and every magenta step tested landed within ΔE 15
of loss or warning, and got dropped.

That is the palette telling us the form is wrong, so take the hint:

- **Regime breakdown is a table** (§8c.7). Tables carry identity in the label column. No series
  colors needed at all — `Net` already wears profit/loss.
- **If regimes are ever charted**, they are *nominal* (reordering them changes nothing), so per the
  method every bar takes the same slot-1 hue — `--accent` — with direct labels and no legend.
  One hue, no collision, no legend box.
- **If a genuine multi-series chart appears later**, these three slots are validated and clear of
  the semantics, in this fixed order — assign in sequence, never cycle:

  | Slot | Hue | Hex | Contrast |
  |---|---|---|---|
  | 1 | blue | `#3D86E0` | 5.03:1 |
  | 2 | yellow | `#9A7420` | 4.33:1 |
  | 3 | violet | `#9B7BE8` | 5.66:1 |

  Worst adjacent CVD ΔE 25.6, normal-vision 26.4 — both comfortable. **Series cap: 2** for
  scatter / small-multiples (all-pairs passes at 2, fails at 3). A fourth series folds to `Other`
  or facets — it never gets a new hue.

  Two tight edges to respect: slot-1 blue sits ΔE 16.0 from `--profit` and slot-2 yellow sits
  ΔE 15.2 from `--loss`. Both clear the ≥15 floor but not by much — never place either adjacent to
  a P&L mark without a direct label.

### Type

Single sans stack, no serif anywhere. Reference renders as a Helvetica/Inter-class grotesk.
Use **Inter**.

```
h1  / empty-state prompt        24px  600   --text-primary
h2  / section heading           16px  600   --text-primary   ("Performance")
h3  / panel title               15px  500   --text-primary   ("Sweep and Engulf Strategy")
card-title                      13px  500   --text-primary   ("Net Daily PNL (USD)")
body / chat                     13px  400   --text-primary   line-height 1.55
kpi-label                       10px  500   --text-muted   uppercase, letter-spacing 0.06em
kpi-value                       14px  500   (semantic color)
metric-row                      13px  400
tab                             13px  500
axis-tick                       10px  400   --text-muted
disclaimer                       9px  400   --text-muted
code                            12px  400   ui-monospace / JetBrains Mono, line-height 1.5
```

### Geometry (at 1920×1080 viewport)

```
left rail width           40px       icons 20×20, centered, ~44px vertical rhythm
chat pane                 x 60→577   content column 505px wide
vertical divider          x 604      1px --border
workspace panel           x 608→1904 bg --bg-panel, radius 8px, inset 16px from viewport bottom
top bar height            ~46px      right-aligned: Share chat · token pill · avatar+caret
workspace header          y 128→158  36px tall
panel padding             16px
card gap                  16px
control height            32px       chips, buttons, inputs
chip radius               6px
panel radius              8px
pill radius               999px      category pills, token pill, send button
```

---

## 3. Layout skeleton

```
┌──┬────────────────────────┬──────────────────────────────────────────────┐
│  │                        │                        [Share chat][⌾264368][●▾]│ top bar
│R ├────────────────────────┼──────────────────────────────────────────────┤
│A │                        │ « [chart][code]  Title ⚙        [Backtest] 📷 │ ws header
│I │   chat transcript      ├──────────────────────────────────────────────┤
│L │   (scrolls)            │                                              │
│  │                        │            WORKSPACE BODY                    │
│  │                        │      chart | code | backtest results         │
│  │                        │                                              │
│  ├────────────────────────┤                                              │
│  │ ┌────────────────────┐ ├──────────────────────────────────────────────┤
│  │ │ Ask for an indicat.│ │  Backtest Summary  <date range>  ☆           │ dock
│  │ │ 🖼            ( ↑ ) │ │  NET PROFIT   TRADES   WIN RATE   MAX DD     │ (collapsed)
│  │ └────────────────────┘ │  ▁▂▃▅▆▇ sparkline equity                     │
│  │  disclaimer            │                                              │
└──┴────────────────────────┴──────────────────────────────────────────────┘
```

Two fixed columns, no user-resizable splitter observed. `«` collapses the chat pane.

### Left rail

Five icons, top to bottom, all `--icon-idle` at rest, `--text-primary` on active/hover:

1. Product logo/mark (top, offset above the group)
2. New chat / compose
3. Indicators
4. Screener / scanner
5. History

No labels, no tooltips observed in frame. Rail bg is identical to page bg — there is **no divider**
between rail and chat pane.

### Top bar

Right-aligned only, no left content:
- `Share chat` — 32px pill, `--bg-panel`, 13px `--text-primary`. **Hidden on the empty state** (see `01`).
- Token/credit pill — `⌾ 264368`, outlined pill, `--accent` text, 13px (reference uses its teal
  here; ours is blue — a credit balance is not a P&L value)
- Avatar circle + chevron

---

## 4. Chat pane

### Empty state (`01-empty-state.png`)

Vertically centered in the pane, above the input:
1. `What do you want to create?` — 24px/600, centered
2. Three pill buttons, centered, wrapping 2 + 1:
   `🖼 Generate From Image` · `↗ Search Trending Scripts` · `⚡ Brainstorm Ideas`
   32px tall, `--bg-panel` fill, 1px `--border`, 13px, leading icon, radius 8px
3. Input box directly below

### Transcript

- **Assistant turns:** no bubble, no avatar. Plain text on page bg, full column width, left-aligned.
  Renders markdown: paragraphs, `**bold**`, ordered + unordered lists with hanging indent, and
  `inline code` in a subtle chip (`--bg-elevated`, mono 12px).
- **User turns:** right-aligned bubble, `--bg-elevated` fill, radius 10px, 10px/14px padding,
  `max-width: 78%` of the column. Images attached by the user render as a rounded thumbnail
  (~155×135, radius 8px) inside the bubble stack.
- Turn spacing 24px. No timestamps, no copy/regenerate hover controls visible.
- Custom scrollbar: 3px, `--border-strong`, inset on the right edge of the column.

### Composer

- Rounded box, radius 10px, 1px `--border`, `--bg-panel` fill, min-height 64px, auto-grows
- Placeholder: `Ask for an indicator` (empty state uses `I want to …` as *seeded value*, not
  placeholder — see `01`)
- Bottom-left: image-attach icon, 16px, `--text-muted`
- Bottom-right: **mic button** (§4a — our addition), then circular send button, 26px, near-white
  fill `--text-primary`, dark up-arrow glyph
- Below, centered, 9px `--text-muted`:
  `Past performance is not indicative of future results. This tool can make errors. Read full disclaimer.`
  — `full disclaimer` underlined.

---

### 4a. Voice input — DIVERGENCE FROM REFERENCE

The reference is type-only. Adding push-to-dictate. **Dictation, not voice mode** — speech fills the
composer, the user reviews, the user sends. It never auto-sends.

**Implementation: the native `SpeechRecognition` Web Speech API. Zero dependencies, no backend, no
audio upload code of our own.** `continuous: true`, `interimResults: true`, `lang` from
`navigator.language`.

#### Button

26px circular, sits left of send with an 8px gap. Mic glyph, `--text-muted` at rest.

| State | Button | Composer |
|---|---|---|
| `idle` | transparent, `--text-muted` glyph | normal |
| `requesting` | `--text-muted` glyph, 700ms pulse | normal |
| `listening` | `--accent` fill, `--text-primary` glyph | 5-bar amplitude meter replaces the placeholder row, driven by `AnalyserNode` RMS, bars `--accent`, 60fps |
| `transcribing` | `--accent` fill, spinner ring | interim text streams in at `--text-muted`, finalizes to `--text-primary` |
| `denied` | 1px `--loss` ring, `--loss` glyph | inline 11px `--loss`: `Microphone blocked — enable it in your browser settings` |
| `unsupported` | **button not rendered** | — |

Never render a mic button that cannot work. Firefox has no `SpeechRecognition`; feature-detect and
hide.

#### Interaction

- Click to start, click again to stop. `Esc` stops and keeps the transcript.
- Auto-stop after 2.5s of silence. Configurable; the timer resets on every interim result.
- Transcript **appends at the caret**, it does not replace existing text.
- Shortcut: `Ctrl/Cmd + Shift + M`.
- While listening, the send button stays enabled — sending stops the recogniser first.

#### Accessibility (not optional)

- `role="button"`, `aria-pressed` bound to the listening state, `aria-label="Dictate"`
- `aria-live="polite"` status region announcing `Listening` / `Stopped` / `Microphone blocked`
- Full keyboard reachability; the amplitude meter is decorative and `aria-hidden`

#### Privacy boundary — must ship with the feature

**Chrome's `SpeechRecognition` streams captured audio to Google's servers for recognition.** That is
third-party data egress from a trading tool. It gets a one-time inline consent line above the
composer on first use, before the first capture:

> `Voice input sends audio to your browser's speech service. Use text instead? [Not now] [Allow]`

Dismissible, remembered in `localStorage`, re-shown if cleared. Not a modal, not pre-checked, and
capture does not start until `Allow`. Do not simplify this away.

`ponytail:` browser speech service, streams audio off-box. Upgrade path when that is unacceptable
or Firefox support is needed: `MediaRecorder` → local `whisper.cpp` endpoint. Same button, same
states, swap the transport — the consent line then goes away because the audio never leaves.

---

## 5. Workspace header

Left group:
- `«` collapse chat, 14px, `--text-muted`
- Two view-toggle icons: **chart** (line-chart glyph) and **code** (`<>`). Active one is
  `--text-primary`, idle `--text-muted`. No pill background, no underline — color only.
- Title, 15px/500 (`My script` before first save, then the generated name)
- `⚙` gear — opens the settings modal (§9)
- A small spinner/refresh glyph appears right of the gear while a run is in flight

Right group, contextual:
- Chart view: `↗ Backtest` text button (appears once the script is a `strategy()`), then `📷` snapshot
- Code view: `⧉ Copy` and `▷ Run`. `Run` is the only **filled** button in the app —
  `--bg-elevated` fill, `--text-primary` label, 32px, radius 6px.

---

## 6. Chart pane

### Toolbar (floating over the chart, top-left, y≈195)

Single row of chips, 32px tall, `--bg-panel`, radius 6px:
- Symbol chip: 16px round asset icon + `XAUUSD` + small teal live dot + chevron
- Timeframe chip: `4h` + chevron
- Indicator icon (bar-chart glyph)
- Settings icon (gear)

### Plot surface

- **No gridlines.** Plain `--bg-panel`. This is the single biggest visual difference from a stock
  charting-lib default — turn grid off explicitly.
- **No left axis, no axis border.** Price labels float on the right at x≈1840, 10px `--text-muted`,
  right-aligned, no separator line. Last-price label gets a filled chip in the series color.
- Time axis at the bottom, ~6–8 ticks, **full datetime**: `6/29/2026, 6:00:00 PM` on intraday,
  `Jun 4` style on higher timeframes. 10px `--text-muted`.
- Candles: up `--profit`, down `--loss`, 1px wicks in the body color, solid bodies. The reference
  splits its down-candle to a hotter red than its loss token; we do not — one loss color everywhere.
- Crosshair: thin dashed `--border-strong` both axes, with a value chip on each axis.

### Indicator overlays (fixture-driven)

- **Signal markers:** small solid triangles above/below the bar, `--profit` up / `--loss` down.
- **Zone boxes:** semi-transparent rects spanning a bar range (accumulation grey, manipulation
  yellow, FVG green/red, IFVG teal/orange in the reference). Fill only, no stroke.
- **EMA trend line:** 2px, one polyline whose stroke switches per segment by slope — rising takes
  `--color-profit`, falling takes `--color-loss`. There are no separate `--ema-*` tokens; the
  polarity colours *are* the semantics, and aliasing them would be a second name to keep in sync.
  A line series cannot carry per-segment colour, so this is drawn in the SVG overlay (§6a).

### Trade visualization (strategy mode — `04-chart-trades-summary-dock.png`)

Per trade:
- Entry label, 10px, two lines: qty (`-10`) then side (`Short`), colored by side
- **TP box:** rect from entry price → target, `--tp-box-fill`
- **SL box:** rect from entry price → stop, `--sl-box-fill`
- Exit label at the close bar: `Exit Short` + signed P&L (`+10`)
- A thin vertical connector from entry marker to the boxes

---

## 7. Code pane (`03-code-view.png`)

- Header switches to `⧉ Copy` / `▷ Run`
- Line-number gutter, right-aligned, 12px `--text-muted`, ~44px wide, no separator rule
- Line 1 (the license comment) is rendered with a full-width **selected-line highlight** band
  — a subtle `--bg-elevated` — because it is the current line; that band follows the caret
- Syntax palette observed:

```
comment        #6A9955   (green, incl. the license URL which is also underlined blue #4A9EFF)
keyword/fn     #DCDCAA   (indicator, input.int, array.new)
string         #CE9178
number         #B5CEA8
type/var       #569CD6   (var, int, float, box)
identifier     #9CDCFE
punctuation    #D4D4D4
```

That is VS Code Dark+. Ship Dark+ rather than hand-rolling.
- Vertical scrollbar on the right of the pane, 4px.
- Read-only for parity purposes. No autocomplete, no diagnostics, no minimap.

---

## 8. Backtest graphics — the core deliverable

Two states.

### 8a. Collapsed dock (`04-chart-trades-summary-dock.png`)

Docked strip at the bottom of the workspace, *below* the chart, ~215px tall. Chart shrinks to fit.

- Header row: `Backtest Summary` 13px/600, then date range `May 5 – Jul 15, 2026` 12px
  `--text-muted`, then a `☆` favourite toggle
- KPI row (same five as §8c) at 10px labels / 14px values
- **Sparkline equity curve**, full width, ~70px tall, no axes, no fill — just the line, colored
  `--loss` while cumulative P&L is negative and `--profit` once positive. Segment-colored, one path.
- x labels underneath, ~10 ticks, 10px `--text-muted`
- Click anywhere → expands to 8b

### 8b. Expanded panel (`05-backtest-performance.png`)

Replaces the chart entirely. Header row:
`[symbol chip] [tf chip]  Backtest Results  <date range>  ☆` … right: `⤢` collapse icon.

Tabs, 13px, underline-on-active (2px `--text-primary`, only under the label width):
**`Performance`** · `Trades Analysis` · `Trades Log`

#### Equity curve (top block, ~255px tall)

- **Area series**, line `--color-profit` 2px, fill
  `linear-gradient(180deg, rgba(14,158,143,0.26), rgba(14,158,143,0.02))` — the gradient is applied
  at the draw site rather than aliased to a token, since it is a composite value Tailwind should
  not build a utility from
- Segments where cumulative P&L < 0 are drawn `--loss` (line *and* fill) — see the red opening
  segment in `05`
- Right price axis, ~8 ticks, includes a negative tick below the zero line, 10px `--text-muted`
- **No gridlines**, but a faint zero baseline
- x axis: ~18 date ticks, `May 5`, `Jun 2`, `Jul 14` style
- Hover tooltip (`04` shows it): `--bg-elevated` card, radius 6px, ~140×80:
  ```
  Trade #18  [Short]        ← badge, --loss bg tint, 10px
  ● Cumulative P&L
    $ 3.2k                  ← 14px --profit
  Tue, Jun 09, 2026, 21:00 (UTC)   ← 10px --text-muted
  ```

#### KPI strip

Full-width row, top border 1px `--border`, 5 equal columns, ~48px tall:

| Label | Value format | Color rule |
|---|---|---|
| `NET PROFIT` | `+1,660.65 USD` — `USD` suffix at 11px `--text-muted` | signed |
| `TRADES` | `45` | `--text-primary` |
| `WIN RATE` | `35.56%` then `16 \| 29` at 11px `--text-muted` | `--text-primary` |
| `MAX DRAWDOWN` | `661.30 USD` then `0.07%` at 11px `--text-muted` | `--text-primary` |
| `PROFIT FACTOR` | `1.572` | `--profit` if > 1, else `--loss` |

Signed values: `--profit` when positive, `--loss` when negative. Always show the `+`.

#### `Performance` section

Heading `Performance` 16px/600, 24px above.

Two cards side by side. From `05`, the left card is ~600px and the right ~340px — call it a
**64/36 grid**, 16px gap. Both cards: `--bg-panel`, 1px `--border`, radius 8px, 16px padding.

**Card 1 — `Net Daily PNL (USD)`**
- Histogram, one bar per trading day, zero baseline
- `--profit` above, `--loss` below, 2px bar width, ~1px gap
- Rotated y-axis title `Net Daily P&L`, ticks `-2k … 3k`
- x ticks: `Jul 2023`, `Jan 2024`, …
- Legend below: `■ Profit  ■ Loss`, 11px, swatches 8×8 radius 2

**Card 2 — `Weekday Performance (USD)`**
- Histogram, 7 bars (Sun→Sat), same color rule
- Rotated y-axis title `Weekday P&L`
- x ticks are weekday names
- Same legend
- **Its own `All` / `Long` / `Short` row, centred below the legend.** The second capture pass found
  a control-shaped `All` there with nothing at the same position under Card 1, so the control
  belongs to this card. It is never clicked on camera, so *filter* is our reading of it (§12.2).
  It is independent of the metrics-table filter below — one card's slice must not silently
  repaint the other's numbers.
- Sat and Sun read zero for every instrument that closes at the weekend, because the bars come
  from the ledger. A weekday breakdown that shows weekend sessions is reporting trades that
  could not have happened.

#### Metrics table

Below the cards. A filter row (`All` / `Long` / `Short` — `All` is the default, right-aligned,
11px), then two-column rows. **The filter recomputes every row from the selected slice, drawdown
included** — a peak-to-trough caused by a short must not survive into the Long view. Shipping these
as static markup with the first option permanently styled active is the failure mode: a control
that looks like it filters and does not is worse than no control, because the reader trusts the
number beside it.

```
row height 30px, 1px --border between rows
label  left,  13px --text-primary
value  right, 13px, semantic color, unit suffix 11px --text-muted
```

Rows confirmed in frame: `Net Profit`, `Open PnL`, and further rows below the fold
(`Gross Profit`, `Gross Loss`, `Max Drawdown`, `Sharpe`, `Sortino`, `Avg Trade`, … — see §12).

### 8c. `Trades Analysis` — DIVERGENCE FROM REFERENCE

Neither reference video ever opens this tab, so there is nothing to copy. **This is ours.** It
carries the shell (tabs, cards, tokens, KPI-strip shape) so it reads as native, and answers the
question the reference does not: *is this result real, or is it an artifact?*

Design rule for the whole tab: **every panel must be able to say "no"**. A card that can only
render a flattering number is decoration. Where an input is missing, the card shows an explicit
empty state and never a substituted number.

Copy rule: customer-facing surface. Banned words — `battery`, `verdict`, `receipt`, `preview`.

#### 1. Sample adequacy strip

Same geometry as the Performance KPI strip (§8b) so it reads as one system. 5 columns:

| Label | Value | Warn rule |
|---|---|---|
| `TRADES` | `82` | amber chip `Thin sample` below 30 |
| `TRADES / MONTH` | `2.3` | amber chip `Sparse` below 2.0 |
| `TOP-3 TRADE SHARE` | `41%` | amber above 40%, red above 60% |
| `LONGEST FLAT PERIOD` | `94 days` | amber above 25% of the test window |
| `EXPOSURE` | `18%` of bars | none |

`TOP-3 TRADE SHARE` is the headline metric of this tab: share of net profit contributed by the
three best trades. It is the one number that catches a curve resting on a handful of outliers.
Amber chip: `--warning` fill at 18%, 10px label, radius 4px.

#### 2. Cost sensitivity — the differentiator card

The reference states outright that slippage and commission are *not* in its equity curve. Ours puts
that on screen.

- Line chart, x = modelled cost per round turn (`$0` → `2×` the configured cost), y = net profit
- Line `--profit` above zero, `--loss` below, single path, segment-colored
- Vertical marker at the configured cost, label `Modelled`
- Vertical marker where the line crosses zero, label `Breakeven`
- Three rows beneath: `Modelled cost` · `Breakeven cost` · `Headroom` (`breakeven ÷ modelled`, ×)
- `Headroom` is `--loss` below 1.5×, `--profit` above 3×, `--text-primary` between
- **Empty state, when costs are not modelled:** the chart is not drawn. Full-card message,
  13px `--text-muted`: `Costs not modelled — this result is a gross-return upper bound.`
  Never draw a flat line and call it insensitive.

#### 3. In-sample / out-of-sample split

- The equity curve again, with a 1px dashed `--border-strong` vertical at the split and the OOS region
  tinted `rgba(255,255,255,0.03)`
- Two stat columns below, `In-sample` / `Out-of-sample`: `Net`, `Win rate`, `Profit factor`,
  `Trades`
- A third column `Δ` showing OOS-minus-IS per row, `--loss` if OOS is materially worse.
  **A win-rate Δ is in percentage POINTS and must be labelled `pp`** — printed bare beside two
  values carrying `%`, it reads as a percentage change, which is a different quantity. **The
  `Trades` Δ is never coloured**: it describes how the run was split, not how it performed, and
  painting the smaller holdout red reads as a result getting worse.
- The split caption states the actual split point. Do not hardcode it — it moves whenever the
  signal count does.
- **Two distinct empty states, and the panel must tell them apart:**
  - No holdout declared → `No out-of-sample period declared for this run.` Do not split the sample
    ourselves and present it as a holdout — a split invented at display time is not a holdout.
  - **A holdout declared that no trade lands in** → say so, with both counts. This is the one that
    gets missed: the guard tests the *declaration*, the table renders, and out-of-sample shows
    `0.00`, `0.0%` and a large negative Δ — reporting that the strategy scored zero out of sample
    when the truth is it was never tested there. **Gate on the data, not on the declaration.**

#### 4. Trade distribution

Histogram of per-trade return in R, zero-centered, bins 0.25R. `--profit` right of zero,
`--loss` left. Two dashed vertical overlays: `mean` and `median`, labelled, 1px `--text-muted`.
Reads at a glance as "many small losses, few large wins" or the reverse.

#### 5. MAE / MFE scatter

x = maximum adverse excursion (R, always ≤ 0), y = maximum favourable excursion (R).
Point per trade, 3px, `--profit` for winners `--loss` for losers, 55% opacity.
A 45° reference line. Diagnoses stop placement: winners clustered at deep MAE means the stop is
barely surviving; losers clustered at high MFE means targets are too far.

#### 6. Duration and streaks

Two mini-histograms in one card, stacked:
- `Bars held` — overlaid winners (`--profit`) vs losers (`--loss`), 45% opacity
- `Consecutive streaks` — win-run and loss-run lengths, diverging from a shared baseline

#### 7. Regime breakdown

Table, same row geometry as the metrics table (§8b), 30px rows, 1px `--border`:

| Regime | Trades | Win rate | Net | Profit factor |
|---|---|---|---|---|
| Trend up | 24 | 58.3% | `+4,120.55 USD` | 2.41 |
| Trend down | 19 | 42.1% | `+880.10 USD` | 1.22 |
| Range | 31 | 38.7% | `−410.30 USD` | 0.88 |
| High volatility | 8 | 62.5% | `+1,396.30 USD` | 3.05 |

- Regime tags come from the fixture; the UI never derives them
- Any regime row with fewer than 10 trades renders its metrics at `--text-muted` with a
  `ⓘ Thin` chip — the numbers stay visible but stop looking authoritative
- **Empty state, when regimes are not tagged:** `Regime tags not available for this run.`

---

### 8d. `Trades Log` — DIVERGENCE FROM REFERENCE

Also never opened in either video. **Ours.** An auditable per-trade ledger — the thing you scroll
when you do not believe the summary.

#### Toolbar

Left: filter pills `All` · `Long` · `Short`, then `All` · `In-sample` · `Out-of-sample`.
Right: `⤓ Export CSV` (32px, `--bg-panel`, 13px).

#### Table

Sticky header, virtualized body, 32px rows, 1px `--border` between rows, hover `--bg-hover`.
**All numerics `font-variant-numeric: tabular-nums`, right-aligned.** Text columns left-aligned.

| Col | Format | Notes |
|---|---|---|
| `#` | `18` | `--text-muted` |
| `Side` | `Long` / `Short` chip | `--profit` / `--loss` tint, 10px, radius 4px |
| `Entry` | `Jun 09, 2026 21:00` | UTC, `--text-muted` 12px |
| `Exit` | `Jun 10, 2026 03:15` | UTC |
| `Bars` | `25` | |
| `Qty` | `10` | |
| `Entry px` | `4,062.15` | |
| `Exit px` | `4,088.40` | |
| `Gross` | `+262.50` | signed color |
| `Costs` | `−14.20` | always `--loss`; `—` when not modelled |
| `Net` | `+248.30` | signed color, 500 weight |
| `R` | `+1.42` | signed color |
| `MAE` | `−0.31` | `--text-muted` |
| `MFE` | `+1.88` | `--text-muted` |
| `Cum. net` | `3,241.10` | signed color |
| `Regime` | `Trend up` | `--text-muted`, `—` when untagged |
| `Sample` | `IS` / `OOS` chip | `OOS` chip `--accent` tint; the column that makes holdout discipline visible |

`Gross` / `Costs` / `Net` are three separate columns on purpose. The reference collapses cost into
nothing at all.

#### Behaviour

- **Row click cross-links to the chart:** switches the workspace to the chart view, scrolls to that
  trade's bar range, and flashes its TP/SL boxes. This is the tab's reason to exist.
- Column sort on click, single-column, arrow in the header.
- Sticky footer row, `--bg-elevated`: totals for `Gross`, `Costs`, `Net`, and the trade count.
  Sticky so the totals never scroll out from under the rows they summarize.
- Horizontal scroll below ~1400px with `#`, `Side` and `Net` frozen left.
- **Banner when costs are not modelled**, above the table, 11px `--text-muted` on `--bg-elevated`:
  `Costs not modelled — Net equals Gross.` The `Costs` column still renders, filled with `—`.
  Hiding the column would hide the omission.

---

## 9. Overlays

### Settings modal (`06-settings-modal.png`)

- Backdrop: full-screen, `rgba(15,16,21,0.55)`, no blur
- Card: ~340px wide, centered, `--bg-panel`, radius 10px, 1px `--border`, 20px padding
- Title = strategy name, 15px/500; `✕` top-right
- Tabs `Inputs` · `Properties`, underline-on-active
- Section headings: 10px uppercase `--text-muted`, letter-spacing 0.06em, 20px above
  (`SIGNAL FILTERS`, `EMA TREND FILTER`, `RISK MANAGEMENT`)
- Rows: label left 13px, control right ~110px wide, 32px tall, `--bg-elevated`, radius 6px
  - **select** — chevron right, text truncates (`Same Directio`)
  - **number** — plain text field, spinner arrows on hover
  - **checkbox** — 16px, radius 4px, filled `--accent` + white check when on
  - **info** — 14px `ⓘ` right of the label or control, `--text-muted`
- Footer, right-aligned: `Cancel` (text button, `--text-muted`) · `Ok` (32px, `--bg-elevated` fill)
- `[TV — not in scope]` The TradingView version of this modal adds a `Defaults ▾` control at the
  bottom-left and a `Visibility` tab. The product's own modal does **not** have them.

### Ticker picker (`07-ticker-picker.png`)

Anchored dropdown under the symbol chip, ~235px wide, `--bg-elevated`, radius 8px, 1px `--border`:

1. Search field — `🔍 Search ticker…`, 32px
2. Category pills, wrapping: `Stocks` `ETFs` `Crypto` `Forex` `Commodities`.
   Active pill: `--accent` fill, dark label. Idle: transparent, `--text-muted`.
3. Result rows, 36px: symbol 13px `--text-primary` over description 11px `--text-muted`
   (`GBPUSD` / `British Pound / U.S. Dollar`). Selected row shows a right-aligned `✓`.
   Hover: `--bg-hover`.
4. Scrollbar, 3px, list caps at ~5 visible rows.

### Timeframe dropdown

Not captured. Same anchored-dropdown shell, single-column list of `1m 5m 15m 1h 4h D W`.
Marked as inferred.

---

## 10. Stack

```
react 19 + vite + typescript
tailwindcss v4              tokens in @theme, no config file
lightweight-charts v5       time-indexed charts only (see split below)
lucide-react                thin-stroke icons match the reference
prism-react-renderer        Pine syntax highlight, VS Code Dark+ theme
```

No state library, no router (single view), no component library, **no second charting library**.
Fixtures are plain JSON in `src/fixtures/`, transcribed from the reference frames so screenshots
are directly comparable.

### Chart split — this matters, get it right before P4

`lightweight-charts` is **time-indexed**. It renders anything whose x-axis is a timestamp, and
fights anything that is not. The app has both kinds:

| Chart | x-axis | Renderer |
|---|---|---|
| Price candles + overlays (§6) | time | `lightweight-charts` |
| Equity curve, expanded (§8b) | time | `lightweight-charts` |
| Equity sparkline, dock (§8a) | time | `lightweight-charts` |
| Net Daily PNL histogram (§8b) | time | `lightweight-charts` |
| **Weekday Performance (§8b)** | **category** | inline SVG |
| **Cost sensitivity (§8c.2)** | **cost, $** | inline SVG |
| **Trade distribution (§8c.4)** | **R bins** | inline SVG |
| **MAE/MFE scatter (§8c.5)** | **R** | inline SVG |
| **Duration + streaks (§8c.6)** | **bins** | inline SVG |

`ponytail:` the five SVG charts are ~40 lines each — axis ticks, a `<path>` or a `<circle>` loop,
tokens straight from CSS vars. That is smaller than the adapter layer a second charting library
would need to match these tokens, and it is static: no zoom, no pan, no crosshair on any of them.
Add Recharts/D3 only if one of these gains real interactivity. Hover tooltips alone do not count —
that is a `<title>` or one `mousemove` handler.

Correcting an earlier claim in this spec: the first draft said one library covered every chart.
It does not — `Weekday Performance` is category-indexed and is in the **parity** set, so this split
is required at P4 regardless of our own tabs.

---

## 11. Build phases

Each phase ends with a screenshot at 1920×1080 diffed against the named reference frame.

| # | Phase | Deliverable | Gate |
|---|---|---|---|
| P0 | Tokens + shell | `@theme` block, left rail, top bar, two-column split, panel chrome | Empty shell matches `01` chrome |
| P1 | Chat pane | Empty state, transcript renderer, markdown, user bubbles, composer, disclaimer | vs `01`, `02` |
| P1b | Voice input | §4a — mic button, 6 states, amplitude meter, interim transcript, consent line, a11y, feature-detect hide | **own review, not a diff** |
| P2 | Chart pane | Toolbar chips, no-grid candles, floating right axis, datetime axis, markers, zone boxes, EMA | vs `02` |
| P3 | Code pane | Gutter, Dark+ highlight, Copy/Run, current-line band | vs `03` |
| P4 | Backtest — Performance | Collapsed dock + expanded panel: equity area, KPI strip, both histogram cards, metrics table, tooltip, tab bar | vs `04`, `05` |
| P4b | Backtest — our tabs | §8c Trades Analysis (7 panels, 5 SVG charts) + §8d Trades Log (17 cols, cross-link, sticky footer, CSV) | **own review, not a diff** |
| P5 | Overlays | Settings modal, ticker picker, timeframe dropdown | vs `06`, `07` |
| P6 | QA | Parity sheet for the 7 pairs; empty-state sweep for P1b/P4b; token audit; 1440px + 1280px reflow | operator sign-off |

**Parity gate, stated so it can fail:** for each pair, the diff must show correct *element
presence, order, alignment, and token usage*. It is allowed to differ in: **color values** (§2b is
ours by decision), webcam-occluded regions (bottom-right ~500×430 of every frame), fixture numbers,
and font hinting. It is **not** allowed to differ in: layout order, spacing scale, **color *role***
(if the reference colors a value by sign, so do we), or the absence of chart gridlines. A phase
that produces no diff sheet has not passed — it has not been checked.

Color gets its own gate, and it is the script, not an opinion:

```
node scripts/validate_palette.js "<the categorical slots>" --mode dark --surface "#101319"
```

Run it in CI on the token file. A hex that enters `--profit`, `--loss`, `--warning`, `--accent` or
a series slot without a passing run is a defect regardless of how it looks.

**P1b and P4b are exempt from the parity diff and get a different gate.** There is nothing to diff
against — they are ours. Their gate is the **empty-state sweep**: for every panel in §8c/§8d and
every state in §4a, render the fixture that should make it refuse, and confirm it refuses.

| Feed it | It must show |
|---|---|
| costs not modelled | cost-sensitivity card refuses; log banner + `—` column |
| no holdout declared | IS/OOS card refuses; it must not invent a split |
| untagged regimes | regime table refuses; log shows `—` |
| 11 trades | `Thin sample` chip on `TRADES` |
| 1.49 trades/month | `Sparse` chip on `TRADES / MONTH` |
| 3 trades carrying 70% of net | `TOP-3 TRADE SHARE` red |
| a regime row with 6 trades | that row muted + `ⓘ Thin` |
| `SpeechRecognition` undefined | mic button absent, not broken |
| mic permission denied | `--loss` ring + inline hint, no modal |
| consent not yet given | no capture starts |

A panel that renders a number for every one of these inputs has failed. Passing means it said no.

---

## 12. Known gaps — resolve before P4 ships

These are unknowns, not decisions. Nothing below should be invented into the build.

1. **Metrics table below the fold** (Performance tab) — **CLOSED as unrecoverable, 2026-08-05.**
   A full second capture pass over both videos at native 1080p settles it: the panel appears only
   in `oxZj1kSye-g`, from 19:10 to the end at 33:06, and in that entire span it is **never
   scrolled, resized, or expanded** — the vertical position of every row is pixel-identical across
   the whole 13 minutes. `Net Profit` and `Open PnL` are the only labelled rows. A third row
   exists in every frame but is cut by the recording's own bottom edge at y=1080, leaving glyph
   tips; no crop or upscale recovers pixels that were never captured. Its value renders as a plain
   (non-P&L-coloured) percentage — that is all that can be said. **Do not invent rows here.**
   Only a screenshot from a logged-in session can close this, and it is not a capture problem.
2. **Weekday Performance card, right edge** — **CLOSED as unrecoverable, same pass.** The webcam
   overlay holds one fixed position (≈x 1420–1920, y 650–1080) in 100% of ~35 sampled frames
   across the card's entire on-screen lifetime. It never moves, shrinks, or disappears, so Mon–Sat
   are permanently occluded.
   **One new fact did come out of it:** a control-shaped **`All`** label sits directly under that
   card's legend, and the sibling `Net Daily PNL` card has nothing at the same position — so the
   control belongs to the Weekday card specifically. It is never clicked or hovered on camera,
   so *that it is a filter* is inference; *that a control-shaped label is there and is unique to
   this card* is observed. §8b implements it as `All / Long / Short` on the strength of the
   second fact, not the first.
3. **Left-rail icon meanings** — glyphs are legible, labels are not. Names in §3 are inferred.
4. **Timeframe dropdown** — never opened.
5. **Light theme** — does not appear to exist. Not built.
6. **Responsive behaviour** — every frame is 1920×1080. Breakpoints are our choice, not parity.

1–2 are now closed against the footage: the second pass proved the information is **not in the
source at any resolution**, which is a different and more useful answer than "not yet looked for".
Only a screenshot from a logged-in session can move them. 3–6 remain open.

**Closed by decision, not by evidence:** the `Trades Analysis` and `Trades Log` tabs were gaps 1–2
in v1 of this spec. They are no longer gaps — operator ruling 2026-08-05: build them as ours (§8c,
§8d). Do not reopen them as parity items if reference footage of LuxAlgo's versions later surfaces;
that footage becomes a comparison, not a target.

---

## 13. Context — Apollo is coming to this screen (NOT a UI spec)

**Nothing in this section is a P0–P6 deliverable.** It is here so P0–P6 do not build something
Apollo has to be retrofitted into. Read it as constraints, not features.

### What Apollo is

Apollo is the product-facing copilot; **Jarvis is the engine — they are one concept**, not two
systems. Apollo is the delivery surface, Jarvis is the capability set. Anything Jarvis can do is
something Apollo should eventually be able to do *through this UI*.

The relevant Jarvis capability already exists as `PerceptionService` (`packages/esq/jarvis/`), which
is the **only** seam Jarvis touches for sight: `inspect_screen`, `inspect_region`, **`analyze_chart`**,
`find_ui_element`, `read_dialog`, **`extract_table`**, `compare_screens`. A local Gemma-4 vision model
acts as a *sensor* — it reports, it does not reason — and returns concise JSON; screenshots never
reach the executive model. Native Windows OCR is the text fast-path. All of it runs on-box.

*(Verify current wiring before building against it — as of the last note it was not yet exposed
through `procman.DesktopApi`, and that note is a month old.)*

### The workflow being replaced

In both reference videos the human does all the perceiving. He looks at the chart, notices the
manipulation box is stretching wrong, screenshots it, describes it in words, and types the
description into the chat. The model is blind and he is its eyes — **most of the 33 minutes is a
human narrating a screen to a model that cannot see it.**

The Apollo version: Apollo sees the chart, the backtest panel and the code directly, and the two go
back and forth about what is actually on screen. "Your manipulation box is stretching to the right
edge on the 1-minute — the distribution phase never triggers" is something Apollo should *observe*,
not something the user should have to type.

### What that costs us now — the actual constraints

Cheap if done from P0. Expensive as a retrofit. In rough priority:

1. **Every chart and table must also expose its data, not just pixels.** `analyze_chart` and
   `extract_table` are far more accurate reading a JSON payload than OCR-ing a canvas. Give every
   chart component a `data-apollo-series` attribute (or a sibling `<script type="application/json">`)
   carrying the exact series it drew. This is the single highest-value constraint in this section:
   it turns "Apollo squints at a screenshot" into "Apollo reads the numbers." It is also free —
   the data is already in the component.
2. **Stable identifiers on every interactive control.** `find_ui_element` needs a handle that is not
   a build-hashed CSS class. `data-apollo-id="timeframe-picker"`, `data-apollo-id="tab-trades-log"`,
   and so on. Naming them is a five-minute discipline at build time and unrecoverable later.
3. **Deterministic chart capture.** The `📷` snapshot control (§5) is already the screenshot seam.
   Make it capture the chart canvas at a fixed size regardless of viewport, so `compare_screens`
   baselines are comparable across sessions. Note the recorded trap: `compare_screens` baselines
   are per-scope — do not let one shared baseline serve two regions.
4. **The transcript needs a speaker model, now.** Back-and-forth means Apollo's turns land in the
   *same* transcript as the user's — the chat pane (§4) is already the surface, no new UI needed.
   But the turn model must carry `source: user | apollo` from P1, plus an optional attribution of
   *what Apollo looked at* ("read your chart, 4h XAUUSD") so a claim can be traced to an observation.
   Adding a discriminant to a transcript later means migrating every stored conversation.
5. **Reserve the proposed-action affordance.** Jarvis is confirm-gated behind an action allowlist;
   Apollo changing your timeframe or editing strategy inputs must render as a proposal the user
   accepts, not a silent mutation. Leave room above the composer for it. Do not build it at P1 —
   just do not fill that space with something else.
6. **Do not assume text-only output.** The mic (§4a) is the input half of a spoken loop. Nothing at
   P1b depends on the output half, but the transcript should not hard-code "assistant turns are
   text" in a way that blocks audio later.

### One consistency note

§4a's voice input uses the browser's speech service, which sends audio off-box — and it ships a
consent line for exactly that reason. Apollo's perception stack is the opposite: local models,
on-box, nothing leaves. **When Apollo lands, move dictation to the same local transport**
(`MediaRecorder` → local whisper) so the whole loop is on-box and the consent line disappears. That
is the upgrade path already noted in §4a; this is the reason it matters beyond Firefox support.

### Explicitly not decided here

Where Apollo's presence indicator lives, whether it gets its own rail icon, what the proposed-action
card looks like, how observation citations render, whether there is a separate voice mode. Those are
a later spec. **This section only forbids foreclosing them.**

---

## 14. Process notes

- **Drift gate (CLAUDE.md):** plan-warden not run — its corpus is the esq/futures plan chain and
  this is a new UI project outside that repo pair. This document *is* the plan artifact the gate
  exists to protect. State this disposition when the gate is next invoked.
- **Board card:** CLAUDE.md requires a Manager card before feature code. This spec is planning, not
  feature code. **File the card before P0**, not after.
- Reference frames are committed under `docs/reference/` so the parity gate stays runnable without
  re-downloading 220MB of video.
