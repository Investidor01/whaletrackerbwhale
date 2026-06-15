import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppConfig, Candle, Signal } from "./types";
import type { CrossResult } from "./indicators";

interface State {
  config: AppConfig;
  history: Signal[];
  whaleActive: boolean;
  activeSignalId: string | null;
  candles: Candle[];
  cross: CrossResult;
  setConfig: (c: Partial<AppConfig>) => void;
  setProcedural: (p: Partial<AppConfig["procedural"]>) => void;
  setIndicators: (i: Partial<AppConfig["indicators"]>) => void;
  addSignal: (s: Signal) => void;
  updateSignal: (id: string, patch: Partial<Signal>) => void;
  clearHistory: () => void;
  toggleWhale: () => void;
  setWhale: (v: boolean) => void;
  setCandles: (c: Candle[] | ((prev: Candle[]) => Candle[])) => void;
  setCross: (c: CrossResult) => void;
  setActiveSignal: (id: string | null) => void;
}

const defaultConfig: AppConfig = {
  pair: "BTCUSDT",
  timeframe: "1m",
  procedural: { seconds: 15, checkMA: true, checkMACD: true, checkStochRSI: true },
  proceduralveo4: { allow80: true, allow99: true },
  proceduralveo5: { enabled: false, requireMA: true, requireMACD: true, requireStochRSI: false },
  indicators: {
    ma: { short: 7, mid: 25, long: 99, colorShort: "#facc15", colorMid: "#22c55e", colorLong: "#ef4444" },
    macd: { fast: 12, slow: 26, signal: 9, colorLine: "#f0b90b", colorSignal: "#7a5cff" },
    stochRsi: { rsiP: 14, stochP: 14, kP: 3, dP: 3, colorK: "#02c076", colorD: "#f6465d" },
  },
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      config: defaultConfig,
      history: [],
      whaleActive: false,
      activeSignalId: null,
      candles: [],
      cross: { ma: null, macd: null, stoch: null },
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      setProcedural: (p) =>
        set((s) => ({ config: { ...s.config, procedural: { ...s.config.procedural, ...p } } })),
      setProceduralveo4: (p) =>
        set((s) => ({ config: { ...s.config, proceduralveo4: { ...s.config.proceduralveo4, ...p } } })),
      setProceduralveo5: (p) =>
        set((s) => ({ config: { ...s.config, proceduralveo5: { ...s.config.proceduralveo5, ...p } } })),
      setIndicators: (i) =>
        set((s) => ({
          config: {
            ...s.config,
            indicators: {
              ma: { ...s.config.indicators.ma, ...(i.ma ?? {}) },
              macd: { ...s.config.indicators.macd, ...(i.macd ?? {}) },
              stochRsi: { ...s.config.indicators.stochRsi, ...(i.stochRsi ?? {}) },
            },
          },
        })),
      addSignal: (sig) => set((s) => ({ history: [sig, ...s.history].slice(0, 500) })),
      updateSignal: (id, patch) =>
        set((s) => ({ history: s.history.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      clearHistory: () => set({ history: [] }),
      toggleWhale: () => set((s) => ({ whaleActive: !s.whaleActive })),
      setWhale: (v) => set({ whaleActive: v }),
      setCandles: (c) =>
        set((s) => ({ candles: typeof c === "function" ? (c as (p: Candle[]) => Candle[])(s.candles) : c })),
      setCross: (c) => set({ cross: c }),
      setActiveSignal: (id) => set({ activeSignalId: id }),
    }),
    {
      name: "whale-tracker-ai",
      version: 4,
      partialize: (s) => ({
        config: s.config,
        history: s.history,
        whaleActive: s.whaleActive,
        activeSignalId: s.activeSignalId,
      }) as Partial<State>,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const macd = p.config?.indicators?.macd as Partial<AppConfig["indicators"]["macd"]> & { color?: string } | undefined;
        const stochRsi = p.config?.indicators?.stochRsi as Partial<AppConfig["indicators"]["stochRsi"]> & { color?: string } | undefined;
        return {
          ...current,
          ...p,
          config: {
            ...defaultConfig,
            ...(p.config ?? {}),
            procedural: { ...defaultConfig.procedural, ...(p.config?.procedural ?? {}) },
            indicators: {
              ma: { ...defaultConfig.indicators.ma, ...(p.config?.indicators?.ma ?? {}) },
              macd: {
                ...defaultConfig.indicators.macd,
                ...(macd ?? {}),
                colorLine: macd?.colorLine ?? macd?.color ?? defaultConfig.indicators.macd.colorLine,
                colorSignal: macd?.colorSignal ?? defaultConfig.indicators.macd.colorSignal,
              },
              stochRsi: {
                ...defaultConfig.indicators.stochRsi,
                ...(stochRsi ?? {}),
                colorK: stochRsi?.colorK ?? stochRsi?.color ?? defaultConfig.indicators.stochRsi.colorK,
                colorD: stochRsi?.colorD ?? defaultConfig.indicators.stochRsi.colorD,
              },
            },
          },
        };
      },
    },
  ),
);