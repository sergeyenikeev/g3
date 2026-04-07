import { describe, expect, it } from "vitest";
import {
  applyRunSummaryToLiveops,
  claimComebackReward,
  claimMissionReward,
  claimStreakReward,
  getComebackStatus,
  getMissionStatuses,
  getStreakStatus,
  getWeekKey,
  normalizeLiveopsSave,
} from "../../src/game/liveops/liveops";
import { makeDefaultSave } from "../../src/platform/save/saveManager";
import { loadStaticGameData } from "../helpers/staticGameData";

describe("liveops", () => {
  it("advances streaks and session counters across UTC days", async () => {
    const data = await loadStaticGameData();
    const firstBoot = normalizeLiveopsSave(makeDefaultSave(), data.liveops, data.leaderboards, "20260407");

    expect(firstBoot.save.liveops.sessionsStarted).toBe(1);
    expect(firstBoot.save.liveops.streak.day).toBe(1);
    expect(firstBoot.summary.streakAdvanced).toBe(true);

    const secondBoot = normalizeLiveopsSave(firstBoot.save, data.liveops, data.leaderboards, "20260408");
    const streak = getStreakStatus(secondBoot.save, data.liveops, "20260408");

    expect(secondBoot.summary.returnedAfterDays).toBe(1);
    expect(secondBoot.save.liveops.sessionsStarted).toBe(2);
    expect(streak.day).toBe(2);
    expect(streak.canClaim).toBe(true);

    const claimed = claimStreakReward(secondBoot.save, data.liveops, "20260408");
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.day).toBe(2);
      expect(claimed.save.liveops.streak.claimedDateUtc).toBe("20260408");
    }
  });

  it("marks comeback eligibility after idle days and prevents double-claim", async () => {
    const data = await loadStaticGameData();
    const firstBoot = normalizeLiveopsSave(makeDefaultSave(), data.liveops, data.leaderboards, "20260401");
    const returnBoot = normalizeLiveopsSave(firstBoot.save, data.liveops, data.leaderboards, "20260405");
    const comeback = getComebackStatus(returnBoot.save, data.liveops);

    expect(returnBoot.summary.returnedAfterDays).toBe(4);
    expect(comeback.eligible).toBe(true);
    expect(comeback.daysAway).toBe(4);

    const firstClaim = claimComebackReward(returnBoot.save, data.liveops, "20260405");
    expect(firstClaim.ok).toBe(true);
    if (firstClaim.ok) {
      const secondClaim = claimComebackReward(firstClaim.save, data.liveops, "20260405");
      expect(secondClaim.ok).toBe(false);
    }
  });

  it("tracks deterministic daily and weekly mission completion from run summaries", async () => {
    const data = await loadStaticGameData();
    const normalized = normalizeLiveopsSave(makeDefaultSave(), data.liveops, data.leaderboards, "20260407");
    const progressed = applyRunSummaryToLiveops(normalized.save, data.liveops, "20260407", {
      mode: "run",
      wave: 20,
      score: 42000,
      totalBolts: 1000,
      bankedBolts: 600,
      heavyScrapCollected: 20,
      projectilesDeflected: 50,
      flipsUsed: 50,
    });

    const completedDaily = getMissionStatuses(progressed, data.liveops, "daily", "20260407").filter(
      (mission) => mission.completed && !mission.claimed
    );
    const completedWeekly = getMissionStatuses(progressed, data.liveops, "weekly", "20260407").filter(
      (mission) => mission.completed && !mission.claimed
    );

    expect(completedDaily.length).toBeGreaterThan(0);
    expect(completedWeekly.length).toBeGreaterThan(0);

    const dailyClaim = claimMissionReward(progressed, data.liveops, "daily", "20260407", completedDaily[0]!.def.id);
    expect(dailyClaim.ok).toBe(true);
    if (dailyClaim.ok) {
      const duplicate = claimMissionReward(dailyClaim.save, data.liveops, "daily", "20260407", completedDaily[0]!.def.id);
      expect(duplicate.ok).toBe(false);
    }
  });

  it("uses Monday-based UTC week keys", () => {
    expect(getWeekKey("20260407")).toBe("20260406");
    expect(getWeekKey("20260412")).toBe("20260406");
  });
});
