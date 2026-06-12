import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppConfig, Signal } from "./types";

interface State {
  config: AppConfig;
  history: Signal[];
  whaleActive: boolean;
  setConfig: (c: Partial<AppConfig>) => void;
  setProcedural: (p: Partial<AppConfig["procedural"]>) => void;
  setIndicators: (i: Partial<AppConfig["indicators"]>) => void;
  addSignal: (s: Signal) => void;
  updateSignal: (id: string, patch: Partial<Signal>) => void;
  clearHistory: () => void;
  toggleWhale: () => void;
  setWhale: (v: boolean) => void;
}

const defaultConfig: AppConfig = {
  pair: "BTCUSDT",
  timeframe: "1m",
  procedural: { seconds: 15, checkMA: true, checkMACD: true, checkStochRSI: true },
  indicators: {
    ma: { short: 7, mid: 25, long: 99, colorShort: "#facc15", colorMid: "#22c55e", colorLong: "#ef4444" },
    macd: { fast: 12, slow: 26, signal: 9, color: "#06b6d4" },
    stochRsi: { rsiP: 14, stochP: 14, kP: 3, dP: 3, color: "#a855f7" },
  },
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      config: defaultConfig,
      history: [],
      whaleActive: false,
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      setProcedural: (p) =>
        set((s) => ({ config: { ...s.config, procedural: { ...s.config.procedural, ...p } } })),
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
    }),
    {
      name: "whale-tracker-ai",
      version: 2,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          config: {
            ...defaultConfig,
            ...(p.config ?? {}),
            procedural: { ...defaultConfig.procedural, ...(p.config?.procedural ?? {}) },
            indicators: {
              ma: { ...defaultConfig.indicators.ma, ...(p.config?.indicators?.ma ?? {}) },
              macd: { ...defaultConfig.indicators.macd, ...(p.config?.indicators?.macd ?? {}) },
              stochRsi: { ...defaultConfig.indicators.stochRsi, ...(p.config?.indicators?.stochRsi ?? {}) },
            },
          },
        };
      },
    },
  ),
);