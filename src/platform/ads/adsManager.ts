import type { RewardedResult, PlatformAdapter } from "../platformAdapter";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { Balances } from "../../data/types";
import { GAME_EVENTS } from "../../game/events";
import type { SaveManager } from "../save/saveManager";
import { canShowInterstitial } from "./interstitialGuards";

type EventBusLike = {
  emit: (eventName: string, payload?: unknown) => void;
};

export class AdsManager {
  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly analytics: AnalyticsAdapter | null,
    private readonly saveManager: SaveManager,
    private readonly events: EventBusLike | null = null
  ) {}

  async showRewarded(placement: string): Promise<RewardedResult> {
    const now = Date.now();
    this.track(ANALYTICS_EVENTS.AD_REWARDED_OFFER, { placement });
    this.track(ANALYTICS_EVENTS.AD_REWARDED_START, { placement });
    this.emitAdBreakEvent(GAME_EVENTS.AD_BREAK_START, { kind: "rewarded", placement });

    let res: RewardedResult;
    try {
      res = await this.adapter.showRewarded(placement);
    } catch (e) {
      this.track(ANALYTICS_EVENTS.AD_REWARDED_FAIL, { placement, reason: "exception" });
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      this.emitAdBreakEvent(GAME_EVENTS.AD_BREAK_END, { kind: "rewarded", placement });
    }

    if (res.ok && res.rewarded) {
      const s = this.saveManager.get();
      await this.saveManager.save({
        ...s,
        ads: {
          ...s.ads,
          lastRewardedAtMs: now,
          rewardedChainCount: Math.max(0, Math.floor(s.ads.rewardedChainCount ?? 0)) + 1,
        },
      });
      this.track(ANALYTICS_EVENTS.AD_REWARDED_COMPLETE, { placement, rewarded: true });
      return res;
    }

    this.track(res.ok ? ANALYTICS_EVENTS.AD_REWARDED_COMPLETE : ANALYTICS_EVENTS.AD_REWARDED_FAIL, {
      placement,
      rewarded: res.ok ? Boolean(res.rewarded) : false,
      reason: res.ok ? "not_rewarded" : res.error,
    });
    return res;
  }

  async showInterstitial(cfg: Balances["ads"] | undefined, placement: string = "results"): Promise<boolean> {
    const now = Date.now();
    const save = this.saveManager.get();
    const allowed = canShowInterstitial(cfg, save, now);
    if (!allowed.ok) {
      this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_FAIL, {
        placement,
        reason: allowed.reason,
        rewardedChainCount: save.ads.rewardedChainCount,
        lastRunDurationSec: save.ads.lastRunDurationSec,
      });
      return false;
    }

    this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_OFFER, { placement });
    this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_START, { placement });
    this.emitAdBreakEvent(GAME_EVENTS.AD_BREAK_START, { kind: "interstitial", placement });

    let shown = false;
    try {
      shown = await this.adapter.showInterstitial();
    } catch {
      shown = false;
    } finally {
      this.emitAdBreakEvent(GAME_EVENTS.AD_BREAK_END, { kind: "interstitial", placement });
    }

    if (shown) {
      const s = this.saveManager.get();
      const dateUtc = new Date(now).toISOString().slice(0, 10).replaceAll("-", "");
      const shownToday = s.ads.interstitialDateUtc === dateUtc ? Math.max(0, Math.floor(s.ads.interstitialsShownToday ?? 0)) : 0;
      await this.saveManager.save({
        ...s,
        ads: {
          ...s.ads,
          lastInterstitialAtMs: now,
          rewardedChainCount: 0,
          interstitialDateUtc: dateUtc,
          interstitialsShownToday: shownToday + 1,
        },
      });
      this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_COMPLETE, { placement, shown: true });
      return true;
    }

    this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_FAIL, { placement, reason: "not_shown" });
    return false;
  }

  private track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.analytics?.track(eventName, payload);
    } catch {
      // ignore
    }
  }

  private emitAdBreakEvent(eventName: string, payload: { kind: "rewarded" | "interstitial"; placement: string }): void {
    try {
      this.events?.emit(eventName, payload);
    } catch {
      // ignore
    }
  }
}
