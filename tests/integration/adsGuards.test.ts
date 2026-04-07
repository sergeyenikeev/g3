import { describe, expect, it } from "vitest";
import { canShowInterstitial } from "../../src/platform/ads/interstitialGuards";
import { makeDefaultSave } from "../../src/platform/save/saveManager";
import type { Balances } from "../../src/data/types";

const ADS_CFG: Balances["ads"] = {
  interstitialCooldownSec: 90,
  disableInterstitialUntilTutorialDone: true,
  interstitialMinRunsCompleted: 2,
  noInterstitialAfterRewardedSec: 20,
  interstitialDailyCap: 2,
  interstitialMinRunDurationSec: 75,
  noInterstitialAfterFrustrationSec: 180,
  noInterstitialAfterRewardedChain: 2,
  rewarded: {
    revive: { enabled: true, hpRestoreFrac: 0.5, invulnSec: 1, clearEnemies: true },
    x2Results: { enabled: true, mult: 2 },
    reroll: { enabled: true },
    startBooster: { enabled: true, addTailSegments: 3, addBolts: 0, addCores: 0 },
  },
};

describe("interstitial guards (integration)", () => {
  it("blocks until tutorial done when configured", () => {
    const s = makeDefaultSave();
    const res = canShowInterstitial(ADS_CFG, s, Date.now());
    expect(res).toEqual({ ok: false, reason: "tutorial_not_done" });
  });

  it("blocks before min runs completed", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 1;
    const res = canShowInterstitial(ADS_CFG, s, Date.now());
    expect(res).toEqual({ ok: false, reason: "min_runs" });
  });

  it("blocks right after rewarded", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 5_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "after_rewarded" });
  });

  it("blocks during cooldown", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 100_000;
    s.ads.lastInterstitialAtMs = now - 10_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "cooldown" });
  });

  it("blocks shallow sessions", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 32;
    const now = Date.now();
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "session_depth" });
  });

  it("blocks after frustration", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    const now = Date.now();
    s.ads.lastFrustrationAtMs = now - 30_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "frustration" });
  });

  it("blocks after rewarded chain", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    s.ads.rewardedChainCount = 2;
    const res = canShowInterstitial(ADS_CFG, s, Date.now());
    expect(res).toEqual({ ok: false, reason: "rewarded_chain" });
  });

  it("blocks after reaching daily cap", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    const now = new Date("2026-04-07T12:00:00.000Z").getTime();
    s.ads.interstitialDateUtc = "20260407";
    s.ads.interstitialsShownToday = 2;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "daily_cap" });
  });

  it("allows when all conditions satisfied", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    s.ads.lastRunDurationSec = 120;
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 100_000;
    s.ads.lastInterstitialAtMs = now - 200_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: true });
  });
});
