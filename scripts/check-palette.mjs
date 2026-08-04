// Palette gate — docs/UI-PARITY-SPEC.md §11.
// Reads the real token values out of src/tokens.css so the gate cannot drift
// from what ships. A hex that enters a semantic or series slot without a
// passing run here is a defect regardless of how it looks.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate, contrast } from "./validate_palette.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "src", "tokens.css"), "utf8");

const tok = (name) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --color-${name} not found in src/tokens.css`);
  return m[1];
};

const SURFACE = tok("bg-panel"); // the chart surface, §2b
const series = [tok("series-1"), tok("series-2"), tok("series-3")];
const profit = tok("profit");
const loss = tok("loss");
const warning = tok("warning");
const accent = tok("accent");

let failed = false;
const line = (ok, label, detail) => {
  if (!ok) failed = true;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label.padEnd(34)} ${detail}`);
};
const dE = (r, re) => {
  const row = r.report.find(([n]) => re.test(n));
  const m = /ΔE\s*([\d.]+)/.exec(row?.[2] ?? "");
  return m ? parseFloat(m[1]) : -1;
};

console.log(`\nTraderCockpit palette gate — surface ${SURFACE}\n`);

// 1. profit/loss must stay separable under CVD. This is the check that killed
//    conventional trading green/red (ΔE 4.0 deutan) — see §2c.
const pl = validate([profit, loss], { mode: "dark", surface: SURFACE, pairs: "all" });
const plCvd = dE(pl, /CVD/i);
const plNv = dE(pl, /Normal/i);
line(plCvd >= 8, "profit/loss CVD separation", `ΔE ${plCvd} (target >= 8)`);
line(plNv >= 15, "profit/loss normal vision", `ΔE ${plNv} (floor >= 15)`);

// 2. every mark colour must clear 3:1 on the surface it is drawn on.
for (const [name, hex] of Object.entries({ profit, loss, warning, accent })) {
  const c = contrast(hex, SURFACE);
  line(c >= 3, `contrast ${name}`, `${c.toFixed(2)}:1 (floor >= 3:1)`);
}

// 3. the series slots, on the adjacent pairlist (bars, lines, stacks).
const s = validate(series, { mode: "dark", surface: SURFACE, pairs: "adjacent" });
for (const [name, ok, detail] of s.report) {
  line(ok === true || ok === "pass" || ok === "warn", `series ${name.toLowerCase()}`, detail);
}

// 4. no series slot may impersonate a reserved semantic colour.
//    Bar is the series floor's own: unsimulated ΔE >= 15.
for (const [i, hex] of series.entries())
  for (const [name, res] of Object.entries({ profit, loss, warning })) {
    const d = dE(validate([hex, res], { mode: "dark", surface: SURFACE, pairs: "all" }), /Normal/i);
    line(d >= 15, `series-${i + 1} vs ${name}`, `ΔE ${d} (floor >= 15)`);
  }

console.log(
  failed
    ? "\nFAILED — a colour changed without clearing the gate. Re-step it; do not relax the gate.\n"
    : "\nOK — palette clears every gate.\n",
);
process.exit(failed ? 1 : 0);
