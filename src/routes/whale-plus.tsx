import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Waves, TrendingUp, TrendingDown, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { ema } from "@/lib/indicators";
import { pushPopup } from "@/components/Popup";

export const Route = createFileRoute("/whale-plus")({
  head: () => ({ meta: [{ title: "Whale + — EMA de Força" }] }),
  component: WhalePlusPage,
});

function WhalePlusPage() {
  const config = useStore((s) => s.config);
  const candles = useStore((s) => s.candles);
  const setWhalePlus = useStore((s) => s.setWhalePlus);
  const wp = config.whalePlus;
  const veo6 = config.proceduralveo6;

  const veo6DirectionActive = veo6.allowCall || veo6.allowPut;
  const blockedByVeo6 = veo6DirectionActive;

  const [period, setPeriod] = useState(wp.emaPeriod);
  const [threshold, setThreshold] = useState(wp.strengthThreshold);
  useEffect(() => setPeriod(wp.emaPeriod), [wp.emaPeriod]);
  useEffect(() => setThreshold(wp.strengthThreshold), [wp.strengthThreshold]);

  const force = useMemo(() => {
    if (candles.length < wp.emaPeriod + 2) return null;
    const closes = candles.map((c) => c.close);
    const e = ema(closes, wp.emaPeriod);
    const last = e[e.length - 1];
    const price = closes[closes.length - 1];
    if (last == null || !Number.isFinite(last)) return null;
    const distPct = ((price - last) / last) * 100;
    return { price, ema: last, distPct, dir: distPct > 0 ? "UP" : "DOWN" as const };
  }, [candles, wp.emaPeriod]);

  const strong = force ? Math.abs(force.distPct) >= wp.strengthThreshold : false;

  const toggle = () => {
    if (!wp.enabled && blockedByVeo6) {
      pushPopup({
        variant: "info",
        title: "Whale+ bloqueado",
        message: "Desative Call/Put no Proceduralveo6 antes de ativar a EMA de Força.",
      });
      return;
    }
    setWhalePlus({ enabled: !wp.enabled });
    pushPopup({
      variant: wp.enabled ? "info" : "signal",
      title: wp.enabled ? "Whale+ desativado" : "Whale+ ativado",
      message: wp.enabled
        ? "Sinais voltam a passar sem filtro de EMA de força."
        : `EMA${wp.emaPeriod} · limiar ${wp.strengthThreshold}% controlando os sinais.`,
    });
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <Waves className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold text-glow text-primary">Whale +</h2>
      </div>
      <p className="text-sm opacity-80">
        <b className="text-primary">EMA de Força mestre.</b> Quando ativa, só permite sinais alinhados
        com a direção da força do mercado — se a EMA aponta para cima, só CALL passa; se aponta para
        baixo, só PUT. Quando desativada não interfere em nada.
      </p>

      {blockedByVeo6 && (
        <div className="binance-panel rounded-lg p-3 border border-[color:var(--loss)]/40 flex gap-2 text-xs">
          <Info className="h-4 w-4 text-[color:var(--loss)] shrink-0 mt-0.5" />
          <div>
            O <b>Proceduralveo6</b> está com filtro de Call/Put ativo. Whale+ não pode ser ligado ao
            mesmo tempo para evitar conflito de métodos — desative Call/Put primeiro.
          </div>
        </div>
      )}

      <div className="binance-panel rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="font-display font-bold">Ativar EMA de Força</div>
          <div className="text-[11px] opacity-70 mt-0.5">Mestre — filtra todos os sinais.</div>
        </div>
        <button
          onClick={toggle}
          className={`relative h-7 w-14 rounded-full transition ${wp.enabled ? "bg-primary" : "bg-zinc-600"} ${blockedByVeo6 ? "opacity-40" : ""}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${wp.enabled ? "left-7" : "left-0.5"}`} />
        </button>
      </div>

      <div className="binance-panel rounded-lg p-4 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Período da EMA</span>
            <span className="font-mono text-primary">{period}</span>
          </div>
          <input
            type="range" min={5} max={200} step={1} value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            onMouseUp={() => setWhalePlus({ emaPeriod: period })}
            onTouchEnd={() => setWhalePlus({ emaPeriod: period })}
            className="w-full accent-primary mt-2"
          />
          <div className="text-[10px] opacity-60 mt-1">Ex.: 21 (curta), 50 (padrão), 200 (longa).</div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Limiar de Força (%)</span>
            <span className="font-mono text-primary">{threshold.toFixed(2)}%</span>
          </div>
          <input
            type="range" min={0} max={2} step={0.05} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            onMouseUp={() => setWhalePlus({ strengthThreshold: threshold })}
            onTouchEnd={() => setWhalePlus({ strengthThreshold: threshold })}
            className="w-full accent-primary mt-2"
          />
          <div className="text-[10px] opacity-60 mt-1">Distância mínima do preço à EMA para considerar força válida.</div>
        </div>
      </div>

      <div className="binance-panel rounded-lg p-4">
        <div className="text-xs uppercase opacity-60 mb-2">Leitura ao vivo</div>
        {force ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Preço" value={force.price.toFixed(2)} />
            <Metric label={`EMA${wp.emaPeriod}`} value={force.ema.toFixed(2)} />
            <Metric
              label="Força"
              value={`${force.distPct >= 0 ? "+" : ""}${force.distPct.toFixed(2)}%`}
              cls={strong ? (force.dir === "UP" ? "text-[color:var(--win)]" : "text-[color:var(--loss)]") : "opacity-60"}
            />
            <div className="col-span-3 flex items-center justify-center gap-2 mt-2 text-sm font-display font-bold">
              {force.dir === "UP" ? <TrendingUp className="h-4 w-4 text-[color:var(--win)]" /> : <TrendingDown className="h-4 w-4 text-[color:var(--loss)]" />}
              {strong ? (
                <span className={force.dir === "UP" ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}>
                  Força a favor de {force.dir === "UP" ? "CALL" : "PUT"}
                </span>
              ) : (
                <span className="opacity-70">Mercado sem força — sinais bloqueados</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs opacity-60">Aguardando dados suficientes...</div>
        )}
      </div>

      <div className="binance-panel rounded-lg p-4 text-xs opacity-80 leading-relaxed">
        <b className="text-primary">Como funciona:</b>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Calcula uma EMA no período escolhido (padrão 50).</li>
          <li>Compara o preço atual com a EMA — acima significa força de compra, abaixo de venda.</li>
          <li>Só libera o sinal se a distância for maior que o limiar configurado.</li>
          <li>Sinal contra a direção da força é <b>bloqueado automaticamente</b>.</li>
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase opacity-60">{label}</div>
      <div className={`font-display text-base font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}