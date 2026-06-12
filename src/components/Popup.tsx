import { useEffect, useState } from "react";

export type PopupVariant = "signal" | "started" | "win" | "loss" | "canceled" | "info";

export interface PopupItem {
  id: string;
  title: string;
  message?: string;
  variant: PopupVariant;
}

let listeners: ((p: PopupItem) => void)[] = [];
export function pushPopup(p: Omit<PopupItem, "id">) {
  const item: PopupItem = { ...p, id: `${Date.now()}-${Math.random()}` };
  listeners.forEach((l) => l(item));
}

const styles: Record<PopupVariant, string> = {
  signal: "from-cyan-400/30 to-cyan-600/10 border-cyan-300/60 text-cyan-100",
  started: "from-amber-400/30 to-amber-600/10 border-amber-300/60 text-amber-100",
  win: "from-emerald-400/30 to-emerald-600/10 border-emerald-300/60 text-emerald-100",
  loss: "from-rose-500/30 to-rose-700/10 border-rose-400/60 text-rose-100",
  canceled: "from-zinc-400/30 to-zinc-600/10 border-zinc-300/50 text-zinc-100",
  info: "from-violet-400/30 to-violet-600/10 border-violet-300/60 text-violet-100",
};

export function PopupHost() {
  const [items, setItems] = useState<PopupItem[]>([]);
  useEffect(() => {
    const fn = (p: PopupItem) => {
      setItems((s) => [...s, p]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== p.id)), 4200);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed top-3 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {items.map((p) => (
        <div
          key={p.id}
          className={`animate-slide-down rounded-2xl border bg-gradient-to-br px-4 py-3 backdrop-blur-xl shadow-[0_8px_40px_oklch(0_0_0/0.5)] ${styles[p.variant]}`}
        >
          <div className="text-sm font-display font-bold tracking-wide">{p.title}</div>
          {p.message ? <div className="text-xs opacity-80 mt-0.5">{p.message}</div> : null}
        </div>
      ))}
    </div>
  );
}