import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

export interface IndicatorLine {
  name: string;
  color: string;
  data: { time: number; value: number }[];
}

interface Props {
  lines: IndicatorLine[];
  height?: number;
}

/**
 * Lightweight chart that renders only indicator lines (no candles).
 * Used to visualize crossings clearly.
 */
export function IndicatorChart({ lines, height = 140 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line">[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: "transparent" }, textColor: "#cbd5e1" },
      grid: {
        vertLines: { color: "rgba(132,142,156,0.06)" },
        horzLines: { color: "rgba(132,142,156,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(132,142,156,0.15)" },
      timeScale: { borderColor: "rgba(132,142,156,0.15)", timeVisible: true, secondsVisible: false },
      autoSize: true,
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // Rebuild series if line count changes
    if (seriesRef.current.length !== lines.length) {
      seriesRef.current.forEach((s) => chart.removeSeries(s));
      seriesRef.current = lines.map((l) =>
        chart.addSeries(LineSeries, { color: l.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: l.name }),
      );
    } else {
      seriesRef.current.forEach((s, i) => s.applyOptions({ color: lines[i].color, title: lines[i].name }));
    }
    lines.forEach((l, i) => {
      seriesRef.current[i].setData(l.data.map((d) => ({ time: d.time as Time, value: d.value })));
    });
  }, [lines]);

  return <div ref={ref} className="w-full rounded-lg binance-panel overflow-hidden" style={{ height }} />;
}