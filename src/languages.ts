import { pineSource } from "./fixtures/market";

/**
 * §17a — the code pane's languages.
 *
 * This module is the ONE answer to "which language is the pane showing", for
 * the same reason `presentedRowsFor` is the one answer to "which rows is this
 * run" (§15). The header's `Copy`, the header's `Run`, the canonical/derived
 * label and the rendered buffer all read from here. When those four each kept
 * their own idea of the selection, `Copy` copied `pineSource` while the pane
 * showed something else — the label-without-its-data defect this build has
 * bought seven times.
 */
export type LanguageId = "pine" | "mql5" | "thinkscript";

/**
 * The language the run was **executed from**. Everything else on this pane is
 * a hand-written translation that has never been run, and §17b requires that
 * distinction to be rendered rather than implied.
 */
export const CANONICAL: LanguageId = "pine";

/**
 * A line carrying this token names a construct with **no faithful equivalent**
 * in the target language (§17b).
 *
 * It lives INSIDE the source text as a native comment rather than beside it in
 * a separate table, for two reasons. It survives the clipboard — a trader who
 * pastes MQL5 into MetaEditor still has the warning, where a UI-only marker
 * would be gone at the moment it mattered. And it cannot drift: there is one
 * string, so the pane cannot mark a line the copied text does not.
 */
export const NO_EQUIVALENT = "NO FAITHFUL EQUIVALENT:";

export type Language = {
  id: LanguageId;
  label: string;
  /**
   * The `prism-react-renderer` grammar this buffer is highlighted with. None
   * of these languages has a Prism grammar of its own, so each is a
   * SUBSTITUTION, and §17a requires the substitution be recorded rather than
   * silently relied upon — with its ceiling, because they are not equally
   * strong claims.
   */
  highlight: string;
  highlightNote: string;
  source: string;
};

const mql5Source = `//+------------------------------------------------------------------+
//| Sweep and Engulf Strategy - MQL5                                 |
//| Hand-written from the canonical Pine v6 source. Never compiled,  |
//| never executed, and it produced none of the numbers on this run. |
//+------------------------------------------------------------------+
#property copyright "TraderCockpit"
#property version   "1.00"

#include <Trade\\Trade.mqh>
CTrade trade;

// ---- Inputs ----
// ${NO_EQUIVALENT} Pine's input.string(..., options = [...]) renders a
// dropdown constrained to the listed values. MQL5 constrains a choice only by
// declaring an enum, which changes what is stored from text to an ordinal, so
// these stay free-text and an unlisted value is accepted silently.
input string InpPrevDir  = "Any";   // Previous Candle Direction: Any | Same Direction
input string InpSlMethod = "ATR";   // Stop Loss Method: ATR | Candle High/Low

input bool   InpUseEma   = true;    // Use & Show EMA Trend Filter
input int    InpEmaLen   = 200;     // EMA Length
input int    InpAtrLen   = 14;      // ATR Length
input double InpAtrMult  = 5.0;     // ATR Multiplier
input double InpRR       = 1.5;     // Risk/Reward Ratio

// ${NO_EQUIVALENT} Pine sizes from strategy.default_qty_value, which MQL5 has
// no counterpart for - an order carries an explicit volume or it is rejected.
// So this input exists in the translation and not in the original, and its
// value is a choice somebody made rather than anything the Pine source says.
input double InpLots     = 0.10;    // Volume (lots)

int hEma = INVALID_HANDLE;
int hAtr = INVALID_HANDLE;

int OnInit()
  {
   hEma = iMA(_Symbol, _Period, InpEmaLen, 0, MODE_EMA, PRICE_CLOSE);
   hAtr = iATR(_Symbol, _Period, InpAtrLen);
   if(hEma == INVALID_HANDLE || hAtr == INVALID_HANDLE)
      return(INIT_FAILED);
   return(INIT_SUCCEEDED);
  }

// Pine evaluates the whole script once per bar. An EA is called per tick, so
// this guard is the translation of Pine's execution model, not an addition to
// the strategy.
bool NewBar()
  {
   static datetime last = 0;
   datetime t = iTime(_Symbol, _Period, 0);
   if(t == last)
      return(false);
   last = t;
   return(true);
  }

void OnTick()
  {
   if(!NewBar())
      return;
   if(PositionSelect(_Symbol))   // Pine: strategy.position_size == 0
      return;

   double ema[1], atr[1];
   if(CopyBuffer(hEma, 0, 1, 1, ema) != 1) return;
   if(CopyBuffer(hAtr, 0, 1, 1, atr) != 1) return;

   double c  = iClose(_Symbol, _Period, 1);
   double h  = iHigh (_Symbol, _Period, 1);
   double l  = iLow  (_Symbol, _Period, 1);
   double h1 = iHigh (_Symbol, _Period, 2);
   double l1 = iLow  (_Symbol, _Period, 2);

   bool bullSweep = (l < l1 && c > h1);
   bool bearSweep = (h > h1 && c < l1);
   bool longOk    = (!InpUseEma || c > ema[0]);
   bool shortOk   = (!InpUseEma || c < ema[0]);

   double stop, target;

   if(bullSweep && longOk)
     {
      stop   = (InpSlMethod == "ATR") ? c - atr[0] * InpAtrMult : l;
      target = c + (c - stop) * InpRR;
      trade.Buy(InpLots, _Symbol, 0.0, stop, target);
     }
   else if(bearSweep && shortOk)
     {
      stop   = (InpSlMethod == "ATR") ? c + atr[0] * InpAtrMult : h;
      target = c - (stop - c) * InpRR;
      trade.Sell(InpLots, _Symbol, 0.0, stop, target);
     }
  }

// ${NO_EQUIVALENT} Pine's plot() draws the EMA from the same script that
// places the orders. An MQL5 Expert Advisor cannot plot at all - a chart line
// needs a separate custom indicator - so the trend filter is applied here but
// nothing about it is visible on the chart.
`;

