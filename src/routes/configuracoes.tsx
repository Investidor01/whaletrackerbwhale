import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PAIRS, TIMEFRAMES } from "@/lib/binance";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Whale Tracker AI" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const { config, setConfig, setProcedural } = useStore();
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h2 className="font-display text-2xl font-bold text-glow text-primary">Configurações</h2>
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Par padrão</label>
        <select value={config.pair} onChange={(e) => setConfig({ pair: e.target.value })} className="bg-card rounded-lg px-3 py-2">
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Timeframe</label>
        <select value={config.timeframe} onChange={(e) => setConfig({ timeframe: e.target.value })} className="bg-card rounded-lg px-3 py-2">
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Tempo Proceduralveo3 (s)</label>
        <input
          type="number"
          min={5}
          max={45}
          value={config.procedural.seconds}
          onChange={(e) => setProcedural({ seconds: parseInt(e.target.value) || 15 })}
          className="bg-card rounded-lg px-3 py-2"
        />
      </div>
    </div>
  );
}