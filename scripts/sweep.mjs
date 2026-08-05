// §11 P6 empty-state sweep — the gate for P1b/P4b, which are exempt from the
// parity diff because there is nothing to diff them against.
//
// "For every panel in §8c/§8d and every state in §4a, render the fixture that
// should make it refuse, and confirm it refuses. A panel that renders a number
// for every one of these inputs has failed. Passing means it said no."
//
// The seven data rows were previously exercised by hand and the three §4a voice
// rows never at all, and no capture was ever tracked — so the gate existed as a
// paragraph, not a receipt. §11 is explicit that "a phase that produces no diff
// sheet has not passed — it has not been checked."
//
// Each row ASSERTS. The captures are for diagnosing a failure, not for
// constituting the pass.
//
// Needs: dev server on 5199, Chrome on CDP 9333.
// Usage: node scripts/sweep.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/sweep");
const PORT = 9333;

const rest = async (p, method = "GET") => {
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`, { method });
  const body = await res.text();
  if (!res.ok) throw new Error(`CDP ${method} ${p} → ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
};

const { default: WS } = await import("ws");

// The voice rows register scripts via Page.addScriptToEvaluateOnNewDocument,
// which survive navigation and outlive the process if it is interrupted. Run in
// a tab of our own and close it in `finally`, so a killed run can never leave a
// shared tab with SpeechRecognition deleted and getUserMedia stubbed — that
// state renders a blank page and looks exactly like a broken dev server.
const page = await rest(`/json/new?${encodeURIComponent("http://localhost:5199/?seed=1")}`, "PUT");
if (!page?.webSocketDebuggerUrl) throw new Error("could not open a CDP tab — is Chrome on 9333?");
const closeTab = async () => {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/close/${page.id}`);
  } catch {
    /* browser already gone */
  }
};
process.on("exit", () => {
  /* best effort; the awaited close in finally is the real one */
});

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
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => sock.on("open", r));
await send("Page.enable");
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });

const injected = [];
/** Runs BEFORE any page script, which is the only point where the voice rows
 *  can be set up — the app reads these capabilities during its first render. */
const inject = async (source) => {
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source });
  injected.push(identifier);
};
const clearInjected = async () => {
  for (const identifier of injected.splice(0)) {
    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }
};

const load = async (query = "?seed=1") => {
  await send("Page.navigate", { url: `http://localhost:5199/${query}` });
  await wait(2300);
};
const click = async (apolloId) => {
  const r = await evaluate(
    `(() => { const el = document.querySelector('[data-apollo-id="${apolloId}"]'); if (!el) return 'MISSING'; el.click(); return 'ok'; })()`,
  );
  await wait(850);
  return r;
};
const shoot = async (name) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(s.data, "base64"));
};

