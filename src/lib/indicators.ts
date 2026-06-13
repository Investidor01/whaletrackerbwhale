import type { Candle } from "./types";

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const line: (number | null)[] = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null,
  );
  const lineNums = line.map((v) => (v === null ? 0 : v));
  const sig = ema(lineNums, signal).map((v, i) => (line[i] === null ? null : v));
  return { line, signal: sig };
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let gain = 0,
    loss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const ch = values[i] - values[i - 1];
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        const rs = loss === 0 ? 100 : gain / loss;
        out.push(100 - 100 / (1 + rs));
      } else out.push(null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function stochRsi(values: number[], rsiP = 14, stochP = 14, kP = 3, dP = 3) {
  const r = rsi(values, rsiP);
  const stoch: (number | null)[] = r.map((_, i) => {
    if (i < rsiP + stochP - 1) return null;
    const slice = r.slice(i - stochP + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length < stochP) return null;
    const mn = Math.min(...slice);
    const mx = Math.max(...slice);
    return mx === mn ? 0 : ((r[i] as number) - mn) / (mx - mn) * 100;
  });
  const stochNums = stoch.map((v) => (v === null ? 0 : v));
  const k = sma(stochNums, kP).map((v, i) => (stoch[i] === null ? null : v));
  const kNums = k.map((v) => (v === null ? 0 : v));
  const d = sma(kNums, dP).map((v, i) => (k[i] === null ? null : v));
  return { k, d };
}

export interface IndicatorSnapshot {
  maShort: number[];
  maMid: number[];
  maLong: number[];
  macdLine: (number | null)[];
  macdSig: (number | null)[];
  stochK: (number | null)[];
  stochD: (number | null)[];
}

export function computeAll(candles: Candle[], params: IndicatorParams = defaultParams): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const mac = macd(closes, params.macd.fast, params.macd.slow, params.macd.signal);
  const st = stochRsi(closes, params.stochRsi.rsiP, params.stochRsi.stochP, params.stochRsi.kP, params.stochRsi.dP);
  return {
    maShort: sma(closes, params.ma.short).map((v) => v ?? NaN) as number[],
    maMid: sma(closes, params.ma.mid).map((v) => v ?? NaN) as number[],
    maLong: sma(closes, params.ma.long).map((v) => v ?? NaN) as number[],
    macdLine: mac.line,
    macdSig: mac.signal,
    stochK: st.k,
    stochD: st.d,
  };
}

function crossed(a1: number, a2: number, b1: number, b2: number): "UP" | "DOWN" | null {
  if (!isFinite(a1) || !isFinite(a2) || !isFinite(b1) || !isFinite(b2)) return null;
  if (a1 <= b1 && a2 > b2) return "UP";
  if (a1 >= b1 && a2 < b2) return "DOWN";
  return null;
}

export interface CrossResult {
  ma: "UP" | "DOWN" | null;
  macd: "UP" | "DOWN" | null;
  stoch: "UP" | "DOWN" | null;
}

export interface IndicatorParams {
  ma: { short: number; mid: number; long: number };
  macd: { fast: number; slow: number; signal: number };
  stochRsi: { rsiP: number; stochP: number; kP: number; dP: number };
}

const defaultParams: IndicatorParams = {
  ma: { short: 7, mid: 25, long: 99 },
  macd: { fast: 12, slow: 26, signal: 9 },
  stochRsi: { rsiP: 14, stochP: 14, kP: 3, dP: 3 },
};

export function detectCrossings(candles: Candle[], params: IndicatorParams = defaultParams): CrossResult {
  const minLen = Math.max(params.ma.long, params.macd.slow + params.macd.signal, params.stochRsi.rsiP + params.stochRsi.stochP) + 2;
  if (candles.length < minLen) return { ma: null, macd: null, stoch: null };
  const closes = candles.map((c) => c.close);
  const s = sma(closes, params.ma.short);
  const m = sma(closes, params.ma.mid);
  const l = sma(closes, params.ma.long);
  const i = closes.length - 1;
  // MA cross: avg(short,mid) vs long
  const avgA1 = ((s[i - 1] ?? NaN) + (m[i - 1] ?? NaN)) / 2;
  const avgA2 = ((s[i] ?? NaN) + (m[i] ?? NaN)) / 2;
  const maCross = crossed(avgA1, avgA2, l[i - 1] ?? NaN, l[i] ?? NaN);

  const mac = macd(closes, params.macd.fast, params.macd.slow, params.macd.signal);
  const macdCross = crossed(
    mac.line[i - 1] ?? NaN,
    mac.line[i] ?? NaN,
    mac.signal[i - 1] ?? NaN,
    mac.signal[i] ?? NaN,
  );

  const st = stochRsi(closes, params.stochRsi.rsiP, params.stochRsi.stochP, params.stochRsi.kP, params.stochRsi.dP);
  const stochCross = crossed(
    st.k[i - 1] ?? NaN,
    st.k[i] ?? NaN,
    st.d[i - 1] ?? NaN,
    st.d[i] ?? NaN,
  );

  return { ma: maCross, macd: macdCross, stoch: stochCross };
}