import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { candlesFor, emaFor, markers, RUN_SYMBOL, RUN_TIMEFRAME, tradeZone } from "../fixtures/market";

const T = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/**
 * Price chart. The reference's distinguishing trait is what it does NOT draw:
 * no gridlines, no axis border, price labels floating on the right (§6).
 * Every charting library defaults to the opposite, so these are all explicit.
 */
export default function ChartPane({
  symbol,
  timeframe,
  withTrades,
  focus,
}: {
  symbol: string;
  timeframe: string;
  withTrades: boolean;
  /** A trade selected in the Trades Log — the chart scrolls to its bar range (§8d). */
  focus?: { n: number; entryTime: number; exitTime: number } | null;
}) {
  // Trade overlays belong to the committed run — a specific instrument at a
  // specific timeframe. Drawing them over anything else attributes those fills
  // to a chart they never happened on; the bar timestamps would not even line up.
  const matchesRun = symbol === RUN_SYMBOL && timeframe === RUN_TIMEFRAME;
  const showTrades = withTrades && matchesRun;
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [zones, setZones] = useState<{ x: number; w: number; entry: number; target: number; stop: number } | null>(null);
  const [trend, setTrend] = useState<{ x: number; y: number }[]>([]);

  // §13.1 — what Apollo reads instead of OCR-ing the canvas. Derived from the
  // same source the chart draws from, so it cannot describe a different series.
  const meta = useMemo(() => {
    const cs = candlesFor(symbol, timeframe);
    return {
      kind: "candles",
      symbol,
      timeframe,
      bars: cs.length,
      first: cs[0].time,
      last: cs.at(-1)!.time,
      overlays: showTrades ? ["ema", "trade-markers", "tp-zone", "sl-zone"] : ["ema"],
      tradesShown: showTrades,
      runSymbol: RUN_SYMBOL,
      runTimeframe: RUN_TIMEFRAME,
      focusedTrade: focus?.n ?? null,
    };
  }, [symbol, timeframe, showTrades, focus?.n]);

  useEffect(() => {
    if (!host.current) return;
    const candles = candlesFor(symbol, timeframe);
    const ema = emaFor(candles);
    const profit = T("--color-profit");
    const loss = T("--color-loss");
    const muted = T("--color-text-muted");
    // Forex needs more decimals than an index; derive precision from the level.
    const px0 = candles[0].close;
    const precision = px0 < 10 ? 4 : px0 < 1000 ? 2 : 2;

    const c = createChart(host.current, {
      layout: {
        background: { color: "transparent" },
        textColor: muted,
        fontSize: 10,
        fontFamily: T("--font-sans") || "Inter, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: {
        vertLine: { color: T("--color-border-strong"), width: 1, style: 3, labelBackgroundColor: T("--color-bg-elevated") },
        horzLine: { color: T("--color-border-strong"), width: 1, style: 3, labelBackgroundColor: T("--color-bg-elevated") },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
      autoSize: true,
    });
    chart.current = c;

    const price = c.addSeries(CandlestickSeries, {
      upColor: profit,
      downColor: loss,
      borderVisible: false,
      wickUpColor: profit,
      wickDownColor: loss,
      priceLineVisible: false,
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
    });
    price.setData(candles.map((k) => ({ ...k, time: k.time as Time })));

    // The EMA is drawn in the SVG overlay below, not as a series: §6 wants one
    // polyline whose colour switches with slope, and a line series cannot carry
    // per-segment colour. Two whitespace-masked series was tried first and is
    // wrong — the series connects straight across the gaps, so it renders as two
    // crossing lines rather than one line changing colour.

    priceRef.current = price;

    // Re-project every overlay through the chart's own coordinate API so the SVG
    // layer tracks pan and zoom exactly.
    const project = () => {
      const ts = c.timeScale();
      const pts: { x: number; y: number }[] = [];
      for (const p of ema) {
        const x = ts.timeToCoordinate(p.time as Time);
        const y = price.priceToCoordinate(p.value);
        if (x !== null && y !== null) pts.push({ x, y });
      }
      setTrend(pts);

      if (!showTrades) return setZones(null);
      const x1 = ts.timeToCoordinate(tradeZone.from as Time);
      const x2 = ts.timeToCoordinate(tradeZone.to as Time);
      const yEntry = price.priceToCoordinate(tradeZone.entry);
      const yTarget = price.priceToCoordinate(tradeZone.target);
      const yStop = price.priceToCoordinate(tradeZone.stop);
      if (x1 === null || x2 === null || yEntry === null || yTarget === null || yStop === null)
        return setZones(null);
      setZones({ x: x1, w: x2 - x1, entry: yEntry, target: yTarget, stop: yStop });
    };

    if (showTrades) {
      createSeriesMarkers(
        price,
        markers.map((m) => ({
          time: m.time as Time,
          position: m.side === "long" ? "belowBar" : "aboveBar",
          color: m.side === "long" ? profit : loss,
          shape: m.side === "long" ? "arrowUp" : "arrowDown",
          text: `${m.kind === "exit" ? "Exit " : ""}${m.side === "long" ? "Long" : "Short"} ${m.side === "long" ? "+" : "−"}${m.qty}`,
        })),
      );

      // Target / stop zones are real rectangles. An area series cannot express a
      // box bounded on all four sides — the first attempt read as a wash.
    }

    c.timeScale().fitContent();
    project();
    // priceToCoordinate returns null for prices outside the *current* scale, and
    // the auto-scale has not settled on the frame fitContent() is called — so a
    // projection taken now clips the left edge. Re-project once it has.
    const settle = requestAnimationFrame(project);
    c.timeScale().subscribeVisibleLogicalRangeChange(project);
    return () => {
      cancelAnimationFrame(settle);
      c.remove();
    };
  }, [showTrades, symbol, timeframe]);

  // Cross-link from the Trades Log: bring that trade's bar range into view.
  // Gated on the run, like the overlays are — a trade's timestamps are 4h XAUUSD
  // bars, so scrolling a BTCUSD 1m chart to them lands on a range that has
  // nothing to do with the trade.
  useEffect(() => {
    if (!focus || !chart.current || !matchesRun) return;
    const pad = (focus.exitTime - focus.entryTime) * 1.5 || 86400;
    chart.current.timeScale().setVisibleRange({
      from: (focus.entryTime - pad) as Time,
      to: (focus.exitTime + pad) as Time,
    });
  }, [focus, matchesRun]);

  return (
    <div className="relative h-full w-full">
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden>
        {/* EMA: one polyline, per-segment colour by slope (§6). */}
        {trend.slice(1).map((p, i) => (
          <line
            key={i}
            x1={trend[i].x}
            y1={trend[i].y}
            x2={p.x}
            y2={p.y}
            strokeWidth={2}
            stroke={p.y <= trend[i].y ? "var(--color-profit)" : "var(--color-loss)"}
          />
        ))}
        {zones && (
          <>
            <rect
              x={zones.x}
              y={Math.min(zones.entry, zones.stop)}
              width={zones.w}
              height={Math.abs(zones.stop - zones.entry)}
              fill="var(--sl-box-fill)"
            />
            <rect
              x={zones.x}
              y={Math.min(zones.entry, zones.target)}
              width={zones.w}
              height={Math.abs(zones.target - zones.entry)}
              fill="var(--tp-box-fill)"
            />
          </>
        )}
      </svg>
      <div
        ref={host}
        className="h-full w-full"
        data-apollo-id="price-chart"
        
        
        data-apollo-series={JSON.stringify(meta)}
      />
    </div>
  );
}
