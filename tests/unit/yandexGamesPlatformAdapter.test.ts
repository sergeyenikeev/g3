import { afterEach, describe, expect, it, vi } from "vitest";
import { YandexGamesPlatformAdapter } from "../../src/platform/adapters/yandexGamesPlatformAdapter";

const originalWindow = (globalThis as any).window;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
});

describe("YandexGamesPlatformAdapter", () => {
  it("reads environment data and deduplicates loading/gameplay hooks", async () => {
    const ready = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          environment: { i18n: { lang: "ru" } },
          features: {
            LoadingAPI: { ready },
            GameplayAPI: { start, stop },
          },
          getPlayer: vi.fn(async () => ({})),
          serverTime: () => 12_345,
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    expect(adapter.getPreferredLanguage()).toBe("ru");
    expect(await adapter.getServerTimeMs()).toBe(12_345);

    await adapter.signalGameReady();
    await adapter.signalGameReady();
    expect(ready).toHaveBeenCalledTimes(1);

    await adapter.signalGameplayStart();
    await adapter.signalGameplayStart();
    expect(start).toHaveBeenCalledTimes(1);

    await adapter.signalGameplayStop();
    await adapter.signalGameplayStop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("subscribes and unsubscribes SDK lifecycle events", async () => {
    const handlers = new Map<string, () => void>();
    const off = vi.fn();

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          on: vi.fn((eventName: string, callback: () => void) => {
            handlers.set(eventName, callback);
          }),
          off,
          getPlayer: vi.fn(async () => ({})),
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    const pause = vi.fn();
    const resume = vi.fn();
    const dispose = adapter.addLifecycleListener({ pause, resume });

    handlers.get("game_api_pause")?.();
    handlers.get("game_api_resume")?.();
    dispose();

    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith("game_api_pause", handlers.get("game_api_pause"));
    expect(off).toHaveBeenCalledWith("game_api_resume", handlers.get("game_api_resume"));
  });

  it("wraps ads with gameplay stop/start and respects Yandex callback payloads", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const showFullscreenAdv = vi.fn(({ callbacks }: any) => callbacks?.onClose?.(true));
    const showRewardedVideo = vi.fn(({ callbacks }: any) => {
      callbacks?.onRewarded?.();
      callbacks?.onClose?.(true);
    });

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          adv: {
            showFullscreenAdv,
            showRewardedVideo,
          },
          features: {
            GameplayAPI: { start, stop },
          },
          getPlayer: vi.fn(async () => ({})),
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();
    await adapter.signalGameplayStart();

    await expect(adapter.showInterstitial()).resolves.toBe(true);
    await expect(adapter.showRewarded("revive")).resolves.toEqual({ ok: true, rewarded: true });

    expect(showFullscreenAdv).toHaveBeenCalledTimes(1);
    expect(showRewardedVideo).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(3);
  });
});
