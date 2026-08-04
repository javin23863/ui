import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
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

    // EMA drawn as two series so the colour can switch by slope without
    // per-segment canvas work — bullish above, bearish below.
    const trend = c.addSeries(LineSeries, {
      color: profit,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    trend.setData(ema.map((p) => ({ time: p.time as Time, value: p.value })));

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

      // Target / stop zones. lightweight-charts has no box primitive, so these
      // are two thin area bands anchored to the entry — enough to read the
      // shape, and far less code than a custom series plugin.
      // ponytail: bands not true boxes; swap for a custom series only if the
      // zones need to be draggable.
      for (const [level, fill] of [
        [tradeZone.target, "var(--tp-box-fill)"],
        [tradeZone.stop, "var(--sl-box-fill)"],
      ] as const) {
        const band = c.addSeries(AreaSeries, {
          lineWidth: 1,
          lineColor: fill === "var(--tp-box-fill)" ? profit : loss,
          topColor: fill === "var(--tp-box-fill)" ? `${profit}33` : `${loss}33`,
          bottomColor: "transparent",
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          baseLineVisible: false,
        });
        band.setData(
          candles
            .filter((k) => k.time >= tradeZone.from && k.time <= tradeZone.to)
            .map((k) => ({ time: k.time as Time, value: level })),
        );
      }
    }

    c.timeScale().fitContent();
    return () => c.remove();
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
    <div
      ref={host}
      className="h-full w-full"
      data-apollo-id="price-chart"
      // §13.1 — expose the data, not only pixels. Apollo reads this instead of
      // OCR-ing the canvas.
      data-apollo-series={JSON.stringify({
        kind: "candles",
        symbol: "XAUUSD",
        timeframe: "4h",
        bars: candles.length,
        first: candles[0].time,
        last: candles.at(-1)!.time,
        overlays: withTrades ? ["ema", "trade-markers", "tp-zone", "sl-zone"] : ["ema"],
      })}
    />
  );
}
