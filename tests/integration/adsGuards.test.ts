import { describe, expect, it } from "vitest";
import { canShowInterstitial } from "../../src/platform/ads/interstitialGuards";
import { makeDefaultSave } from "../../src/platform/save/saveManager";
import type { Balances } from "../../src/data/types";

const ADS_CFG: Balances["ads"] = {
  interstitialCooldownSec: 90,
  disableInterstitialUntilTutorialDone: true,
  interstitialMinRunsCompleted: 2,
  noInterstitialAfterRewardedSec: 20,
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
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 5_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "after_rewarded" });
  });

  it("blocks during cooldown", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 100_000;
    s.ads.lastInterstitialAtMs = now - 10_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: false, reason: "cooldown" });
  });

  it("allows when all conditions satisfied", () => {
    const s = makeDefaultSave();
    s.tutorial.completed = true;
    s.stats.runsCompleted = 10;
    const now = Date.now();
    s.ads.lastRewardedAtMs = now - 100_000;
    s.ads.lastInterstitialAtMs = now - 200_000;
    const res = canShowInterstitial(ADS_CFG, s, now);
    expect(res).toEqual({ ok: true });
  });
});
