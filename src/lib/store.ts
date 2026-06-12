import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppConfig, Signal } from "./types";

interface State {
  config: AppConfig;
  history: Signal[];
  whaleActive: boolean;
  setConfig: (c: Partial<AppConfig>) => void;
  setProcedural: (p: Partial<AppConfig["procedural"]>) => void;
  addSignal: (s: Signal) => void;
  updateSignal: (id: string, patch: Partial<Signal>) => void;
  clearHistory: () => void;
  toggleWhale: () => void;
  setWhale: (v: boolean) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      config: {
        pair: "BTCUSDT",
        timeframe: "1m",
        procedural: { seconds: 15, checkMA: true, checkMACD: true, checkStochRSI: true },
      },
      history: [],
      whaleActive: false,
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      setProcedural: (p) =>
        set((s) => ({ config: { ...s.config, procedural: { ...s.config.procedural, ...p } } })),
      addSignal: (sig) => set((s) => ({ history: [sig, ...s.history].slice(0, 500) })),
      updateSignal: (id, patch) =>
        set((s) => ({ history: s.history.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      clearHistory: () => set({ history: [] }),
      toggleWhale: () => set((s) => ({ whaleActive: !s.whaleActive })),
      setWhale: (v) => set({ whaleActive: v }),
    }),
    { name: "whale-tracker-ai" },
  ),
);