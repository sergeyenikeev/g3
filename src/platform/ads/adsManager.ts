import type { RewardedResult, PlatformAdapter } from "../platformAdapter";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { Balances } from "../../data/types";
import type { SaveManager } from "../save/saveManager";
import { canShowInterstitial } from "./interstitialGuards";

export class AdsManager {
  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly analytics: AnalyticsAdapter | null,
    private readonly saveManager: SaveManager
  ) {}

  async showRewarded(placement: string): Promise<RewardedResult> {
    const now = Date.now();
    this.track(ANALYTICS_EVENTS.AD_REWARDED_OFFER, { placement });
    this.track(ANALYTICS_EVENTS.AD_REWARDED_START, { placement });

    let res: RewardedResult;
    try {
      res = await this.adapter.showRewarded(placement);
    } catch (e) {
      this.track(ANALYTICS_EVENTS.AD_REWARDED_FAIL, { placement, reason: "exception" });
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    if (res.ok && res.rewarded) {
      const s = this.saveManager.get();
      await this.saveManager.save({ ...s, ads: { ...s.ads, lastRewardedAtMs: now } });
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
    if (!allowed.ok) return false;

    this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_OFFER, { placement });
    this.track(ANALYTICS_EVENTS.AD_INTERSTITIAL_START, { placement });

    let shown = false;
    try {
      shown = await this.adapter.showInterstitial();
    } catch {
      shown = false;
    }

    if (shown) {
      const s = this.saveManager.get();
      await this.saveManager.save({ ...s, ads: { ...s.ads, lastInterstitialAtMs: now } });
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
}

