import { describe, expect, it } from "vitest";
import {
  formatResource,
  getDailyVariantCopy,
  getLevelFinaleCopy,
  getLevelModifierCopy,
  getLevelObjectiveCopy,
  getMetaNodeName,
  getRarityLabel,
  normalizeLanguageSetting,
  resolveLocale,
  t,
} from "../../src/i18n/localization";

describe("localization", () => {
  it("resolves locale from an explicit setting", () => {
    expect(resolveLocale("ru", ["en-US"])).toBe("ru");
    expect(resolveLocale("en", ["ru-RU"])).toBe("en");
  });

  it("resolves auto locale from browser languages", () => {
    expect(resolveLocale("auto", ["ru-RU", "en-US"])).toBe("ru");
    expect(resolveLocale("auto", ["de-DE", "en-US"])).toBe("en");
  });

  it("normalizes invalid language settings to auto", () => {
    expect(normalizeLanguageSetting("fr")).toBe("auto");
    expect(normalizeLanguageSetting("ru")).toBe("ru");
  });

  it("formats localized copy for gameplay and meta data", () => {
    expect(t("ru", "menu.play")).toBe("ИГРАТЬ");
    expect(getDailyVariantCopy("ru", "daily_fast_flip").title).toBe("Быстрый флип");
    expect(getMetaNodeName("ru", "meta_dash_unlock", "Dash")).toBe("Тюнинг рывка");
    expect(getLevelModifierCopy("en", "salvage_surge").title).toBe("Salvage Surge");
    expect(getLevelObjectiveCopy("en", "deflect_projectiles").title).toBe("Return Fire");
    expect(getLevelFinaleCopy("en", "ion_tempest").title).toBe("Ion Tempest");
    expect(t("en", "menu.pilotButton", { name: "ORBIT-7" })).toBe("Pilot: ORBIT-7");
    expect(t("en", "leaderboard.division.elite")).toBe("Elite");
    expect(t("en", "leaderboard.milestone.legend_league")).toBe("Legend League");
    expect(t("en", "leaderboard.filter.daily")).toBe("DAILY");
    expect(t("en", "results.newRecord")).toBe("New record");
    expect(t("en", "results.bestDelta", { value: "+1200" })).toBe("Best delta: +1200");
    expect(t("en", "results.nextDivision", { division: "Elite", score: "60000" })).toBe("Next division: Elite at 60000");
    expect(t("en", "menu.leaderboardCareerStatus", { count: 2, total: 4, title: "Legend League" })).toBe(
      "Career badges 2/4. Next: Legend League"
    );
    expect(t("en", "results.pilot")).toBe("Pilot");
    expect(getRarityLabel("en", "epic")).toBe("EPIC");
    expect(formatResource("ru", "cores", 3)).toBe("3 ядра");
  });
});
