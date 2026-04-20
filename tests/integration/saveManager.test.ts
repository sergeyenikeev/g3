import { afterEach, describe, expect, it } from "vitest";
import type { PlatformAdapter, PlatformLoadOptions, RewardedResult } from "../../src/platform/platformAdapter";
import { SaveManager } from "../../src/platform/save/saveManager";
import { LOCAL_SAVE_MIRROR_KEY } from "../../src/platform/storageKeys";

const originalLocalStorage = (globalThis as any).localStorage;

afterEach(() => {
  if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
  else (globalThis as any).localStorage = originalLocalStorage;
});

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

  async load(_options?: PlatformLoadOptions): Promise<unknown | null> {
    return this.store;
  }
}

class ScopedMemoryAdapter extends MemoryAdapter {
  constructor(private readonly scope: string) {
    super();
  }

  getStorageScope(): string {
    return this.scope;
  }
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
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
    expect(s.loginRewards).toEqual({ lastClaimDateUtc: null, day: 0 });
    expect(s.liveops.sessionsStarted).toBe(0);
    expect(s.liveops.streak.day).toBe(0);
    expect(s.liveops.missions.daily.claimedIds).toEqual([]);
    expect(s.liveops.weeklyLeaderboard.weekKey).toBeNull();
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
    s.loginRewards.lastClaimDateUtc = "20260407";
    s.loginRewards.day = 3;
    s.liveops.sessionsStarted = 2;
    s.liveops.streak.day = 2;
    s.liveops.missions.daily.dateUtc = "20260407";
    s.liveops.missions.daily.progress.daily_bank_140 = 90;
    s.liveops.weeklyLeaderboard.weekKey = "20260406";
    await sm.save(s);

