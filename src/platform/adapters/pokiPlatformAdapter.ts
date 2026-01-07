import type { PlatformAdapter, RewardedResult } from "../platformAdapter";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type PokiSdk = {
  init?: () => Promise<unknown> | unknown;
  gameLoadingFinished?: () => void;
  commercialBreak?: (...args: any[]) => Promise<unknown> | unknown;
  rewardedBreak?: (...args: any[]) => Promise<unknown> | unknown;
};

export class PokiPlatformAdapter implements PlatformAdapter {
  readonly name = "poki";
  private sdk: PokiSdk | null = null;

  async init(): Promise<void> {
    const sdk = ((window as any)?.PokiSDK as PokiSdk | undefined) ?? null;
    this.sdk = sdk;
    if (!sdk?.init) return;
    try {
      await sdk.init();
      sdk.gameLoadingFinished?.();
    } catch {
      // ignore
    }
  }

  async showInterstitial(): Promise<boolean> {
    const cb = this.sdk?.commercialBreak;
    if (!cb) return false;

    try {
      if (cb.length >= 1) {
        await new Promise<void>((resolve) => cb(() => resolve()));
      } else {
        const res = cb();
        if (res && typeof (res as any).then === "function") await res;
      }
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    const rb = this.sdk?.rewardedBreak;
    if (!rb) return { ok: true, rewarded: false };

    try {
      if (rb.length >= 1) {
        const rewarded = await new Promise<boolean>((resolve) => rb((ok: any) => resolve(Boolean(ok))));
        return { ok: true, rewarded };
      }

      const res = rb();
      if (res && typeof (res as any).then === "function") {
        const out = await res;
        if (typeof out === "boolean") return { ok: true, rewarded: out };
        if (out && typeof out === "object" && "rewarded" in (out as any)) return { ok: true, rewarded: Boolean((out as any).rewarded) };
      }
      return { ok: true, rewarded: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
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

