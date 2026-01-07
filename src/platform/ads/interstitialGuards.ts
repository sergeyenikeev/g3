import type { Balances } from "../../data/types";
import type { SaveData } from "../save/saveManager";

export type InterstitialGuardResult =
  | { ok: true }
  | { ok: false; reason: "ads_disabled" | "tutorial_not_done" | "min_runs" | "cooldown" | "after_rewarded" };

export function canShowInterstitial(cfg: Balances["ads"] | undefined, save: SaveData, nowMs: number): InterstitialGuardResult {
  if (!cfg) return { ok: false, reason: "ads_disabled" };

  if (cfg.disableInterstitialUntilTutorialDone) {
    if (!save.tutorial.completed && !save.tutorial.skipped) return { ok: false, reason: "tutorial_not_done" };
  }

  const minRuns = Math.max(0, Math.floor(cfg.interstitialMinRunsCompleted ?? 0));
  const runsCompleted = Math.max(0, Math.floor(save.stats.runsCompleted ?? 0));
  if (runsCompleted < minRuns) return { ok: false, reason: "min_runs" };

  const noAfterRewardedMs = Math.max(0, cfg.noInterstitialAfterRewardedSec ?? 0) * 1000;
  const lastRewardedAt = Math.max(0, save.ads.lastRewardedAtMs ?? 0);
  if (noAfterRewardedMs > 0 && nowMs - lastRewardedAt < noAfterRewardedMs) return { ok: false, reason: "after_rewarded" };

  const cdMs = Math.max(0, cfg.interstitialCooldownSec) * 1000;
  const lastAt = Math.max(0, save.ads.lastInterstitialAtMs ?? 0);
  if (cdMs > 0 && nowMs - lastAt < cdMs) return { ok: false, reason: "cooldown" };

  return { ok: true };
}

