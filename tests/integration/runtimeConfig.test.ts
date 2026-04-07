import { describe, expect, it } from "vitest";
import { buildRuntimeConfig } from "../../src/data/runtimeConfig";
import { applyDailyToConfig } from "../../src/game/daily/daily";
import { loadStaticGameData } from "../helpers/staticGameData";

describe("RuntimeConfig (integration)", () => {
  it("builds config from JSON and applies preset plus meta levels", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, {
      presetId: "casual",
      metaLevels: { meta_dash_unlock: 1, meta_frame_1: 2, meta_tail_1: 1 },
    });

    expect(built.config.player.hpMax).toBeGreaterThanOrEqual(110);
    expect(built.config.dash.enabledByDefault).toBe(true);
    expect(built.config.enemies.chaser.hp).toBeGreaterThan(0);
    expect(built.config.recycler.healOnBank).toBeGreaterThan(10);
    expect(built.config.tail.maxLenBase).toBeGreaterThan(14);
    expect(built.config.liveops.streak.maxDay).toBe(7);
    expect(built.config.leaderboards.boards.some((board) => board.key === "weekly")).toBe(true);
    expect((built.config.daily.rotations?.length ?? 0)).toBeGreaterThan(0);
    expect(built.config.ads.interstitialDailyCap).toBe(2);
    expect(built.config.ads.noInterstitialAfterRewardedChain).toBe(2);
  });

  it("applies daily modifiers to runtime config", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "normal", metaLevels: {} });

    const before = built.config.flip.cooldownBaseSec;
    applyDailyToConfig(built.config, built.basePerks, built.config.daily, {
      dateUtc: "20260101",
      variantId: "daily_fast_flip",
    });

    expect(built.config.flip.cooldownBaseSec).toBeLessThan(before);
  });
});