    const s2 = await sm.load();
    expect(s2.stats.bestWave).toBe(10);
    expect(s2.settings.language).toBe("ru");
    expect(s2.settings.pilotName).toBe("Nova");
    expect(s2.leaderboard.highestDivision).toBe("scrapper");
    expect(s2.leaderboard.claimedMilestones).toEqual([]);
    expect(s2.loginRewards).toEqual({ lastClaimDateUtc: "20260407", day: 3 });
    expect(s2.liveops.sessionsStarted).toBe(2);
    expect(s2.liveops.streak.day).toBe(2);
    expect(s2.liveops.missions.daily.progress.daily_bank_140).toBe(90);
    expect(s2.liveops.weeklyLeaderboard.weekKey).toBe("20260406");
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
    expect(s.loginRewards).toEqual({ lastClaimDateUtc: null, day: 0 });
  });

  it("falls back to defaults on invalid save version", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save({ v: 999 });

    const sm = new SaveManager(adapter);
    const s = await sm.load();
    expect(s.v).toBe(1);
  });

  it("captures raw platform payloads before sanitizing them", async () => {
    const captured: unknown[] = [];
    const rawSave = {
      v: 1,
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.6,
        visualQuality: "auto",
        language: "ru",
        pilotName: "Nova",
      },
      tutorial: { completed: true, skipped: false },
      meta: { nodeLevels: {}, wallet: { bolts: 42, cores: 1 } },
      stats: { bestWave: 7, bestBolts: 100, runsCompleted: 3 },
      ads: {
        lastInterstitialAtMs: 0,
        lastRewardedAtMs: 0,
        rewardedChainCount: 0,
        lastFrustrationAtMs: 0,
        lastRunStartedAtMs: 0,
        lastRunDurationSec: 0,
        interstitialDateUtc: null,
        interstitialsShownToday: 0,
      },
      loginRewards: { lastClaimDateUtc: null, day: 0 },
      liveops: {
        firstSeenDateUtc: null,
        lastSeenDateUtc: null,
        sessionsStarted: 0,
        lastReturnGapDays: 0,
        activation: { firstScrapTracked: false, firstBankTracked: false, firstUpgradeTracked: false },
        onboarding: { freeBoostsUsed: 0 },
        streak: { day: 0, claimedDateUtc: null },
        comeback: { lastClaimDateUtc: null, lastEligibleGapDays: 0 },
        missions: {
          daily: { dateUtc: null, progress: {}, claimedIds: [] },
          weekly: { weekKey: null, progress: {}, claimedIds: [] },
        },
        claimedEventRewardIds: [],
        weeklyLeaderboard: {
          weekKey: null,
          entries: [],
          highestDivision: "scrapper",
          claimedRewardDivisions: [],
          claimedRewardWeekKeys: [],
        },
      },
      daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
      leaderboard: { entries: [], highestDivision: "scrapper", claimedRewardDivisions: [], claimedMilestones: [] },
      legacyDraftMeta: { tutorialVersion: 0 },
    };

    class RawCaptureAdapter extends MemoryAdapter {
      async load(options?: PlatformLoadOptions): Promise<unknown | null> {
        options?.captureRawPlatformData?.(rawSave);
        return rawSave;
      }
    }

    const sm = new SaveManager(new RawCaptureAdapter());
    const save = await sm.load({
      captureRawPlatformData: (value) => captured.push(value),
    });

    expect(captured).toEqual([rawSave]);
    expect(save.settings.pilotName).toBe("Nova");
    expect(save.meta.wallet.bolts).toBe(42);
  });

  it("does not rewrite platform data when recovery loads from the local mirror", async () => {
    (globalThis as any).localStorage = new MemoryStorage();

    const mirrorSave = {
      v: 1,
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.6,
        visualQuality: "auto",
        language: "ru",
        pilotName: "Mirror",
      },
      tutorial: { completed: false, skipped: false },
      meta: { nodeLevels: {}, wallet: { bolts: 5, cores: 0 } },
      stats: { bestWave: 1, bestBolts: 5, runsCompleted: 1 },
      ads: {
        lastInterstitialAtMs: 0,
        lastRewardedAtMs: 0,
        rewardedChainCount: 0,
        lastFrustrationAtMs: 0,
        lastRunStartedAtMs: 0,
        lastRunDurationSec: 0,
        interstitialDateUtc: null,
        interstitialsShownToday: 0,
      },
      loginRewards: { lastClaimDateUtc: null, day: 0 },
      liveops: {
        firstSeenDateUtc: null,
        lastSeenDateUtc: null,
        sessionsStarted: 0,
        lastReturnGapDays: 0,
        activation: { firstScrapTracked: false, firstBankTracked: false, firstUpgradeTracked: false },
        onboarding: { freeBoostsUsed: 0 },
        streak: { day: 0, claimedDateUtc: null },
        comeback: { lastClaimDateUtc: null, lastEligibleGapDays: 0 },
        missions: {
          daily: { dateUtc: null, progress: {}, claimedIds: [] },
          weekly: { weekKey: null, progress: {}, claimedIds: [] },
        },
        claimedEventRewardIds: [],
        weeklyLeaderboard: {
          weekKey: null,
          entries: [],
          highestDivision: "scrapper",
          claimedRewardDivisions: [],
          claimedRewardWeekKeys: [],
        },
      },
      daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
      leaderboard: { entries: [], highestDivision: "scrapper", claimedRewardDivisions: [], claimedMilestones: [] },
    };

    class MirrorRecoveryAdapter extends ScopedMemoryAdapter {
      loadCalls: Array<PlatformLoadOptions | null> = [];
      saveCalls: unknown[] = [];

      async load(options?: PlatformLoadOptions): Promise<unknown | null> {
        this.loadCalls.push(options ?? null);
        return null;
      }

      async save(data: unknown): Promise<void> {
        this.saveCalls.push(data);
        await super.save(data);
      }
    }

    const adapter = new MirrorRecoveryAdapter("yandex:player-a");
    globalThis.localStorage.setItem(`${LOCAL_SAVE_MIRROR_KEY}:yandex:player-a`, JSON.stringify(mirrorSave));

    const sm = new SaveManager(adapter);
    const save = await sm.load({ ignorePlatformData: true });

    expect(save.settings.pilotName).toBe("Mirror");
    expect(adapter.saveCalls).toEqual([]);
    expect(adapter.loadCalls).toHaveLength(1);
  });

  it("can save to the local mirror without writing back to the platform", async () => {
    (globalThis as any).localStorage = new MemoryStorage();

    class LocalOnlySaveAdapter extends ScopedMemoryAdapter {
      saveCalls: unknown[] = [];

      async save(data: unknown): Promise<void> {
        this.saveCalls.push(data);
        await super.save(data);
      }
    }

    const adapter = new LocalOnlySaveAdapter("yandex:player-a");
    const sm = new SaveManager(adapter);
    const save = await sm.load();
    save.settings.pilotName = "Recovery";

    await sm.save(save, { persistToPlatform: false });

    expect(adapter.saveCalls).toEqual([]);
    expect(globalThis.localStorage.getItem(`${LOCAL_SAVE_MIRROR_KEY}:yandex:player-a`)).toContain('"pilotName":"Recovery"');
  });

  it("isolates local mirrors by storage scope", async () => {
    (globalThis as any).localStorage = new MemoryStorage();

    const first = new ScopedMemoryAdapter("yandex:player-a");
    const firstManager = new SaveManager(first);
    const firstSave = await firstManager.load();
    firstSave.stats.bestWave = 12;
    await firstManager.save(firstSave);

    const second = new ScopedMemoryAdapter("yandex:player-b");
    const secondManager = new SaveManager(second);
    const secondSave = await secondManager.load();

    expect(secondSave.stats.bestWave).toBe(0);
    await expect(second.load()).resolves.toBeNull();
  });
});
