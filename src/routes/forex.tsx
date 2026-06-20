import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";
import { FIAT_PAIRS } from "@/lib/binance";

export const Route = createFileRoute("/forex")({
  head: () => ({ meta: [{ title: "Moedas Fiduciárias — Whale Tracker AI" }] }),
  component: () => (
    <DashboardView
      pairs={FIAT_PAIRS}
      icon="💶"
      priceDigits={4}
      title="Moedas Fiduciárias"
      subtitle="EUR, GBP, AUD e outras moedas fiat contra stablecoins. Mesmo motor profissional, com todos os indicadores e cards de cruzamento."
    />
  ),
});
