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
        vertLines: { color: "rgba(132,142,156,0.08)" },
        horzLines: { color: "rgba(132,142,156,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(132,142,156,0.2)" },
      timeScale: { borderColor: "rgba(132,142,156,0.2)", timeVisible: true, secondsVisible: false },
      autoSize: true,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#02c076",
      downColor: "#f6465d",
      borderUpColor: "#02c076",
      borderDownColor: "#f6465d",
      wickUpColor: "#02c076",
      wickDownColor: "#f6465d",
    });
    markersRef.current = createSeriesMarkers<Time>(seriesRef.current!, [], { autoScale: true, zOrder: "top" });
    return () => chart.remove();
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ ...c, time: c.time as Time })));
  }, [candles]);

  useEffect(() => {
    markersRef.current?.setMarkers(markers);
  }, [markers]);

  return <div ref={ref} className="h-[390px] w-full rounded-lg binance-panel overflow-hidden" />;
}