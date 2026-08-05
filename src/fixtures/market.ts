// Deterministic fixture data. Capabilities are out of scope (§ spec header) —
// nothing here calls a market, a model, or an engine. Seeded so screenshots are
// byte-stable across runs, which is what makes the parity diff meaningful.

export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type Marker = { time: number; side: "long" | "short"; kind: "entry" | "exit"; qty: number; price: number };
export type Trade = {
  n: number;
  side: "Long" | "Short";
  entryTime: number;
  exitTime: number;
  bars: number;
  qty: number;
  entryPx: number;
  exitPx: number;
  gross: number;
  costs: number | null;
  net: number;
  r: number;
  mae: number;
  mfe: number;
  cum: number;
  regime: string | null;
  sample: "IS" | "OOS";
};

// mulberry32 — tiny seeded PRNG, keeps the fixture reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400;
const START = Math.floor(Date.UTC(2026, 4, 5) / 1000);

/** Where each instrument trades, so a symbol's price scale is plausible. */
const BASE: Record<string, number> = {
  XAUUSD: 4062,
  XAGUSD: 48.2,
  WTIUSD: 71.4,
  BTCUSD: 61240,
  ETHUSD: 3180,
  GBPUSD: 1.2740,
  USDCHF: 0.8062,
  AUDUSD: 0.6615,
  USDCAD: 1.3585,
  NZDUSD: 0.6021,
  NVDA: 198.6,
  AAPL: 287.2,
  MSFT: 370.1,
  TSLA: 419.6,
  SPY: 612.4,
  QQQ: 528.9,
};

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/**
 * Per-symbol candles. The series is derived from the symbol so the chart can
 * never show one instrument's price action under another's name — selecting a
 * ticker used to change only the label, which in a trading UI misattributes
 * price action to the wrong market.
 */
/** Bar interval in seconds, per timeframe label. */
const TF_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 4 * 3600,
  D: DAY,
  W: 7 * DAY,
};

/** Crypto trades through the weekend. Metals, FX and equities do not. */
const ALWAYS_ON = new Set(["BTCUSD", "ETHUSD"]);

export function candlesFor(symbol: string, timeframe = "4h"): Candle[] {
  const base = BASE[symbol] ?? 100;
  const step = TF_SECONDS[timeframe] ?? TF_SECONDS["4h"];
  // Volatility scales with the square root of the bar interval, so a 1m chart
  // is not a 4h chart with a different label — switching timeframe has to move
  // the data, not just the chip.
  const vol = base * 0.0016 * Math.sqrt(step / TF_SECONDS["4h"]);
  const r = rng(seedOf(symbol + timeframe));
  const alwaysOn = ALWAYS_ON.has(symbol);
  const out: Candle[] = [];
  let px = base;
  let t = START;
  for (let i = 0; i < 420; i++) {
    // Drift is deliberately weak against the noise. An earlier series carried a
    // strong sine trend plus a late bias, and any rule run over it came out at a
    // 72% win rate and a profit factor near 6 — numbers that make a demo look
    // like a scam to the one audience that matters here.
    const drift = Math.sin(i / 38) * vol * 0.9 + (i > 300 ? vol * 0.15 : vol * 0.05);
    const open = px;
    const close = open + drift + (r() - 0.5) * vol * 14;
    const high = Math.max(open, close) + r() * vol * 4.5;
    const low = Math.min(open, close) - r() * vol * 4.5;
    out.push({ time: t, open, high, low, close });
    px = close;
    t += step;
    // Roll forward out of the weekend. Timestamps were a flat START + i * step,
    // which prints Saturday and Sunday bars for an instrument that is closed —
    // and any weekday breakdown built from them invents a session. It showed up
    // the moment Weekday Performance stopped being hand-written: gold's best
    // day came out Saturday. DAY is a whole multiple of every intraday step
    // here, so skipping in whole days preserves the intraday alignment.
    if (!alwaysOn) while (isWeekend(t)) t += DAY;
  }
  return out;
}

const isWeekend = (t: number) => {
  const d = new Date(t * 1000).getUTCDay();
  return d === 0 || d === 6;
};

export function emaFor(cs: Candle[]): { time: number; value: number }[] {
  const k = 2 / (60 + 1);
  let e = cs[0].close;
  return cs.map((c) => {
    e = c.close * k + e * (1 - k);
    return { time: c.time, value: e };
  });
}

