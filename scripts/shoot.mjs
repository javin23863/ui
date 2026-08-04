// Screenshot the running dev server over CDP at exactly 1920x1080, which is the
// resolution every reference frame was captured at (§11 parity gate).
// Usage: node scripts/shoot.mjs <out.png> [clickSelector ...]
import { writeFileSync } from "node:fs";
import { WebSocket } from "node:http";

const [, , out, ...clicks] = process.argv;
const PORT = 9333;
const URL_ = `http://localhost:5199/${process.env.SEED ? "?seed=1" : ""}`;

const rest = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json();

const targets = await rest("/json/list");
let page = targets.find((t) => t.type === "page" && t.url.includes("localhost:5199"));
if (!page) {
  await rest(`/json/new?${encodeURIComponent(URL_)}`);
  await new Promise((r) => setTimeout(r, 1500));
  page = (await rest("/json/list")).find((t) => t.type === "page" && t.url.includes("5199"));
}

const { default: WS } = await import("ws").catch(() => ({ default: null }));
if (!WS) {
  console.error("ws module missing — run: npm i -D ws");
  process.exit(1);
}

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

await new Promise((r) => sock.on("open", r));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: URL_ });
await new Promise((r) => setTimeout(r, 2200));

for (const sel of clicks) {
  const r = await send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector('${sel}'); if (!el) return 'MISSING ${sel}'; el.click(); return 'ok'; })()`,
    returnByValue: true,
  });
  const v = r?.result?.value;
  if (v !== "ok") console.error(v);
  await new Promise((r) => setTimeout(r, 900));
}
await new Promise((r) => setTimeout(r, 800));

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`wrote ${out}`);
sock.close();
process.exit(0);
