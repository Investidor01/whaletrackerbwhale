import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fetchKlines } from "@/lib/binance";
import { useStore } from "@/lib/store";
import { runBacktest, BACKTEST_TFS, BACKTEST_RANGES, type BacktestResult } from "@/lib/backtest";
import { PAIRS } from "@/lib/binance";
import { FlaskConical, Loader2, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/backtest")({
  head: () => ({ meta: [{ title: "Backtest — Whale Tracker AI" }] }),
  component: BacktestPage,
});

function BacktestPage() {
  const config = useStore((s) => s.config);
  const [pair, setPair] = useState(config.pair);
  const [tf, setTf] = useState("5m");
  const [rangeId, setRangeId] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [progress, setProgress] = useState(0);
  const range = BACKTEST_RANGES.find((p) => p.id === rangeId)!;

  async function run() {
    setLoading(true); setResult(null); setProgress(10);
    try {
      const candles = await fetchKlines(pair, tf, range.candles);
      setProgress(60);
      await new Promise((r) => setTimeout(r, 80));
      const r = runBacktest(candles, config.indicators);
      setProgress(100);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="binance-panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Backtest Profissional</h1>
        </div>
        <p className="text-xs text-muted-foreground">Analise a assertividade da sua configuração atual de indicadores sobre dados históricos.</p>
      </div>

      <div className="binance-panel rounded-lg p-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs">
            <span className="opacity-60">Par</span>
            <select value={pair} onChange={(e) => setPair(e.target.value)} className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm">
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="opacity-60">Timeframe</span>
            <select value={tf} onChange={(e) => setTf(e.target.value)} className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm">
              {BACKTEST_TFS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="opacity-60">Amostra</span>
            <select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm">
              {BACKTEST_RANGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>
        <div className="text-[11px] opacity-60">
          Indicadores aplicados: MA {config.indicators.ma.short}/{config.indicators.ma.mid}/{config.indicators.ma.long} · MACD {config.indicators.macd.fast}/{config.indicators.macd.slow}/{config.indicators.macd.signal} · StochRSI {config.indicators.stochRsi.rsiP}/{config.indicators.stochRsi.stochP}
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary text-primary-foreground font-display font-bold py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : "Executar Backtest"}
        </button>
        {loading && (
          <div className="h-2 rounded-full bg-card overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <div className="binance-panel rounded-lg p-4">
            <div className="text-[10px] uppercase opacity-60">Assertividade Geral</div>
            <div className={`font-display text-4xl font-bold ${result.accuracy >= 60 ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>
              {result.accuracy.toFixed(1)}%
            </div>
            <div className="text-xs mt-1">{result.trades} sinais · {result.wins} W / {result.losses} L</div>
            <div className={`mt-2 text-[11px] inline-flex px-2 py-1 rounded ${result.accuracy >= 65 ? "bg-[color:var(--win)]/15 text-[color:var(--win)]" : result.accuracy >= 50 ? "bg-primary/15 text-primary" : "bg-[color:var(--loss)]/15 text-[color:var(--loss)]"}`}>
              {result.accuracy >= 65 ? "EXCELENTE" : result.accuracy >= 50 ? "ACEITÁVEL" : "RUIM — recalibrar"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Sinais 80%" trades={result.conf80.trades} wins={result.conf80.wins} />
            <StatCard label="Sinais 99%" trades={result.conf99.trades} wins={result.conf99.wins} />
          </div>
          <div className="binance-panel rounded-lg p-3 max-h-72 overflow-auto">
            <div className="text-xs uppercase opacity-60 mb-2">Últimos sinais</div>
            <div className="flex flex-col gap-1">
              {result.signals.slice(-30).reverse().map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border">
                  <span className="flex items-center gap-2">
                    {s.dir === "UP" ? <TrendingUp className="h-3.5 w-3.5 text-[color:var(--win)]" /> : <TrendingDown className="h-3.5 w-3.5 text-[color:var(--loss)]" />}
                    {s.dir === "UP" ? "CALL" : "PUT"} · {s.conf}%
                  </span>
                  <span className="opacity-60">{new Date(s.time * 1000).toLocaleString()}</span>
                  <span className={s.result === "WIN" ? "text-[color:var(--win)] font-bold" : "text-[color:var(--loss)] font-bold"}>{s.result}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, trades, wins }: { label: string; trades: number; wins: number }) {
  const acc = trades ? Math.round((wins / trades) * 100) : 0;
  return (
    <div className="binance-panel rounded-lg p-3">
      <div className="text-[10px] uppercase opacity-60">{label}</div>
      <div className={`font-display text-2xl font-bold ${acc >= 60 ? "text-[color:var(--win)]" : "text-[color:var(--loss)]"}`}>{acc}%</div>
      <div className="text-[11px] opacity-60">{wins}/{trades}</div>
    </div>
  );
}