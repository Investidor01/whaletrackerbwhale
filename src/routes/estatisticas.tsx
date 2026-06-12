import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/estatisticas")({
  head: () => ({ meta: [{ title: "Estatísticas — Whale Tracker AI" }] }),
  component: StatsPage,
});

function StatsPage() {
  const { history } = useStore();
  const wins = history.filter((h) => h.result === "WIN").length;
  const losses = history.filter((h) => h.result === "LOSS").length;
  const canceled = history.filter((h) => h.result === "CANCELED").length;
  const total = wins + losses;
  const acc = total ? (wins / total) * 100 : 0;
  const cancelRate = history.length ? (canceled / history.length) * 100 : 0;
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h2 className="font-display text-2xl font-bold text-glow text-primary">Estatísticas</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider opacity-60">Total Win</div>
          <div className="font-display text-4xl font-bold mt-1 text-[color:var(--win)]">{wins}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider opacity-60">Total Loss</div>
          <div className="font-display text-4xl font-bold mt-1 text-[color:var(--loss)]">{losses}</div>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wider opacity-60">Assertividade</div>
        <div className="font-display text-5xl font-bold text-glow text-primary mt-1">{acc.toFixed(1)}%</div>
        <div className="h-2 mt-3 rounded-full bg-zinc-700/50 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${acc}%` }} />
        </div>
      </div>
      <div className="glass-card rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wider opacity-60">Taxa de Cancelamento (Proceduralveo3)</div>
        <div className="font-display text-4xl font-bold mt-1">{cancelRate.toFixed(1)}%</div>
        <div className="text-xs opacity-70 mt-1">{canceled} sinais cancelados para proteger seu resultado.</div>
      </div>
    </div>
  );
}