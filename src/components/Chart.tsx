import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

interface Props {
  candles: Candle[];
  markers: SeriesMarker<Time>[];
}

export function Chart({ candles, markers }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
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
    markersRef.current = createSeriesMarkers<Time>(seriesRef.current!, []);
    return () => chart.remove();
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ ...c, time: c.time as Time })));
  }, [candles]);

  useEffect(() => {
    markersRef.current?.setMarkers(markers);
  }, [markers]);

  return <div ref={ref} className="h-[360px] w-full rounded-2xl glass-card overflow-hidden" />;
}