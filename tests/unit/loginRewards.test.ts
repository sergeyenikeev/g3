import { describe, expect, it } from "vitest";
import {
  claimLoginReward,
  getLoginRewardForDay,
  getLoginRewardStatus,
  LOGIN_REWARD_DAY_COUNT,
} from "../../src/game/daily/loginRewards";
import { makeDefaultSave } from "../../src/platform/save/saveManager";

describe("loginRewards", () => {
  it("grants the day 1 reward on the first login of a day", () => {
    const save = makeDefaultSave();

    const result = claimLoginReward(save, "20260407");

    expect(result.claimed).toBe(true);
    expect(result.day).toBe(1);
    expect(result.reward).toEqual(getLoginRewardForDay(1));
    expect(result.save.loginRewards).toEqual({ lastClaimDateUtc: "20260407", day: 1 });
    expect(result.save.meta.wallet.bolts).toBe(30);
  });

  it("does not grant the reward twice on the same day", () => {
    const first = claimLoginReward(makeDefaultSave(), "20260407");
    const second = claimLoginReward(first.save, "20260407");

    expect(second.claimed).toBe(false);
    expect(second.save.meta.wallet.bolts).toBe(first.save.meta.wallet.bolts);
    expect(second.save.loginRewards.day).toBe(1);
  });

  it("cycles back to day 1 after day 5", () => {
    let save = makeDefaultSave();
    const dates = ["20260407", "20260408", "20260409", "20260410", "20260411", "20260412"];

    const claimedDays: number[] = [];
    for (const date of dates) {
      const result = claimLoginReward(save, date);
      save = result.save;
      claimedDays.push(result.day ?? 0);
    }

    expect(claimedDays).toEqual([1, 2, 3, 4, 5, 1]);
    expect(save.meta.wallet.bolts).toBe(30 + 60 + 90 + 120 + 150 + 30);
    expect(getLoginRewardStatus(save, "20260412")).toEqual({
      claimedToday: true,
      lastClaimDay: 1,
      lastClaimReward: getLoginRewardForDay(1),
      nextDay: 2,
      nextReward: getLoginRewardForDay(2),
    });
    expect(LOGIN_REWARD_DAY_COUNT).toBe(5);
  });
});
