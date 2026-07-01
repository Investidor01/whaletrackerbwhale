import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, Home, History, ShieldCheck, ShieldAlert, Sparkles, Users, BarChart3, Settings, Info, Bell, Waves, Zap } from "lucide-react";
import { useSignalEngine } from "@/lib/useSignalEngine";
import { useStore } from "@/lib/store";
import { pushPopup } from "@/components/Popup";
import { ensureNotificationPermission } from "@/lib/notifications";

const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/proceduralveo3", label: "Proceduralveo3", icon: ShieldCheck },
  { to: "/proceduralveo4", label: "Proceduralveo4", icon: Sparkles },
  { to: "/proceduralveo5", label: "Proceduralveo5", icon: ShieldAlert },
  { to: "/proceduralveo6", label: "Proceduralveo6", icon: Zap },
  { to: "/whale-plus", label: "Whale +", icon: Waves },
  { to: "/analises-futuro", label: "Análises do Futuro", icon: Users },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/sobre", label: "Sobre", icon: Info },
] as const;

// Module-level cache so the whale-toggle popup never replays on
// HMR/route remounts — only on actual user toggle.
let lastSeenWhale: boolean | null = null;

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useSignalEngine();
  const whaleActive = useStore((s) => s.whaleActive);
  const veo5Enabled = useStore((s) => s.config.proceduralveo5.enabled);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  );
  useEffect(() => {
    // Ask once, on mount, so signal popups can mirror to OS push.
    ensureNotificationPermission().then((p) => setNotifPerm(p));
  }, []);
  useEffect(() => {
    if (lastSeenWhale === whaleActive) return;
    if (lastSeenWhale === null) {
      lastSeenWhale = whaleActive;
      return;
    }
    lastSeenWhale = whaleActive;
    if (whaleActive) {
      pushPopup({
        variant: "signal",
        title: "ANALISANDO BALEIAS NO MERCADO",
        message: "Whale Tracker AI ativado — rastreando fluxo.",
      });
      if (veo5Enabled) {
        pushPopup({
          variant: "info",
          title: "Proceduralveo5 Analisando Liquidez Baleias",
          message: "Confirmando cruzamentos selecionados em tempo real.",
        });
      }
    } else {
      pushPopup({
        variant: "info",
        title: "Análise pausada",
        message: "Whale Tracker AI desativado.",
      });
    }
  }, [whaleActive, veo5Enabled]);
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 py-3 shadow-[0_8px_24px_oklch(0_0_0/0.28)]">
        <button
          aria-label="Menu"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:border-primary/70 hover:text-primary transition"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-center font-display font-bold text-lg sm:text-xl tracking-tight">
          <span className="text-primary">Whale</span>{" "}
          <span className="text-foreground">Tracker</span>{" "}
          <span className="text-primary">AI</span>
        </h1>
        <div className="h-10 w-10" />
      </header>
      {notifPerm === "default" && (
        <button
          onClick={() => ensureNotificationPermission().then((p) => setNotifPerm(p))}
          className="mx-auto mt-2 flex items-center gap-2 rounded-lg binance-panel px-3 py-2 text-xs text-primary"
        >
          <Bell className="h-4 w-4" /> Ativar notificações push
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 animate-fade-up">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 h-full w-[78%] max-w-xs binance-panel animate-slide-down p-5 flex flex-col gap-1 rounded-r-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-lg text-primary">Menu</span>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-card hover:text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-card hover:text-primary transition"
                activeProps={{ className: "bg-card text-primary border border-primary/40" }}
              >
                <n.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="px-4 pb-24 pt-4 max-w-3xl mx-auto">{children}</main>
    </div>
  );
}