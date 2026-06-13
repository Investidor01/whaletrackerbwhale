import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Time, SeriesMarker } from "lightweight-charts";
import { Chart } from "@/components/Chart";
import { fetchKlines, subscribeKline, tfSeconds, PAIRS, TIMEFRAMES } from "@/lib/binance";
import { computeAll, detectCrossings, type CrossResult, type IndicatorSnapshot } from "@/lib/indicators";
import type { Candle, Direction, Signal } from "@/lib/types";
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
      const current = active;
      const entryStart = current.entryCandleStart;
      if (!entryStart) return;
      const entryCandle = candles.find((c) => c.time === entryStart);
      const remaining = entryStart + tfSec - Math.floor(Date.now() / 1000);
      const procKey = `proc-${current.id}`;
      if (entryCandle && remaining <= config.procedural.seconds && remaining > 0 && !proceduralRanRef.current.has(procKey)) {
        proceduralRanRef.current.add(procKey);
        const cr = detectCrossings(candles, config.indicators);
        const checks: ("UP" | "DOWN" | null)[] = [];
        if (config.procedural.checkMA) checks.push(cr.ma);
        if (config.procedural.checkMACD) checks.push(cr.macd);
        if (config.procedural.checkStochRSI) checks.push(cr.stoch);
        const recoil = checks.some((d) => d && d !== current.direction);
        if (recoil) {
          updateSignal(current.id, { result: "CANCELED", closedAt: Date.now() });
          activeRef.current = null;
          active = null;
          pushPopup({
            variant: "canceled",
            title: "Proceduralveo3 — Análise Cancelada",
            message: "Recuo detectado antes do fechamento.",
          });
        } else {
          const patch: Partial<Signal> = { proceduralConfirmedAt: Date.now() };
          active = { ...current, ...patch };
          activeRef.current = active;
          updateSignal(current.id, patch);
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

  const lineValues = useMemo(() => {
    if (!candles.length) return null;
    const s = computeAll(candles, config.indicators);
    const i = candles.length - 1;
    return {
      ma: [
        { name: `MA${config.indicators.ma.short}`, value: s.maShort[i], color: config.indicators.ma.colorShort },
        { name: `MA${config.indicators.ma.mid}`, value: s.maMid[i], color: config.indicators.ma.colorMid },
        { name: `MA${config.indicators.ma.long}`, value: s.maLong[i], color: config.indicators.ma.colorLong },
      ],
      macd: [
        { name: "MACD", value: s.macdLine[i], color: config.indicators.macd.colorLine },
        { name: "Signal", value: s.macdSig[i], color: config.indicators.macd.colorSignal },
      ],
      stoch: [
        { name: "%K", value: s.stochK[i], color: config.indicators.stochRsi.colorK },
        { name: "%D", value: s.stochD[i], color: config.indicators.stochRsi.colorD },
      ],
    };
  }, [candles, config.indicators]);

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Spot Signal</div>
            <div className="font-display text-2xl font-bold text-primary">{config.pair}</div>
          </div>
          <div className="text-right">
            <div className={`font-display text-2xl font-bold ${change >= 0 ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{last ? last.close.toFixed(2) : "—"}</div>
            <div className={`text-xs ${change >= 0 ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <select
          value={config.pair}
          onChange={(e) => setConfig({ pair: e.target.value })}
          className="flex-1 rounded-lg binance-panel px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
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
          className="rounded-lg binance-panel px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
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
      {lineValues ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <LineCard title="Médias Móveis" dir={cross.ma} rows={lineValues.ma} />
          <LineCard title="MACD" dir={cross.macd} rows={lineValues.macd} />
          <LineCard title="RSI Estocástico" dir={cross.stoch} rows={lineValues.stoch} />
        </div>
      ) : null}
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
          color={config.indicators.macd.colorLine}
        />
        <CrossCard
          label="StochRSI"
          sub={`${config.indicators.stochRsi.rsiP}/${config.indicators.stochRsi.stochP}`}
          dir={cross.stoch}
          color={config.indicators.stochRsi.colorK}
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
    <div className="binance-panel rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
      <div className={`text-xs mt-0.5 ${positive ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{sub}</div>
    </div>
  );
}

function LineCard({ title, dir, rows }: { title: string; dir: "UP" | "DOWN" | null; rows: { name: string; value: number | null; color: string }[] }) {
  const label = dir === "UP" ? "Cruzamento CALL" : dir === "DOWN" ? "Cruzamento PUT" : "Aguardando";
  return (
    <div className="binance-panel rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-display text-sm font-bold">{title}</div>
        <div className={`text-[10px] font-bold uppercase ${dir === "UP" ? "text-[color:var(--win)]" : dir === "DOWN" ? "text-[color:var(--loss)]" : "text-muted-foreground"}`}>{label}</div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color, boxShadow: `0 0 12px ${row.color}` }} />
            <span className="text-muted-foreground">{row.name}</span>
            <span className="font-display font-bold">{formatLineValue(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLineValue(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : Math.abs(value) < 1 ? value.toFixed(5) : value.toFixed(2);
}

function readIndicatorDirection(snapshot: IndicatorSnapshot, index: number): CrossResult {
  const maBlend = (snapshot.maShort[index] + snapshot.maMid[index]) / 2;
  const ma = isFinite(maBlend) && isFinite(snapshot.maLong[index])
    ? maBlend > snapshot.maLong[index] ? "UP" : "DOWN"
    : null;
  const macdLine = snapshot.macdLine[index];
  const macdSig = snapshot.macdSig[index];
  const macd = macdLine !== null && macdSig !== null ? macdLine > macdSig ? "UP" : "DOWN" : null;
  const stochK = snapshot.stochK[index];
  const stochD = snapshot.stochD[index];
  const stoch = stochK !== null && stochD !== null ? stochK > stochD ? "UP" : "DOWN" : null;
  return { ma, macd, stoch };
}

function signalDecision(cross: CrossResult, directions: CrossResult): { direction: Direction; confidence: number } | null {
  const crossedDirections = [cross.ma, cross.macd, cross.stoch].filter(Boolean) as Direction[];
  for (const direction of ["UP", "DOWN"] as const) {
    if (!crossedDirections.includes(direction)) continue;
    const confirmations = [directions.ma, directions.macd, directions.stoch].filter((d) => d === direction).length;
    if (confirmations >= 3) return { direction, confidence: 99 };
    if (confirmations >= 2) return { direction, confidence: 80 };
  }
  return null;
}

function signalMarker(signal: Signal, candle: Candle): SeriesMarker<Time> {
  const range = Math.max(candle.high - candle.low, Math.abs(candle.close) * 0.001);
  const isCall = signal.direction === "UP";
  return {
    id: signal.id,
    time: signal.signalCandleStart as Time,
    position: isCall ? "atPriceBottom" : "atPriceTop",
    price: isCall ? candle.low - range * 1.35 : candle.high + range * 1.35,
    color: isCall ? "#02c076" : "#f6465d",
    shape: isCall ? "arrowUp" : "arrowDown",
    text: `${isCall ? "CALL" : "PUT"} ${signal.confidence}%`,
    size: 2,
  };
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
