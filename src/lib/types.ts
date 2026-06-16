export type Direction = "UP" | "DOWN";
export type SignalResult = "WIN" | "LOSS" | "CANCELED" | "PENDING";

export interface Candle {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Signal {
  id: string;
  pair: string;
  timeframe: string;
  direction: Direction;
  confidence: number; // 85 or 99
  signalCandleStart: number; // seconds
  entryCandleStart?: number; // seconds
  entryPrice: number;
  exitPrice?: number;
  result: SignalResult;
  createdAt: number;
  proceduralConfirmedAt?: number;
  startedAt?: number;
  closedAt?: number;
  notifiedSignal?: boolean;
  notifiedProcedural?: boolean;
  notifiedStarted?: boolean;
  notifiedResult?: boolean;
}

export interface AppConfig {
  pair: string;
  timeframe: string;
  procedural: {
    seconds: number;
    checkMA: boolean;
    checkMACD: boolean;
    checkStochRSI: boolean;
  };
  proceduralveo4: {
    allow80: boolean;
    allow99: boolean;
  };
  proceduralveo5: {
    enabled: boolean;
    requireMA: boolean;
    requireMACD: boolean;
    requireStochRSI: boolean;
  };
  indicators: {
    ma: { short: number; mid: number; long: number; colorShort: string; colorMid: string; colorLong: string };
    macd: { fast: number; slow: number; signal: number; colorLine: string; colorSignal: string };
    stochRsi: { rsiP: number; stochP: number; kP: number; dP: number; colorK: string; colorD: string };
  };
}