try {
  const results = [];
  const record = (row, ok, detail) => {
    results.push({ row, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${row.padEnd(34)} ${detail}`);
  };

  // ---------------------------------------------------------------- data rows

  /** Open the Trades Analysis tab under a given run profile. */
  const analysisUnder = async (profile) => {
    await load();
    await click("open-backtest");
    await click("tab-trades-analysis");
    if (profile) await click(`profile-${profile}`);
  };

  const bodyText = () => evaluate("document.body.innerText");

  const DATA_ROWS = [
    {
      // §11 declares TWO behaviours for this one input: the cost-sensitivity
      // card refuses, AND the log shows a banner with a `—` costs column.
      // Checking only the card left the log free to regress to a displayed
      // 0.00 with the gate still green.
      row: "costs not modelled",
      setup: () => analysisUnder("no-costs"),
      check: async () => {
        const card = /Spread and commissions not modelled/i.test(await bodyText());
        await click("tab-trades-log");
        const log = await evaluate(`(() => {
          const banner = /Costs not modelled/i.test(document.body.innerText);
          const table = document.querySelector('[data-apollo-id="trades-log"]');
          if (!table) return { banner, table: false };
          const head = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
          const col = head.findIndex((h) => /^costs$/i.test(h));
          const cells = [...table.querySelectorAll('tbody tr')]
            .map((tr) => tr.querySelectorAll('td')[col]?.textContent?.trim())
            .filter((v) => v !== undefined);
          return {
            banner,
            table: true,
            col,
            dashes: cells.every((v) => v === "—"),
            sample: cells.slice(0, 3),
          };
        })()`);
        const ok = card && log.banner && log.table && log.col >= 0 && log.dashes;
        return [
          ok,
          `card=${card} logBanner=${log.banner} costsColumn=${log.table ? log.sample?.join(",") : "no table"}`,
        ];
      },
    },
    {
      row: "no holdout declared",
      setup: () => analysisUnder("no-holdout"),
      check: async () => {
        const t = await bodyText();
        const refused = /No out-of-sample period declared/i.test(t);
        const invented = /Split after trade #/i.test(t);
        return [refused && !invented, refused ? (invented ? "refused BUT still shows a split" : "IS/OOS refuses, no split invented") : "no refusal"];
      },
    },
    {
      row: "untagged regimes",
      setup: () => analysisUnder("no-regimes"),
      check: async () => {
        const t = await bodyText();
        const refused = /Regime tags not available for this run/i.test(t);
        return [refused, refused ? "regime table refuses" : "regime panel rendered without refusing"];
      },
    },
    {
      row: "11 trades → Thin sample chip",
      setup: () => analysisUnder("thin"),
      check: async () => {
        const t = await bodyText();
        return [/thin sample/i.test(t), /thin sample/i.test(t) ? "Thin sample chip present" : "no Thin sample chip"];
      },
    },
    {
      row: "sparse trades/month → Sparse chip",
      setup: () => analysisUnder("thin"),
      check: async () => {
        const t = await bodyText();
        return [/sparse/i.test(t), /sparse/i.test(t) ? "Sparse chip present" : "no Sparse chip"];
      },
    },
    {
      row: "top-3 concentration → red",
      setup: () => analysisUnder("thin"),
      check: async () => {
        const red = await evaluate(`(() => {
          const els = [...document.querySelectorAll('*')].filter(e => /TOP-3/i.test(e.textContent||'') && e.children.length < 4);
          for (const e of els) {
            const host = e.closest('div');
            if (!host) continue;
            if ([...host.querySelectorAll('*')].some(x => getComputedStyle(x).color === getComputedStyle(document.documentElement).getPropertyValue('--color-loss').trim() || (x.className||'').toString().includes('text-loss'))) return true;
          }
          return false;
        })()`);
        return [red, red ? "TOP-3 share rendered in loss colour" : "TOP-3 share not flagged"];
      },
    },
    {
      row: "thin regime row → muted + Thin",
      setup: () => analysisUnder(null),
      // Scoped to the row, and requires BOTH signals. Searching the whole page
      // for "thin" passed on the `Thin sample` chip belonging to a different
      // panel entirely — the row could lose its muted styling and its marker
      // and the gate would still have gone green.
      check: async () => {
        const r = await evaluate(`(() => {
          const table = document.querySelector('[data-apollo-id="regime-table"]');
          if (!table) return { table: false };
          const rows = [...table.querySelectorAll('tbody tr')];
          const parsed = rows.map((tr) => {
            const cells = tr.querySelectorAll('td');
            return {
              n: Number(cells[1]?.textContent?.trim() ?? NaN),
              muted: tr.className.includes('text-text-muted'),
              marker: /\\bThin\\b/.test(cells[0]?.textContent ?? ''),
            };
          });
          return { table: true, rows: parsed };
        })()`);
        if (!r.table) return [false, "no regime table rendered"];
        const thinRows = r.rows.filter((x) => x.n < 10);
        if (!thinRows.length) return [false, `no row under 10 trades to check (rows: ${r.rows.length})`];
        const bad = thinRows.filter((x) => !x.muted || !x.marker);
        return [
          bad.length === 0,
          bad.length === 0
            ? `${thinRows.length} thin row(s), each muted AND carrying a row-local Thin marker`
            : `${bad.length} thin row(s) missing muted styling or the row-local marker`,
        ];
      },
    },
  ];

  for (const r of DATA_ROWS) {
    await r.setup();
    const [ok, detail] = await r.check();
    await shoot(r.row.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
    record(r.row, ok, detail);
  }

  // --------------------------------------------------------------- §4a voice

  // 1. SpeechRecognition undefined → the mic must be ABSENT, not present-and-broken.
  await clearInjected();
  await inject(`delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    Object.defineProperty(window,'SpeechRecognition',{get:()=>undefined,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{get:()=>undefined,configurable:true});`);
  await load();
  {
    const micCount = await evaluate(`document.querySelectorAll('[data-apollo-id="mic"]').length`);
    const sendCount = await evaluate(`document.querySelectorAll('[data-apollo-id="send"]').length`);
    await shoot("voice-no-speechrecognition");
    record(
      "SpeechRecognition undefined",
      micCount === 0 && sendCount === 1,
      micCount === 0 ? `mic absent, composer still usable (send=${sendCount})` : `mic still rendered (${micCount})`,
    );
  }

  // 2. Permission denied → loss ring + inline hint, and NO modal.
  await clearInjected();
  await inject(`
    localStorage.setItem('tc.voice.consent','1');
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), {name:'NotAllowedError'}));
    class FakeSR { start(){ const e = new Event('error'); e.error='not-allowed'; setTimeout(()=>this.onerror&&this.onerror(e),10); } stop(){} abort(){} }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;`);
  await load();
  await click("mic");
  await wait(600);
  {
    const state = await evaluate(`(() => {
      const mic = document.querySelector('[data-apollo-id="mic"]');
      const cls = mic ? mic.className.toString() : '';
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
      return { ring: /ring-loss|text-loss/.test(cls), modal: !!dialog, text: document.body.innerText };
    })()`);
    await shoot("voice-permission-denied");
    const hint = /blocked|denied|permission/i.test(state.text);
    record(
      "mic permission denied",
      state.ring && hint && !state.modal,
      `ring=${state.ring} hint=${hint} modal=${state.modal}`,
    );
  }

  // 3. Consent not yet given → clicking the mic must NOT start capture.
  await clearInjected();
  await inject(`
    localStorage.removeItem('tc.voice.consent');
    window.__gum = 0;
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = () => { window.__gum++; return Promise.reject(new Error('should not be called')); };
    class FakeSR { constructor(){ window.__sr = (window.__sr||0); } start(){ window.__sr++; } stop(){} abort(){} }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;`);
  await load();
  await click("mic");
  await wait(600);
  {
    const s = await evaluate(`({ gum: window.__gum|0, sr: window.__sr|0,
      prompt: !!document.querySelector('[data-apollo-id="voice-consent-allow"]') })`);
    await shoot("voice-consent-not-given");
    record(
      "consent not yet given",
      s.gum === 0 && s.sr === 0 && s.prompt,
      `getUserMedia=${s.gum} recognition.start=${s.sr} consentPrompt=${s.prompt}`,
    );
  }

  await clearInjected();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} rows refused as specified`);
  if (failed.length) {
    console.error(`\nEMPTY-STATE SWEEP FAILED — ${failed.length} row(s) rendered a number where they should have said no:`);
    for (const f of failed) console.error(`  - ${f.row}: ${f.detail}`);
  }
  process.exitCode = failed.length ? 1 : 0;
  console.log("empty-state sweep: PASS — every row said no");

} finally {
  // `process.exit()` here would skip this block entirely — it terminates
  // immediately — so the exit code is SET and the process is left to end on its
  // own. An earlier version called process.exit() inside the try and this
  // cleanup never ran once.
  try {
    await clearInjected();
    // The permission-denied fixture writes tc.voice.consent=1, and localStorage
    // is origin-scoped across the whole browser profile, not the tab. Left
    // behind, a later real visit treats consent as already granted and starts
    // microphone capture without asking. Clear it unconditionally.
    await send("Page.navigate", { url: "http://localhost:5199/" });
    await wait(900);
    await evaluate(`localStorage.removeItem('tc.voice.consent')`);
    const left = await evaluate(`localStorage.getItem('tc.voice.consent')`);
    if (left !== null) console.error(`WARNING: voice consent key still set (${left}) — clear it by hand`);
  } catch (e) {
    console.error(`cleanup failed, clear localStorage 'tc.voice.consent' by hand: ${e.message}`);
  }
  try {
    sock.close();
  } catch {
    /* already closed */
  }
  await closeTab();
}
