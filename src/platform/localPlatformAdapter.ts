import type { PlatformAdapter, RewardedResult } from "./platformAdapter";
import { PLATFORM_SAVE_KEY } from "./storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "./utils/localStorage";

export class LocalPlatformAdapter implements PlatformAdapter {
  readonly name = "local";

  async init(): Promise<void> {
    // no-op
  }

  async showInterstitial(): Promise<boolean> {
    return false;
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    return { ok: true, rewarded: false };
  }

  async save(data: unknown): Promise<void> {
    const raw = safeJsonStringify(data);
    if (!raw) return;
    safeLocalStorageSet(PLATFORM_SAVE_KEY, raw);
  }

  async load(): Promise<unknown | null> {
    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }
}

