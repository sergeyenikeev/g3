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
    const setData = vi.fn(async () => undefined);

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          environment: { i18n: { lang: "ru" } },
          features: {
            LoadingAPI: { ready },
            GameplayAPI: { start, stop },
          },
          getPlayer: vi.fn(async () => ({
            getUniqueID: () => "player-a",
            setData,
          })),
          serverTime: () => 12_345,
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    expect(adapter.getPreferredLanguage()).toBe("ru");
    expect(await adapter.getServerTimeMs()).toBe(12_345);
    expect(adapter.getStorageScope()).toBe("yandex:player-a");

    await adapter.signalGameReady();
    await adapter.signalGameReady();
    expect(ready).toHaveBeenCalledTimes(1);

    await adapter.signalGameplayStart();
    await adapter.signalGameplayStart();
    expect(start).toHaveBeenCalledTimes(1);

    await adapter.signalGameplayStop();
    await adapter.signalGameplayStop();
    expect(stop).toHaveBeenCalledTimes(1);

    await adapter.save({ progress: 1 });
    expect(setData).toHaveBeenCalledWith({ progress: 1 }, true);
  });

  it("can ignore platform save reads and capture raw platform payloads", async () => {
    const getData = vi.fn(async () => ({ v: 1, stats: { bestWave: 7 } }));

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          getPlayer: vi.fn(async () => ({
            getUniqueID: () => "player-a",
            getData,
          })),
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    const captured: unknown[] = [];
    await expect(
      adapter.load({
        captureRawPlatformData: (value) => captured.push(value),
      })
    ).resolves.toEqual({ v: 1, stats: { bestWave: 7 } });
    await expect(adapter.load({ ignorePlatformData: true })).resolves.toBeNull();

    expect(getData).toHaveBeenCalledTimes(1);
    expect(captured).toEqual([{ v: 1, stats: { bestWave: 7 } }]);
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

  it("does not reload before the first successful boot when account selection changes the active player", async () => {
    const handlers = new Map<string, () => void | Promise<void>>();
    const off = vi.fn();
    const reload = vi.fn();
    const getPlayer = vi
      .fn()
      .mockResolvedValueOnce({ getUniqueID: () => "player-a" })
      .mockResolvedValueOnce({ getUniqueID: () => "player-b" });

    (globalThis as any).window = {
      location: { reload },
      YaGames: {
        init: vi.fn(async () => ({
          EVENTS: {
            ACCOUNT_SELECTION_DIALOG_OPENED: "ACCOUNT_SELECTION_DIALOG_OPENED",
            ACCOUNT_SELECTION_DIALOG_CLOSED: "ACCOUNT_SELECTION_DIALOG_CLOSED",
          },
          on: vi.fn((eventName: string, callback: () => void | Promise<void>) => {
            handlers.set(eventName, callback);
          }),
          off,
          getPlayer,
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    const pause = vi.fn();
    const resume = vi.fn();
    adapter.addLifecycleListener({ pause, resume });

    await handlers.get("ACCOUNT_SELECTION_DIALOG_OPENED")?.();
    await handlers.get("ACCOUNT_SELECTION_DIALOG_CLOSED")?.();

    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(adapter.getStorageScope()).toBe("yandex:player-b");
  });

  it("reloads the page after account selection changes the active player once boot completed", async () => {
    const handlers = new Map<string, () => void | Promise<void>>();
    const off = vi.fn();
    const reload = vi.fn();
    const getPlayer = vi
      .fn()
      .mockResolvedValueOnce({ getUniqueID: () => "player-a" })
      .mockResolvedValueOnce({ getUniqueID: () => "player-b" });

    (globalThis as any).window = {
      location: { reload },
      YaGames: {
        init: vi.fn(async () => ({
          EVENTS: {
            ACCOUNT_SELECTION_DIALOG_OPENED: "ACCOUNT_SELECTION_DIALOG_OPENED",
            ACCOUNT_SELECTION_DIALOG_CLOSED: "ACCOUNT_SELECTION_DIALOG_CLOSED",
          },
          on: vi.fn((eventName: string, callback: () => void | Promise<void>) => {
            handlers.set(eventName, callback);
          }),
          off,
          getPlayer,
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();
    adapter.markBootCompleted();

    const pause = vi.fn();
    const resume = vi.fn();
    adapter.addLifecycleListener({ pause, resume });

    await handlers.get("ACCOUNT_SELECTION_DIALOG_OPENED")?.();
    await handlers.get("ACCOUNT_SELECTION_DIALOG_CLOSED")?.();

    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(adapter.getStorageScope()).toBe("yandex:player-b");
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

  it("submits board-aware scores and reads leaderboard snapshots", async () => {
    const setLeaderboardScore = vi.fn(async () => undefined);
    const getLeaderboardEntries = vi.fn(async () => ({
      entries: [
        { rank: 1, score: 50000, player: { publicName: "ACE-1" } },
        { rank: 2, score: 42000, player: { publicName: "YOU" } },
      ],
      userRank: 2,
      userScore: 42000,
    }));

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          getPlayer: vi.fn(async () => ({})),
          getLeaderboards: vi.fn(async () => ({
            setLeaderboardScore,
            getLeaderboardEntries,
          })),
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();
    await adapter.submitScore("magnet_caravan_weekly", 42000);
    const snapshot = await adapter.getLeaderboard("magnet_caravan_weekly", "weekly");

    expect(setLeaderboardScore).toHaveBeenCalledWith("magnet_caravan_weekly", 42000);
    expect(getLeaderboardEntries).toHaveBeenCalledWith("magnet_caravan_weekly", {
      includeUser: true,
      quantityAround: 1,
      quantityTop: 5,
    });
    expect(snapshot).toMatchObject({
      boardId: "magnet_caravan_weekly",
      scope: "weekly",
      source: "platform",
      currentPlayerRank: 2,
      currentPlayerScore: 42000,
    });
  });

  it("caches leaderboard snapshots between repeated reads and invalidates after submit", async () => {
    const setLeaderboardScore = vi.fn(async () => undefined);
    const getLeaderboardEntries = vi.fn(async () => ({
      entries: [{ rank: 1, score: 35000, player: { publicName: "YOU" } }],
      userRank: 1,
      userScore: 35000,
    }));

    (globalThis as any).window = {
      YaGames: {
        init: vi.fn(async () => ({
          getPlayer: vi.fn(async () => ({})),
          getLeaderboards: vi.fn(async () => ({
            setLeaderboardScore,
            getLeaderboardEntries,
          })),
        })),
      },
    };

    const adapter = new YandexGamesPlatformAdapter();
    await adapter.init();

    await adapter.getLeaderboard("magnet_caravan_weekly", "weekly");
    await adapter.getLeaderboard("magnet_caravan_weekly", "weekly");
    expect(getLeaderboardEntries).toHaveBeenCalledTimes(1);

    await adapter.submitScore("magnet_caravan_weekly", 36000);
    await adapter.getLeaderboard("magnet_caravan_weekly", "weekly");
    expect(getLeaderboardEntries).toHaveBeenCalledTimes(2);
  });
});
