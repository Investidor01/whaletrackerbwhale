import { useEffect, useState } from "react";
import { pushNotify } from "@/lib/notifications";

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
  // Mirror to OS-level push notification when permission granted
  pushNotify(item.title, item.message);
}

const styles: Record<PopupVariant, string> = {
  signal: "border-primary/70 text-primary",
  started: "border-primary/70 text-primary",
  win: "border-[color:var(--win)]/70 text-[color:var(--win)]",
  loss: "border-[color:var(--loss)]/70 text-[color:var(--loss)]",
  canceled: "border-muted-foreground/50 text-muted-foreground",
  info: "border-primary/70 text-primary",
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
          className={`animate-slide-down rounded-lg border bg-card px-4 py-3 shadow-[0_8px_40px_oklch(0_0_0/0.5)] ${styles[p.variant]}`}
        >
          <div className="text-sm font-display font-bold tracking-wide">{p.title}</div>
          {p.message ? <div className="text-xs opacity-80 mt-0.5">{p.message}</div> : null}
        </div>
      ))}
    </div>
  );
}