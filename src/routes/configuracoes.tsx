import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PAIRS, TIMEFRAMES } from "@/lib/binance";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Whale Tracker AI" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const { config, setConfig, setProcedural, setIndicators } = useStore();
  const ind = config.indicators;
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

      <h3 className="font-display text-lg font-bold mt-2 text-primary">Médias Móveis</h3>
      <div className="glass-card rounded-2xl p-4 grid grid-cols-3 gap-3">
        <NumField label="Curta" value={ind.ma.short} onChange={(v) => setIndicators({ ma: { ...ind.ma, short: v } })} />
        <NumField label="Média" value={ind.ma.mid} onChange={(v) => setIndicators({ ma: { ...ind.ma, mid: v } })} />
        <NumField label="Longa" value={ind.ma.long} onChange={(v) => setIndicators({ ma: { ...ind.ma, long: v } })} />
        <ColorField label="Cor Curta" value={ind.ma.colorShort} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorShort: v } })} />
        <ColorField label="Cor Média" value={ind.ma.colorMid} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorMid: v } })} />
        <ColorField label="Cor Longa" value={ind.ma.colorLong} onChange={(v) => setIndicators({ ma: { ...ind.ma, colorLong: v } })} />
      </div>

      <h3 className="font-display text-lg font-bold mt-2 text-primary">MACD</h3>
      <div className="glass-card rounded-2xl p-4 grid grid-cols-3 gap-3">
        <NumField label="Fast" value={ind.macd.fast} onChange={(v) => setIndicators({ macd: { ...ind.macd, fast: v } })} />
        <NumField label="Slow" value={ind.macd.slow} onChange={(v) => setIndicators({ macd: { ...ind.macd, slow: v } })} />
        <NumField label="Signal" value={ind.macd.signal} onChange={(v) => setIndicators({ macd: { ...ind.macd, signal: v } })} />
        <div className="col-span-3">
          <ColorField label="Cor" value={ind.macd.color} onChange={(v) => setIndicators({ macd: { ...ind.macd, color: v } })} />
        </div>
      </div>

      <h3 className="font-display text-lg font-bold mt-2 text-primary">Stochastic RSI</h3>
      <div className="glass-card rounded-2xl p-4 grid grid-cols-2 gap-3">
        <NumField label="RSI Período" value={ind.stochRsi.rsiP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, rsiP: v } })} />
        <NumField label="Stoch Período" value={ind.stochRsi.stochP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, stochP: v } })} />
        <NumField label="%K" value={ind.stochRsi.kP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, kP: v } })} />
        <NumField label="%D" value={ind.stochRsi.dP} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, dP: v } })} />
        <div className="col-span-2">
          <ColorField label="Cor" value={ind.stochRsi.color} onChange={(v) => setIndicators({ stochRsi: { ...ind.stochRsi, color: v } })} />
        </div>
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