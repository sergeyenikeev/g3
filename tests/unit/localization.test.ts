import { describe, expect, it } from "vitest";
import {
  formatResource,
  formatShortSeconds,
  getDailyRotationCopy,
  getDailyVariantCopy,
  getLevelFinaleCopy,
  getLevelModifierCopy,
  getLevelObjectiveCopy,
  getLiveopsEventCopy,
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

  it("formats compact cooldown labels without scene-level locale branches", () => {
    expect(formatShortSeconds("en", 2.1)).toBe("3s");
    expect(formatShortSeconds("ru", 2.1)).toBe("3с");
  });

  it("formats localized copy for gameplay and meta data", () => {
    expect(t("ru", "menu.play")).toBe("ИГРАТЬ");
    expect(getDailyVariantCopy("ru", "daily_fast_flip").title).toBe("Быстрый флип");
    expect(getDailyVariantCopy("ru", "daily_cash_surge").title).toBe("Кассовый всплеск");
    expect(getDailyRotationCopy("ru", "caravan_week").title).toBe("Неделя каравана");
    expect(getDailyRotationCopy("ru", "caravan_week").badge).toBe("НЕДЕЛЯ КАРАВАНА");
    expect(getLiveopsEventCopy("ru", "tomorrow_offer").title).toBe("Завтрашний бонус двора");
    expect(getMetaNodeName("ru", "meta_dash_unlock", "Dash")).toBe("Тюнинг рывка");
    expect(getMetaNodeName("ru", "meta_salvage_routes", "Routes")).toBe("Маршруты добычи");
    expect(getLevelModifierCopy("en", "salvage_surge").title).toBe("Salvage Surge");
    expect(getLevelModifierCopy("en", "breaker_surge").title).toBe("Breaker Surge");
    expect(getLevelObjectiveCopy("en", "deflect_projectiles").title).toBe("Return Fire");
    expect(getLevelFinaleCopy("en", "ion_tempest").title).toBe("Ion Tempest");
    expect(getLevelFinaleCopy("en", "core_monsoon").title).toBe("Core Monsoon");
    expect(t("en", "menu.pilotButton", { name: "ORBIT-7" })).toBe("Pilot: ORBIT-7");
    expect(t("en", "leaderboard.division.elite")).toBe("Elite");
    expect(t("en", "leaderboard.milestone.legend_league")).toBe("Legend League");
    expect(t("en", "leaderboard.filter.daily")).toBe("DAILY");
    expect(t("en", "menu.liveopsTitle")).toBe("MISSION BOARD");
    expect(t("en", "menu.readyBadge", { count: "2" })).toBe("READY 2");
    expect(t("en", "menu.mission.use_flip", { target: "3" })).toBe("Use FLIP 3x");
    expect(t("ru", "menu.mission.collect_heavy_scrap", { target: "8" })).toBe("Тяж. лом 8");
    expect(t("en", "menu.careerMilestonesTitle")).toBe("Career badges");
    expect(t("en", "menu.careerUnlocked")).toBe("Unlocked");
    expect(
      t("en", "menu.loginRewardLine", {
        day: "3",
        maxDay: "5",
        reward: "90 bolts",
        nextDay: "4",
        nextReward: "120 bolts",
      })
    ).toBe("Login reward: Day 3/5 90 bolts | Next Day 4: 120 bolts");
    expect(t("en", "toast.loginReward", { day: "2", reward: "60 bolts" })).toBe("Login reward claimed: Day 2 | 60 bolts");
    expect(t("en", "results.newRecord")).toBe("New record");
    expect(t("en", "results.bestDelta", { value: "+1200" })).toBe("Best delta: +1200");
    expect(t("en", "results.nextDivision", { division: "Elite", score: "60000" })).toBe("Next division: Elite at 60000");
    expect(t("en", "results.weeklyBoard", { rank: "2", division: "Ace" })).toBe("Weekly board: #2 | Ace");
    expect(t("en", "results.weeklyDeltaUp", { value: "3" })).toBe("Weekly climb: +3");
    expect(t("en", "menu.leaderboardCareerStatus", { count: 2, total: 4, title: "Legend League" })).toBe(
      "Career badges 2/4. Next: Legend League"
    );
    expect(t("en", "menu.playFreeBoost", { usesLeft: "2" })).toBe("PLAY + FREE BOOST (2 left)");
    expect(t("en", "menu.claimOpsReady", { count: "3" })).toBe("CLAIM READY (3)");
    expect(t("en", "toast.opsClaimed", { reward: "120 bolts" })).toBe("Claimed liveops rewards: 120 bolts");
    expect(t("en", "results.pilot")).toBe("Pilot");
    expect(getRarityLabel("en", "epic")).toBe("EPIC");
    expect(formatResource("ru", "cores", 3)).toBe("3 ядра");
  });

  it("keeps russian leaderboard and rewards copy free from leftover english labels", () => {
    expect(t("ru", "toast.noOpsReady")).not.toContain("liveops");
    expect(t("ru", "toast.opsClaimed", { reward: "120 болтов" })).not.toContain("liveops");
    expect(t("ru", "toast.weeklyBoardReward", { division: "Старатель", reward: "120 болтов" })).not.toContain("weekly");
    expect(t("ru", "results.weeklyDeltaUp", { value: "3" })).not.toContain("weekly");
    expect(t("ru", "results.weeklyDeltaDown", { value: "2" })).not.toContain("weekly");
    expect(t("ru", "results.weeklyDeltaNew")).not.toContain("weekly");
    expect(getDailyRotationCopy("ru", "caravan_week").title).not.toContain("Caravan");
    expect(getLiveopsEventCopy("ru", "tomorrow_offer").title).not.toContain("Tomorrow");
  });
  it("covers staged menu and weekly race copy used by redesigned menu helpers", () => {
    expect(t("en", "menu.weeklyRaceHotLine", { division: "Elite", remaining: "1200" })).toBe("One strong run to Elite | 1200");
    expect(
      t("en", "menu.liveopsStatusLine", {
        day: "3",
        streakState: "READY",
        ready: "2",
        daily: "1/3",
        weekly: "4/8",
      })
    ).toBe("Streak 3 READY | ready 2 | d 1/3 | w 4/8");
    expect(t("en", "menu.weeklyRaceHeldRewardBadge", { reward: "120B" })).toBe("RESET 120B");
    expect(t("en", "menu.rewardBoltsCompact", { value: "35" })).toBe("35B");
    expect(t("en", "menu.installedLevelShort")).toBe("Lv.");

    expect(t("ru", "menu.weeklyRaceHotLine", { division: "Элита", remaining: "1200" })).not.toContain("One strong run");
    expect(t("ru", "menu.liveopsStatusLine", { day: "3", streakState: "ГОТОВО", ready: "2", daily: "1/3", weekly: "4/8" })).not.toContain("Streak");
    expect(t("ru", "menu.weeklyRaceHeldRewardBadge", { reward: "120Б" })).not.toContain("RESET");
    expect(t("ru", "menu.rewardBoltsCompact", { value: "35" })).not.toContain("B");
    expect(t("ru", "menu.installedLevelShort")).not.toBe("Lv.");
  });
});