/** The instrument and timeframe the committed backtest run belongs to. */
export const RUN_SYMBOL = "XAUUSD";
export const RUN_TIMEFRAME = "4h";

export const candles = candlesFor(RUN_SYMBOL);
export const ema = emaFor(candles);

export const markers: Marker[] = [
  { time: candles[64].time, side: "short", kind: "entry", qty: 10, price: candles[64].high },
  { time: candles[96].time, side: "short", kind: "exit", qty: 10, price: candles[96].low },
  { time: candles[150].time, side: "long", kind: "entry", qty: 10, price: candles[150].low },
  { time: candles[186].time, side: "long", kind: "exit", qty: 10, price: candles[186].high },
  { time: candles[268].time, side: "short", kind: "entry", qty: 10, price: candles[268].high },
  { time: candles[300].time, side: "short", kind: "exit", qty: 10, price: candles[300].low },
];

// The open trade box pair rendered on the chart (§6 trade visualisation).
export const tradeZone = {
  from: candles[268].time,
  to: candles[300].time,
  entry: candles[268].high,
  target: candles[268].high - 46,
  stop: candles[268].high + 22,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dollars at risk per trade — what 1R means everywhere below. */
const RISK = 300;

/**
 * The trades are RUN over the candle series rather than invented alongside it,
 * so every column reconciles with the ones next to it: gross is
 * (exit − entry) × qty × direction, R is gross over the risk above, and MAE/MFE
 * are the actual worst and best excursions between the entry and exit bars.
 *
 * They used to come from independent random draws. A reader checking a single
 * row found a short entered at 3968.59 and exited at 4151.57 on qty 10 —
 * a 1,829.80 loss — reported as −210.72. §8d calls this tab an auditable
 * ledger; the one thing it must survive is somebody auditing it.
 */
export const trades: Trade[] = (() => {
  const r = rng(7);
  const trend = emaFor(candles);
  const QTY = 10;
  const out: Trade[] = [];
  let cum = 0;
  // Entry is the rule the chat transcript on the left of the screen describes:
  // a bullish sweep takes out the previous low and closes above its high, a
  // bearish sweep the mirror. Anything else and the narrative and the ledger are
  // describing two different strategies.
  const signals: { i: number; dir: 1 | -1 }[] = [];
  for (let i = 1; i < candles.length - 10; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    if (c.low < p.low && c.close > p.high) signals.push({ i, dir: 1 });
    else if (c.high > p.high && c.close < p.low) signals.push({ i, dir: -1 });
  }

  let n = 0;
  for (const sig of signals) {
    if (++n > 62) break;
    const ei = sig.i;
    const bars = 2 + Math.floor(r() * 7);
    const xi = Math.min(candles.length - 1, ei + bars);
    const dir = sig.dir;
    const slope = trend[ei].value - trend[Math.max(0, ei - 6)].value;

    const entryPx = round2(candles[ei].close);
    const exitPx = round2(candles[xi].close);
    const gross = round2((exitPx - entryPx) * dir * QTY);
    const costs = round2(-(6 + r() * 12));
    const net = round2(gross + costs);
    cum = round2(cum + net);

    const span = candles.slice(ei, xi + 1);
    const lo = Math.min(...span.map((c) => c.low));
    const hi = Math.max(...span.map((c) => c.high));
    const adverse = dir === 1 ? lo - entryPx : entryPx - hi;
    const favourable = dir === 1 ? hi - entryPx : entryPx - lo;

    out.push({
      n,
      side: dir === 1 ? "Long" : "Short",
      entryTime: candles[ei].time,
      exitTime: candles[xi].time,
      bars: xi - ei,
      qty: QTY,
      entryPx,
      exitPx,
      gross,
      costs,
      net,
      r: round2(gross / RISK),
      mae: round2(Math.min(0, adverse) * QTY / RISK),
      mfe: round2(Math.max(0, favourable) * QTY / RISK),
      cum,
      regime: regimeAt(entryPx, slope, hi - lo),
      // Last 30% of the run is held back. Derived from the count so the split
      // cannot drift when the signal count changes.
      sample: n > Math.ceil(Math.min(signals.length, 62) * 0.7) ? "OOS" : "IS",
    });
  }
  return out;
})();

/** Named from what the bars did, not drawn from a hat. */
function regimeAt(px: number, slope: number, range: number): string {
  if (range > px * 0.02) return "High volatility";
  if (slope > px * 0.002) return "Trend up";
  if (slope < -px * 0.002) return "Trend down";
  return "Range";
}

/**
 * The equity path of a given set of rows. Cumulative net is RECOMPUTED rather
 * than read from `t.cum`, because a run presented without costs accumulates its
 * gross results — a curve ending at the cost-deducted total underneath a
 * cost-free Net Profit is the same contradiction in chart form.
 */
export const equityFor = (rows: typeof trades) => {
  let cum = 0;
  return rows.map((t) => {
    cum = round2(cum + t.net);
    return { time: t.entryTime, value: cum, n: t.n, side: t.side };
  });
};

export const dailyPnlFor = (rows: typeof trades) => rows.map((t) => ({ time: t.entryTime, value: t.net }));

/** The full run as executed — what the dock and the chart pane show. */
export const equity = equityFor(trades);

export const dailyPnl = dailyPnlFor(trades);

// Derived from the trades, never written by hand. Hand-entered weekday totals
// summed to 4,270.70 against a net profit of 1,813.27 — an aggregate that
// contradicts the ledger it claims to summarise, which is the same defect as a
// label that moves without its data.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The capital the run is sized against. Every percentage is relative to this,
 *  so a currency figure and its percentage cannot disagree. */
export const startingCapital = 25000;

export type SideFilter = "All" | "Long" | "Short";

const bySide = (side: SideFilter, from: typeof trades = trades) =>
  side === "All" ? from : from.filter((t) => t.side === side);

export function weekdayPnlFor(side: SideFilter = "All", from: typeof trades = trades) {
  const rows = bySide(side, from);
  return WEEKDAYS.map((label, day) => ({
    label,
    value: round2(
      rows.filter((t) => new Date(t.entryTime * 1000).getUTCDay() === day).reduce((s, t) => s + t.net, 0),
    ),
  }));
}

export const weekdayPnl = weekdayPnlFor();

/**
 * Everything the metrics table and the KPI strip report, for whatever slice of
 * the ledger is selected. Peak-to-trough runs over that slice's own cumulative
 * series rather than the whole run's, so filtering to Long does not quietly keep
 * showing the drawdown a short caused.
 */
export function statsFor(rows: typeof trades) {
  const wins = rows.filter((t) => t.net > 0);
  const losses = rows.filter((t) => t.net <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.net, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.net, 0));
  const netProfit = round2(rows.reduce((s, t) => s + t.net, 0));

  let cum = 0;
  let peak = 0;
  let worst = 0;
  let worstPct = 0;
  for (const t of rows) {
    cum = round2(cum + t.net);
    if (cum > peak) peak = cum;
    const fall = peak - cum;
    if (fall > worst) {
      worst = fall;
      worstPct = (fall / (startingCapital + peak)) * 100;
    }
  }

  return {
    wins: wins.length,
    losses: losses.length,
    trades: rows.length,
    grossProfit,
    grossLoss,
    netProfit,
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : 0,
    maxDrawdown: round2(worst),
    maxDrawdownPct: round2(worstPct),
    avgBars: rows.length ? rows.reduce((s, t) => s + t.bars, 0) / rows.length : 0,
  };
}

