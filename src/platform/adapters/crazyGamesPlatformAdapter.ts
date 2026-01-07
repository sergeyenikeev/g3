import type { PlatformAdapter, RewardedResult } from "../platformAdapter";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type CrazySdk = {
  init?: () => Promise<unknown> | unknown;
  ad?: {
    requestAd?: (kind: string) => Promise<unknown> | unknown;
  };
  data?: {
    getItem?: (key: string) => Promise<unknown> | unknown;
    setItem?: (key: string, value: unknown) => Promise<unknown> | unknown;
  };
};

export class CrazyGamesPlatformAdapter implements PlatformAdapter {
  readonly name = "crazygames";
  private sdk: CrazySdk | null = null;

  async init(): Promise<void> {
    const w = window as any;
    const sdk = (w?.CrazyGames?.SDK as CrazySdk | undefined) ?? (w?.CrazyGamesSDK as CrazySdk | undefined) ?? null;
    this.sdk = sdk;
    if (!sdk?.init) return;
    try {
      await sdk.init();
    } catch {
      // ignore
    }
  }

  async showInterstitial(): Promise<boolean> {
    try {
      const req = this.sdk?.ad?.requestAd;
      if (!req) return false;
      await req("midgame");
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    try {
      const req = this.sdk?.ad?.requestAd;
      if (!req) return { ok: true, rewarded: false };
      await req("rewarded");
      return { ok: true, rewarded: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async save(data: unknown): Promise<void> {
    const raw = safeJsonStringify(data);
    if (!raw) return;

    const setItem = this.sdk?.data?.setItem;
    if (setItem) {
      try {
        await setItem(PLATFORM_SAVE_KEY, raw);
        return;
      } catch {
        // fallback
      }
    }

    safeLocalStorageSet(PLATFORM_SAVE_KEY, raw);
  }

  async load(): Promise<unknown | null> {
    const getItem = this.sdk?.data?.getItem;
    if (getItem) {
      try {
        const v = await getItem(PLATFORM_SAVE_KEY);
        if (typeof v === "string") return safeJsonParse(v);
        if (v && typeof v === "object") return v as unknown;
      } catch {
        // fallback
      }
    }

    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }
}

