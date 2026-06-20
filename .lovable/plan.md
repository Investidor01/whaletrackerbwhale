## Problemas a corrigir

1. **Estado inconsistente ao navegar** — popups repetem, configurações "voltam ao antigo", sinais somem. Causa: `useSignalEngine` é montado no `Layout`, mas dedupe `shownPopups` é local de módulo e o engine roda em paralelo com `<Popup/>` que também monta listeners; algumas páginas têm hooks próprios que sobrescrevem `candles`/`cross` no store.
2. **Sinal não é gerado mesmo com cruzamento visível** — `signalDecision` exige `directions.ma === dir` no mesmo candle do cross, o que invalida muitos cruzamentos legítimos (a média rápida acabou de cruzar mas alinhamento ainda não está "estável"). Relaxar: usar o cross como verdade e exigir só MACD alinhado para 80% / +Stoch para 99%.
3. **Histórico duplicado** — `addSignal` é chamado sem checar se já existe sinal com mesmo `signalCandleStart`+pair+tf. Adicionar guarda.
4. **Seta só some ao navegar** — o gráfico filtra markers só na primeira render; o `useEffect` que aplica markers não re-dispara quando `result` muda. Forçar dependência em `history` e filtrar `PENDING` apenas.
5. **Forex sem indicadores** — `/forex` é página simples. Reaproveitar dashboard principal compartilhando componente.
6. **Backtest M1/M5/M30/H1** — adicionar presets de timeframe configuráveis (não só período).
7. **Max Whale baseado em histórico** — refazer: faz grid-search em dados ao vivo baixados na hora (não histórico do usuário), testa N combinações de períodos de MA/MACD/Stoch e retorna a mais assertiva.
8. **Toggles de indicadores** — em Configurações adicionar switches "usar MA / usar MACD / usar StochRSI" para permitir sinal com 1 indicador.
9. **Pro Whale+** — nova rota `/pro-whale` com gráfico, detecção automática de suporte/resistência (pivôs) e LTA/LTB (regressão dos topos/fundos), gera sinal apenas quando preço toca zona, com apurador próprio.
10. **Push Notifications** — pedir permissão e disparar notificação nativa em cada popup (`notifications.ts` já existe; garantir uso consistente).
11. **Seta após Win/Loss** — já é filtrada por PENDING, mas precisa re-renderizar quando `updateSignal` muda result. Corrigir dependência.

## Mudanças por arquivo

- `src/lib/useSignalEngine.ts`: relaxar regra de alinhamento; dedupe por `signalCandleStart`; respeitar toggles `useMA/useMACD/useStochRSI`; chamar `notify()` em cada popup.
- `src/lib/store.ts`: adicionar `config.indicatorsEnabled = {ma,macd,stochRsi}` e migração.
- `src/components/Chart.tsx`: efeito de markers depende de `history` e de `result`.
- `src/components/Layout.tsx`: garantir engine montado uma única vez (guard global); banner permission push.
- `src/routes/configuracoes.tsx`: 3 toggles novos.
- `src/routes/forex.tsx`: reusar mesmo dashboard de `index.tsx` (extrair `<DashboardView/>` compartilhado, recebendo lista de pares).
- `src/routes/backtest.tsx`: seletor de timeframe (1m/5m/30m/1h) + período.
- `src/routes/max-whale.tsx`: refazer — busca live de candles do par/tf escolhido, roda grid-search, retorna melhor combinação. Sem dependência do histórico do usuário.
- `src/routes/pro-whale.tsx` (novo) + `src/lib/sr.ts` (novo): pivôs (fractais N-bar), zonas S/R por clustering, LTA/LTB via regressão linear nos últimos N topos/fundos; gera sinal no toque; apurador próprio reusando lifecycle.
- `src/lib/notifications.ts`: assegurar `requestPermission` + helper `notify(title,body)` chamado pelo `pushPopup`.
- `routeTree.gen.ts` + menu do Layout: adicionar Pro Whale+.

## Validação

- Build limpo.
- Playwright: abrir `/`, ligar whale, simular candles via store para confirmar 1 sinal gerado, navegar para `/historico` e voltar — sem duplicação e sem popups repetidos.
- Conferir que seta some imediatamente após WIN/LOSS sem navegar.
- Backtest com tf=5m executa.
- Max Whale roda sem histórico salvo.
- Forex mostra cards de indicadores idênticos ao dashboard.
- Pro Whale+ desenha zonas e dispara sinal em toque simulado.
