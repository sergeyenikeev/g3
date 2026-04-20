import type { PlatformAdapter, PlatformLoadOptions, RewardedResult } from "../platformAdapter";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type VkBridge = {
  send: (method: string, params?: any) => Promise<any>;
};

export class VkPlatformAdapter implements PlatformAdapter {
  readonly name = "vk";
  private bridge: VkBridge | null = null;

  async init(): Promise<void> {
    const bridge = ((window as any)?.vkBridge as VkBridge | undefined) ?? null;
    this.bridge = bridge;
    if (!bridge?.send) return;
    try {
      await bridge.send("VKWebAppInit");
    } catch {
      // ignore
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.bridge?.send) return false;
    try {
      const res = await this.bridge.send("VKWebAppShowNativeAds", { ad_format: "interstitial" });
      return res?.result === true;
    } catch {
      return false;
    }
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    if (!this.bridge?.send) return { ok: true, rewarded: false };
    try {
      const res = await this.bridge.send("VKWebAppShowNativeAds", { ad_format: "reward" });
      return { ok: true, rewarded: res?.result === true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async save(data: unknown): Promise<void> {
    const raw = safeJsonStringify(data);
    if (!raw) return;

    if (this.bridge?.send) {
      try {
        await this.bridge.send("VKWebAppStorageSet", { key: PLATFORM_SAVE_KEY, value: raw });
        return;
      } catch {
        // fallback
      }
    }

    safeLocalStorageSet(PLATFORM_SAVE_KEY, raw);
  }

  async load(_options?: PlatformLoadOptions): Promise<unknown | null> {
    if (this.bridge?.send) {
      try {
        const res = await this.bridge.send("VKWebAppStorageGet", { keys: [PLATFORM_SAVE_KEY] });
        const value = res?.keys?.find((k: any) => k?.key === PLATFORM_SAVE_KEY)?.value;
        if (typeof value === "string") return safeJsonParse(value);
      } catch {
        // fallback
      }
    }
    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }
}
