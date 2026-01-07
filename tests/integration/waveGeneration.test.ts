import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/prng";
import { buildRuntimeConfig } from "../../src/data/runtimeConfig";
import { buildWavePlan } from "../../src/game/director/waveDirector";
import { loadStaticGameData } from "../helpers/staticGameData";

describe("WaveDirector (integration)", () => {
  it("учитывает anti-snowball при low HP", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "normal" });
    const rng = createRng("wave-seed");
    const waveSet = built.config.waveSets.default;
    expect(waveSet).toBeTruthy();

    const plan = buildWavePlan(
      { waves: built.config.waves, director: built.config.director, tail: built.config.tail },
      waveSet!,
      built.config.patterns,
      1,
      { tailLen: 0, hpRatio: 0.1 },
      rng
    );

    expect(plan.extraScrapClusters).toBeGreaterThanOrEqual(built.config.director.antiSnowball.lowHpExtraScrapClusters);
    expect(plan.budget).toBeLessThanOrEqual(7);
  });

  it("breather волна помечается special", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "normal" });
    const rng = createRng("wave-seed2");
    const waveSet = built.config.waveSets.default!;

    const plan = buildWavePlan(
      { waves: built.config.waves, director: built.config.director, tail: built.config.tail },
      waveSet,
      built.config.patterns,
      built.config.director.breather.everyWaves,
      { tailLen: 0, hpRatio: 1 },
      rng
    );

    expect(plan.special?.type).toBe("breather");
    expect(plan.durationSec).toBeCloseTo(built.config.director.breather.durationSec);
  });
});

