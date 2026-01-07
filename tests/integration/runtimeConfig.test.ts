import { describe, expect, it } from "vitest";
import { buildRuntimeConfig } from "../../src/data/runtimeConfig";
import { applyDailyToConfig } from "../../src/game/daily/daily";
import { loadStaticGameData } from "../helpers/staticGameData";

describe("RuntimeConfig (integration)", () => {
  it("собирает конфиг из JSON + применяет preset и meta", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "casual", metaLevels: { meta_dash_unlock: 1 } });

    expect(built.config.player.hpMax).toBeGreaterThanOrEqual(110);
    expect(built.config.dash.enabledByDefault).toBe(true);
    expect(built.config.enemies.chaser.hp).toBeGreaterThan(0);
  });

  it("daily применяет modifiers к конфигу", async () => {
    const data = await loadStaticGameData();
    const built = buildRuntimeConfig(data, { presetId: "normal", metaLevels: {} });

    const before = built.config.flip.cooldownBaseSec;
    applyDailyToConfig(built.config, built.basePerks, built.config.daily, { dateUtc: "20260101", variantId: "daily_fast_flip" });
    const after = built.config.flip.cooldownBaseSec;

    expect(after).toBeLessThan(before);
  });
});
