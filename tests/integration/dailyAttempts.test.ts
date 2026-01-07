import { describe, expect, it } from "vitest";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave } from "../../src/game/daily/dailyAttempts";
import type { DailyConfig } from "../../src/data/types";
import { makeDefaultSave } from "../../src/platform/save/saveManager";

const DAILY_CFG: DailyConfig = {
  seedMode: "utc_date_yyyymmdd",
  dailyRewards: { firstRunBonusBoltsMult: 1.25, extraAttemptRewardedMax: 2, coreDropBonus: 0.05 },
  dailyVariants: [],
};

describe("daily attempts (integration)", () => {
  it("normalizeDailySave resets attempts and best on date change", () => {
    const s = makeDefaultSave();
    const s2 = {
      ...s,
      daily: { ...s.daily, lastDateUtc: "20260101", attemptsUsed: 3, bestWave: 7, bestBolts: 123 },
    };
    const out = normalizeDailySave(s2, "20260102");
    expect(out.daily.lastDateUtc).toBe("20260102");
    expect(out.daily.attemptsUsed).toBe(0);
    expect(out.daily.bestWave).toBe(0);
    expect(out.daily.bestBolts).toBe(0);
  });

  it("getDailyAttemptsInfo enforces 1 free + rewarded extras", () => {
    const s = makeDefaultSave();
    const date = "20260101";

    const a0 = getDailyAttemptsInfo(DAILY_CFG, s, date);
    expect(a0.maxAttempts).toBe(3);
    expect(a0.canStartFree).toBe(true);
    expect(a0.canStartRewarded).toBe(false);

    const s1 = consumeDailyAttempt(s, date);
    const a1 = getDailyAttemptsInfo(DAILY_CFG, s1, date);
    expect(a1.attemptsUsed).toBe(1);
    expect(a1.canStartFree).toBe(false);
    expect(a1.canStartRewarded).toBe(true);

    const s2 = consumeDailyAttempt(consumeDailyAttempt(s1, date), date);
    const a3 = getDailyAttemptsInfo(DAILY_CFG, s2, date);
    expect(a3.attemptsUsed).toBe(3);
    expect(a3.canStartFree).toBe(false);
    expect(a3.canStartRewarded).toBe(false);
    expect(a3.attemptsLeft).toBe(0);
  });
});

