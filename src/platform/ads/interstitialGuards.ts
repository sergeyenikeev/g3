import type { Balances } from "../../data/types";
import type { SaveData } from "../save/saveManager";

export type InterstitialGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "ads_disabled"
        | "tutorial_not_done"
        | "min_runs"
        | "session_depth"
        | "frustration"
        | "rewarded_chain"
        | "cooldown"
        | "after_rewarded"
        | "daily_cap";
    };

export function canShowInterstitial(cfg: Balances["ads"] | undefined, save: SaveData, nowMs: number): InterstitialGuardResult {
  if (!cfg) return { ok: false, reason: "ads_disabled" };

  if (cfg.disableInterstitialUntilTutorialDone) {
    if (!save.tutorial.completed && !save.tutorial.skipped) return { ok: false, reason: "tutorial_not_done" };
  }

  const minRuns = Math.max(0, Math.floor(cfg.interstitialMinRunsCompleted ?? 0));
  const runsCompleted = Math.max(0, Math.floor(save.stats.runsCompleted ?? 0));
  if (runsCompleted < minRuns) return { ok: false, reason: "min_runs" };

  const minRunDurationSec = Math.max(0, Math.floor(cfg.interstitialMinRunDurationSec ?? 0));
  const lastRunDurationSec = Math.max(0, Math.floor(save.ads.lastRunDurationSec ?? 0));
  if (minRunDurationSec > 0 && lastRunDurationSec > 0 && lastRunDurationSec < minRunDurationSec) {
    return { ok: false, reason: "session_depth" };
  }

  const frustrationMs = Math.max(0, cfg.noInterstitialAfterFrustrationSec ?? 0) * 1000;
  const lastFrustrationAtMs = Math.max(0, save.ads.lastFrustrationAtMs ?? 0);
  if (frustrationMs > 0 && lastFrustrationAtMs > 0 && nowMs - lastFrustrationAtMs < frustrationMs) {
    return { ok: false, reason: "frustration" };
  }

  const rewardedChainCap = Math.max(0, Math.floor(cfg.noInterstitialAfterRewardedChain ?? 0));
  const rewardedChainCount = Math.max(0, Math.floor(save.ads.rewardedChainCount ?? 0));
  if (rewardedChainCap > 0 && rewardedChainCount >= rewardedChainCap) return { ok: false, reason: "rewarded_chain" };

  const noAfterRewardedMs = Math.max(0, cfg.noInterstitialAfterRewardedSec ?? 0) * 1000;
  const lastRewardedAt = Math.max(0, save.ads.lastRewardedAtMs ?? 0);
  if (noAfterRewardedMs > 0 && lastRewardedAt > 0 && nowMs - lastRewardedAt < noAfterRewardedMs) {
    return { ok: false, reason: "after_rewarded" };
  }

  const cdMs = Math.max(0, cfg.interstitialCooldownSec) * 1000;
  const lastAt = Math.max(0, save.ads.lastInterstitialAtMs ?? 0);
  if (cdMs > 0 && lastAt > 0 && nowMs - lastAt < cdMs) return { ok: false, reason: "cooldown" };

  const dailyCap = Math.max(0, Math.floor(cfg.interstitialDailyCap ?? 0));
  const dateUtc = formatUtcYyyymmdd(nowMs);
  const shownToday = save.ads.interstitialDateUtc === dateUtc ? Math.max(0, Math.floor(save.ads.interstitialsShownToday ?? 0)) : 0;
  if (dailyCap > 0 && shownToday >= dailyCap) return { ok: false, reason: "daily_cap" };

  return { ok: true };
}

function formatUtcYyyymmdd(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10).replaceAll("-", "");
}
