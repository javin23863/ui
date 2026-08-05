// §11 P6 reflow gate — 1440px and 1280px.
//
// This was declared in the phase table and never run. §12 gap 6 says our
// breakpoints are OUR choice rather than parity; that removes the target, not
// the check. The reference frames are all 1920x1080, so nothing else in the
// repo has ever looked at a narrower window.
//
// It does not just take pictures. A sheet nobody reads is the "gate that
// checked nothing" failure, so every state is MEASURED and the script exits
// non-zero when a measurement fails. The sheets exist to diagnose a failure,
// not to constitute the pass.
//
// Needs: dev server on 5199, Chrome on CDP 9333.
// Usage: node scripts/reflow.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/reflow");
const PORT = 9333;

const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
];

const STATES = [
  { name: "chart", seed: true, clicks: [] },
  { name: "backtest", seed: true, clicks: ["open-backtest"] },
  { name: "analysis", seed: true, clicks: ["open-backtest", "tab-trades-analysis"] },
  { name: "log", seed: true, clicks: ["open-backtest", "tab-trades-log"] },
  { name: "code", seed: true, clicks: ["view-code"] },
];

const rest = async (p, method = "GET") => {
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`, { method });
  const body = await res.text();
  if (!res.ok) throw new Error(`CDP ${method} ${p} → ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
};

const { default: WS } = await import("ws");
const list = await rest("/json/list");
const page = list.find((t) => t.type === "page" && t.url.includes("localhost:5199"));
if (!page) throw new Error("no dev-server page in Chrome — is the dev server up on 5199?");

const sock = new WS(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
let id = 0;
const pending = new Map();
sock.on("message", (m) => {
  const msg = JSON.parse(m.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    sock.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true }))?.result?.value;

await new Promise((r) => sock.on("open", r));
await send("Page.enable");
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });

const failures = [];
const rows = [];

for (const { w, h } of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  for (const state of STATES) {
    await send("Page.navigate", { url: `http://localhost:5199/${state.seed ? "?seed=1" : ""}` });
    await new Promise((r) => setTimeout(r, 2200));

    for (const sel of state.clicks) {
      const clicked = await evaluate(
        `(() => { const el = document.querySelector('[data-apollo-id="${sel}"]'); if (!el) return 'MISSING'; el.click(); return 'ok'; })()`,
      );
      if (clicked !== "ok") failures.push(`${w}px ${state.name}: control ${sel} is ${clicked}`);
      await new Promise((r) => setTimeout(r, 900));
    }
    await new Promise((r) => setTimeout(r, 700));

    // The page itself must never scroll sideways. Wide content (tables, charts)
    // is allowed to scroll INSIDE its own container, so the check is on the
    // document, and separately on any element that spills past the viewport
    // without being scrollable itself.
    const m = await evaluate(`(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const spills = [];
      // Wide content is ALLOWED to overflow as long as something between it and
      // the root scrolls horizontally — that is the intended pattern for the
      // 17-column trades table. The first version of this check asked whether
      // the element itself scrolled, which it never does: the WRAPPER scrolls.
      // It duly reported a defect that was not there.
      const inScrollableAncestor = (el) => {
        for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('[data-apollo-id]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (inScrollableAncestor(el)) continue;
        if (r.right > vw + 1 || r.left < -1) {
          spills.push(el.getAttribute('data-apollo-id') + '@' + Math.round(r.left) + '..' + Math.round(r.right));
        }
      }
      return { vw, docScroll: de.scrollWidth, bodyScroll: document.body.scrollWidth, spills };
    })()`);

    const overflow = Math.max(m.docScroll, m.bodyScroll) - m.vw;
    const ok = overflow <= 1 && m.spills.length === 0;
    rows.push(`${ok ? "PASS" : "FAIL"}  ${w}px  ${state.name.padEnd(9)} overflow ${String(overflow).padStart(4)}px  spills ${m.spills.length}`);
    if (overflow > 1) failures.push(`${w}px ${state.name}: page scrolls sideways by ${overflow}px`);
    for (const s of m.spills) failures.push(`${w}px ${state.name}: ${s} escapes the viewport (${m.vw}px) and does not scroll itself`);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `${w}-${state.name}.png`), Buffer.from(shot.data, "base64"));
  }
}

console.log(rows.join("\n"));
sock.close();

if (failures.length) {
  console.error(`\nREFLOW GATE FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nreflow gate: PASS at 1440 and 1280");
process.exit(0);
