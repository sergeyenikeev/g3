import { describe, expect, it } from "vitest";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart } from "../../src/game/daily/dailyAttempts";
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

  it("planDailyStart prefers the free attempt before rewarded extras", () => {
    const s = makeDefaultSave();
    const date = "20260101";
    const info = getDailyAttemptsInfo(DAILY_CFG, s, date);

    expect(planDailyStart(info, { boosted: false, boosterEnabled: true })).toEqual({
      canStart: true,
      kind: "free",
      needsAttemptRewarded: false,
      needsBoosterRewarded: false,
      attemptWasRewarded: false,
    });
  });

  it("planDailyStart requires the rewarded attempt only after the free one is spent", () => {
    const s = consumeDailyAttempt(makeDefaultSave(), "20260101");
    const info = getDailyAttemptsInfo(DAILY_CFG, s, "20260101");

    expect(planDailyStart(info, { boosted: false, boosterEnabled: true })).toEqual({
      canStart: true,
      kind: "rewarded",
      needsAttemptRewarded: true,
      needsBoosterRewarded: false,
      attemptWasRewarded: true,
    });
  });

  it("planDailyStart keeps boosted daily to one rewarded ad while free attempt exists", () => {
    const info = getDailyAttemptsInfo(DAILY_CFG, makeDefaultSave(), "20260101");

    expect(planDailyStart(info, { boosted: true, boosterEnabled: true })).toEqual({
      canStart: true,
      kind: "boosted_free",
      needsAttemptRewarded: false,
      needsBoosterRewarded: true,
      attemptWasRewarded: false,
    });
  });

  it("planDailyStart uses the booster ad as the rewarded extra attempt when free daily is exhausted", () => {
    const s = consumeDailyAttempt(makeDefaultSave(), "20260101");
    const info = getDailyAttemptsInfo(DAILY_CFG, s, "20260101");

    expect(planDailyStart(info, { boosted: true, boosterEnabled: true })).toEqual({
      canStart: true,
      kind: "boosted_rewarded",
      needsAttemptRewarded: false,
      needsBoosterRewarded: true,
      attemptWasRewarded: true,
    });
  });
});
