import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Globe2, ShieldCheck, Sparkles, Target, TrendingUp, Waves } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Whale Tracker AI" },
      { name: "description", content: "7 anos rastreando baleias. 2 bilhões em volume diário. 70 países." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="flex flex-col gap-5 animate-fade-up pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl binance-panel p-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
        <div className="relative">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-5xl shadow-[0_0_60px_oklch(0.82_0.16_85/0.35)]">
            🐋
          </div>
          <h2 className="font-display text-3xl font-bold mt-4 text-primary">Whale Tracker AI</h2>
          <p className="opacity-80 mt-2 text-sm max-w-md mx-auto">
            A inteligência por trás dos movimentos das maiores carteiras do mundo.
            Rastreamos baleias em tempo real e convertemos seu fluxo em sinais de alta assertividade.
          </p>
        </div>
      </section>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <Big icon={<TrendingUp className="h-4 w-4" />} n="99%" t="de assertividade em sinais 3⭐" />
        <Big icon={<Activity className="h-4 w-4" />} n="2bi" t="USD em volume monitorado/dia" />
        <Big icon={<Globe2 className="h-4 w-4" />} n="70+" t="países usam o sistema" />
        <Big icon={<ShieldCheck className="h-4 w-4" />} n="7anos" t="rastreando baleias 24/7" />
      </div>

      {/* Como funciona */}
      <section className="binance-panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Como funciona</h3>
        </div>
        <ol className="flex flex-col gap-3 text-sm">
          <Step n="1" title="Rastreamento de Baleias" desc="Monitoramos transações de grandes carteiras em múltiplas blockchains em tempo real." />
          <Step n="2" title="Cruzamento de Indicadores" desc="MA, MACD e Stochastic RSI são correlacionados ao fluxo de baleias na vela atual." />
          <Step n="3" title="Proceduralveo3" desc="Antes do fechamento, reanalisamos os indicadores. Se houver recuo, o sinal é cancelado." />
          <Step n="4" title="Entrada na Próxima Vela" desc="Sinais aprovados entram automaticamente na abertura da vela seguinte." />
        </ol>
      </section>

      {/* Diferenciais */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Feature icon={<Waves className="h-5 w-5 text-primary" />} title="Fluxo de Baleias" desc="Detecção em tempo real do movimento de grandes players." />
        <Feature icon={<Target className="h-5 w-5 text-primary" />} title="Sinais Filtrados" desc="Apenas convergências fortes geram entrada — sem ruído." />
        <Feature icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Proteção Proceduralveo3" desc="Cancela automaticamente sinais com recuo nos indicadores." />
        <Feature icon={<Activity className="h-5 w-5 text-primary" />} title="100% Tempo Real" desc="Stream direto da Binance via WebSocket." />
      </section>

      {/* Depoimentos */}
      <section className="binance-panel rounded-2xl p-5">
        <h3 className="font-display font-bold text-lg mb-4">O que dizem</h3>
        <div className="flex flex-col gap-3 text-sm">
          <Quote text="Operei 14 sinais essa semana. 13 wins." who="Marcus T., BR" />
          <Quote text="O Proceduralveo3 me salvou de 4 perdas em um único dia." who="Linda W., US" />
          <Quote text="Sinto que estou vendo o mercado pelos olhos das baleias." who="Hiroshi T., JP" />
        </div>
      </section>

      <Link
        to="/"
        className="rounded-2xl py-4 text-center font-display font-bold tracking-wide bg-primary text-primary-foreground hover:opacity-90 transition shadow-[0_8px_30px_oklch(0.82_0.16_85/0.35)]"
      >
        Começar a analisar →
      </Link>
    </div>
  );
}

function Big({ n, t, icon }: { n: string; t: string; icon: React.ReactNode }) {
  return (
    <div className="binance-panel rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-primary opacity-80">{icon}<span className="text-[10px] uppercase tracking-wider">Métrica</span></div>
      <div className="font-display text-3xl font-bold mt-1 text-primary">{n}</div>
      <div className="text-xs opacity-80 mt-1 leading-tight">{t}</div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary font-display font-bold text-xs">{n}</span>
      <div>
        <div className="font-bold">{title}</div>
        <div className="opacity-80">{desc}</div>
      </div>
    </li>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="binance-panel rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="font-display font-bold text-sm">{title}</span></div>
      <div className="text-xs opacity-80">{desc}</div>
    </div>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <div className="border-l-2 border-primary/60 pl-3">
      <div className="italic">"{text}"</div>
      <div className="opacity-60 text-xs mt-1">— {who}</div>
    </div>
  );
}