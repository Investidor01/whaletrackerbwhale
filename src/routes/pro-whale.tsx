import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { PAIRS, TIMEFRAMES, fetchKlines, subscribeKline, tfSeconds } from "@/lib/binance";
import type { Candle } from "@/lib/types";
import { clusterZones, distancePct, findPivots, fitTrendlines, lineValueAt } from "@/lib/sr";
import { pushPopup } from "@/components/Popup";
import { Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pro-whale")({
  head: () => ({ meta: [{ title: "Pro Whale+ — Suporte/Resistência + LTA/LTB" }] }),
  component: ProWhale,
});

interface PWSignal {
  id: string;
  time: number;
  entryTime: number;
  direction: "UP" | "DOWN";
  reason: string;
  entryPrice?: number;
  result: "PENDING" | "WIN" | "LOSS";
}

function ProWhale() {
  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("5m");
  const [showSR, setShowSR] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [active, setActive] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<PWSignal[]>([]);
  const lastTouchRef = useRef<string>("");
  const tfSec = tfSeconds(tf);

  useEffect(() => {
    let alive = true;
    fetchKlines(pair, tf, 400).then((c) => { if (alive) setCandles(c); });
    return () => { alive = false; };
  }, [pair, tf]);

  useEffect(() => {
    const unsub = subscribeKline(pair, tf, ({ candle }) => {
      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (candle.time === last.time) return [...prev.slice(0, -1), candle];
        if (candle.time > last.time) return [...prev.slice(-399), candle];
        return prev;
      });
    });
    return unsub;
  }, [pair, tf]);

  const pivots = useMemo(() => findPivots(candles, 3), [candles]);
  const zones = useMemo(() => clusterZones(pivots), [pivots]);
  const trendlines = useMemo(() => fitTrendlines(pivots, 5), [pivots]);

  // Signal generation: on touch of zone / trendline
  useEffect(() => {
    if (!active || candles.length < 30) return;
    const live = candles[candles.length - 1];

    // Apuração WIN/LOSS for pending signals
    setSignals((prev) => prev.map((s) => {
      if (s.result !== "PENDING") return s;
      const ent = candles.find((c) => c.time === s.entryTime);
      if (!ent) return s;
      const idx = candles.findIndex((c) => c.time === s.entryTime);
      const next = idx >= 0 ? candles[idx + 1] : undefined;
      const updated = s.entryPrice === undefined ? { ...s, entryPrice: ent.open } : s;
      if (next || idx === candles.length - 1) {
        // entry candle is closed (there's a next candle) → apurar
        if (next) {
          const ep = updated.entryPrice ?? ent.open;
          const win = updated.direction === "UP" ? ent.close > ep : ent.close < ep;
          pushPopup({ variant: win ? "win" : "loss", title: win ? "Pro Whale+ WIN" : "Pro Whale+ LOSS", message: `${pair} · ${updated.direction === "UP" ? "CALL" : "PUT"}` });
          return { ...updated, result: win ? "WIN" : "LOSS" };
        }
      }
      return updated;
    }));

    // Block new signal while pending
    if (signals.some((s) => s.result === "PENDING")) return;

    const tol = 0.0015; // 0.15%
    let trigger: { direction: "UP" | "DOWN"; reason: string; key: string } | null = null;

    if (showSR) {
      for (const z of zones) {
        if (distancePct(live.close, z.price) < tol) {
          if (z.kind === "support" && live.close <= z.price * (1 + tol) && live.close >= z.price * (1 - tol)) {
            trigger = { direction: "UP", reason: `Toque em SUPORTE ${z.price.toFixed(2)} (força ${z.strength})`, key: `sup-${z.price.toFixed(2)}-${live.time}` };
            break;
          }
          if (z.kind === "resistance") {
            trigger = { direction: "DOWN", reason: `Toque em RESISTÊNCIA ${z.price.toFixed(2)} (força ${z.strength})`, key: `res-${z.price.toFixed(2)}-${live.time}` };
            break;
          }
        }
      }
    }

    if (!trigger && showLines) {
      for (const l of trendlines) {
        const lv = lineValueAt(l, live.time);
        if (distancePct(live.close, lv) < tol) {
          trigger = l.kind === "lta"
            ? { direction: "UP", reason: `Toque na LTA (${lv.toFixed(2)})`, key: `lta-${live.time}` }
            : { direction: "DOWN", reason: `Toque na LTB (${lv.toFixed(2)})`, key: `ltb-${live.time}` };
          break;
        }
      }
    }

    if (trigger && lastTouchRef.current !== trigger.key) {
      lastTouchRef.current = trigger.key;
      const sig: PWSignal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        time: live.time,
        entryTime: live.time + tfSec,
        direction: trigger.direction,
        reason: trigger.reason,
        result: "PENDING",
      };
      setSignals((p) => [sig, ...p].slice(0, 50));
      pushPopup({
        variant: "signal",
        title: `Pro Whale+ ${trigger.direction === "UP" ? "CALL" : "PUT"}`,
        message: trigger.reason,
      });
    }
  }, [candles, active, zones, trendlines, showSR, showLines, pair, tfSec, signals]);

  // Chart rendering with overlays
  const containerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const zoneSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const lineSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#cbd5e1" },
      grid: { vertLines: { color: "rgba(132,142,156,0.08)" }, horzLines: { color: "rgba(132,142,156,0.08)" } },
      autoSize: true,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(132,142,156,0.2)" },
      rightPriceScale: { borderColor: "rgba(132,142,156,0.2)" },
      crosshair: { mode: 0 },
    });
    chartApiRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#02c076", downColor: "#f6465d",
      borderUpColor: "#02c076", borderDownColor: "#f6465d",
      wickUpColor: "#02c076", wickDownColor: "#f6465d",
    });
    markersRef.current = createSeriesMarkers<Time>(candleSeriesRef.current!, [], { autoScale: true, zOrder: "top" });
    return () => { chart.remove(); chartApiRef.current = null; };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    candleSeriesRef.current.setData(candles.map((c) => ({ ...c, time: c.time as Time })));
  }, [candles]);

  // Render S/R as horizontal lines
  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart || !candles.length) return;
    zoneSeriesRef.current.forEach((s) => chart.removeSeries(s));
    zoneSeriesRef.current = [];
    if (!showSR) return;
    for (const z of zones) {
      const color = z.kind === "support" ? "#02c076" : "#f6465d";
      const s = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: `${z.kind === "support" ? "S" : "R"} ${z.price.toFixed(2)}` });
      s.setData(candles.map((c) => ({ time: c.time as Time, value: z.price })));
      zoneSeriesRef.current.push(s);
    }
  }, [zones, candles, showSR]);

  // Render trendlines
  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart || !candles.length) return;
    lineSeriesRef.current.forEach((s) => chart.removeSeries(s));
    lineSeriesRef.current = [];
    if (!showLines) return;
    for (const l of trendlines) {
      const color = l.kind === "lta" ? "#facc15" : "#a855f7";
      const s = chart.addSeries(LineSeries, { color, lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: l.kind.toUpperCase() });
      s.setData(candles.map((c) => ({ time: c.time as Time, value: lineValueAt(l, c.time) })));
      lineSeriesRef.current.push(s);
    }
  }, [trendlines, candles, showLines]);

  // Markers
  useEffect(() => {
    if (!markersRef.current) return;
    const m: SeriesMarker<Time>[] = signals.filter((s) => s.result === "PENDING").map((s) => {
      const c = candles.find((x) => x.time === s.time);
      if (!c) return null;
      const range = Math.max(c.high - c.low, Math.abs(c.close) * 0.001);
      const isCall = s.direction === "UP";
      return {
        id: s.id,
        time: s.time as Time,
        position: isCall ? "atPriceBottom" : "atPriceTop",
        price: isCall ? c.low - range * 1.35 : c.high + range * 1.35,
        color: isCall ? "#02c076" : "#f6465d",
        shape: isCall ? "arrowUp" : "arrowDown",
        text: `${isCall ? "CALL" : "PUT"}`,
        size: 2,
      } as SeriesMarker<Time>;
    }).filter(Boolean) as SeriesMarker<Time>[];
    markersRef.current.setMarkers(m);
  }, [signals, candles]);

  const last = candles[candles.length - 1];
  const closed = signals.filter((s) => s.result !== "PENDING");
  const wins = signals.filter((s) => s.result === "WIN").length;
  const acc = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Pro Whale+</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Identificação automática de suporte/resistência e LTA/LTB. Sinal é gerado apenas no <span className="text-primary font-bold">toque</span> de uma região e apurado na próxima vela.
        </p>
      </div>

      <div className="flex gap-2">
        <select value={pair} onChange={(e) => setPair(e.target.value)} className="flex-1 rounded-lg binance-panel px-3 py-2 text-sm">
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} className="rounded-lg binance-panel px-3 py-2 text-sm">
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="binance-panel rounded-lg p-3 flex flex-col gap-2">
        <Toggle label="Suporte/Resistência automáticos" value={showSR} onChange={setShowSR} />
        <Toggle label="LTA / LTB automáticos" value={showLines} onChange={setShowLines} />
      </div>

      <div ref={containerRef} className="h-[420px] w-full rounded-lg binance-panel overflow-hidden" />

      <div className="grid grid-cols-3 gap-2">
        <Card label="Preço" value={last ? last.close.toFixed(2) : "—"} />
        <Card label="Zonas" value={`${zones.length}`} sub={`${trendlines.length} linhas`} />
        <Card label="Assertividade" value={`${acc}%`} positive={acc >= 60} />
      </div>

      <div className="flex flex-col items-center mt-2">
        <button
          onClick={() => setActive((a) => !a)}
          className={`relative grid h-28 w-28 place-items-center rounded-full text-4xl transition ${active ? "animate-whale-pulse bg-primary/15 neon-border text-primary" : "binance-panel hover:border-primary/60"}`}
        >
          <Sparkles className="h-10 w-10" />
        </button>
        <span className="mt-3 text-sm uppercase tracking-widest opacity-80">{active ? "Pro Whale+ ativo" : "Toque para iniciar"}</span>
      </div>

      {signals.length > 0 && (
        <div className="binance-panel rounded-lg p-3 max-h-72 overflow-auto">
          <div className="text-xs uppercase opacity-60 mb-2">Sinais Pro Whale+</div>
          <div className="flex flex-col gap-1">
            {signals.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-xs px-2 py-1.5 rounded border border-border">
                <div className="min-w-0">
                  <div className="font-bold">{s.direction === "UP" ? "CALL" : "PUT"}</div>
                  <div className="opacity-60 truncate">{s.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={s.result === "WIN" ? "text-[color:var(--win)] font-bold" : s.result === "LOSS" ? "text-[color:var(--loss)] font-bold" : "text-primary"}>{s.result}</div>
                  <div className="opacity-60">{new Date(s.time * 1000).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between gap-2 text-left px-1">
      <span className="text-sm">{label}</span>
      <span className={`relative inline-block h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Card({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="binance-panel rounded-lg p-3">
      <div className="text-[10px] uppercase opacity-60">{label}</div>
      <div className={`font-display text-lg font-bold mt-1 ${positive === undefined ? "" : positive ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{value}</div>
      {sub && <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}
