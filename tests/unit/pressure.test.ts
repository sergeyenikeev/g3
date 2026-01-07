import { describe, expect, it } from "vitest";
import { computePressure, getPressureTargets } from "../../src/game/director/pressure";

describe("pressure", () => {
  it("computePressure считает сумму весов", () => {
    const cfg = {
      tail: { maxLenCap: 40 },
      director: {
        pressure: {
          weights: { nearEnemies: 0.6, nearProjectiles: 0.35, recentHits: 1.2, tailLenFactor: 1.0 },
          targetMinBase: 2,
          targetMinPerWave: 0.1,
          targetMaxBase: 4,
          targetMaxPerWave: 0.2,
          radiusNearEnemies: 100,
          radiusNearProjectiles: 100,
          recentHitWindowSec: 6,
        },
      },
    };

    const p = computePressure(cfg as any, { nearEnemies: 3, nearProjectiles: 2, recentHits: 1, tailLen: 20 });
    // 0.6*3 + 0.35*2 + 1.2*1 + 1.0*(20/40)
    expect(p).toBeCloseTo(1.8 + 0.7 + 1.2 + 0.5);
  });

  it("targets растут по волнам", () => {
    const cfg = {
      director: {
        pressure: {
          targetMinBase: 2,
          targetMinPerWave: 0.1,
          targetMaxBase: 4,
          targetMaxPerWave: 0.2,
          weights: { nearEnemies: 1, nearProjectiles: 1, recentHits: 1, tailLenFactor: 1 },
          radiusNearEnemies: 100,
          radiusNearProjectiles: 100,
          recentHitWindowSec: 6,
        },
      },
    };
    expect(getPressureTargets(cfg as any, 1)).toEqual({ min: 2, max: 4 });
    expect(getPressureTargets(cfg as any, 5)).toEqual({ min: 2.4, max: 4.8 });
  });
});

