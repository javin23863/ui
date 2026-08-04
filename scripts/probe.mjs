// Ask the running page what it actually computed, instead of inferring from pixels.
import WS from "ws";
const rest = async (p) => (await fetch(`http://127.0.0.1:9333${p}`)).json();
const page = (await rest("/json/list")).find((t) => t.type === "page" && t.url.includes("5199"));
const sock = new WS(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
sock.on("message", (m) => {
  const j = JSON.parse(m.toString());
  if (j.id && pending.has(j.id)) pending.get(j.id)(j.result), pending.delete(j.id);
});
const send = (method, params = {}) =>
  new Promise((r) => (pending.set(++id, r), sock.send(JSON.stringify({ id, method, params }))));
await new Promise((r) => sock.on("open", r));
const evalJs = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value;

console.log(await evalJs(process.argv[2]));
sock.close();
process.exit(0);
