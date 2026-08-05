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

  /** Open the §15 library. `seeded` false gives a genuinely empty one. */
  const library = async (seeded = true) => {
    await load(seeded ? "?seed=1" : "");
    await click("rail-history");
  };

  /** data-apollo-id of the first card in the list, in whatever order is active. */
  const firstCard = () =>
    evaluate(
      `(() => { const el = document.querySelector('[data-apollo-id^="library-card-"]'); return el ? el.getAttribute('data-apollo-id') : null; })()`,
    );

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
    // ------------------------------------------------------------- §15 library

    {
      // The default state. Nothing is saved, so the panel must explain what a
      // save keeps rather than showing an example run that was never run.
      row: "empty library explains a save",
      setup: () => library(false),
      check: async () => {
        const r = await evaluate(`(() => ({
          cards: document.querySelectorAll('[data-apollo-id^="library-card-"]').length,
          text: document.querySelector('[data-apollo-id="strategy-library"]')?.innerText ?? '',
        }))()`);
        const explains = /No saved runs yet/i.test(r.text) && /instrument, timeframe, date range/i.test(r.text);
        return [
          r.cards === 0 && explains,
          `cards=${r.cards} explainsWhatASaveKeeps=${explains}`,
        ];
      },
    },
    {
      // The harder refusal §15 names: a saved run whose data is gone must say so
      // and must NOT re-render its headline against whatever is loaded now.
      row: "saved run without its data",
      setup: () => library(),
      check: async () => {
        const r = await evaluate(`(() => {
          const el = document.querySelector('[data-apollo-id="library-card-run-vwap-fade"]');
          if (!el) return { card: false };
          const t = el.innerText;
          return {
            card: true,
            refuses: /no longer loaded/i.test(t),
            numbers: /Win rate|Profit factor/i.test(t),
            chips: !!el.querySelector('[data-apollo-id="library-chips-run-vwap-fade"]'),
          };
        })()`);
        if (!r.card) return [false, "the unavailable-data run is not in the library"];
        return [
          r.refuses && !r.numbers && !r.chips,
          `saysUnavailable=${r.refuses} rendersNumbersAnyway=${r.numbers} rendersChips=${r.chips}`,
        ];
      },
    },
    {
      // §15b's whole argument. Asserted relatively so it can actually fail: the
      // default order must NOT lead with the biggest number, and selecting
      // "Highest return" must show that it would have.
      row: "default sort is not by return",
      setup: () => library(),
      check: async () => {
        const first = await firstCard();
        const control = await evaluate(
          `document.querySelector('[data-apollo-id="library-sort-trust"]')?.getAttribute('aria-pressed')`,
        );
        const named = await evaluate(
          `document.querySelector('[data-apollo-id="library-sort-trust"]')?.textContent?.trim()`,
        );
        await click("library-sort-return");
        const byReturn = await firstCard();
        const differs = first !== byReturn;
        return [
          control === "true" && named === "Most trustworthy" && differs,
          `default=${control} label="${named}" trustFirst=${first} returnFirst=${byReturn} ordersDiffer=${differs}`,
        ];
      },
    },
    {
      // A save that evaporates on reload is only acceptable while it says so.
      row: "library states saves are not kept",
      setup: () => library(),
      check: async () => {
        const t = await evaluate(
          `document.querySelector('[data-apollo-id="library-storage-notice"]')?.innerText ?? ''`,
        );
        // Both clauses, so dropping either one fails: that saves are lost, and
        // that nothing is kept beyond the tab.
        const ok = /lost on reload/i.test(t) && /nothing is stored/i.test(t);
        return [ok, ok ? "storage limit stated on screen" : `notice missing or silent: "${t}"`];
      },
    },
    {
      // A save must carry the numbers of the run it was taken from. An earlier
      // build stored the selected profile's trade COUNT beside the full
      // ledger's net, win rate and date range — "11 trades" over a 37-month
      // span earning the whole run's money.
      row: "save keeps its own profile numbers",
      setup: async () => {
        await load();
        await click("open-backtest");
        await click("tab-trades-analysis");
        await click("profile-thin");
        await click("favourite-run");
        await click("rail-history");
      },
      check: async () => {
        const r = await evaluate(`(() => {
          const cards = [...document.querySelectorAll('[data-apollo-id^="library-card-"]')];
          const el = cards.find((c) => /Sweep and Engulf Strategy/.test(c.innerText));
          if (!el) return { card: false };
          const read = (label) => {
            const row = [...el.querySelectorAll('div')].find(
              (d) => d.querySelector('dt') && d.querySelector('dt').textContent.trim() === label,
            );
            return row ? row.querySelector('dd').textContent.trim() : null;
          };
          return { card: true, trades: read('Trades'), net: read('Net'), text: el.innerText };
        })()`);
        if (!r.card) return [false, "the starred run is not in the library"];
        const trades = Number(r.trades);
        // The full ledger is 47 trades netting 1,999.70 over Jun 2023 - Jul 2026.
        const fullNet = /1,?999\.70/.test(r.net ?? "");
        const fullRange = /Jun 4, 2023/.test(r.text ?? "");
        return [
          trades === 11 && !fullNet && !fullRange,
          `trades=${trades} net=${r.net} showsFullRunNet=${fullNet} showsFullRunRange=${fullRange}`,
        ];
      },
    },
    {
      // The run profile drove the log and the analysis tab but not Performance,
      // so under no-costs the log totalled +2,587.70 while the metrics table two
      // clicks away said +1,999.70 for the same run — a disagreement of exactly
      // the costs the profile claimed were not modelled. All three surfaces that
      // state a net for this run must state the same one.
      row: "no-costs figures agree everywhere",
      setup: async () => {
        await load();
        await click("open-backtest");
        await click("tab-trades-analysis");
        await click("profile-no-costs");
      },
      check: async () => {
        const money = (s) => (s ? Number(String(s).replace(/[^0-9.-]/g, "")) : NaN);
        // The qualifier has to describe the SAME representation as the headline.
        // A cost-free net beside a Top-3 percentage computed against the
        // cost-deducted net is two different runs on one card.
        const panelTop3 = await evaluate(`(() => {
          const el = [...document.querySelectorAll('div')].find(
            (d) => d.children.length === 2 && /^TOP-3 TRADE SHARE$/i.test(d.children[0]?.textContent?.trim() ?? ''),
          );
          return el ? el.children[1].textContent.trim() : null;
        })()`);
        await click("tab-trades-log");
        const logNet = await evaluate(`(() => {
          const tf = document.querySelector('[data-apollo-id="trades-log"]')?.querySelector('tfoot');
          if (!tf) return null;
          // The totals row leaves trailing columns blank, so take the last cell
          // that actually carries a number — that is Cum./Net.
          const cells = [...tf.querySelectorAll('td,th')].map((c) => c.textContent.trim());
          const numeric = cells.filter((t) => /[0-9]/.test(t));
          return numeric.length ? numeric[numeric.length - 1] : null;
        })()`);
        // Recompute the Top-3 share from the LEDGER ON SCREEN rather than
        // comparing two surfaces that both read the same function. Checking only
        // panel-against-card cannot fail: pointing both at the wrong rows moves
        // them together, and they agree on a figure that describes neither the
        // net beside it nor the trades below it.
        const expectedTop3 = await evaluate(`(() => {
          const t = document.querySelector('[data-apollo-id="trades-log"]');
          if (!t) return null;
          const head = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim());
          const col = head.findIndex((h) => /^net$/i.test(h));
          if (col < 0) return null;
          const nets = [...t.querySelectorAll('tbody tr')]
            .map((tr) => tr.querySelectorAll('td')[col]?.textContent ?? '')
            .map((s) => Number(s.replace(/\\u2212/g, '-').replace(/[^0-9.-]/g, '')))
            .filter((n) => Number.isFinite(n));
          if (!nets.length) return null;
          const sum = nets.reduce((a, b) => a + b, 0);
          const top3 = [...nets].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
          return sum > 0 ? (top3 / sum) * 100 : null;
        })()`);
        await click("tab-performance");
        const panelNet = await evaluate(`(() => {
          const rows = [...document.querySelectorAll('dl > div')];
          const r = rows.find((d) => d.querySelector('dt')?.textContent.trim() === 'Net Profit');
          return r ? r.querySelector('dd').textContent.trim() : null;
        })()`);
        await click("favourite-run");
        await click("rail-history");
        const cardNet = await evaluate(`(() => {
          const c = [...document.querySelectorAll('[data-apollo-id^="library-card-"]')].find((x) => /Sweep and Engulf/.test(x.innerText));
          if (!c) return null;
          const r = [...c.querySelectorAll('div')].find((d) => d.querySelector('dt')?.textContent.trim() === 'Net');
          return r ? r.querySelector('dd').textContent.trim() : null;
        })()`);
        const cardTop3 = await evaluate(`(() => {
          const c = [...document.querySelectorAll('[data-apollo-id^="library-card-"]')].find((x) => /Sweep and Engulf/.test(x.innerText));
          const m = c && c.innerText.match(/Top-3 carries (\\d+)% of net/);
          return m ? m[1] : null;
        })()`);
        const [a, b, c] = [money(logNet), money(panelNet), money(cardNet)];
        const netAgree = Number.isFinite(a) && Math.abs(a - b) < 0.01 && Math.abs(a - c) < 0.01;
        const p3 = money(panelTop3);
        const c3 = money(cardTop3);
        // Each must match the ledger on screen, not merely each other.
        const exp = Number.isFinite(expectedTop3) ? expectedTop3 : NaN;
        const top3Agree =
          Number.isFinite(exp) && Number.isFinite(p3) && Number.isFinite(c3) &&
          Math.abs(p3 - exp) < 1.5 && Math.abs(c3 - exp) < 1.5;
        return [
          netAgree && top3Agree,
          `net: log=${logNet} panel=${panelNet} card=${cardNet} agree=${netAgree}` +
            ` | top3: ledger=${Number.isFinite(exp) ? exp.toFixed(0) : "?"}% panel=${panelTop3} card=${cardTop3}% agree=${top3Agree}`,
        ];
      },
    },
    {
      // The same strategy under a different profile is a different run. Saving
      // one must not make the star claim the other is already kept.
      row: "another profile saves separately",
      setup: async () => {
        await load();
        await click("open-backtest");
        await click("tab-trades-analysis");
        await click("favourite-run"); // full run
        await click("profile-thin");
        await click("favourite-run"); // thin run — a different run
        await click("rail-history");
      },
      check: async () => {
        const n = await evaluate(
          `[...document.querySelectorAll('[data-apollo-id^="library-card-"]')].filter((c) => /Sweep and Engulf Strategy/.test(c.innerText)).length`,
        );
        return [n === 2, `saved snapshots of the same strategy = ${n} (expected 2: full and thin)`];
      },
    },
    {
      // §15c — abandoned runs leave the default view but are never destroyed.
      row: "archived run is kept, not deleted",
      setup: () => library(),
      check: async () => {
        const active = await evaluate(
          `!!document.querySelector('[data-apollo-id="library-card-run-orb-eurusd"]')`,
        );
        await click("library-filter-archived");
        const archived = await evaluate(
          `!!document.querySelector('[data-apollo-id="library-card-run-orb-eurusd"]')`,
        );
        return [
          !active && archived,
          `inActiveView=${active} inArchivedView=${archived}`,
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
