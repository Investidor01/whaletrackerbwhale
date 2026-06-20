import type { Candle } from "./types";

export interface PivotPoint { index: number; time: number; price: number; kind: "high" | "low" }

/** Fractal-based pivots: a high higher than `look` bars on each side. */
export function findPivots(candles: Candle[], look = 3): PivotPoint[] {
  const out: PivotPoint[] = [];
  for (let i = look; i < candles.length - look; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = i - look; j <= i + look; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, time: c.time, price: c.high, kind: "high" });
    if (isLow) out.push({ index: i, time: c.time, price: c.low, kind: "low" });
  }
  return out;
}

export interface Zone { price: number; kind: "support" | "resistance"; strength: number }

/** Cluster pivots into S/R zones by proximity. */
export function clusterZones(pivots: PivotPoint[], tolerancePct = 0.0025, max = 6): Zone[] {
  const groups: { kind: "support" | "resistance"; prices: number[] }[] = [];
  for (const p of pivots) {
    const kind: Zone["kind"] = p.kind === "high" ? "resistance" : "support";
    const g = groups.find((x) => x.kind === kind && Math.abs(x.prices[0] - p.price) / p.price < tolerancePct);
    if (g) g.prices.push(p.price);
    else groups.push({ kind, prices: [p.price] });
  }
  return groups
    .map((g) => ({ price: g.prices.reduce((a, b) => a + b, 0) / g.prices.length, kind: g.kind, strength: g.prices.length }))
    .filter((z) => z.strength >= 2)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, max);
}

export interface TrendLine { kind: "lta" | "ltb"; a: number; b: number; startTime: number; endTime: number }

/**
 * Linear regression on most recent N lows → LTA (uptrend support).
 * Most recent N highs → LTB (downtrend resistance).
 */
export function fitTrendlines(pivots: PivotPoint[], look = 5): TrendLine[] {
  const out: TrendLine[] = [];
  const lows = pivots.filter((p) => p.kind === "low").slice(-look);
  const highs = pivots.filter((p) => p.kind === "high").slice(-look);
  const fit = (pts: PivotPoint[]) => {
    if (pts.length < 2) return null;
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.time, 0);
    const sy = pts.reduce((s, p) => s + p.price, 0);
    const sxy = pts.reduce((s, p) => s + p.time * p.price, 0);
    const sxx = pts.reduce((s, p) => s + p.time * p.time, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const a = (n * sxy - sx * sy) / denom;
    const b = (sy - a * sx) / n;
    return { a, b, startTime: pts[0].time, endTime: pts[pts.length - 1].time };
  };
  const ltaFit = fit(lows);
  const ltbFit = fit(highs);
  if (ltaFit && ltaFit.a > 0) out.push({ kind: "lta", ...ltaFit });
  if (ltbFit && ltbFit.a < 0) out.push({ kind: "ltb", ...ltbFit });
  return out;
}

export function lineValueAt(line: TrendLine, time: number): number {
  return line.a * time + line.b;
}

export function distancePct(a: number, b: number) {
  return Math.abs(a - b) / Math.max(b, 1e-9);
}
