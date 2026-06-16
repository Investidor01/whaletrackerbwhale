import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Time, SeriesMarker } from "lightweight-charts";
import { Chart } from "@/components/Chart";
import { IndicatorChart, type IndicatorLine } from "@/components/IndicatorChart";
import { PAIRS, TIMEFRAMES, fetchKlines, subscribeKline, tfSeconds } from "@/lib/binance";
import type { Candle } from "@/lib/types";
import { computeWhalePlus, whalePlusSignal, defaultWhalePlus, type WhalePlusConfig } from "@/lib/whaleplus";
import { pushPopup } from "@/components/Popup";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/whale-plus")({
  head: () => ({ meta: [{ title: "Dashboard Whale+ — EMA · VWAP · RSI" }] }),
  component: WhalePlus,
});

interface WPSignal {
  id: string;
  signalTime: number;
  entryTime: number;
  direction: "UP" | "DOWN";
  entryPrice?: number;
  exitPrice?: number;
  result: "PENDING" | "WIN" | "LOSS";
  reason: string[];
}

function WhalePlus() {
  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("1m");
  const [cfg, setCfg] = useState<WhalePlusConfig>(defaultWhalePlus);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<WPSignal[]>([]);
  const [active, setActive] = useState(false);
  const lastSignalCandleRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    fetchKlines(pair, tf, 300).then((c) => { if (alive) setCandles(c); });
    return () => { alive = false; };
  }, [pair, tf]);

  useEffect(() => {
    const unsub = subscribeKline(pair, tf, ({ candle }) => {
      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (candle.time === last.time) return [...prev.slice(0, -1), candle];
        if (candle.time > last.time) return [...prev.slice(-299), candle];
        return prev;
      });
    });
    return unsub;
  }, [pair, tf]);

  const snap = useMemo(() => candles.length ? computeWhalePlus(candles, cfg) : null, [candles, cfg]);
  const tfSec = tfSeconds(tf);

  // Signal detection & lifecycle
  useEffect(() => {
    if (!active || !snap || candles.length < 30) return;
    const i = candles.length - 1;
    const live = candles[i];

    // 1. Update pending signals
    setSignals((prev) => prev.map((s) => {
      if (s.result !== "PENDING") return s;
      const entryCandle = candles.find((c) => c.time === s.entryTime);
      if (entryCandle && s.entryPrice === undefined) {
        return { ...s, entryPrice: entryCandle.open };
      }
      // resolution: entry candle closed (next candle exists)
      const nextIdx = candles.findIndex((c) => c.time === s.entryTime);
      if (nextIdx >= 0 && nextIdx < candles.length - 1) {
        const ep = s.entryPrice ?? entryCandle?.open ?? live.close;
        const ec = entryCandle!.close;
        const win = s.direction === "UP" ? ec > ep : ec < ep;
        pushPopup({ variant: win ? "win" : "loss", title: win ? "Whale+ WIN" : "Whale+ LOSS", message: `${pair} · ${s.direction === "UP" ? "CALL" : "PUT"}` });
        return { ...s, exitPrice: ec, result: win ? "WIN" : "LOSS" };
      }
      return s;
    }));

    // 2. Generate new signal only if no pending and didn't already use this candle
    const hasPending = signals.some((s) => s.result === "PENDING");
    if (hasPending) return;
    if (lastSignalCandleRef.current === live.time) return;
    const det = whalePlusSignal(candles, snap, cfg, i);
    if (det) {
      lastSignalCandleRef.current = live.time;
      const entryTime = live.time + tfSec;
      const sig: WPSignal = {
        id: `${Date.now()}`,
        signalTime: live.time,
        entryTime,
        direction: det.direction,
        result: "PENDING",
        reason: det.reason,
      };
      setSignals((p) => [sig, ...p].slice(0, 50));
      pushPopup({
        variant: "signal",
        title: `Whale+ Sinal ${det.direction === "UP" ? "CALL" : "PUT"}`,
        message: det.reason.join(" · "),
      });
    }
  }, [candles, snap, active, cfg, pair, tfSec, signals]);

  const markers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!candles.length) return [];
    return signals.filter((s) => s.result === "PENDING").map((s) => {
      const c = candles.find((x) => x.time === s.signalTime);
      if (!c) return null;
      const range = Math.max(c.high - c.low, Math.abs(c.close) * 0.001);
      const isCall = s.direction === "UP";
      return {
        id: s.id,
        time: s.signalTime as Time,
        position: isCall ? "atPriceBottom" : "atPriceTop",
        price: isCall ? c.low - range * 1.35 : c.high + range * 1.35,
        color: isCall ? "#02c076" : "#f6465d",
        shape: isCall ? "arrowUp" : "arrowDown",
        text: `${isCall ? "CALL" : "PUT"} Whale+`,
        size: 2,
      } as SeriesMarker<Time>;
    }).filter(Boolean) as SeriesMarker<Time>[];
  }, [signals, candles]);

  const lines = useMemo<{ price: IndicatorLine[]; rsi: IndicatorLine[] } | null>(() => {
    if (!snap) return null;
    const map = (arr: (number | null)[], color: string, name: string): IndicatorLine => ({
      name, color,
      data: candles.map((c, i) => {
        const v = arr[i];
        return v == null || !Number.isFinite(v) ? null : { time: c.time, value: v as number };
      }).filter(Boolean) as { time: number; value: number }[],
    });
    return {
      price: [map(snap.ema, "#f0b90b", `EMA${cfg.emaPeriod}`), map(snap.vwap, "#02c076", "VWAP")],
      rsi: [map(snap.rsi, "#7a5cff", `RSI${cfg.rsiPeriod}`)],
    };
  }, [snap, candles, cfg.emaPeriod, cfg.rsiPeriod]);

  const last = candles[candles.length - 1];
  const closed = signals.filter((s) => s.result !== "PENDING");
  const wins = signals.filter((s) => s.result === "WIN").length;
  const acc = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Dashboard Whale+</h1>
        </div>
        <p className="text-xs text-muted-foreground">Tendência (EMA) + Volume (VWAP) + Momentum (RSI). Sinal só dispara quando os 3 alinham.</p>
      </div>

      <div className="flex gap-2">
        <select value={pair} onChange={(e) => setPair(e.target.value)} className="flex-1 rounded-lg binance-panel px-3 py-2 text-sm">
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} className="rounded-lg binance-panel px-3 py-2 text-sm">
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <Chart candles={candles} markers={markers} />

      {lines && (
        <>
          <div className="binance-panel rounded-lg p-3">
            <div className="mb-2 text-xs uppercase opacity-60">EMA · VWAP</div>
            <IndicatorChart lines={lines.price} height={140} />
          </div>
          <div className="binance-panel rounded-lg p-3">
            <div className="mb-2 text-xs uppercase opacity-60">RSI</div>
            <IndicatorChart lines={lines.rsi} height={120} />
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card label="Preço" value={last ? last.close.toFixed(2) : "—"} />
        <Card label="Assertividade" value={`${acc}%`} positive={acc >= 60} />
        <Card label="Sinais" value={`${signals.length}`} />
      </div>

      <div className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div className="text-xs uppercase opacity-60">Configurações Whale+</div>
        <NumField label="EMA Período" value={cfg.emaPeriod} onChange={(v) => setCfg({ ...cfg, emaPeriod: v })} />
        <NumField label="RSI Período" value={cfg.rsiPeriod} onChange={(v) => setCfg({ ...cfg, rsiPeriod: v })} />
        <NumField label="Sobrevenda" value={cfg.rsiOversold} onChange={(v) => setCfg({ ...cfg, rsiOversold: v })} />
        <NumField label="Sobrecompra" value={cfg.rsiOverbought} onChange={(v) => setCfg({ ...cfg, rsiOverbought: v })} />
        <NumField label="Vol Média (períodos)" value={cfg.volumeAvg} onChange={(v) => setCfg({ ...cfg, volumeAvg: v })} />
        <NumField label="Vol Fator mínimo" value={cfg.volumeFactor} step={0.1} onChange={(v) => setCfg({ ...cfg, volumeFactor: v })} />
      </div>

      <div className="flex flex-col items-center mt-2">
        <button
          onClick={() => setActive((a) => !a)}
          className={`relative grid h-28 w-28 place-items-center rounded-full text-4xl transition ${active ? "animate-whale-pulse bg-primary/15 neon-border text-primary" : "binance-panel hover:border-primary/60"}`}
        >
          🐋+
        </button>
        <span className="mt-3 text-sm uppercase tracking-widest opacity-80">{active ? "Whale+ rastreando" : "Toque para iniciar"}</span>
      </div>

      {signals.length > 0 && (
        <div className="binance-panel rounded-lg p-3 max-h-72 overflow-auto">
          <div className="text-xs uppercase opacity-60 mb-2">Sinais Whale+</div>
          <div className="flex flex-col gap-1">
            {signals.map((s) => (
              <div key={s.id} className="flex flex-col gap-0.5 px-2 py-2 rounded border border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    {s.direction === "UP" ? <TrendingUp className="h-3.5 w-3.5 text-[color:var(--win)]" /> : <TrendingDown className="h-3.5 w-3.5 text-[color:var(--loss)]" />}
                    {s.direction === "UP" ? "CALL" : "PUT"}
                  </span>
                  <span className="opacity-60">{new Date(s.signalTime * 1000).toLocaleTimeString()}</span>
                  <span className={s.result === "WIN" ? "text-[color:var(--win)] font-bold" : s.result === "LOSS" ? "text-[color:var(--loss)] font-bold" : "text-primary"}>{s.result}</span>
                </div>
                <div className="text-[10px] opacity-60">{s.reason.join(" · ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="binance-panel rounded-lg p-3">
      <div className="text-[10px] uppercase opacity-60">{label}</div>
      <div className={`font-display text-lg font-bold mt-1 ${positive === undefined ? "" : positive ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{value}</div>
    </div>
  );
}

function NumField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between text-xs gap-3">
      <span className="opacity-70">{label}</span>
      <input type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-24 rounded-lg bg-card border border-border px-2 py-1 text-sm text-right" />
    </label>
  );
}