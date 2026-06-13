import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Time, SeriesMarker } from "lightweight-charts";
import { Chart } from "@/components/Chart";
import { fetchKlines, subscribeKline, tfSeconds, PAIRS, TIMEFRAMES } from "@/lib/binance";
import { computeAll, detectCrossings } from "@/lib/indicators";
import type { Candle, Signal } from "@/lib/types";
import { useStore } from "@/lib/store";
import { pushPopup } from "@/components/Popup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whale Tracker AI — Dashboard" },
      { name: "description", content: "Monitor de baleias e sinais cripto em tempo real." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { config, setConfig, whaleActive, toggleWhale, addSignal, updateSignal, history } = useStore();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [cross, setCross] = useState<{ ma: "UP" | "DOWN" | null; macd: "UP" | "DOWN" | null; stoch: "UP" | "DOWN" | null }>({ ma: null, macd: null, stoch: null });
  const activeRef = useRef<Signal | null>(null);
  const proceduralRanRef = useRef<Set<string>>(new Set());
  const lastClosedTimeRef = useRef<number>(0);

  // Re-load candles on pair/tf change
  useEffect(() => {
    let alive = true;
    fetchKlines(config.pair, config.timeframe).then((c) => {
      if (alive) setCandles(c);
    });
    setMarkers([]);
    activeRef.current = null;
    return () => {
      alive = false;
    };
  }, [config.pair, config.timeframe]);

  // WebSocket stream
  useEffect(() => {
    const unsub = subscribeKline(config.pair, config.timeframe, ({ candle, closed }) => {
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (candle.time === last.time) {
          const next = prev.slice(0, -1);
          next.push(candle);
          return next;
        }
        if (candle.time > last.time) return [...prev.slice(-499), candle];
        return prev;
      });
      if (closed) lastClosedTimeRef.current = candle.time;
    });
    return unsub;
  }, [config.pair, config.timeframe]);

  // Signal engine
  useEffect(() => {
    if (candles.length < 30) return;
    const tfSec = tfSeconds(config.timeframe);
    const last = candles[candles.length - 1];
    const snapshot = computeAll(candles, config.indicators);
    setCross(readIndicatorDirection(snapshot, candles.length - 1));
    if (!whaleActive) return;
    let active = activeRef.current;

    if (active?.entryCandleStart) {
      const entryCandle = candles.find((c) => c.time === active?.entryCandleStart);
      if (entryCandle && !active.startedAt) {
        const patch: Partial<Signal> = { entryPrice: entryCandle.open, startedAt: Date.now() };
        active = { ...active, ...patch };
        activeRef.current = active;
        updateSignal(active.id, patch);
        pushPopup({
          variant: "started",
          title: "Vela iniciada",
          message: `Entrada ${active.direction === "UP" ? "CALL" : "PUT"} • ${active.pair} ${active.timeframe}`,
        });
      }
    }

    if (active?.entryCandleStart && active.startedAt && active.result === "PENDING") {
      const entryCandle = candles.find((c) => c.time === active?.entryCandleStart);
      const remaining = active.entryCandleStart + tfSec - Math.floor(Date.now() / 1000);
      const procKey = `proc-${active.id}`;
      if (entryCandle && remaining <= config.procedural.seconds && remaining > 0 && !proceduralRanRef.current.has(procKey)) {
        proceduralRanRef.current.add(procKey);
        const cr = detectCrossings(candles, config.indicators);
        const checks: ("UP" | "DOWN" | null)[] = [];
        if (config.procedural.checkMA) checks.push(cr.ma);
        if (config.procedural.checkMACD) checks.push(cr.macd);
        if (config.procedural.checkStochRSI) checks.push(cr.stoch);
        const recoil = checks.some((d) => d && d !== active.direction);
        if (recoil) {
          updateSignal(active.id, { result: "CANCELED", closedAt: Date.now() });
          activeRef.current = null;
          active = null;
          pushPopup({
            variant: "canceled",
            title: "Proceduralveo3 — Análise Cancelada",
            message: "Recuo detectado antes do fechamento.",
          });
        } else {
          const patch: Partial<Signal> = { proceduralConfirmedAt: Date.now() };
          active = { ...active, ...patch };
          activeRef.current = active;
          updateSignal(active.id, patch);
          pushPopup({
            variant: "info",
            title: "Proceduralveo3 Confirmado",
            message: "Sem recuo nos indicadores selecionados.",
          });
        }
      }
    }

    if (active?.entryCandleStart && lastClosedTimeRef.current === active.entryCandleStart) {
      const closedCandle = candles.find((c) => c.time === active?.entryCandleStart);
      if (closedCandle) {
        const entryPrice = Number.isFinite(active.entryPrice) ? active.entryPrice : closedCandle.open;
        const win = active.direction === "UP" ? closedCandle.close > entryPrice : closedCandle.close < entryPrice;
        const result = win ? "WIN" : "LOSS";
        updateSignal(active.id, { result, entryPrice, exitPrice: closedCandle.close, closedAt: Date.now() });
        pushPopup({
          variant: win ? "win" : "loss",
          title: win ? "WIN ✓" : "LOSS ✗",
          message: `${active.pair} • ${active.direction === "UP" ? "CALL" : "PUT"}`,
        });
        activeRef.current = null;
        active = null;
      }
    }

    const closedTime = lastClosedTimeRef.current;
    const closedCandle = candles.find((c) => c.time === closedTime);
    const closedKey = `${config.pair}-${config.timeframe}-${closedTime}`;
    if (!activeRef.current && closedCandle && !proceduralRanRef.current.has(`gen-${closedKey}`)) {
      proceduralRanRef.current.add(`gen-${closedKey}`);
      const detectionCandles = candles.filter((c) => c.time <= closedTime);
      const cr = detectCrossings(detectionCandles, config.indicators);
      const closedSnapshot = computeAll(detectionCandles, config.indicators);
      const decision = signalDecision(cr, readIndicatorDirection(closedSnapshot, detectionCandles.length - 1));
      if (decision) {
        const entryCandleStart = closedCandle.time + tfSec;
        const entryCandle = candles.find((c) => c.time === entryCandleStart);
        const sig: Signal = {
          id: `${Date.now()}`,
          pair: config.pair,
          timeframe: config.timeframe,
          direction: decision.direction,
          confidence: decision.confidence,
          signalCandleStart: closedCandle.time,
          entryCandleStart,
          entryPrice: entryCandle?.open ?? Number.NaN,
          result: "PENDING",
          createdAt: Date.now(),
        };
        activeRef.current = sig;
        addSignal(sig);
        setMarkers((prevMarkers) => [
          ...prevMarkers,
          signalMarker(sig, closedCandle),
        ].slice(-80));
        pushPopup({
          variant: "signal",
          title: `Sinal Gerado — ${sig.direction === "UP" ? "CALL" : "PUT"} (${sig.confidence}%)`,
          message: `${sig.pair} • ${sig.timeframe} • entrada na próxima vela`,
        });
      }
    }
  }, [candles, whaleActive, config, addSignal, updateSignal]);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  const stats = useMemo(() => {
    const closed = history.filter((h) => h.result === "WIN" || h.result === "LOSS");
    const wins = history.filter((h) => h.result === "WIN").length;
    const acc = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    return { wins, losses: closed.length - wins, acc };
  }, [history]);

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex gap-2">
        <select
          value={config.pair}
          onChange={(e) => setConfig({ pair: e.target.value })}
          className="flex-1 rounded-xl glass-card px-3 py-2 text-sm font-medium"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={config.timeframe}
          onChange={(e) => setConfig({ timeframe: e.target.value })}
          className="rounded-xl glass-card px-3 py-2 text-sm font-medium"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <Chart candles={candles} markers={markers} />

      <div className="grid grid-cols-2 gap-2">
        <IndicatorCard label="Preço" value={last ? last.close.toFixed(2) : "—"} sub={`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`} positive={change >= 0} />
        <IndicatorCard label="Assertividade" value={`${stats.acc}%`} sub={`${stats.wins}W / ${stats.losses}L`} positive={stats.acc >= 60} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CrossCard
          label="MA"
          sub={`${config.indicators.ma.short}/${config.indicators.ma.mid}/${config.indicators.ma.long}`}
          dir={cross.ma}
          color={config.indicators.ma.colorMid}
        />
        <CrossCard
          label="MACD"
          sub={`${config.indicators.macd.fast}/${config.indicators.macd.slow}/${config.indicators.macd.signal}`}
          dir={cross.macd}
          color={config.indicators.macd.color}
        />
        <CrossCard
          label="StochRSI"
          sub={`${config.indicators.stochRsi.rsiP}/${config.indicators.stochRsi.stochP}`}
          dir={cross.stoch}
          color={config.indicators.stochRsi.color}
        />
      </div>

      <div className="flex flex-col items-center mt-4">
        <button
          onClick={toggleWhale}
          className={`relative grid h-32 w-32 place-items-center rounded-full text-5xl transition ${
            whaleActive ? "animate-whale-pulse bg-gradient-to-br from-cyan-400/30 to-cyan-700/20 neon-border" : "glass-card"
          }`}
          aria-label="Ativar Baleia"
        >
          🐋
        </button>
        <span className="mt-3 font-display text-sm tracking-widest uppercase opacity-80">
          {whaleActive ? "Baleia rastreando" : "Toque para iniciar"}
        </span>
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="glass-card rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
      <div className={`text-xs mt-0.5 ${positive ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{sub}</div>
    </div>
  );
}

function CrossCard({ label, sub, dir, color }: { label: string; sub: string; dir: "UP" | "DOWN" | null; color: string }) {
  const value = dir === "UP" ? "ALTA" : dir === "DOWN" ? "BAIXA" : "—";
  const cls = dir === "UP" ? "text-[color:var(--win)]" : dir === "DOWN" ? "text-[color:var(--loss)]" : "opacity-60";
  return (
    <div className="glass-card rounded-2xl p-3 border-l-2" style={{ borderLeftColor: color }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className={`font-display text-lg font-bold mt-1 ${cls}`}>
        {dir === "UP" ? "▲ " : dir === "DOWN" ? "▼ " : ""}{value}
      </div>
      <div className="text-[10px] mt-0.5 opacity-60">{sub}</div>
    </div>
  );
}
