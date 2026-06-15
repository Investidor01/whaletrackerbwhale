import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/proceduralveo5")({
  head: () => ({ meta: [{ title: "Proceduralveo5 — Whale Tracker AI" }] }),
  component: Proceduralveo5Page,
});

function Proceduralveo5Page() {
  const config = useStore((s) => s.config);
  const setProceduralveo5 = useStore((s) => s.setProceduralveo5);
  const v = config.proceduralveo5;
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold text-glow text-primary">Proceduralveo5</h2>
      </div>
      <p className="text-sm opacity-80">
        <span className="text-primary font-semibold">Identificação de liquidez das baleias.</span>{" "}
        Esta camada garante que o sinal só seja gerado quando os cruzamentos dos indicadores
        selecionados aconteçam <b>juntos</b>, na mesma direção, no mesmo instante — evitando
        armadilhas onde as baleias retiram liquidez do mercado.
      </p>

      <div className="binance-panel rounded-lg p-4">
        <h3 className="font-display font-bold text-sm mb-2">Como funciona</h3>
        <ul className="text-xs opacity-80 leading-relaxed list-disc pl-5 space-y-1">
          <li>Ative o Proceduralveo5 abaixo para passar a exigir confirmação de liquidez.</li>
          <li>Selecione quais indicadores devem cruzar simultaneamente.</li>
          <li>Se qualquer indicador selecionado <b>não</b> estiver cruzando junto, o sinal é descartado.</li>
          <li>As análises começam imediatamente ao ativar o botão da baleia no dashboard.</li>
          <li>Funciona combinado com o Proceduralveo4 (80%/99%) — ambos precisam aprovar.</li>
        </ul>
      </div>

      <Toggle
        label="Ativar Proceduralveo5"
        sub="Quando ligado, apenas cruzamentos simultâneos selecionados geram sinal."
        value={v.enabled}
        onChange={(x) => setProceduralveo5({ enabled: x })}
        highlight
      />

      <div className="text-[11px] uppercase tracking-wider opacity-60 mt-2">
        Indicadores exigidos
      </div>
      <Toggle
        label="Médias Móveis (MA)"
        sub="Sempre recomendada — confirma a tendência principal."
        value={v.requireMA}
        onChange={(x) => setProceduralveo5({ requireMA: x })}
      />
      <Toggle
        label="MACD"
        sub="Confirma a aceleração do movimento."
        value={v.requireMACD}
        onChange={(x) => setProceduralveo5({ requireMACD: x })}
      />
      <Toggle
        label="Stochastic RSI"
        sub="Confirma reversão / momentum."
        value={v.requireStochRSI}
        onChange={(x) => setProceduralveo5({ requireStochRSI: x })}
      />

      <div className="binance-panel rounded-lg p-3 text-[11px] opacity-70 leading-relaxed">
        Exemplos válidos: <b>MA + MACD</b>, <b>MA + StochRSI</b>, <b>MACD + StochRSI</b> ou
        os três juntos. Você combina como quiser — o motor só vai disparar quando todos
        os selecionados cruzarem alinhados.
      </div>
    </div>
  );
}

function Toggle({ label, sub, value, onChange, highlight }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; highlight?: boolean }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`binance-panel rounded-lg p-4 flex items-center justify-between text-left ${highlight && value ? "ring-1 ring-primary/60" : ""}`}
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