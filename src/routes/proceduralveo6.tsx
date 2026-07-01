import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { pushPopup } from "@/components/Popup";

export const Route = createFileRoute("/proceduralveo6")({
  head: () => ({ meta: [{ title: "Proceduralveo6 — Direção · Ruído · Cooldown" }] }),
  component: Proceduralveo6Page,
});

function Proceduralveo6Page() {
  const config = useStore((s) => s.config);
  const setProceduralveo6 = useStore((s) => s.setProceduralveo6);
  const setWhalePlus = useStore((s) => s.setWhalePlus);
  const v = config.proceduralveo6;
  const wpEnabled = config.whalePlus.enabled;

  const setDirection = (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch };
    // Mutex: se ligar Call/Put, desliga Whale+ automaticamente
    if ((next.allowCall || next.allowPut) && wpEnabled) {
      setWhalePlus({ enabled: false });
      pushPopup({
        variant: "info",
        title: "Whale+ desativado",
        message: "Proceduralveo6 e Whale+ não podem operar juntos. Whale+ foi desligado.",
      });
    }
    setProceduralveo6(patch);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold text-glow text-primary">Proceduralveo6</h2>
      </div>
      <p className="text-sm opacity-80">
        Controle avançado da <b className="text-primary">direção dos sinais</b>, do
        <b> bloqueador de ruídos</b> nos segundos finais da vela e do <b>cooldown</b> entre sinais.
      </p>

      {/* Direção */}
      <section className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div>
          <div className="font-display font-bold">Direção dos Sinais</div>
          <div className="text-[11px] opacity-70 mt-0.5">
            Só ativos aqui geram sinal. Se ambos estiverem desativados, apenas o Whale+ (EMA de Força)
            pode gerar sinais.
          </div>
        </div>
        <Toggle
          label="Permitir sinais de COMPRA (CALL)"
          sub="Gera setas verdes de alta."
          value={v.allowCall}
          onChange={(x) => setDirection({ allowCall: x })}
        />
        <Toggle
          label="Permitir sinais de VENDA (PUT)"
          sub="Gera setas vermelhas de baixa."
          value={v.allowPut}
          onChange={(x) => setDirection({ allowPut: x })}
        />
        {!v.allowCall && !v.allowPut && !wpEnabled && (
          <div className="rounded border border-[color:var(--loss)]/50 p-2 text-xs flex gap-2 text-[color:var(--loss)]">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            Nenhum método ativo. Ative Call/Put ou o Whale+ para receber sinais.
          </div>
        )}
        {(v.allowCall || v.allowPut) && wpEnabled && (
          <div className="rounded border border-primary/40 p-2 text-xs opacity-80">
            Whale+ está ativo — ao ligar Call/Put ele será desativado automaticamente.
          </div>
        )}
      </section>

      {/* Bloqueador de ruído */}
      <section className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div>
          <div className="font-display font-bold">Bloqueador de Ruído</div>
          <div className="text-[11px] opacity-70 mt-0.5">
            Impede sinais gerados nos últimos segundos da vela — evita entradas sem tempo de preparação.
          </div>
        </div>
        <Toggle
          label="Ativar bloqueio nos segundos finais"
          sub={`Bloqueia sinais nos últimos ${v.blockNearCloseSeconds}s da vela ativa.`}
          value={v.blockNearCloseEnabled}
          onChange={(x) => setProceduralveo6({ blockNearCloseEnabled: x })}
        />
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Segundos bloqueados</span>
            <span className="font-mono text-primary">{v.blockNearCloseSeconds}s</span>
          </div>
          <input
            type="range" min={1} max={30} step={1}
            value={v.blockNearCloseSeconds}
            onChange={(e) => setProceduralveo6({ blockNearCloseSeconds: Number(e.target.value) })}
            className="w-full accent-primary mt-2"
          />
        </div>
      </section>

      {/* Cooldown */}
      <section className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div>
          <div className="font-display font-bold">Cooldown entre Sinais</div>
          <div className="text-[11px] opacity-70 mt-0.5">
            Evita gerar sinais em sequência — mantém o profissionalismo do fluxo.
          </div>
        </div>
        <Toggle
          label="Ativar cooldown"
          sub={`Espera mínima de ${v.cooldownSeconds}s entre dois sinais.`}
          value={v.cooldownEnabled}
          onChange={(x) => setProceduralveo6({ cooldownEnabled: x })}
        />
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Tempo do cooldown</span>
            <span className="font-mono text-primary">{v.cooldownSeconds}s</span>
          </div>
          <input
            type="range" min={10} max={600} step={5}
            value={v.cooldownSeconds}
            onChange={(e) => setProceduralveo6({ cooldownSeconds: Number(e.target.value) })}
            className="w-full accent-primary mt-2"
          />
          <div className="text-[10px] opacity-60 mt-1">
            Quando um sinal for gerado durante o cooldown, o pop-up "Cooldown de Segurança" aparece.
          </div>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <button
      onClick={() => { const next = !v; setV(next); onChange(next); }}
      className="rounded-lg border border-border bg-card/50 p-3 flex items-center justify-between text-left"
    >
      <div className="flex-1 pr-3">
        <div className="font-medium text-sm">{label}</div>
        {sub ? <div className="text-[11px] opacity-60 mt-0.5">{sub}</div> : null}
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${v ? "bg-primary" : "bg-zinc-600"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${v ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}