const all = statsFor(trades);
const { grossProfit, grossLoss } = all;
const drawdown = { abs: all.maxDrawdown, pct: all.maxDrawdownPct };

export const summary = {
  symbol: "XAUUSD",
  timeframe: "4h",
  strategy: "Sweep and Engulf Strategy",
  rangeLabel: "Jun 4, 2023 – Jul 15, 2026",
  netProfit: all.netProfit,
  trades: all.trades,
  winRate: all.winRate,
  wins: all.wins,
  losses: all.losses,
  maxDrawdown: drawdown.abs,
  maxDrawdownPct: drawdown.pct,
  profitFactor: all.profitFactor,
  openPnl: 0,
};

// Runs on every dev boot. These aggregates are shown side by side, so a reader
// can subtract one from another — if they ever stop agreeing, the screen is
// lying and it should fail here rather than in front of someone.
if (import.meta.env.DEV) {
  const weekdaySum = weekdayPnl.reduce((s, d) => s + d.value, 0);
  if (Math.abs(weekdaySum - summary.netProfit) > 0.5)
    throw new Error(`weekday P&L sums to ${weekdaySum}, net profit is ${summary.netProfit}`);
  if (Math.abs(grossProfit - grossLoss - summary.netProfit) > 0.5)
    throw new Error(`gross ${grossProfit} - ${grossLoss} does not equal net ${summary.netProfit}`);
  if (summary.wins + summary.losses !== summary.trades)
    throw new Error(`wins + losses does not equal ${summary.trades}`);
}

