import { describe, expect, it } from "vitest";
import { buildRuntimeConfig } from "../../src/data/runtimeConfig";
import { applyTrainingModeConfig } from "../../src/game/tutorial/trainingMode";
import { loadStaticGameData } from "../helpers/staticGameData";

describe("training mode", () => {
  it("softens the run and disables monetization hooks", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "normal", metaLevels: {} });

    const before = {
      bankTimeSec: built.config.recycler.bankTimeSec,
      chaserSpeed: built.config.enemies.chaser.speed,
      shooterDamage: built.config.enemies.shooter.projectile.damage,
      reviveEnabled: built.config.ads.rewarded.revive.enabled,
    };

    applyTrainingModeConfig(built.config);

    expect(built.config.recycler.bankTimeSec).toBeLessThanOrEqual(before.bankTimeSec);
    expect(built.config.enemies.chaser.speed).toBeLessThan(before.chaserSpeed);
    expect(built.config.enemies.shooter.projectile.damage).toBeLessThanOrEqual(before.shooterDamage);
    expect(built.config.ads.rewarded.revive.enabled).toBe(false);
    expect(built.config.ads.rewarded.x2Results.enabled).toBe(false);
    expect(built.config.ads.rewarded.reroll.enabled).toBe(false);
    expect(before.reviveEnabled).toBe(true);
  });
});
