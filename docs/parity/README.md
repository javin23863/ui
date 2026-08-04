# Parity sheets — P6

Each image is `docs/reference/<frame>` on the left and our render on the right, both at 1920×1080.

> **These rot. Regenerate them in the same commit as any UI change.**
>
> The first set was shot before the `@layer base` fix and kept showing defects that were already
> corrected — a gate artifact that disagrees with the build is worse than no artifact, because it
> is trusted. If you changed anything visual and did not re-shoot, this folder is lying.

Regenerate (dev server running on 5199):

```bash
SEED=1 node scripts/shoot.mjs <out.png> [data-apollo-id selectors to click ...]
```

then pair each with its reference frame via the `ffmpeg` hstack recorded in the build history.

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
roughly thirty-five. `lightweight-charts` derives tick count from pane height and exposes no public
control over it. The levers that exist — coarsening `minMove` — would round displayed prices and
corrupt precision, which is worse than the cosmetic delta. Unfixed and disclosed rather than
worked around.

## Not diffed, by design

`Trades Analysis` and `Trades Log` have no reference footage — they are ours (§8c, §8d). Their gate
is the empty-state sweep, not a pixel diff: feed each panel the input that should make it refuse
and confirm it refuses. Captures of those states live outside this folder; the switch that drives
them is in the tab itself under **Run profile**.
