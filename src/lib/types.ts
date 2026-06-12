export type Direction = "UP" | "DOWN";
export type SignalResult = "WIN" | "LOSS" | "CANCELED" | "PENDING";

export interface Candle {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Signal {
  id: string;
  pair: string;
  timeframe: string;
  direction: Direction;
  confidence: number; // 85 or 99
  signalCandleStart: number; // seconds
  entryPrice: number;
  exitPrice?: number;
  result: SignalResult;
  createdAt: number;
  closedAt?: number;
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
}