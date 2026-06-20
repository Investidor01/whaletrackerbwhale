import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";
import { PAIRS } from "@/lib/binance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whale Tracker AI — Dashboard" },
      { name: "description", content: "Monitor de baleias e sinais cripto em tempo real." },
    ],
  }),
  component: () => <DashboardView pairs={PAIRS} icon="🐋" priceDigits={2} />,
});