const thinkScriptSource = `# Sweep and Engulf Strategy - thinkScript
# Hand-written from the canonical Pine v6 source. Never compiled, never
# executed, and it produced none of the numbers on this run.

input prevDir  = {default "Any", "Same Direction"};
input useEma   = yes;
input emaLen   = 200;
input slMethod = {default "ATR", "Candle High/Low"};
input atrLen   = 14;
input atrMult  = 5.0;
input rr       = 1.5;

def ema200 = ExpAverage(close, emaLen);
def atr    = ATR(length = atrLen);   # Wilder's, matching Pine's ta.atr

def bullSweep = low < low[1] and close > high[1];
def bearSweep = high > high[1] and close < low[1];

def longOk  = !useEma or close > ema200;
def shortOk = !useEma or close < ema200;

def longSignal  = bullSweep and longOk;
def shortSignal = bearSweep and shortOk;

# The levels AS COMPUTED ON THE SIGNAL BAR.
def longStopAt  = if slMethod == slMethod."ATR" then close - atr * atrMult else low;
def shortStopAt = if slMethod == slMethod."ATR" then close + atr * atrMult else high;

# Pine keeps stopPrice and targetPrice in var floats: set once at entry, then
# unchanged for the life of the position. These are latched with rec for that
# reason. Recomputing them from each new bar's close and ATR would walk the
# stop and the target along with price, which is a different strategy - it can
# never be stopped out on a trend against it.
rec longStop    = if longSignal  then longStopAt  else longStop[1];
rec shortStop   = if shortSignal then shortStopAt else shortStop[1];
rec longTarget  = if longSignal  then close + (close - longStopAt) * rr else longTarget[1];
rec shortTarget = if shortSignal then close - (shortStopAt - close) * rr else shortTarget[1];

# ${NO_EQUIVALENT} Pine reads strategy.position_size to take a signal only
# while flat. thinkScript exposes no position size to a study, so the
# flat-only guard cannot be written and every qualifying bar signals - which
# is a different strategy on any instrument that sweeps twice in a row.
AddOrder(OrderType.BUY_TO_OPEN,  longSignal,  name = "Long");
AddOrder(OrderType.SELL_TO_OPEN, shortSignal, name = "Short");

# ${NO_EQUIVALENT} Pine's strategy.exit attaches a stop AND a limit to the
# position as one bracket, where the first to fill cancels the other and both
# are live intrabar. thinkScript's AddOrder has no attached bracket, so these
# are separate orders that do not cancel one another - a bar touching both the
# stop and the target fills both - and they are evaluated on the CLOSE of a
# bar rather than the moment price crosses, so a level pierced and recovered
# inside one bar exits in Pine and does not exit here.
AddOrder(OrderType.SELL_TO_CLOSE, low <= longStop[1] or high >= longTarget[1], name = "Exit Long");
AddOrder(OrderType.BUY_TO_CLOSE, high >= shortStop[1] or low <= shortTarget[1], name = "Exit Short");

plot EmaTrend = if useEma then ema200 else Double.NaN;
EmaTrend.SetLineWeight(2);
EmaTrend.AssignValueColor(if close > ema200 then Color.CYAN else Color.RED);
`;

export const LANGUAGES: Language[] = [
  {
    id: "pine",
    label: "Pine v6",
    highlight: "javascript",
    highlightNote:
      "Pine has no Prism grammar. Highlighted as JavaScript, which is what the reference pane's observed VS Code Dark+ palette was matched against (§7).",
    source: pineSource,
  },
  {
    id: "mql5",
    label: "MQL5",
    highlight: "cpp",
    // A GOOD substitution, and said so plainly so the weaker one below is not
    // read as the same claim.
    highlightNote:
      "MQL5 has no Prism grammar. Highlighted as C++, which is a close fit: MQL5 is C++-derived, so its keywords, comment forms, string literals and numeric forms all land where the highlighter expects them.",
    source: mql5Source,
  },
  {
    id: "thinkscript",
    label: "thinkScript",
    highlight: "cpp",
    // The recorded CEILING. §17a's amendment requires this be written as a
    // weaker claim than MQL5's, not a second copy of it.
    highlightNote:
      "thinkScript has no Prism grammar. Highlighted as C++, which is a WEAKER fit than MQL5's: thinkScript is not C-derived. Comments, strings and numbers colour correctly; plot, def and input are not C keywords and stay uncoloured, while default inside an option list is coloured as one when it is not.",
    source: thinkScriptSource,
  },
];

export function languageFor(id: LanguageId): Language {
  const found = LANGUAGES.find((l) => l.id === id);
  // Falling back to the canonical would render Pine under an MQL5 label, which
  // is precisely the defect this module exists to prevent. Fail loudly.
  if (!found) throw new Error(`unknown language: ${id}`);
  return found;
}

export const isDerived = (id: LanguageId) => id !== CANONICAL;

/** Lines with no faithful equivalent in this buffer — §17b, rendered at the line. */
export const refusalLines = (source: string): number[] =>
  source
    .split("\n")
    .map((line, i) => (line.includes(NO_EQUIVALENT) ? i : -1))
    .filter((i) => i >= 0);
