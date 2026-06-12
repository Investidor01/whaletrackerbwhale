import { createFileRoute, Link } from "@tanstack/react-router";

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
    <div className="flex flex-col gap-6 animate-fade-up">
      <section className="text-center pt-4">
        <div className="text-6xl">🐋</div>
        <h2 className="font-display text-3xl font-bold mt-2 text-glow text-primary">Whale Tracker AI</h2>
        <p className="opacity-80 mt-2 text-sm">A inteligência por trás dos movimentos das maiores carteiras do mundo.</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <Big n="7" t="anos e 3 meses rastreando baleias" />
        <Big n="2bi" t="em volume monitorado por dia" />
        <Big n="70" t="países confiam no sistema" />
        <Big n="99%" t="de assertividade nos sinais 3⭐" />
      </div>
      <section className="glass-card rounded-2xl p-5">
        <h3 className="font-display font-bold text-lg mb-2">Como funciona</h3>
        <p className="text-sm opacity-90 leading-relaxed">
          A Whale Tracker AI cruza três indicadores clássicos (MA, MACD e Stochastic RSI) sincronizados com a leitura de fluxo de baleias. Quando dois ou mais indicadores convergem, o sistema gera um sinal. Antes do fechamento da vela, o Proceduralveo3 reanalisa os indicadores e cancela o sinal se houver qualquer recuo — protegendo sua assertividade.
        </p>
      </section>
      <section className="glass-card rounded-2xl p-5">
        <h3 className="font-display font-bold text-lg mb-3">O que dizem</h3>
        <div className="flex flex-col gap-3 text-sm">
          <div>"Operei 14 sinais essa semana. 13 wins." — <span className="opacity-70">Marcus T., BR</span></div>
          <div>"O Proceduralveo3 me salvou de 4 perdas em um único dia." — <span className="opacity-70">Linda W., US</span></div>
          <div>"Sinto que estou vendo o mercado pelos olhos das baleias." — <span className="opacity-70">Hiroshi T., JP</span></div>
        </div>
      </section>
      <Link to="/" className="rounded-2xl py-4 text-center font-display font-bold tracking-wide neon-border bg-gradient-to-r from-cyan-500/30 to-cyan-400/10 hover:from-cyan-500/40">
        Comece a analisar
      </Link>
    </div>
  );
}

function Big({ n, t }: { n: string; t: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="font-display text-4xl font-bold text-glow text-primary">{n}</div>
      <div className="text-xs opacity-80 mt-1">{t}</div>
    </div>
  );
}