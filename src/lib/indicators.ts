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

export function computeAll(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  return {
    maShort: sma(closes, 7).map((v) => v ?? NaN) as number[],
    maMid: sma(closes, 25).map((v) => v ?? NaN) as number[],
    maLong: sma(closes, 99).map((v) => v ?? NaN) as number[],
    ...macd(closes),
    ...((): { stochK: (number | null)[]; stochD: (number | null)[] } => {
      const s = stochRsi(closes);
      return { stochK: s.k, stochD: s.d };
    })(),
    macdLine: macd(closes).line,
    macdSig: macd(closes).signal,
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

export function detectCrossings(candles: Candle[]): CrossResult {
  if (candles.length < 100) return { ma: null, macd: null, stoch: null };
  const closes = candles.map((c) => c.close);
  const s = sma(closes, 7);
  const m = sma(closes, 25);
  const l = sma(closes, 99);
  const i = closes.length - 1;
  // MA cross: avg(short,mid) vs long
  const avgA1 = ((s[i - 1] ?? NaN) + (m[i - 1] ?? NaN)) / 2;
  const avgA2 = ((s[i] ?? NaN) + (m[i] ?? NaN)) / 2;
  const maCross = crossed(avgA1, avgA2, l[i - 1] ?? NaN, l[i] ?? NaN);

  const mac = macd(closes);
  const macdCross = crossed(
    mac.line[i - 1] ?? NaN,
    mac.line[i] ?? NaN,
    mac.signal[i - 1] ?? NaN,
    mac.signal[i] ?? NaN,
  );

  const st = stochRsi(closes);
  const stochCross = crossed(
    st.k[i - 1] ?? NaN,
    st.k[i] ?? NaN,
    st.d[i - 1] ?? NaN,
    st.d[i] ?? NaN,
  );

  return { ma: maCross, macd: macdCross, stoch: stochCross };
}