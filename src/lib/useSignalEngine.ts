import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { fetchKlines, subscribeKline, tfSeconds } from "./binance";
import { computeAll, detectCrossings, ema, type CrossResult, type IndicatorSnapshot } from "./indicators";
import type { Direction, Signal } from "./types";
import { pushPopup } from "@/components/Popup";

// Session-scoped dedupe so navigation / HMR remounts cannot replay popups
const shownPopups = new Set<string>();
function popupOnce(key: string, payload: Parameters<typeof pushPopup>[0]) {
  if (shownPopups.has(key)) return;
  shownPopups.add(key);
  pushPopup(payload);
}

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

export function signalDecision(
  cross: CrossResult,
  directions: CrossResult,
  opts: {
    allowMAonly: boolean;
    allow80: boolean;
    allow99: boolean;
    veo5Enabled: boolean;
    veo5: { requireMA: boolean; requireMACD: boolean; requireStochRSI: boolean };
    enabled?: { ma: boolean; macd: boolean; stochRsi: boolean };
  },
): { direction: Direction; confidence: number } | null {
  const enabled = opts.enabled ?? { ma: true, macd: true, stochRsi: true };

  // Any indicator (that is enabled) that crossed becomes a candidate trigger.
  // Direction confirmation only requires the OTHER enabled indicators to be
  // ALIGNED in the same direction (not necessarily crossing on the same tick).
  const triggers: { src: "ma" | "macd" | "stoch"; dir: Direction }[] = [];
  if (enabled.ma && cross.ma) triggers.push({ src: "ma", dir: cross.ma });
  if (enabled.macd && cross.macd) triggers.push({ src: "macd", dir: cross.macd });
  if (enabled.stochRsi && cross.stoch) triggers.push({ src: "stoch", dir: cross.stoch });
  if (triggers.length === 0) return null;

  // Choose the trigger with the most agreement among enabled indicators.
  let best: { direction: Direction; confidence: number } | null = null;
  for (const t of triggers) {
    const aligned = {
      ma: enabled.ma ? directions.ma === t.dir : true,
      macd: enabled.macd ? directions.macd === t.dir : true,
      stoch: enabled.stochRsi ? directions.stoch === t.dir : true,
    };

    // Proceduralveo5 — custom liquidity gate.
    if (opts.veo5Enabled) {
      if (opts.veo5.requireMA && !aligned.ma) continue;
      if (opts.veo5.requireMACD && !aligned.macd) continue;
      if (opts.veo5.requireStochRSI && !aligned.stoch) continue;
    }

    // Proceduralveo4 scale: MA=80%, MA+MACD=88%, MA+MACD+StochRSI=99%.
    const alignedMA = enabled.ma && aligned.ma;
    const alignedMACD = enabled.macd && aligned.macd;
    const alignedStoch = enabled.stochRsi && aligned.stoch;
    let confidence: number | null = null;
    if (alignedMA && alignedMACD && alignedStoch) {
      if (opts.allow99) confidence = 99;
      else if (opts.allow80) confidence = 88;
      else if (opts.allowMAonly) confidence = 80;
    } else if (alignedMA && alignedMACD) {
      if (opts.allow80) confidence = 88;
      else if (opts.allowMAonly) confidence = 80;
    } else if (alignedMA && opts.allowMAonly) {
      confidence = 80;
    } else if (!enabled.ma) {
      const others = (alignedMACD ? 1 : 0) + (alignedStoch ? 1 : 0);
      const enabledOthers = (enabled.macd ? 1 : 0) + (enabled.stochRsi ? 1 : 0);
      if (others === enabledOthers && enabledOthers >= 2 && opts.allow99) confidence = 99;
      else if (others >= 1 && opts.allow80) confidence = 80;
    }
    if (confidence == null) continue;
    if (!best || confidence > best.confidence) best = { direction: t.dir, confidence };
  }
  return best;
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
  const setLastSignalAt = useStore((s) => s.setLastSignalAt);

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
          popupOnce(`started:${active.id}`, {
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
          popupOnce(`canceled:${active.id}`, {
            variant: "canceled",
            title: "Proceduralveo3 — Cancelado",
            message: "Recuo detectado antes do fechamento.",
          });
          return;
        } else {
          updateSignal(active.id, { proceduralConfirmedAt: Date.now(), notifiedProcedural: true });
          popupOnce(`veo3:${active.id}`, {
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
        popupOnce(`result:${active.id}`, {
          variant: win ? "win" : "loss",
          title: win ? "WIN ✓" : "LOSS ✗",
          message: `${active.pair} • ${active.direction === "UP" ? "CALL" : "PUT"}`,
        });
        return;
      }
    }

    // 4. Generate new signal (only if no active signal & whale on)
    if (!active && whaleActive) {
      const veo6 = config.proceduralveo6;
      const wp = config.whalePlus;
      const anyDirectionAllowed = veo6.allowCall || veo6.allowPut;
      const anyMethodActive = anyDirectionAllowed || wp.enabled;
      if (!anyMethodActive) {
        popupOnce(`veo6:none`, {
          variant: "info",
          title: "Ative Proceduralveo6 ou Whale+",
          message: "Habilite Call/Put no Proceduralveo6 ou EMA de Força no Whale+ para continuar.",
        });
        return;
      }
      if (veo6.cooldownEnabled && state.lastSignalAt) {
        const elapsed = (Date.now() - state.lastSignalAt) / 1000;
        if (elapsed < veo6.cooldownSeconds) {
          popupOnce(`cooldown:${state.lastSignalAt}`, {
            variant: "info",
            title: "Cooldown de Segurança",
            message: `Aguardando ${Math.ceil(veo6.cooldownSeconds - elapsed)}s para o próximo sinal.`,
          });
          return;
        }
      }
      if (veo6.blockNearCloseEnabled) {
        const nowSec = Math.floor(Date.now() / 1000);
        const rem = liveCandle.time + tfSec - nowSec;
        if (rem > 0 && rem <= veo6.blockNearCloseSeconds) return;
      }

      // Dedupe: never emit two signals for the same candle.
      const dup = state.history.find(
        (h) =>
          h.pair === config.pair &&
          h.timeframe === config.timeframe &&
          h.signalCandleStart === liveCandle.time,
      );
      if (dup) return;
      const cr = detectCrossings(candles, config.indicators);
      const decision = signalDecision(cr, liveDir, {
        allowMAonly: config.proceduralveo4.allowMAonly,
        allow80: config.proceduralveo4.allow80,
        allow99: config.proceduralveo4.allow99,
        veo5Enabled: config.proceduralveo5.enabled,
        veo5: {
          requireMA: config.proceduralveo5.requireMA,
          requireMACD: config.proceduralveo5.requireMACD,
          requireStochRSI: config.proceduralveo5.requireStochRSI,
        },
        enabled: config.indicatorsEnabled,
      });
      if (!decision) return;

      if (anyDirectionAllowed) {
        if (decision.direction === "UP" && !veo6.allowCall) return;
        if (decision.direction === "DOWN" && !veo6.allowPut) return;
      }

      if (wp.enabled) {
        const closes = candles.map((c) => c.close);
        const e = ema(closes, wp.emaPeriod);
        const lastE = e[e.length - 1];
        if (lastE == null || !Number.isFinite(lastE)) return;
        const price = liveCandle.close;
        const distPct = ((price - lastE) / lastE) * 100;
        if (Math.abs(distPct) < wp.strengthThreshold) return;
        const forceDir: Direction = distPct > 0 ? "UP" : "DOWN";
        if (forceDir !== decision.direction) return;
      }

      {
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
        setLastSignalAt(Date.now());
        popupOnce(`signal:${sig.id}`, {
          variant: "signal",
          title: `Sinal Gerado — ${sig.direction === "UP" ? "CALL" : "PUT"} (${sig.confidence}%)`,
          message: `${sig.pair} • ${sig.timeframe} • entrada na próxima vela`,
        });
      }
    }
  }, [candles, whaleActive, config, addSignal, updateSignal, setCross, setActiveSignal, setLastSignalAt, activeSignalId]);
}