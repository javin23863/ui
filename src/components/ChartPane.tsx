import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { candles, ema, markers, tradeZone } from "../fixtures/market";

const T = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/**
 * Price chart. The reference's distinguishing trait is what it does NOT draw:
 * no gridlines, no axis border, price labels floating on the right (§6).
 * Every charting library defaults to the opposite, so these are all explicit.
 */
export default function ChartPane({
  withTrades,
  focus,
}: {
  withTrades: boolean;
  /** A trade selected in the Trades Log — the chart scrolls to its bar range (§8d). */
  focus?: { n: number; entryTime: number; exitTime: number } | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [zones, setZones] = useState<{ x: number; w: number; entry: number; target: number; stop: number } | null>(null);
  const [trend, setTrend] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (!host.current) return;
    const profit = T("--color-profit");
    const loss = T("--color-loss");
    const muted = T("--color-text-muted");

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

      if (!withTrades) return setZones(null);
      const x1 = ts.timeToCoordinate(tradeZone.from as Time);
      const x2 = ts.timeToCoordinate(tradeZone.to as Time);
      const yEntry = price.priceToCoordinate(tradeZone.entry);
      const yTarget = price.priceToCoordinate(tradeZone.target);
      const yStop = price.priceToCoordinate(tradeZone.stop);
      if (x1 === null || x2 === null || yEntry === null || yTarget === null || yStop === null)
        return setZones(null);
      setZones({ x: x1, w: x2 - x1, entry: yEntry, target: yTarget, stop: yStop });
    };

    if (withTrades) {
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
  }, [withTrades]);

  // Cross-link from the Trades Log: bring that trade's bar range into view.
  useEffect(() => {
    if (!focus || !chart.current) return;
    const pad = (focus.exitTime - focus.entryTime) * 1.5 || 86400;
    chart.current.timeScale().setVisibleRange({
      from: (focus.entryTime - pad) as Time,
      to: (focus.exitTime + pad) as Time,
    });
  }, [focus]);

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
        // §13.1 — expose the data, not only pixels. Apollo reads this instead
        // of OCR-ing the canvas.
        data-apollo-series={JSON.stringify({
          kind: "candles",
          symbol: "XAUUSD",
          timeframe: "4h",
          bars: candles.length,
          first: candles[0].time,
          last: candles.at(-1)!.time,
          overlays: withTrades ? ["ema", "trade-markers", "tp-zone", "sl-zone"] : ["ema"],
          focusedTrade: focus?.n ?? null,
        })}
      />
    </div>
  );
}
