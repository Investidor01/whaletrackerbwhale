import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/proceduralveo4")({
  head: () => ({ meta: [{ title: "Proceduralveo4 — Whale Tracker AI" }] }),
  component: Proceduralveo4Page,
});

function Proceduralveo4Page() {
  const config = useStore((s) => s.config);
  const setProceduralveo4 = useStore((s) => s.setProceduralveo4);
  const v = config.proceduralveo4;
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold text-glow text-primary">Proceduralveo4</h2>
      </div>
      <p className="text-sm opacity-80">
        <span className="text-primary font-semibold">Segurança de assertividade.</span> Filtra qual
        nível de sinal você quer receber. Cada nível exige um conjunto diferente de cruzamentos
        alinhados — quanto mais indicadores confirmam, maior a assertividade estimada.
      </p>

      <div className="binance-panel rounded-lg p-4">
        <h3 className="font-display font-bold text-sm mb-2">Como funciona</h3>
        <ul className="text-xs opacity-80 leading-relaxed list-disc pl-5 space-y-1">
          <li><span className="text-[color:var(--win)] font-semibold">80%</span> — exige cruzamento simultâneo de <b>MA + MACD</b> na mesma direção.</li>
          <li><span className="text-primary font-semibold">99%</span> — exige cruzamento simultâneo de <b>MA + MACD + StochRSI</b> alinhados.</li>
          <li>A <b>MA</b> é sempre obrigatória — sem cruzamento da MA, nenhum sinal é gerado.</li>
          <li>Desligando os dois toggles, o sistema deixa de gerar sinais até você reativar.</li>
        </ul>
      </div>

      <Toggle
        label="Permitir sinais 80% (MA + MACD)"
        sub="Dois indicadores cruzando juntos."
        value={v.allow80}
        onChange={(x) => setProceduralveo4({ allow80: x })}
      />
      <Toggle
        label="Permitir sinais 99% (MA + MACD + StochRSI)"
        sub="Três indicadores cruzando juntos — máxima assertividade."
        value={v.allow99}
        onChange={(x) => setProceduralveo4({ allow99: x })}
      />

      <div className="text-xs opacity-60 leading-relaxed mt-2">
        Dica: para operar apenas sinais premium, ative somente o toggle de 99%. Você verá
        menos sinais, porém com confluência máxima.
      </div>
    </div>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="binance-panel rounded-lg p-4 flex items-center justify-between text-left"
    >
      <div>
        <div className="font-medium">{label}</div>
        {sub ? <div className="text-[11px] opacity-60 mt-0.5">{sub}</div> : null}
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-zinc-600"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}