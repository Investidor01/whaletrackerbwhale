import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { sma } from "@/lib/indicators";

interface Props {
  candles: Candle[];
  markers: SeriesMarker<Time>[];
}

export function Chart({ candles, markers }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma6Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#cbd5e1",
      },
      grid: {
        vertLines: { color: "rgba(120,140,180,0.08)" },
        horzLines: { color: "rgba(120,140,180,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(120,140,180,0.2)" },
      timeScale: { borderColor: "rgba(120,140,180,0.2)", timeVisible: true, secondsVisible: false },
      autoSize: true,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#10d39a",
      downColor: "#ef4444",
      borderUpColor: "#10d39a",
      borderDownColor: "#ef4444",
      wickUpColor: "#10d39a",
      wickDownColor: "#ef4444",
    });
    ma1Ref.current = chart.addSeries(LineSeries, { color: "#facc15", lineWidth: 1 });
    ma2Ref.current = chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 1 });
    ma6Ref.current = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1 });
    markersRef.current = createSeriesMarkers<Time>(seriesRef.current!, []);
    return () => chart.remove();
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ ...c, time: c.time as Time })));
    const closes = candles.map((c) => c.close);
    const m1 = sma(closes, 7);
    const m2 = sma(closes, 25);
    const m6 = sma(closes, 99);
    const toLine = (arr: (number | null)[]) =>
      candles
        .map((c, i) => (arr[i] === null ? null : { time: c.time as Time, value: arr[i] as number }))
        .filter(Boolean) as { time: Time; value: number }[];
    ma1Ref.current?.setData(toLine(m1));
    ma2Ref.current?.setData(toLine(m2));
    ma6Ref.current?.setData(toLine(m6));
  }, [candles]);

  useEffect(() => {
    markersRef.current?.setMarkers(markers);
  }, [markers]);

  return <div ref={ref} className="h-[360px] w-full rounded-2xl glass-card overflow-hidden" />;
}