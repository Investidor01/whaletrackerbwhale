import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Time, SeriesMarker } from "lightweight-charts";
import { Chart } from "@/components/Chart";
import { IndicatorChart, type IndicatorLine } from "@/components/IndicatorChart";
import { PAIRS, TIMEFRAMES, tfSeconds } from "@/lib/binance";
import { computeAll } from "@/lib/indicators";
import type { Candle, Signal } from "@/lib/types";
import { useStore } from "@/lib/store";

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
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const whaleActive = useStore((s) => s.whaleActive);
  const toggleWhale = useStore((s) => s.toggleWhale);
  const history = useStore((s) => s.history);
  const activeSignalId = useStore((s) => s.activeSignalId);
  const candles = useStore((s) => s.candles);
  const cross = useStore((s) => s.cross);

  const activeSignal = useMemo(
    () => (activeSignalId ? history.find((h) => h.id === activeSignalId) ?? null : null),
    [activeSignalId, history],
  );

  // Markers derived from history (pending only — disappear on win/loss/cancel)
  const markers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!candles.length) return [];
    return history
      .filter((s) => s.pair === config.pair && s.timeframe === config.timeframe && s.result === "PENDING")
      .map((s) => {
        const c = candles.find((x) => x.time === s.signalCandleStart);
        if (!c) return null;
        return signalMarker(s, c);
      })
      .filter(Boolean) as SeriesMarker<Time>[];
  }, [history, candles, config.pair, config.timeframe]);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  const tfSec = tfSeconds(config.timeframe);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 500);
    return () => clearInterval(id);
  }, []);
  const candleRemaining = last ? Math.max(0, last.time + tfSec - now) : 0;
  const mm = String(Math.floor(candleRemaining / 60)).padStart(2, "0");
  const ss = String(candleRemaining % 60).padStart(2, "0");

  const stats = useMemo(() => {
    const closed = history.filter((h) => h.result === "WIN" || h.result === "LOSS");
    const wins = history.filter((h) => h.result === "WIN").length;
    const acc = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    return { wins, losses: closed.length - wins, acc };
  }, [history]);

  const indicatorData = useMemo(() => {
    if (!candles.length) return null;
    const s = computeAll(candles, config.indicators);
    const buildLine = (arr: (number | null | typeof NaN)[], color: string, name: string): IndicatorLine => ({
      name,
      color,
      data: candles
        .map((c, i) => {
          const v = arr[i];
          return v === null || v === undefined || !Number.isFinite(v) ? null : { time: c.time, value: v as number };
        })
        .filter(Boolean) as { time: number; value: number }[],
    });
    return {
      ma: [
        buildLine(s.maShort, config.indicators.ma.colorShort, `MA${config.indicators.ma.short}`),
        buildLine(s.maMid, config.indicators.ma.colorMid, `MA${config.indicators.ma.mid}`),
        buildLine(s.maLong, config.indicators.ma.colorLong, `MA${config.indicators.ma.long}`),
      ],
      macd: [
        buildLine(s.macdLine, config.indicators.macd.colorLine, "MACD"),
        buildLine(s.macdSig, config.indicators.macd.colorSignal, "Signal"),
      ],
      stoch: [
        buildLine(s.stochK, config.indicators.stochRsi.colorK, "%K"),
        buildLine(s.stochD, config.indicators.stochRsi.colorD, "%D"),
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
            <div className="mt-1 text-[10px] uppercase tracking-wider opacity-60">
              Vela <span className="text-primary">{config.timeframe}</span> · termina em{" "}
              <span className="font-mono font-bold text-primary">{mm}:{ss}</span>
            </div>
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
      {indicatorData ? (
        <div className="flex flex-col gap-3">
          <IndicatorPanel title="Médias Móveis" subtitle={`MA ${config.indicators.ma.short}/${config.indicators.ma.mid}/${config.indicators.ma.long}`} lines={indicatorData.ma} />
          <IndicatorPanel title="MACD" subtitle={`${config.indicators.macd.fast}/${config.indicators.macd.slow}/${config.indicators.macd.signal}`} lines={indicatorData.macd} />
          <IndicatorPanel title="RSI Estocástico" subtitle={`${config.indicators.stochRsi.rsiP}/${config.indicators.stochRsi.stochP}/${config.indicators.stochRsi.kP}/${config.indicators.stochRsi.dP}`} lines={indicatorData.stoch} />
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <CrossCard
          label="MA"
          sub={`${config.indicators.ma.short}/${config.indicators.ma.mid}/${config.indicators.ma.long}`}
          dir={cross.ma}
          color={config.indicators.ma.colorMid}
          active={activeSignal}
        />
        <CrossCard
          label="MACD"
          sub={`${config.indicators.macd.fast}/${config.indicators.macd.slow}/${config.indicators.macd.signal}`}
          dir={cross.macd}
          color={config.indicators.macd.colorLine}
          active={activeSignal}
        />
        <CrossCard
          label="StochRSI"
          sub={`${config.indicators.stochRsi.rsiP}/${config.indicators.stochRsi.stochP}`}
          dir={cross.stoch}
          color={config.indicators.stochRsi.colorK}
          active={activeSignal}
        />
      </div>

      <div className="flex flex-col items-center mt-4">
        <button
          onClick={toggleWhale}
          className={`relative grid h-32 w-32 place-items-center rounded-full text-5xl transition ${
            whaleActive ? "animate-whale-pulse bg-primary/15 neon-border text-primary" : "binance-panel hover:border-primary/60"
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

function IndicatorPanel({ title, subtitle, lines }: { title: string; subtitle: string; lines: IndicatorLine[] }) {
  return (
    <div className="binance-panel rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-sm font-bold">{title}</div>
          <div className="text-[10px] uppercase opacity-50">{subtitle}</div>
        </div>
        <div className="flex gap-2">
          {lines.map((l) => (
            <span key={l.name} className="flex items-center gap-1 text-[10px] opacity-80">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color, boxShadow: `0 0 8px ${l.color}` }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>
      <IndicatorChart lines={lines} height={150} />
    </div>
  );
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

function CrossCard({ label, sub, dir, color, active }: { label: string; sub: string; dir: "UP" | "DOWN" | null; color: string; active: Signal | null }) {
  // When a signal is active and Proceduralveo3 already confirmed → all cards show "SINAL ATIVO"
  if (active && active.proceduralConfirmedAt) {
    return (
      <div className="glass-card rounded-2xl p-3 border-l-2" style={{ borderLeftColor: color }}>
        <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
        <div className="font-display text-sm font-bold mt-1 text-primary animate-pulse">SINAL ATIVO</div>
        <div className="text-[10px] mt-0.5 opacity-60">{active.direction === "UP" ? "CALL" : "PUT"} {active.confidence}%</div>
      </div>
    );
  }
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
