import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/analises-futuro")({
  head: () => ({ meta: [{ title: "Análises do Futuro — Whale Tracker AI" }] }),
  component: ComunidadePage,
});

const BOTS = [
  "Marcus Tenório", "Linda Whitmore", "Hiroshi Tanaka", "Ana Beatriz Salles", "Lucas Andrade",
  "Sophie Laurent", "Dimitri Volkov", "Aisha Okafor", "Rafael Mendoza", "Chloe O'Brien",
  "Takeshi Mori", "Camila Restrepo", "Olivier Dubois", "Priya Sharma", "Henrik Olsen",
  "Mateus Cavalcanti", "Yuki Nakamura", "Isabella Rossi", "Karim El-Hadi", "Bruna Vasconcelos",
  "Niko Karjalainen", "Diego Salvatierra", "Hannah Becker", "Joaquim Pestana", "Mei Lin",
  "Sebastian Krüger", "Layla Hassan", "Fernanda Quintela", "Owen Patterson", "Saskia Janssen",
  "Pedro Henrique Mota", "Aaliyah Coleman", "Mirko Bianchi", "Larissa Pimentel", "Yusuf Demir",
  "Carolina Bastos", "Felix Brandt", "Júlia Aparecida", "Khalid Al-Mansouri", "Rodrigo Boa Sorte",
];

const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#22d3ee", "#eab308"];

const TEMPLATES = [
  "Detectei movimento de baleia em {pair} — próxima vela possível {dir}.",
  "{robots} robôs convergindo em {pair}. Cuidado com {dir}.",
  "Zona de baleia identificada na {exchange} • {pair}. Possível {dir} a caminho.",
  "Liquidez se acumulando em {pair}. Próximos minutos: {dir} provável.",
  "Fluxo institucional em {pair} pela {exchange}. Sinal de {dir} fortalecendo.",
  "{robots} confirmações em {pair}. A baleia está se posicionando para {dir}.",
  "Spike de volume em {pair} • zona crítica. Atenção para {dir}.",
  "Padrão idêntico a 7d atrás em {pair}. Resultado: {dir}.",
  "Carteira #{robots} acumulando {pair} na {exchange}. {dir} esperada.",
  "Engenharia de fluxo aponta {dir} em {pair} no próximo candle.",
];

const EXCHANGES = ["Binance", "Bybit", "OKX", "Coinbase Pro", "Kraken"];

interface Post {
  id: string;
  bot: string;
  color: string;
  text: string;
  ts: number;
}

function generate(pair: string, lastDir: "alta" | "baixa", used: Set<string>): Post | null {
  for (let tries = 0; tries < 8; tries++) {
    const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const text = tpl
      .replace("{pair}", pair)
      .replace("{dir}", lastDir)
      .replace("{robots}", String(3 + Math.floor(Math.random() * 14)))
      .replace("{exchange}", EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)]);
    if (!used.has(text)) {
      used.add(text);
      const idx = Math.floor(Math.random() * BOTS.length);
      return {
        id: `${Date.now()}-${Math.random()}`,
        bot: BOTS[idx],
        color: COLORS[idx % COLORS.length],
        text,
        ts: Date.now(),
      };
    }
  }
  return null;
}

function ComunidadePage() {
  const { config } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const usedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tick = () => {
      const dir: "alta" | "baixa" = Math.random() > 0.5 ? "alta" : "baixa";
      const p = generate(config.pair, dir, usedRef.current);
      if (p) setPosts((s) => [p, ...s].slice(0, 40));
    };
    tick();
    tick();
    tick();
    const id = setInterval(tick, 4000 + Math.random() * 5000);
    return () => clearInterval(id);
  }, [config.pair]);

  return (
    <div className="flex flex-col gap-3 animate-fade-up">
      <h2 className="font-display text-2xl font-bold text-glow text-primary">Análises do Futuro</h2>
      <div className="glass-card rounded-2xl p-3 border-l-4 border-l-[color:var(--gold)] text-xs">
        🐋 <span className="opacity-90">Apenas fundadores publicam aqui. Comentários desativados.</span>
      </div>
      {posts.map((p) => (
        <article key={p.id} className="glass-card rounded-2xl p-3 flex gap-3 animate-fade-up">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-sm text-black"
            style={{ background: p.color }}
          >
            {p.bot.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm truncate">{p.bot}</span>
              <span className="text-[10px] opacity-60">{new Date(p.ts).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm mt-1 leading-snug">{p.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}