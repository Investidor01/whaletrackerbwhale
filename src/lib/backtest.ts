import type { Candle } from "./types";
import { sma, macd, stochRsi, ema } from "./indicators";

export interface BacktestParams {
  ma: { short: number; mid: number; long: number };
  macd: { fast: number; slow: number; signal: number };
  stochRsi: { rsiP: number; stochP: number; kP: number; dP: number };
}

export interface BacktestResult {
  trades: number;
  wins: number;
  losses: number;
  accuracy: number; // 0..100
  conf80: { trades: number; wins: number };
  conf99: { trades: number; wins: number };
  signals: { time: number; dir: "UP" | "DOWN"; conf: number; result: "WIN" | "LOSS" }[];
}

function cross(a1: number, a2: number, b1: number, b2: number): "UP" | "DOWN" | null {
  if (!isFinite(a1) || !isFinite(a2) || !isFinite(b1) || !isFinite(b2)) return null;
  if (a1 <= b1 && a2 > b2) return "UP";
  if (a1 >= b1 && a2 < b2) return "DOWN";
  return null;
}

/**
 * Replays the same engine logic against historical candles:
 * MA cross is required; aligned MACD => 80%; +StochRSI aligned => 99%.
 * Entry is the OPEN of next candle, exit is CLOSE of that candle.
 */
export function runBacktest(candles: Candle[], p: BacktestParams): BacktestResult {
  const closes = candles.map((c) => c.close);
  const s = sma(closes, p.ma.short);
  const m = sma(closes, p.ma.mid);
  const l = sma(closes, p.ma.long);
  const mac = macd(closes, p.macd.fast, p.macd.slow, p.macd.signal);
  const st = stochRsi(closes, p.stochRsi.rsiP, p.stochRsi.stochP, p.stochRsi.kP, p.stochRsi.dP);

  const res: BacktestResult = {
    trades: 0, wins: 0, losses: 0, accuracy: 0,
    conf80: { trades: 0, wins: 0 },
    conf99: { trades: 0, wins: 0 },
    signals: [],
  };

  for (let i = 2; i < candles.length - 1; i++) {
    const a1 = ((s[i - 1] ?? NaN) + (m[i - 1] ?? NaN)) / 2;
    const a2 = ((s[i] ?? NaN) + (m[i] ?? NaN)) / 2;
    const maC = cross(a1, a2, l[i - 1] ?? NaN, l[i] ?? NaN);
    if (!maC) continue;
    const macdC = cross(mac.line[i - 1] ?? NaN, mac.line[i] ?? NaN, mac.signal[i - 1] ?? NaN, mac.signal[i] ?? NaN);
    if (macdC !== maC) continue;
    // Direction confirmations on candle i
    const macdAligned = (mac.line[i] ?? NaN) > (mac.signal[i] ?? NaN) ? "UP" : "DOWN";
    if (macdAligned !== maC) continue;

    const stochC = cross(st.k[i - 1] ?? NaN, st.k[i] ?? NaN, st.d[i - 1] ?? NaN, st.d[i] ?? NaN);
    const stochDir = (st.k[i] ?? NaN) > (st.d[i] ?? NaN) ? "UP" : "DOWN";
    const fullStoch = stochC === maC && stochDir === maC;

    const conf = fullStoch ? 99 : 80;
    const entry = candles[i + 1];
    const win = maC === "UP" ? entry.close > entry.open : entry.close < entry.open;
    res.trades++;
    if (win) res.wins++; else res.losses++;
    if (conf === 99) { res.conf99.trades++; if (win) res.conf99.wins++; }
    else { res.conf80.trades++; if (win) res.conf80.wins++; }
    res.signals.push({ time: entry.time, dir: maC, conf, result: win ? "WIN" : "LOSS" });
  }
  res.accuracy = res.trades ? Math.round((res.wins / res.trades) * 1000) / 10 : 0;
  return res;
}

// Mapping of preset periods to a tf + limit (Binance cap = 1000 per request)
export const BACKTEST_PERIODS: { id: string; label: string; tf: string; limit: number }[] = [
  { id: "1d", label: "1 Dia", tf: "1m", limit: 1000 },
  { id: "1w", label: "1 Semana", tf: "15m", limit: 672 },
  { id: "1m", label: "1 Mês", tf: "1h", limit: 720 },
  { id: "1y", label: "1 Ano", tf: "1d", limit: 365 },
];

// EMA helper re-export so other modules can rely on it
export { ema };