# Parity sheets — P6

Each image is `docs/reference/<frame>` on the left and our render on the right, both at 1920×1080.

> **These rot. Regenerate them in the same commit as any UI change.**
>
> The first set was shot before the `@layer base` fix and kept showing defects that were already
> corrected — a gate artifact that disagrees with the build is worse than no artifact, because it
> is trusted. If you changed anything visual and did not re-shoot, this folder is lying.

Regenerate all seven:

```bash
npm run dev                       # serves on 5199
node scripts/parity.mjs           # or: node scripts/parity.mjs p5-backtest
```

`parity.mjs` owns the state each sheet is shot in and the pairing with its reference frame. It
needs Chrome listening for CDP on 9333:

```bash
chrome --remote-debugging-port=9333 --user-data-dir=<scratch> --window-size=1920,1080
```

This used to be a paragraph asking the next person to run `shoot.mjs` seven times and hstack the
results by hand. That is how the folder went stale the first time — an instruction that takes seven
manual steps is one that gets skipped when the change feels small.

| Sheet | Reference frame | Verdict |
|---|---|---|
| `p1-empty-state.png` | 01 | pass |
| `p2-chart.png` | 02 | pass, one delta — price-axis tick density |
| `p3-code-view.png` | 03 | pass |
| `p4-dock.png` | 04 | pass |
| `p5-backtest.png` | 05 | pass |
| `p6-settings.png` | 06 | pass |
| `p7-ticker.png` | 07 | pass |

## What the gate checks

Per §11, the diff must show correct **element presence, order, alignment and token usage**.

**Allowed to differ:** colour values (§2b is ours by decision), the webcam-occluded region in the
bottom-right ~500×430 of every reference frame, browser chrome present in the reference and absent
in ours, and fixture numbers.

**Not allowed to differ:** layout order, spacing scale, colour *role*, or the absence of chart
gridlines.

## Open delta

**Price axis tick density (`p2`, `p4`).** The reference shows roughly five price labels; we render
about twenty.

This was previously written up as "`lightweight-charts` exposes no public control over tick count,
and the only lever is `minMove`, which would corrupt precision." **That is wrong, and it was
asserted rather than measured.** Tick spacing scales with `layout.fontSize`: raising it from 10 to
22 halves the tick count (ticks move from every 100 to every 200 units — measured 2026-08-05).

The delta stands anyway, for a reason worth stating accurately: reaching ~5 labels needs a font
size around 40, `layout.fontSize` is global to both axes, and a 40px time axis is a far worse
defect than a dense price axis. So the ceiling is a **trade-off we are choosing**, not a limit the
library imposes — and if the price scale ever gets its own font size, this closes immediately.

## Not diffed, by design

`Trades Analysis` and `Trades Log` have no reference footage — they are ours (§8c, §8d). Their gate
is the empty-state sweep, not a pixel diff: feed each panel the input that should make it refuse
and confirm it refuses. Captures of those states live outside this folder; the switch that drives
them is in the tab itself under **Run profile**.
