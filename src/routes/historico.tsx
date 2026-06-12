import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Trash2, TrendingUp, TrendingDown, Ban } from "lucide-react";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — Whale Tracker AI" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { history, clearHistory } = useStore();
  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-glow text-primary">Histórico</h2>
        <button
          onClick={() => confirm("Apagar todo o histórico?") && clearHistory()}
          className="flex items-center gap-2 rounded-xl border border-[color:var(--loss)]/50 px-3 py-2 text-sm text-[color:var(--loss)] hover:bg-[color:var(--loss)]/10"
        >
          <Trash2 className="h-4 w-4" />
          Apagar
        </button>
      </div>
      {history.length === 0 && (
        <div className="glass-card rounded-2xl p-8 text-center opacity-70">Nenhum sinal ainda. Ative a Baleia 🐋</div>
      )}
      {history.map((s) => {
        const isWin = s.result === "WIN";
        const isLoss = s.result === "LOSS";
        const isCancel = s.result === "CANCELED";
        return (
          <div key={s.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl ${
                isWin ? "bg-[color:var(--win)]/20 text-[color:var(--win)]" :
                isLoss ? "bg-[color:var(--loss)]/20 text-[color:var(--loss)]" :
                isCancel ? "bg-zinc-500/20 text-zinc-300" : "bg-primary/20 text-primary"
              }`}
            >
              {s.direction === "UP" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold">{s.pair} • {s.timeframe}</div>
              <div className="text-xs opacity-70">{new Date(s.createdAt).toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className={`font-bold text-sm ${
                isWin ? "text-[color:var(--win)]" :
                isLoss ? "text-[color:var(--loss)]" :
                isCancel ? "text-zinc-300" : "text-primary"
              }`}>
                {isCancel ? <span className="flex items-center gap-1"><Ban className="h-3 w-3" />CANCELADO</span> : s.result}
              </div>
              <div className="text-xs opacity-60">{s.confidence}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}