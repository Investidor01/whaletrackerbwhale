import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fetchKlines } from "@/lib/binance";
import { useStore } from "@/lib/store";
import { runBacktest, type BacktestParams } from "@/lib/backtest";
import { PAIRS } from "@/lib/binance";
import { Brain, Loader2, Download, CheckCircle2 } from "lucide-react";
import { pushPopup } from "@/components/Popup";

export const Route = createFileRoute("/max-whale")({
  head: () => ({ meta: [{ title: "Max Whale — Otimização Automática" }] }),
  component: MaxWhalePage,
});

// Bounded parameter grid — keeps total combos reasonable for the browser.
const MA_SHORT = [5, 7, 9];
const MA_MID = [21, 25, 34];
const MA_LONG = [50, 99, 200];
const MACD_FAST = [8, 12];
const MACD_SLOW = [21, 26];
const STOCH = [14];

interface ComboResult { params: BacktestParams; trades: number; accuracy: number; conf99Acc: number }

function MaxWhalePage() {
  const config = useStore((s) => s.config);
  const setIndicators = useStore((s) => s.setIndicators);
  const [pair, setPair] = useState(config.pair);
  const [tf, setTf] = useState("5m");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [best, setBest] = useState<ComboResult[]>([]);
  const [imported, setImported] = useState<number | null>(null);

  async function optimize() {
    setRunning(true); setBest([]); setProgress(0); setImported(null);
    setPhase("Baixando dados históricos");
    pushPopup({ variant: "signal", title: "Max Whale Iniciado", message: "Buscando melhores configurações..." });
    const candles = await fetchKlines(pair, tf, 1000);
    setProgress(8);
    setPhase("Gerando combinações");
    await new Promise((r) => setTimeout(r, 200));

    const combos: BacktestParams[] = [];
    for (const s of MA_SHORT) for (const m of MA_MID) for (const l of MA_LONG)
      for (const f of MACD_FAST) for (const sl of MACD_SLOW) for (const st of STOCH) {
        if (s >= m || m >= l) continue;
        if (f >= sl) continue;
        combos.push({
          ma: { short: s, mid: m, long: l },
          macd: { fast: f, slow: sl, signal: 9 },
          stochRsi: { rsiP: st, stochP: st, kP: 3, dP: 3 },
        });
      }

    setPhase(`Backtestando ${combos.length} combinações`);
    const results: ComboResult[] = [];
    for (let i = 0; i < combos.length; i++) {
      const r = runBacktest(candles, combos[i]);
      if (r.trades >= 5) {
        const conf99Acc = r.conf99.trades ? (r.conf99.wins / r.conf99.trades) * 100 : 0;
        results.push({ params: combos[i], trades: r.trades, accuracy: r.accuracy, conf99Acc });
      }
      if (i % 6 === 0) {
        setProgress(Math.round(10 + (i / combos.length) * 85));
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setPhase("Ranqueando melhores resultados");
    results.sort((a, b) => (b.accuracy - a.accuracy) || (b.trades - a.trades));
    setBest(results.slice(0, 5));
    setProgress(100);
    setRunning(false);
    setPhase("Concluído");
    pushPopup({ variant: "win", title: "Max Whale Concluído", message: `Top ${Math.min(5, results.length)} configurações encontradas.` });
  }

  function importConfig(idx: number) {
    const c = best[idx];
    if (!c) return;
    setIndicators({
      ma: { ...config.indicators.ma, ...c.params.ma },
      macd: { ...config.indicators.macd, ...c.params.macd },
      stochRsi: { ...config.indicators.stochRsi, ...c.params.stochRsi },
    });
    setImported(idx);
    pushPopup({ variant: "signal", title: "Configuração Importada", message: "Indicadores atualizados com sucesso." });
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Max Whale</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Algoritmo automático que testa centenas de combinações de períodos de indicadores em dados históricos e identifica a configuração com a maior assertividade do dia.
        </p>
      </div>

      <div className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="opacity-60">Par</span>
            <select value={pair} onChange={(e) => setPair(e.target.value)} className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm">
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="opacity-60">Timeframe</span>
            <select value={tf} onChange={(e) => setTf(e.target.value)} className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm">
              {["1m","5m","15m","1h"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <button onClick={optimize} disabled={running} className="rounded-lg bg-primary text-primary-foreground font-display font-bold py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {running ? <><Loader2 className="h-4 w-4 animate-spin" /> {phase}...</> : "Iniciar Max Whale"}
        </button>
        {running && (
          <>
            <div className="h-2 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[11px] text-center opacity-70">{phase} · {progress}%</div>
          </>
        )}
      </div>

      {best.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase opacity-60 px-1">Melhores configurações encontradas</div>
          {best.map((b, i) => (
            <div key={i} className="binance-panel rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-sm font-bold">#{i + 1} · {b.accuracy.toFixed(1)}% <span className="opacity-50 text-xs">({b.trades} sinais)</span></div>
                  <div className="text-[11px] opacity-70 mt-1">MA {b.params.ma.short}/{b.params.ma.mid}/{b.params.ma.long}</div>
                  <div className="text-[11px] opacity-70">MACD {b.params.macd.fast}/{b.params.macd.slow}/{b.params.macd.signal}</div>
                  <div className="text-[11px] opacity-70">StochRSI {b.params.stochRsi.rsiP}/{b.params.stochRsi.stochP}</div>
                  {b.conf99Acc > 0 && <div className="text-[11px] text-[color:var(--win)] mt-0.5">Sinais 99%: {b.conf99Acc.toFixed(1)}%</div>}
                </div>
                <button
                  onClick={() => importConfig(i)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${imported === i ? "bg-[color:var(--win)]/20 text-[color:var(--win)]" : "bg-primary text-primary-foreground"}`}
                >
                  {imported === i ? <><CheckCircle2 className="h-3.5 w-3.5" /> Importado</> : <><Download className="h-3.5 w-3.5" /> Importar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}