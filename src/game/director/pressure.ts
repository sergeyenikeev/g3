import type { Balances } from "../../data/types";

export type PressureMetrics = {
  nearEnemies: number;
  nearProjectiles: number;
  recentHits: number;
  tailLen: number;
};

export type PressureTargets = { min: number; max: number };

export function getPressureTargets(cfg: Pick<Balances, "director">, waveIndex: number): PressureTargets {
  const i = Math.max(0, waveIndex - 1);
  return {
    min: cfg.director.pressure.targetMinBase + cfg.director.pressure.targetMinPerWave * i,
    max: cfg.director.pressure.targetMaxBase + cfg.director.pressure.targetMaxPerWave * i,
  };
}

export function computePressure(cfg: Pick<Balances, "director" | "tail">, metrics: PressureMetrics): number {
  const w = cfg.director.pressure.weights;
  const tailLenFactor = cfg.tail.maxLenCap > 0 ? clamp(metrics.tailLen / cfg.tail.maxLenCap, 0, 1) : 0;
  return (
    w.nearEnemies * Math.max(0, metrics.nearEnemies) +
    w.nearProjectiles * Math.max(0, metrics.nearProjectiles) +
    w.recentHits * Math.max(0, metrics.recentHits) +
    w.tailLenFactor * tailLenFactor
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

