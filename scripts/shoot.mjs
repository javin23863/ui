// Screenshot the running dev server over CDP. Defaults to exactly 1920x1080,
// the resolution every reference frame was captured at (§11 parity gate);
// override with W/H for the §11 reflow check, which runs at 1440 and 1280.
// Usage: node scripts/shoot.mjs <out.png> [clickSelector ...]
//        W=1280 H=800 node scripts/shoot.mjs <out.png>
import { writeFileSync } from "node:fs";

const [, , out, ...clicks] = process.argv;
const PORT = 9333;
const WIDTH = Number(process.env.W) || 1920;
const HEIGHT = Number(process.env.H) || 1080;
const URL_ = `http://localhost:5199/${process.env.SEED ? "?seed=1" : ""}`;

const rest = async (p, method = "GET") => {
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`, { method });
  const body = await res.text();
  if (!res.ok) throw new Error(`CDP ${method} ${p} → ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
};

const targets = await rest("/json/list");
let page = targets.find((t) => t.type === "page" && t.url.includes("localhost:5199"));
if (!page) {
  // Chrome has required PUT on /json/new since 111; a GET returns a plain-text
  // error, so parsing it as JSON fails with a stack trace that says nothing
  // about the real cause.
  await rest(`/json/new?${encodeURIComponent(URL_)}`, "PUT");
  await new Promise((r) => setTimeout(r, 1500));
  page = (await rest("/json/list")).find((t) => t.type === "page" && t.url.includes("5199"));
}
if (!page) throw new Error("no dev-server page in Chrome — is the dev server up on 5199?");

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
  width: WIDTH,
  height: HEIGHT,
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
