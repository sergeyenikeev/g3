import { afterEach, describe, expect, it, vi } from "vitest";
import { AdsManager } from "../../src/platform/ads/adsManager";
import type { RewardedResult, PlatformAdapter } from "../../src/platform/platformAdapter";
import { makeDefaultSave } from "../../src/platform/save/saveManager";
import type { AnalyticsAdapter, AnalyticsEventPayload } from "../../src/analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../src/analytics/eventNames";
import type { Balances } from "../../src/data/types";
import { SaveManager } from "../../src/platform/save/saveManager";

class MemoryAdapter implements PlatformAdapter {
  readonly name = "test";
  storage: unknown | null = null;
  interstitialCalls = 0;
  rewardedCalls: string[] = [];
  showInterstitialResult = true;
  showRewardedResult: RewardedResult = { ok: true, rewarded: true };

  async init(): Promise<void> {
    // no-op
  }

  async showInterstitial(): Promise<boolean> {
    this.interstitialCalls += 1;
    return this.showInterstitialResult;
  }

  async showRewarded(placement: string): Promise<RewardedResult> {
    this.rewardedCalls.push(placement);
    return this.showRewardedResult;
  }

  async save(data: unknown): Promise<void> {
    this.storage = data;
  }

  async load(): Promise<unknown | null> {
    return this.storage;
  }
}

class CaptureAnalytics implements AnalyticsAdapter {
  readonly name = "capture";
  events: Array<{ name: string; payload?: AnalyticsEventPayload }> = [];

  async init(): Promise<void> {
    // no-op
  }

  track(eventName: string, payload?: AnalyticsEventPayload): void {
    this.events.push({ name: eventName, payload });
  }
}

const ADS_CFG: Balances["ads"] = {
  interstitialCooldownSec: 0,
  disableInterstitialUntilTutorialDone: false,
  interstitialMinRunsCompleted: 0,
  noInterstitialAfterRewardedSec: 0,
  rewarded: {
    revive: { enabled: true, hpRestoreFrac: 0.5, invulnSec: 1, clearEnemies: true },
    x2Results: { enabled: true, mult: 2 },
    reroll: { enabled: true },
  },
};

describe("ads manager (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates save + tracks when rewarded is granted", async () => {
    const adapter = new MemoryAdapter();
    adapter.storage = makeDefaultSave();
    const saveManager = new SaveManager(adapter);
    await saveManager.load();
    const analytics = new CaptureAnalytics();
    const ads = new AdsManager(adapter, analytics, saveManager);

    vi.spyOn(Date, "now").mockReturnValue(1111);
    adapter.showRewardedResult = { ok: true, rewarded: true };
    const res = await ads.showRewarded("test_rewarded");

    expect(res).toEqual({ ok: true, rewarded: true });
    expect(saveManager.get().ads.lastRewardedAtMs).toBe(1111);
    expect(analytics.events.map((e) => e.name)).toEqual([
      ANALYTICS_EVENTS.AD_REWARDED_OFFER,
      ANALYTICS_EVENTS.AD_REWARDED_START,
      ANALYTICS_EVENTS.AD_REWARDED_COMPLETE,
    ]);
    expect(adapter.rewardedCalls).toEqual(["test_rewarded"]);
  });

  it("does not update save when rewarded is not granted", async () => {
    const adapter = new MemoryAdapter();
    adapter.storage = makeDefaultSave();
    const saveManager = new SaveManager(adapter);
    await saveManager.load();
    const analytics = new CaptureAnalytics();
    const ads = new AdsManager(adapter, analytics, saveManager);

    vi.spyOn(Date, "now").mockReturnValue(2222);
    adapter.showRewardedResult = { ok: true, rewarded: false };
    const res = await ads.showRewarded("test_rewarded");

    expect(res).toEqual({ ok: true, rewarded: false });
    expect(saveManager.get().ads.lastRewardedAtMs).toBe(0);
    expect(analytics.events.map((e) => e.name)).toEqual([
      ANALYTICS_EVENTS.AD_REWARDED_OFFER,
      ANALYTICS_EVENTS.AD_REWARDED_START,
      ANALYTICS_EVENTS.AD_REWARDED_COMPLETE,
    ]);
  });

  it("updates save + tracks when interstitial is shown", async () => {
    const adapter = new MemoryAdapter();
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    adapter.storage = s;
    const saveManager = new SaveManager(adapter);
    await saveManager.load();
    const analytics = new CaptureAnalytics();
    const ads = new AdsManager(adapter, analytics, saveManager);

    vi.spyOn(Date, "now").mockReturnValue(3333);
    adapter.showInterstitialResult = true;
    const res = await ads.showInterstitial(ADS_CFG, "results");

    expect(res).toBe(true);
    expect(saveManager.get().ads.lastInterstitialAtMs).toBe(3333);
    expect(adapter.interstitialCalls).toBe(1);
    expect(analytics.events.map((e) => e.name)).toEqual([
      ANALYTICS_EVENTS.AD_INTERSTITIAL_OFFER,
      ANALYTICS_EVENTS.AD_INTERSTITIAL_START,
      ANALYTICS_EVENTS.AD_INTERSTITIAL_COMPLETE,
    ]);
  });

  it("does not call adapter when interstitial is disabled by cfg", async () => {
    const adapter = new MemoryAdapter();
    adapter.storage = makeDefaultSave();
    const saveManager = new SaveManager(adapter);
    await saveManager.load();
    const analytics = new CaptureAnalytics();
    const ads = new AdsManager(adapter, analytics, saveManager);

    const res = await ads.showInterstitial(undefined, "results");
    expect(res).toBe(false);
    expect(adapter.interstitialCalls).toBe(0);
    expect(analytics.events).toEqual([]);
  });
});
