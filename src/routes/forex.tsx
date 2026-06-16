import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Time, SeriesMarker } from "lightweight-charts";
import { Chart } from "@/components/Chart";
import { FIAT_PAIRS, TIMEFRAMES, fetchKlines, subscribeKline, tfSeconds } from "@/lib/binance";
import type { Candle } from "@/lib/types";
import { useStore } from "@/lib/store";
import { detectCrossings, computeAll } from "@/lib/indicators";
import { signalDecision, readIndicatorDirection } from "@/lib/useSignalEngine";
import { Banknote, TrendingUp, TrendingDown } from "lucide-react";
import { pushPopup } from "@/components/Popup";

export const Route = createFileRoute("/forex")({
  head: () => ({ meta: [{ title: "Moedas Fiduciárias — Whale Tracker AI" }] }),
  component: ForexPage,
});

interface FSig {
  id: string;
  pair: string;
  signalTime: number;
  entryTime: number;
  direction: "UP" | "DOWN";
  confidence: number;
  entryPrice?: number;
  result: "PENDING" | "WIN" | "LOSS";
}

function ForexPage() {
  const config = useStore((s) => s.config);
  const [pair, setPair] = useState(FIAT_PAIRS[0]);
  const [tf, setTf] = useState("5m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<FSig[]>([]);
  const [active, setActive] = useState(false);
  const tfSec = tfSeconds(tf);

  useEffect(() => {
    let alive = true;
    fetchKlines(pair, tf, 300).then((c) => { if (alive) setCandles(c); }).catch(() => {
      pushPopup({ variant: "canceled", title: "Par indisponível", message: `${pair} sem dados em ${tf}.` });
    });
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

  // Engine adapted from main: MA+MACD => 80, +Stoch => 99
  useEffect(() => {
    if (!active || candles.length < 30) return;
    const live = candles[candles.length - 1];
    setSignals((prev) => prev.map((s) => {
      if (s.result !== "PENDING") return s;
      const ent = candles.find((c) => c.time === s.entryTime);
      if (ent && s.entryPrice === undefined) return { ...s, entryPrice: ent.open };
      const idx = candles.findIndex((c) => c.time === s.entryTime);
      if (idx >= 0 && idx < candles.length - 1) {
        const ep = s.entryPrice ?? ent!.open;
        const win = s.direction === "UP" ? ent!.close > ep : ent!.close < ep;
        pushPopup({ variant: win ? "win" : "loss", title: win ? "Forex WIN" : "Forex LOSS", message: `${s.pair} · ${s.direction === "UP" ? "CALL" : "PUT"}` });
        return { ...s, result: win ? "WIN" : "LOSS" };
      }
      return s;
    }));
    const pending = signals.some((s) => s.result === "PENDING");
    if (pending) return;
    const cr = detectCrossings(candles, config.indicators);
    const snap = computeAll(candles, config.indicators);
    const dirs = readIndicatorDirection(snap, candles.length - 1);
    const dec = signalDecision(cr, dirs, {
      allow80: config.proceduralveo4.allow80,
      allow99: config.proceduralveo4.allow99,
      veo5Enabled: config.proceduralveo5.enabled,
      veo5: { requireMA: config.proceduralveo5.requireMA, requireMACD: config.proceduralveo5.requireMACD, requireStochRSI: config.proceduralveo5.requireStochRSI },
    });
    if (dec) {
      const sig: FSig = {
        id: `${Date.now()}`,
        pair, signalTime: live.time, entryTime: live.time + tfSec,
        direction: dec.direction, confidence: dec.confidence, result: "PENDING",
      };
      setSignals((p) => [sig, ...p].slice(0, 50));
      pushPopup({ variant: "signal", title: `Forex Sinal ${dec.direction === "UP" ? "CALL" : "PUT"} (${dec.confidence}%)`, message: `${pair} · ${tf}` });
    }
  }, [candles, active, config, pair, tf, tfSec, signals]);

  const markers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!candles.length) return [];
    return signals.filter((s) => s.result === "PENDING" && s.pair === pair).map((s) => {
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
        text: `${isCall ? "CALL" : "PUT"} ${s.confidence}%`,
        size: 2,
      } as SeriesMarker<Time>;
    }).filter(Boolean) as SeriesMarker<Time>[];
  }, [signals, candles, pair]);

  const last = candles[candles.length - 1];
  const closed = signals.filter((s) => s.result !== "PENDING");
  const wins = signals.filter((s) => s.result === "WIN").length;
  const acc = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Moedas Fiduciárias</h1>
        </div>
        <p className="text-xs text-muted-foreground">EUR, GBP, AUD e outras moedas fiat contra stablecoins. Mesmo motor de sinais profissional.</p>
      </div>

      <div className="flex gap-2">
        <select value={pair} onChange={(e) => setPair(e.target.value)} className="flex-1 rounded-lg binance-panel px-3 py-2 text-sm">
          {FIAT_PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} className="rounded-lg binance-panel px-3 py-2 text-sm">
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <Chart candles={candles} markers={markers} />

      <div className="grid grid-cols-3 gap-2">
        <Card label="Preço" value={last ? last.close.toFixed(4) : "—"} />
        <Card label="Assertividade" value={`${acc}%`} positive={acc >= 60} />
        <Card label="Sinais" value={`${signals.length}`} />
      </div>

      <div className="flex flex-col items-center mt-2">
        <button
          onClick={() => setActive((a) => !a)}
          className={`relative grid h-28 w-28 place-items-center rounded-full text-4xl transition ${active ? "animate-whale-pulse bg-primary/15 neon-border text-primary" : "binance-panel hover:border-primary/60"}`}
        >
          💶
        </button>
        <span className="mt-3 text-sm uppercase tracking-widest opacity-80">{active ? "Forex rastreando" : "Toque para iniciar"}</span>
      </div>

      {signals.length > 0 && (
        <div className="binance-panel rounded-lg p-3 max-h-72 overflow-auto">
          <div className="text-xs uppercase opacity-60 mb-2">Sinais Forex</div>
          <div className="flex flex-col gap-1">
            {signals.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border">
                <span className="flex items-center gap-2">
                  {s.direction === "UP" ? <TrendingUp className="h-3.5 w-3.5 text-[color:var(--win)]" /> : <TrendingDown className="h-3.5 w-3.5 text-[color:var(--loss)]" />}
                  {s.pair} · {s.direction === "UP" ? "CALL" : "PUT"} {s.confidence}%
                </span>
                <span className="opacity-60">{new Date(s.signalTime * 1000).toLocaleTimeString()}</span>
                <span className={s.result === "WIN" ? "text-[color:var(--win)] font-bold" : s.result === "LOSS" ? "text-[color:var(--loss)] font-bold" : "text-primary"}>{s.result}</span>
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