import type { PlatformAdapter, RewardedResult } from "../platformAdapter";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type YandexSdk = {
  adv?: {
    showFullscreenAdv?: (opts: any) => void;
    showRewardedVideo?: (opts: any) => void;
  };
  getPlayer?: (opts?: any) => Promise<any>;
};

export class YandexGamesPlatformAdapter implements PlatformAdapter {
  readonly name = "yandex";
  private ysdk: YandexSdk | null = null;
  private player: any | null = null;

  async init(): Promise<void> {
    const w = window as any;
    const api = w?.YaGames;
    if (!api?.init) return;
    try {
      this.ysdk = (await api.init()) as YandexSdk;
    } catch {
      this.ysdk = null;
      return;
    }

    const getPlayer = this.ysdk?.getPlayer;
    if (!getPlayer) return;
    try {
      this.player = await getPlayer({ scopes: false });
    } catch {
      this.player = null;
    }
  }

  async showInterstitial(): Promise<boolean> {
    const fn = this.ysdk?.adv?.showFullscreenAdv;
    if (!fn) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        fn({
          callbacks: {
            onClose: () => resolve(true),
            onError: () => resolve(false),
          },
        });
      } catch {
        resolve(false);
      }
    });
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    const fn = this.ysdk?.adv?.showRewardedVideo;
    if (!fn) return { ok: true, rewarded: false };

    return await new Promise<RewardedResult>((resolve) => {
      let rewarded = false;
      try {
        fn({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => resolve({ ok: true, rewarded }),
            onError: (e: unknown) => resolve({ ok: false, error: e instanceof Error ? e.message : String(e) }),
          },
        });
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  async save(data: unknown): Promise<void> {
    if (this.player?.setData) {
      try {
        await this.player.setData(data);
        return;
      } catch {
        // fallback
      }
    }

    const raw = safeJsonStringify(data);
    if (!raw) return;
    safeLocalStorageSet(PLATFORM_SAVE_KEY, raw);
  }

  async load(): Promise<unknown | null> {
    if (this.player?.getData) {
      try {
        const data = await this.player.getData();
        if (data && typeof data === "object") return data as unknown;
      } catch {
        // fallback
      }
    }

    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }
}

