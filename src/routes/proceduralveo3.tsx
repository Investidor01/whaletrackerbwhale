import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/proceduralveo3")({
  head: () => ({ meta: [{ title: "Proceduralveo3 — Whale Tracker AI" }] }),
  component: ProceduralPage,
});

function ProceduralPage() {
  const { config, setProcedural } = useStore();
  const p = config.procedural;
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h2 className="font-display text-2xl font-bold text-glow text-primary">Proceduralveo3</h2>
      <p className="text-sm opacity-80">
        Sistema de segurança que reanalisa os indicadores X segundos antes da vela do sinal fechar. Se houver recuo nos indicadores selecionados, o sinal é cancelado para proteger sua assertividade.
      </p>
      <div className="glass-card rounded-2xl p-4">
        <label className="block text-sm font-medium mb-2">Tempo de análise antes do fim da vela</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={p.seconds}
            onChange={(e) => setProcedural({ seconds: parseInt(e.target.value) })}
            className="flex-1 accent-[color:var(--neon)]"
          />
          <span className="font-display text-2xl font-bold text-primary text-glow w-16 text-right">{p.seconds}s</span>
        </div>
      </div>
      <Toggle label="Reanalisar Médias Móveis (MA)" value={p.checkMA} onChange={(v) => setProcedural({ checkMA: v })} />
      <Toggle label="Reanalisar MACD" value={p.checkMACD} onChange={(v) => setProcedural({ checkMACD: v })} />
      <Toggle label="Reanalisar Stochastic RSI" value={p.checkStochRSI} onChange={(v) => setProcedural({ checkStochRSI: v })} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="glass-card rounded-2xl p-4 flex items-center justify-between"
    >
      <span className="font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-[color:var(--neon)]" : "bg-zinc-600"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}