export type Metric = { label: string; value: string; tone?: "profit" | "loss" };

// The sign and the colour both come from the number. Net Profit used to carry a
// literal "+" and a permanent profit tone, so a slice that lost money would have
// rendered "+-412.80 USD" in green.
const money = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)} USD`;
const tone = (n: number): "profit" | "loss" => (n >= 0 ? "profit" : "loss");

/**
 * The rows as the run PRESENTS them. A run that does not model costs reports net
 * equal to gross — the Trades Log says exactly that on screen — so every surface
 * that reports a number for such a run has to use the same values.
 *
 * The run profile drove the Trades Log and Trades Analysis but not the
 * Performance tab, so under `no-costs` the log totalled +2,587.70 while the
 * metrics table two clicks away said +1,999.70 for the same run. Both were on
 * screen, and they disagreed by exactly the costs the profile claimed were not
 * modelled.
 */
export const asPresented = (rows: typeof trades, costsModelled: boolean) =>
  costsModelled ? rows : rows.map((t) => ({ ...t, costs: 0, net: t.gross }));

export function metricsFor(side: SideFilter = "All", costsModelled = true): Metric[] {
  const s = statsFor(asPresented(bySide(side), costsModelled));
  return [
    { label: "Net Profit", value: money(s.netProfit), tone: tone(s.netProfit) },
    { label: "Open PnL", value: "0.00 USD" },
    { label: "Gross Profit", value: money(s.grossProfit), tone: "profit" },
    { label: "Gross Loss", value: `−${s.grossLoss.toFixed(2)} USD`, tone: "loss" },
    { label: "Max Drawdown", value: `${s.maxDrawdown.toFixed(2)} USD` },
    { label: "Profit Factor", value: s.profitFactor.toFixed(3), tone: tone(s.profitFactor - 1) },
    { label: "Avg Trade", value: s.trades ? money(s.netProfit / s.trades) : "—" },
    { label: "Avg Bars Held", value: s.trades ? s.avgBars.toFixed(1) : "—" },
  ];
}

export const metrics = metricsFor();

export const pineSource = `// This Pine Script® code is subject to the Mozilla Public License 2.0
// © TraderCockpit

//@version=6
strategy("Sweep and Engulf Strategy", overlay = true, max_boxes_count = 500)

// ---- Inputs ----
grp_sig  = "Signal Filters"
prevDir  = input.string("Any", "Previous Candle Direction", options = ["Any", "Same Direction"], group = grp_sig)

grp_ema  = "EMA Trend Filter"
useEma   = input.bool(true, "Use & Show EMA Trend Filter", group = grp_ema)
emaLen   = input.int(200, "EMA Length", minval = 1, group = grp_ema)

grp_risk = "Risk Management"
slMethod = input.string("ATR", "Stop Loss Method", options = ["ATR", "Candle High/Low"], group = grp_risk)
atrLen   = input.int(14, "ATR Length", minval = 1, group = grp_risk)
atrMult  = input.float(5.0, "ATR Multiplier", minval = 0.1, group = grp_risk)
rr       = input.float(1.5, "Risk/Reward Ratio", minval = 0.1, group = grp_risk)

// ---- State ----
var float entryPrice = na
var float stopPrice  = na
var float targetPrice = na

ema200 = ta.ema(close, emaLen)
atr    = ta.atr(atrLen)

bullSweep = low < low[1] and close > high[1]
bearSweep = high > high[1] and close < low[1]

trendOk(bool isLong) =>
    not useEma or (isLong ? close > ema200 : close < ema200)

if bullSweep and trendOk(true) and strategy.position_size == 0
    entryPrice  := close
    stopPrice   := slMethod == "ATR" ? close - atr * atrMult : low
    targetPrice := entryPrice + (entryPrice - stopPrice) * rr
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", stop = stopPrice, limit = targetPrice)

if bearSweep and trendOk(false) and strategy.position_size == 0
    entryPrice  := close
    stopPrice   := slMethod == "ATR" ? close + atr * atrMult : high
    targetPrice := entryPrice - (stopPrice - entryPrice) * rr
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", stop = stopPrice, limit = targetPrice)

plot(useEma ? ema200 : na, "EMA Trend", color = close > ema200 ? color.teal : color.red, linewidth = 2)
`;
