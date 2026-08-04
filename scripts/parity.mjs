// Regenerate every side-by-side parity sheet in docs/parity/.
//
// This was a paragraph of prose telling the next person to run shoot.mjs seven
// times and hstack the results by hand. The first set was built before the
// @layer base fix and kept showing defects that were already corrected — a gate
// artifact that disagrees with the build is worse than none, because it is
// trusted. A one-command regeneration is the only version of that instruction
// that survives contact.
//
// Needs: the dev server on 5199, and Chrome listening for CDP on 9333.
// Usage: node scripts/parity.mjs [sheet ...]      (default: all)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Paths resolve from this file, not the shell's cwd — every path below is
// repo-relative and the script is worth running from anywhere.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Each sheet pairs one reference frame with one state of ours. `seed` loads the
// committed run; without it the app is in its empty state.
const SHEETS = [
  { out: "p1-empty-state", ref: "01-empty-state.png", seed: false, clicks: [] },
  { out: "p2-chart", ref: "02-chart-indicator.png", seed: true, clicks: [] },
  { out: "p3-code-view", ref: "03-code-view.png", seed: true, clicks: ["view-code"] },
  { out: "p4-dock", ref: "04-chart-trades-summary-dock.png", seed: true, clicks: [] },
  { out: "p5-backtest", ref: "05-backtest-performance.png", seed: true, clicks: ["open-backtest"] },
  { out: "p6-settings", ref: "06-settings-modal.png", seed: true, clicks: ["strategy-settings"] },
  { out: "p7-ticker", ref: "07-ticker-picker.png", seed: true, clicks: ["symbol-picker"] },
];

const PANE_W = 940;
const PANE_H = 529; // 1080 * 940/1920, so neither side is distorted
const BAR = 34;
const FONT = "/Windows/Fonts/consola.ttf";

const want = process.argv.slice(2);
const todo = want.length ? SHEETS.filter((s) => want.includes(s.out)) : SHEETS;
if (!todo.length) {
  console.error(`no such sheet. known: ${SHEETS.map((s) => s.out).join(", ")}`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "parity-"));
const run = (cmd, args, env) =>
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });

// A label baked into the image, so a sheet lifted out of the folder still says
// which side is which.
const pane = (label) =>
  `scale=${PANE_W}:${PANE_H},pad=${PANE_W}:${PANE_H + BAR}:0:${BAR}:black,` +
  `drawtext=fontfile=${FONT}:text='${label}':x=10:y=9:fontsize=15:fontcolor=0x8B93A7`;

try {
  for (const s of todo) {
    const mine = join(tmp, `${s.out}.png`);
    run(
      "node",
      [join(ROOT, "scripts/shoot.mjs"), mine, ...s.clicks.map((c) => `[data-apollo-id="${c}"]`)],
      { SEED: s.seed ? "1" : "" },
    );

    run("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", join(ROOT, "docs/reference", s.ref),
      "-i", mine,
      "-filter_complex",
      `[0:v]${pane("REFERENCE — LuxAlgo Quant")}[a];[1:v]${pane("OURS — TraderCockpit")}[b];[a][b]hstack`,
      join(ROOT, "docs/parity", `${s.out}.png`),
    ]);
    console.log(`${s.out}  ←  ${s.ref}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
