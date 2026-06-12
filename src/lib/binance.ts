import type { Candle } from "./types";

const TF_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
};

export function tfSeconds(tf: string) {
  return TF_SECONDS[tf] ?? 60;
}

export async function fetchKlines(pair: string, tf: string, limit = 300): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${tf}&limit=${limit}`;
  const res = await fetch(url);
  const json = (await res.json()) as unknown[];
  return (json as Array<[number, string, string, string, string, ...unknown[]]>).map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

export interface KlineMsg {
  candle: Candle;
  closed: boolean;
}

export function subscribeKline(
  pair: string,
  tf: string,
  onMsg: (m: KlineMsg) => void,
): () => void {
  const url = `wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${tf}`;
  let ws: WebSocket | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const k = data.k;
        if (!k) return;
        onMsg({
          candle: {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          },
          closed: !!k.x,
        });
      } catch {
        /* noop */
      }
    };
    ws.onclose = () => {
      if (!closed) timer = setTimeout(connect, 1500);
    };
    ws.onerror = () => ws?.close();
  };
  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    ws?.close();
  };
}

export const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT"];
export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h"];