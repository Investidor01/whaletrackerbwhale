import type { Candle } from "./types";
import { ema } from "./indicators";

export interface WhalePlusConfig {
  emaPeriod: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  volumeAvg: number;
  volumeFactor: number; // current vol must be > avg*factor
}

export const defaultWhalePlus: WhalePlusConfig = {
  emaPeriod: 21,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  volumeAvg: 20,
  volumeFactor: 1.2,
};

function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let g = 0, l = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const ch = values[i] - values[i - 1];
    const gg = Math.max(ch, 0), ll = Math.max(-ch, 0);
    if (i <= period) {
      g += gg; l += ll;
      if (i === period) {
        g /= period; l /= period;
        const rs = l === 0 ? 100 : g / l;
        out.push(100 - 100 / (1 + rs));
      } else out.push(null);
    } else {
      g = (g * (period - 1) + gg) / period;
      l = (l * (period - 1) + ll) / period;
      const rs = l === 0 ? 100 : g / l;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

/** VWAP rolling over the whole array (cumulative from start of session view). */
export function vwap(candles: Candle[]): number[] {
  let cumPV = 0, cumV = 0;
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    const v = c.volume ?? 0;
    cumPV += tp * v;
    cumV += v;
    return cumV > 0 ? cumPV / cumV : tp;
  });
}

export interface WhalePlusSnapshot {
  ema: (number | null)[];
  vwap: number[];
  rsi: (number | null)[];
  avgVol: (number | null)[];
}

export function computeWhalePlus(candles: Candle[], cfg: WhalePlusConfig): WhalePlusSnapshot {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume ?? 0);
  const avgVol: (number | null)[] = vols.map((_, i) => {
    if (i < cfg.volumeAvg - 1) return null;
    let s = 0; for (let j = i - cfg.volumeAvg + 1; j <= i; j++) s += vols[j];
    return s / cfg.volumeAvg;
  });
  return { ema: ema(closes, cfg.emaPeriod), vwap: vwap(candles), rsi: rsi(closes, cfg.rsiPeriod), avgVol };
}

export interface WhalePlusSignal { direction: "UP" | "DOWN"; reason: string[]; }

/** Detects a fresh signal on candle index i (intra/close). */
export function whalePlusSignal(candles: Candle[], snap: WhalePlusSnapshot, cfg: WhalePlusConfig, i: number): WhalePlusSignal | null {
  if (i < Math.max(cfg.emaPeriod, cfg.rsiPeriod, cfg.volumeAvg) + 1) return null;
  const c = candles[i];
  const prev = candles[i - 1];
  const e = snap.ema[i]; const ep = snap.ema[i - 1];
  const v = snap.vwap[i];
  const r = snap.rsi[i]; const rp = snap.rsi[i - 1];
  const av = snap.avgVol[i];
  if (e == null || ep == null || r == null || rp == null || av == null) return null;
  const volOk = (c.volume ?? 0) > av * cfg.volumeFactor;
  if (!volOk) return null;

  const trendUp = c.close > e && c.close > v;
  const trendDown = c.close < e && c.close < v;

  // CALL: exiting oversold + RSI rising
  if (trendUp && rp < cfg.rsiOversold && r > rp) {
    return { direction: "UP", reason: [`EMA${cfg.emaPeriod} acima`, `VWAP suporte`, `RSI saindo sobrevenda (${rp.toFixed(1)}→${r.toFixed(1)})`, `Volume ${((c.volume ?? 0) / av).toFixed(2)}x média`] };
  }
  // PUT: leaving overbought + RSI falling
  if (trendDown && rp > cfg.rsiOverbought && r < rp) {
    return { direction: "DOWN", reason: [`EMA${cfg.emaPeriod} abaixo`, `VWAP resistência`, `RSI saindo sobrecompra (${rp.toFixed(1)}→${r.toFixed(1)})`, `Volume ${((c.volume ?? 0) / av).toFixed(2)}x média`] };
  }
  void prev;
  return null;
}