import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PAIRS, TIMEFRAMES } from "@/lib/binance";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Whale Tracker AI" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const { config, setConfig, setProcedural, setIndicators, setIndicatorsEnabled } = useStore();
  const ind = config.indicators;
  const enabled = config.indicatorsEnabled;
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Whale Tracker AI</div>
        <h2 className="font-display text-2xl font-bold text-primary">Configurações</h2>
      </div>
      <div className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div>
          <div className="font-display text-sm font-bold text-primary">Indicadores ativos para sinal</div>
          <div className="text-[11px] opacity-60">Desative para gerar sinais com apenas um indicador, sem confluência obrigatória.</div>
        </div>
        <ToggleRow label="Médias Móveis (MA)" value={enabled.ma} onChange={(v) => setIndicatorsEnabled({ ma: v })} />
        <ToggleRow label="MACD" value={enabled.macd} onChange={(v) => setIndicatorsEnabled({ macd: v })} />
        <ToggleRow label="Stochastic RSI" value={enabled.stochRsi} onChange={(v) => setIndicatorsEnabled({ stochRsi: v })} />
      </div>
      <div className="binance-panel rounded-lg p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Par padrão</label>
        <select value={config.pair} onChange={(e) => setConfig({ pair: e.target.value })} className="bg-card rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary">
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="binance-panel rounded-lg p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Timeframe</label>
        <select value={config.timeframe} onChange={(e) => setConfig({ timeframe: e.target.value })} className="bg-card rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary">
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="binance-panel rounded-lg p-4 flex flex-col gap-2">
        <label className="text-sm opacity-80">Tempo Proceduralveo3 (s)</label>
        <input
          type="number"
          min={5}
          max={45}
          value={config.procedural.seconds}
          onChange={(e) => setProcedural({ seconds: parseInt(e.target.value) || 15 })}
          className="bg-card rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <h3 className="font-display text-lg font-bold mt-2 text-primary">Médias Móveis</h3>
      <div className="binance-panel rounded-lg p-4 grid grid-cols-3 gap-3">
        <NumField label="Curta" value={ind.ma.short} onChange={(v) => setIndicators({ ma: { ...ind.ma, short: v } })} />
        <NumField label="Média" value={ind.ma.mid} onChange={(v) => setIndicators({ ma: { ...ind.ma, mid: v } })} />
        <NumField label="Longa" value={ind.ma.long} onChange={(v) => setIndicators({ ma: { ...ind.ma, long: v } })} />
        <ColorField label="Cor Curta" value={ind.ma.colorShort} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorShort: v } })} />
        <ColorField label="Cor Média" value={ind.ma.colorMid} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorMid: v } })} />
        <ColorField label="Cor Longa" value={ind.ma.colorLong} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorLong: v } })} />
      </div>

      <h3 className="font-display text-lg font-bold mt-2 text-primary">MACD</h3>
      <div className="binance-panel rounded-lg p-4 grid grid-cols-3 gap-3">
        <NumField label="Fast" value={ind.macd.fast} onChange={(v) => setIndicators({ macd: { ...ind.macd, fast: v } })} />
        <NumField label="Slow" value={ind.macd.slow} onChange={(v) => setIndicators({ macd: { ...ind.macd, slow: v } })} />
        <NumField label="Signal" value={ind.macd.signal} onChange={(v) => setIndicators({ macd: { ...ind.macd, signal: v } })} />
        <ColorField label="Cor MACD" value={ind.macd.colorLine} onChange={(v) => setIndicators({ macd: { ...ind.macd, colorLine: v } })} />
        <ColorField label="Cor Signal" value={ind.macd.colorSignal} onChange={(v) => setIndicators({ macd: { ...ind.macd, colorSignal: v } })} />
      </div>

      <h3 className="font-display text-lg font-bold mt-2 text-primary">Stochastic RSI</h3>
      <div className="binance-panel rounded-lg p-4 grid grid-cols-2 gap-3">
        <NumField label="RSI Período" value={ind.stochRsi.rsiP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, rsiP: v } })} />
        <NumField label="Stoch Período" value={ind.stochRsi.stochP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, stochP: v } })} />
        <NumField label="%K" value={ind.stochRsi.kP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, kP: v } })} />
        <NumField label="%D" value={ind.stochRsi.dP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, dP: v } })} />
        <ColorField label="Cor %K" value={ind.stochRsi.colorK} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, colorK: v } })} />
        <ColorField label="Cor %D" value={ind.stochRsi.colorD} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, colorD: v } })} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider opacity-60">{label}</span>
      <input
        type="number"
        min={1}
        max={500}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="bg-card rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider opacity-60">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 rounded cursor-pointer bg-transparent border-0"
      />
    </label>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 text-left"
    >
      <span className="text-sm">{label}</span>
      <span className={`relative inline-block h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}