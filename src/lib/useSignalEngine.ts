import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { fetchKlines, subscribeKline, tfSeconds } from "./binance";
import { computeAll, detectCrossings, type CrossResult, type IndicatorSnapshot } from "./indicators";
import type { Candle, Direction, Signal } from "./types";
import { pushPopup } from "@/components/Popup";

export function readIndicatorDirection(snapshot: IndicatorSnapshot, index: number): CrossResult {
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

export function signalDecision(cross: CrossResult, directions: CrossResult): { direction: Direction; confidence: number } | null {
  const crossedDirections = [cross.ma, cross.macd, cross.stoch].filter(Boolean) as Direction[];
  for (const direction of ["UP", "DOWN"] as const) {
    if (!crossedDirections.includes(direction)) continue;
    const confirmations = [directions.ma, directions.macd, directions.stoch].filter((d) => d === direction).length;
    if (confirmations >= 3) return { direction, confidence: 99 };
    if (confirmations >= 2) return { direction, confidence: 80 };
  }
  return null;
}

/**
 * Global signal engine. Mount once in the app shell so signals progress
 * (Proceduralveo3, entry, win/loss) regardless of the current route.
 */
export function useSignalEngine() {
  const config = useStore((s) => s.config);
  const whaleActive = useStore((s) => s.whaleActive);
  const candles = useStore((s) => s.candles);
  const activeSignalId = useStore((s) => s.activeSignalId);
  const setCandles = useStore((s) => s.setCandles);
  const setCross = useStore((s) => s.setCross);
  const setActiveSignal = useStore((s) => s.setActiveSignal);
  const addSignal = useStore((s) => s.addSignal);
  const updateSignal = useStore((s) => s.updateSignal);

  const lastClosedTimeRef = useRef<number>(0);

  // Load history candles on pair/tf change
  useEffect(() => {
    let alive = true;
    // If active signal is on a different pair/tf, cancel it so it doesn't dangle
    const st = useStore.getState();
    const a = st.activeSignalId ? st.history.find((h) => h.id === st.activeSignalId) : null;
    if (a && a.result === "PENDING" && (a.pair !== config.pair || a.timeframe !== config.timeframe)) {
      updateSignal(a.id, { result: "CANCELED", closedAt: Date.now(), notifiedResult: true });
      setActiveSignal(null);
    }
    fetchKlines(config.pair, config.timeframe).then((c) => {
      if (alive) setCandles(c);
    });
    return () => {
      alive = false;
    };
  }, [config.pair, config.timeframe, setCandles, updateSignal, setActiveSignal]);

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
  }, [config.pair, config.timeframe, setCandles]);

  // Lifecycle on each candle update
  useEffect(() => {
    if (candles.length < 30) return;
    const tfSec = tfSeconds(config.timeframe);
    const liveCandle = candles[candles.length - 1];
    const snapshot = computeAll(candles, config.indicators);
    const liveDir = readIndicatorDirection(snapshot, candles.length - 1);
    setCross(liveDir);

    const state = useStore.getState();
    const active: Signal | null = state.activeSignalId
      ? state.history.find((h) => h.id === state.activeSignalId) ?? null
      : null;

    // 1. Entry candle started (vela iniciada)
    if (active && active.entryCandleStart && !active.startedAt) {
      const entryCandle = candles.find((c) => c.time === active.entryCandleStart);
      if (entryCandle) {
        updateSignal(active.id, {
          entryPrice: entryCandle.open,
          startedAt: Date.now(),
          notifiedStarted: true,
        });
        if (!active.notifiedStarted) {
          pushPopup({
            variant: "started",
            title: "Vela iniciada",
            message: `Entrada ${active.direction === "UP" ? "CALL" : "PUT"} • ${active.pair} ${active.timeframe}`,
          });
        }
        return; // re-run next tick with fresh active
      }
    }

    // 2. Proceduralveo3 confirmation window
    if (active && active.result === "PENDING" && !active.proceduralConfirmedAt) {
      const remaining = active.signalCandleStart + tfSec - Math.floor(Date.now() / 1000);
      if (remaining <= config.procedural.seconds && remaining > 0) {
        const checks: ("UP" | "DOWN" | null)[] = [];
        if (config.procedural.checkMA) checks.push(liveDir.ma);
        if (config.procedural.checkMACD) checks.push(liveDir.macd);
        if (config.procedural.checkStochRSI) checks.push(liveDir.stoch);
        const recoil = checks.some((d) => d && d !== active.direction);
        if (recoil) {
          updateSignal(active.id, { result: "CANCELED", closedAt: Date.now(), notifiedResult: true });
          setActiveSignal(null);
          pushPopup({
            variant: "canceled",
            title: "Proceduralveo3 — Cancelado",
            message: "Recuo detectado antes do fechamento.",
          });
          return;
        } else {
          updateSignal(active.id, { proceduralConfirmedAt: Date.now(), notifiedProcedural: true });
          pushPopup({
            variant: "info",
            title: "Proceduralveo3 Confirmado",
            message: "Sinal aprovado para entrada.",
          });
          return;
        }
      }
    }

    // 3. Entry candle closed → apuração WIN/LOSS
    if (active && active.entryCandleStart && lastClosedTimeRef.current >= active.entryCandleStart && active.result === "PENDING") {
      const closedCandle = candles.find((c) => c.time === active.entryCandleStart);
      if (closedCandle) {
        const entryPrice = Number.isFinite(active.entryPrice) ? active.entryPrice : closedCandle.open;
        const win = active.direction === "UP" ? closedCandle.close > entryPrice : closedCandle.close < entryPrice;
        const result = win ? "WIN" : "LOSS";
        updateSignal(active.id, {
          result,
          entryPrice,
          exitPrice: closedCandle.close,
          closedAt: Date.now(),
          notifiedResult: true,
        });
        setActiveSignal(null);
        pushPopup({
          variant: win ? "win" : "loss",
          title: win ? "WIN ✓" : "LOSS ✗",
          message: `${active.pair} • ${active.direction === "UP" ? "CALL" : "PUT"}`,
        });
        return;
      }
    }

    // 4. Generate new signal (only if no active signal & whale on)
    if (!active && whaleActive) {
      const cr = detectCrossings(candles, config.indicators);
      const decision = signalDecision(cr, liveDir);
      if (decision) {
        const entryCandleStart = liveCandle.time + tfSec;
        const sig: Signal = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pair: config.pair,
          timeframe: config.timeframe,
          direction: decision.direction,
          confidence: decision.confidence,
          signalCandleStart: liveCandle.time,
          entryCandleStart,
          entryPrice: Number.NaN,
          result: "PENDING",
          createdAt: Date.now(),
          notifiedSignal: true,
        };
        addSignal(sig);
        setActiveSignal(sig.id);
        pushPopup({
          variant: "signal",
          title: `Sinal Gerado — ${sig.direction === "UP" ? "CALL" : "PUT"} (${sig.confidence}%)`,
          message: `${sig.pair} • ${sig.timeframe} • entrada na próxima vela`,
        });
      }
    }
  }, [candles, whaleActive, config, addSignal, updateSignal, setCross, setActiveSignal, activeSignalId]);
}