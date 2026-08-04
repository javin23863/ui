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

export const candles: Candle[] = (() => {
  const r = rng(20260805);
  const out: Candle[] = [];
  let px = 4062;
  for (let i = 0; i < 420; i++) {
    const drift = Math.sin(i / 38) * 1.6 + (i > 300 ? 0.55 : 0.06);
    const open = px;
    const close = open + drift + (r() - 0.5) * 11;
    const high = Math.max(open, close) + r() * 5.5;
    const low = Math.min(open, close) - r() * 5.5;
    out.push({ time: START + i * DAY * 0.25, open, high, low, close });
    px = close;
  }
  return out;
})();

// EMA overlay — colour switches by slope (§6), drawn as one polyline.
export const ema: { time: number; value: number }[] = (() => {
  const k = 2 / (60 + 1);
  let e = candles[0].close;
  return candles.map((c) => {
    e = c.close * k + e * (1 - k);
    return { time: c.time, value: e };
  });
})();

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

export const trades: Trade[] = (() => {
  const r = rng(7);
  const out: Trade[] = [];
  let cum = 0;
  for (let i = 1; i <= 62; i++) {
    const side = r() > 0.46 ? "Long" : "Short";
    const win = r() > 0.58;
    const rMult = win ? 0.6 + r() * 2.4 : -(0.5 + r() * 0.7);
    const gross = Math.round(rMult * 178 * 100) / 100;
    const costs = Math.round(-(6 + r() * 12) * 100) / 100;
    const net = Math.round((gross + costs) * 100) / 100;
    cum = Math.round((cum + net) * 100) / 100;
    const ei = Math.min(candles.length - 30, 8 + i * 6);
    const bars = 6 + Math.floor(r() * 40);
    out.push({
      n: i,
      side,
      entryTime: candles[ei].time,
      exitTime: candles[Math.min(candles.length - 1, ei + bars)].time,
      bars,
      qty: 10,
      entryPx: Math.round(candles[ei].close * 100) / 100,
      exitPx: Math.round(candles[Math.min(candles.length - 1, ei + bars)].close * 100) / 100,
      gross,
      costs,
      net,
      r: Math.round(rMult * 100) / 100,
      mae: -Math.round(r() * 90) / 100,
      mfe: Math.round((Math.max(rMult, 0.1) + r() * 0.8) * 100) / 100,
      cum,
      regime: ["Trend up", "Trend down", "Range", "High volatility"][Math.floor(r() * 4)],
      sample: i > 44 ? "OOS" : "IS",
    });
  }
  return out;
})();

export const equity = trades.map((t) => ({ time: t.entryTime, value: t.cum, n: t.n, side: t.side }));

export const dailyPnl = trades.map((t) => ({ time: t.entryTime, value: t.net }));

export const weekdayPnl = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1830.4 },
  { label: "Tue", value: -640.2 },
  { label: "Wed", value: 2410.9 },
  { label: "Thu", value: 980.15 },
  { label: "Fri", value: -310.55 },
  { label: "Sat", value: 0 },
];

const wins = trades.filter((t) => t.net > 0);
const losses = trades.filter((t) => t.net <= 0);
const grossProfit = wins.reduce((s, t) => s + t.net, 0);
const grossLoss = Math.abs(losses.reduce((s, t) => s + t.net, 0));

export const summary = {
  symbol: "XAUUSD",
  timeframe: "4h",
  strategy: "Sweep and Engulf Strategy",
  rangeLabel: "Jun 4, 2023 – Jul 15, 2026",
  netProfit: trades.at(-1)!.cum,
  trades: trades.length,
  winRate: (wins.length / trades.length) * 100,
  wins: wins.length,
  losses: losses.length,
  maxDrawdown: 1639.5,
  maxDrawdownPct: 0.16,
  profitFactor: grossProfit / grossLoss,
  openPnl: 0,
};

export const metrics: { label: string; value: string; tone?: "profit" | "loss" }[] = [
  { label: "Net Profit", value: `+${summary.netProfit.toFixed(2)} USD`, tone: "profit" },
  { label: "Open PnL", value: "0.00 USD" },
  { label: "Gross Profit", value: `+${grossProfit.toFixed(2)} USD`, tone: "profit" },
  { label: "Gross Loss", value: `-${grossLoss.toFixed(2)} USD`, tone: "loss" },
  { label: "Max Drawdown", value: `${summary.maxDrawdown.toFixed(2)} USD` },
  { label: "Profit Factor", value: summary.profitFactor.toFixed(3), tone: "profit" },
  { label: "Avg Trade", value: `${(summary.netProfit / summary.trades).toFixed(2)} USD` },
  { label: "Avg Bars Held", value: (trades.reduce((s, t) => s + t.bars, 0) / trades.length).toFixed(1) },
];

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

plot(useEma ? ema200 : na, "EMA Trend", color = close > ema200 ? color.teal : color.red, linewidth = 2)
`;
