import { describe, expect, it } from "vitest";
import type { PlatformAdapter, RewardedResult } from "../../src/platform/platformAdapter";
import { SaveManager } from "../../src/platform/save/saveManager";

class MemoryAdapter implements PlatformAdapter {
  readonly name = "memory";
  private store: unknown | null = null;

  async init(): Promise<void> {}

  async showInterstitial(): Promise<boolean> {
    return true;
  }

  async showRewarded(): Promise<RewardedResult> {
    return { ok: true, rewarded: true };
  }

  async save(data: unknown): Promise<void> {
    this.store = data;
  }

  async load(): Promise<unknown | null> {
    return this.store;
  }
}

describe("SaveManager (integration)", () => {
  it("returns defaults when storage is empty", async () => {
    const sm = new SaveManager(new MemoryAdapter());
    const s = await sm.load();

    expect(s.v).toBe(1);
    expect(s.settings.language).toBe("auto");
    expect(s.settings.pilotName).toBe("");
    expect(s.leaderboard.highestDivision).toBe("scrapper");
    expect(s.leaderboard.claimedRewardDivisions).toEqual([]);
    expect(s.leaderboard.claimedMilestones).toEqual([]);
    expect(s.meta.wallet.bolts).toBe(0);
    expect(s.meta.wallet.cores).toBe(0);
  });

  it("round-trips saved data", async () => {
    const sm = new SaveManager(new MemoryAdapter());
    const s = await sm.load();
    s.stats.bestWave = 10;
    s.settings.language = "ru";
    s.settings.pilotName = "Nova";
    s.meta.wallet.bolts = 250;
    await sm.save(s);

    const s2 = await sm.load();
    expect(s2.stats.bestWave).toBe(10);
    expect(s2.settings.language).toBe("ru");
    expect(s2.settings.pilotName).toBe("Nova");
    expect(s2.leaderboard.highestDivision).toBe("scrapper");
    expect(s2.leaderboard.claimedMilestones).toEqual([]);
    expect(s2.meta.wallet.bolts).toBe(250);
  });

  it("sanitizes pilot names from storage", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save({
      v: 1,
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.6,
        visualQuality: "auto",
        language: "en",
        pilotName: "   Long   Pilot   Name   1234567890   ",
      },
      tutorial: { completed: false, skipped: false },
      meta: { nodeLevels: {}, wallet: { bolts: 0, cores: 0 } },
      stats: { bestWave: 0, bestBolts: 0, runsCompleted: 0 },
      ads: { lastInterstitialAtMs: 0, lastRewardedAtMs: 0 },
      daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
      leaderboard: { entries: [] },
    });

    const sm = new SaveManager(adapter);
    const s = await sm.load();
    expect(s.settings.pilotName).toBe("Long Pilot Name 12");
    expect(s.leaderboard.highestDivision).toBe("scrapper");
    expect(s.leaderboard.claimedRewardDivisions).toEqual([]);
    expect(s.leaderboard.claimedMilestones).toEqual([]);
  });

  it("falls back to defaults on invalid save version", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save({ v: 999 });

    const sm = new SaveManager(adapter);
    const s = await sm.load();
    expect(s.v).toBe(1);
  });
});
