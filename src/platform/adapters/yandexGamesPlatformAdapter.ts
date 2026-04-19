import type { PlatformAdapter, PlatformLifecycleListener, PlatformLeaderboardSnapshot, RewardedResult } from "../platformAdapter";
import { getPreinitializedYandexSdk } from "../sdk/loadPlatformSdk";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type YandexPlayer = {
  getData?: () => Promise<unknown>;
  setData?: (data: unknown, flush?: boolean) => Promise<unknown>;
  getUniqueID?: () => string;
  getID?: () => string;
};

type YandexSdk = {
  adv?: {
    showFullscreenAdv?: (opts: {
      callbacks?: {
        onClose?: (wasShown?: boolean) => void;
        onError?: (error: unknown) => void;
      };
    }) => void;
    showRewardedVideo?: (opts: {
      callbacks?: {
        onClose?: (wasShown?: boolean) => void;
        onError?: (error: unknown) => void;
        onRewarded?: () => void;
      };
    }) => void;
  };
  environment?: {
    i18n?: {
      lang?: string;
      tld?: string;
    };
    app?: {
      id?: string;
    };
    payload?: string;
  };
  features?: {
    GameplayAPI?: {
      start?: () => void | Promise<void>;
      stop?: () => void | Promise<void>;
    };
    LoadingAPI?: {
      ready?: () => void | Promise<void>;
    };
  };
  getPlayer?: (opts?: { signed?: boolean; scopes?: boolean }) => Promise<YandexPlayer>;
  getLeaderboards?: () => Promise<{
    setLeaderboardScore?: (name: string, score: number, extraData?: string) => Promise<unknown>;
    getLeaderboardEntries?: (
      name: string,
      opts?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number }
    ) => Promise<{
      entries?: Array<{
        rank?: number;
        score?: number;
        player?: { publicName?: string };
      }>;
      userRank?: number;
      userScore?: number;
    }>;
  }>;
  on?: (eventName: string, listener: () => void) => (() => void) | void;
  off?: (eventName: string, listener: () => void) => void;
  serverTime?: () => number;
  EVENTS?: Record<string, string | undefined>;
};

export class YandexGamesPlatformAdapter implements PlatformAdapter {
  readonly name = "yandex";
  private static readonly LEADERBOARD_CACHE_TTL_MS = 15_000;
  private ysdk: YandexSdk | null = null;
  private player: YandexPlayer | null = null;
  private leaderboards:
    | {
        setLeaderboardScore?: (name: string, score: number, extraData?: string) => Promise<unknown>;
        getLeaderboardEntries?: (
          name: string,
          opts?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number }
        ) => Promise<{
          entries?: Array<{
            rank?: number;
            score?: number;
            player?: { publicName?: string };
          }>;
          userRank?: number;
          userScore?: number;
        }>;
      }
    | null = null;
  private gameplayActive = false;
  private gameReadySent = false;
  private playerStorageScope: string | null = null;
  private accountSelectionOpen = false;
  private leaderboardCache = new Map<
    string,
    { expiresAt: number; snapshot: PlatformLeaderboardSnapshot }
  >();
  private leaderboardRequests = new Map<string, Promise<PlatformLeaderboardSnapshot | null>>();

  async init(): Promise<void> {
    try {
      this.ysdk = (await getPreinitializedYandexSdk()) as YandexSdk | null;
    } catch {
      this.ysdk = null;
      return;
    }

    if (!this.ysdk) return;

    await this.refreshPlayerContext();
  }

  getStorageScope(): string | null {
    return this.playerStorageScope ? `yandex:${this.playerStorageScope}` : null;
  }

  getPreferredLanguage(): string | null {
    const language = this.ysdk?.environment?.i18n?.lang;
    return typeof language === "string" && language.length > 0 ? language : null;
  }

  async getServerTimeMs(): Promise<number | null> {
    try {
      const value = this.ysdk?.serverTime?.();
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  async signalGameReady(): Promise<void> {
    if (this.gameReadySent) return;
    this.gameReadySent = true;

    try {
      await Promise.resolve(this.ysdk?.features?.LoadingAPI?.ready?.());
    } catch {
      // ignore
    }
  }

  async signalGameplayStart(): Promise<void> {
    if (this.gameplayActive) return;
    this.gameplayActive = true;

    try {
      await Promise.resolve(this.ysdk?.features?.GameplayAPI?.start?.());
    } catch {
      // ignore
    }
  }

  async signalGameplayStop(): Promise<void> {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;

    try {
      await Promise.resolve(this.ysdk?.features?.GameplayAPI?.stop?.());
    } catch {
      // ignore
    }
  }

  addLifecycleListener(listener: PlatformLifecycleListener): () => void {
    const ysdk = this.ysdk;
    if (!ysdk?.on) return () => {};

    const disposers: Array<() => void> = [];
    const bind = (eventName: string | null, callback?: () => void | Promise<void>) => {
      if (!callback) return;
      if (!eventName) return;

      try {
        const wrapped = () => callback();
        const maybeDispose = ysdk.on?.(eventName, wrapped);
        if (typeof maybeDispose === "function") {
          disposers.push(maybeDispose);
          return;
        }

        if (ysdk.off) {
          disposers.push(() => {
            try {
              ysdk.off?.(eventName, wrapped);
            } catch {
              // ignore
            }
          });
        }
      } catch {
        // ignore
      }
    };

    bind("game_api_pause", listener.pause);
    bind("game_api_resume", listener.resume);
    bind(resolveSdkEventName(ysdk, "ACCOUNT_SELECTION_DIALOG_OPENED", "ACCOUNT_SELECTION_DIALOG_OPEN"), async () => {
      this.accountSelectionOpen = true;
      listener.pause?.();
    });
    bind(resolveSdkEventName(ysdk, "ACCOUNT_SELECTION_DIALOG_CLOSED", "ACCOUNT_SELECTION_DIALOG_CLOSE"), async () => {
      const previousScope = this.getStorageScope();
      await this.refreshPlayerContext();
      this.accountSelectionOpen = false;
      if (previousScope !== this.getStorageScope()) {
        try {
          window.location.reload();
          return;
        } catch {
          // ignore
        }
      }
      listener.resume?.();
    });

    return () => {
      for (const dispose of disposers.splice(0)) dispose();
    };
  }

  async showInterstitial(): Promise<boolean> {
    const show = this.ysdk?.adv?.showFullscreenAdv;
    if (!show) return false;

    return this.withAdBreak(async () => {
      return await new Promise<boolean>((resolve) => {
        try {
          show({
            callbacks: {
              onClose: (wasShown?: boolean) => resolve(Boolean(wasShown)),
              onError: () => resolve(false),
            },
          });
        } catch {
          resolve(false);
        }
      });
    });
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    const show = this.ysdk?.adv?.showRewardedVideo;
    if (!show) return { ok: true, rewarded: false };

    return this.withAdBreak(async () => {
      return await new Promise<RewardedResult>((resolve) => {
        let rewarded = false;

        try {
          show({
            callbacks: {
              onRewarded: () => {
                rewarded = true;
              },
              onClose: (wasShown?: boolean) => resolve({ ok: true, rewarded: rewarded && Boolean(wasShown) }),
              onError: (error: unknown) => resolve({ ok: false, error: normalizeError(error) }),
            },
          });
        } catch (error) {
          resolve({ ok: false, error: normalizeError(error) });
        }
      });
    });
  }

  async save(data: unknown): Promise<void> {
    if (!this.accountSelectionOpen && this.player?.setData) {
      try {
        await this.player.setData(data, true);
        return;
      } catch {
        // fallback
      }
    }

    const raw = safeJsonStringify(data);
    if (!raw) return;
    safeLocalStorageSet(this.getSaveFallbackKey(), raw);
  }

  async load(): Promise<unknown | null> {
    if (this.player?.getData) {
      try {
        const data = await this.player.getData();
        if (data && typeof data === "object") return data;
      } catch {
        // fallback
      }
    }

    return safeJsonParse(safeLocalStorageGet(this.getSaveFallbackKey()));
  }

  async submitScore(boardId: string, score: number): Promise<void> {
    const safeScore = Math.max(0, Math.floor(score));
    if (this.leaderboards?.setLeaderboardScore) {
      try {
        await this.leaderboards.setLeaderboardScore(boardId, safeScore);
        this.invalidateLeaderboardCache(boardId);
        return;
      } catch {
        // fallback
      }
    }
    const fallback = safeJsonParse(safeLocalStorageGet(this.getLeaderboardFallbackKey(boardId)));
    const nextScore = typeof fallback === "number" && Number.isFinite(fallback) ? Math.max(fallback, safeScore) : safeScore;
    safeLocalStorageSet(this.getLeaderboardFallbackKey(boardId), String(nextScore));
    this.invalidateLeaderboardCache(boardId);
  }

  async getLeaderboard(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): Promise<PlatformLeaderboardSnapshot | null> {
    const cacheKey = this.getLeaderboardCacheKey(boardId, scope);
    const now = Date.now();
    const cached = this.leaderboardCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.snapshot;

    const pending = this.leaderboardRequests.get(cacheKey);
    if (pending) return pending;

    const request = this.fetchLeaderboard(boardId, scope, cacheKey);
    this.leaderboardRequests.set(cacheKey, request);
    return request;
  }

  private async withAdBreak<T>(run: () => Promise<T>): Promise<T> {
    const shouldResume = this.gameplayActive;
    if (shouldResume) await this.signalGameplayStop();

    try {
      return await run();
    } finally {
      if (shouldResume) await this.signalGameplayStart();
    }
  }

  private async refreshPlayerContext(): Promise<void> {
    this.leaderboardCache.clear();
    this.leaderboardRequests.clear();
    const getPlayer = this.ysdk?.getPlayer;
    if (!getPlayer) {
      this.player = null;
      this.playerStorageScope = null;
      this.leaderboards = null;
      return;
    }

    try {
      this.player = (await getPlayer({ scopes: false, signed: false })) ?? null;
    } catch {
      this.player = null;
    }
    this.playerStorageScope = resolvePlayerStorageScope(this.player);

    try {
      this.leaderboards = (await this.ysdk?.getLeaderboards?.()) ?? null;
    } catch {
      this.leaderboards = null;
    }
  }

  private getSaveFallbackKey(): string {
    return getScopedKey(PLATFORM_SAVE_KEY, this.getStorageScope());
  }

  private getLeaderboardFallbackKey(boardId: string): string {
    return getScopedKey(`${PLATFORM_SAVE_KEY}:leaderboards:${boardId}`, this.getStorageScope());
  }

  private async fetchLeaderboard(
    boardId: string,
    scope: PlatformLeaderboardSnapshot["scope"],
    cacheKey: string
  ): Promise<PlatformLeaderboardSnapshot | null> {
    try {
      let snapshot: PlatformLeaderboardSnapshot | null = null;

      if (this.leaderboards?.getLeaderboardEntries) {
        try {
          const res = await this.leaderboards.getLeaderboardEntries(boardId, {
            includeUser: true,
            quantityAround: 1,
            quantityTop: 5,
          });
          const entries = Array.isArray(res?.entries)
            ? res.entries.map((entry, index) => ({
                rank: Math.max(1, Math.floor(entry?.rank ?? index + 1)),
                score: Math.max(0, Math.floor(entry?.score ?? 0)),
                playerName: entry?.player?.publicName || `Pilot ${index + 1}`,
              }))
            : [];
          snapshot = {
            boardId,
            scope,
            source: "platform",
            entries,
            currentPlayerRank: typeof res?.userRank === "number" ? Math.max(1, Math.floor(res.userRank)) : null,
            currentPlayerScore: typeof res?.userScore === "number" ? Math.max(0, Math.floor(res.userScore)) : null,
          };
        } catch {
          snapshot = null;
        }
      }

      if (!snapshot) {
        const raw = safeLocalStorageGet(this.getLeaderboardFallbackKey(boardId));
        const score = raw ? Number.parseInt(raw, 10) : 0;
        snapshot = {
          boardId,
          scope,
          source: "local",
          entries: score > 0 ? [{ rank: 1, score, playerName: "YOU", isCurrentPlayer: true }] : [],
          currentPlayerRank: score > 0 ? 1 : null,
          currentPlayerScore: score > 0 ? score : null,
        };
      }

      this.leaderboardCache.set(cacheKey, {
        expiresAt: Date.now() + YandexGamesPlatformAdapter.LEADERBOARD_CACHE_TTL_MS,
        snapshot,
      });
      return snapshot;
    } finally {
      this.leaderboardRequests.delete(cacheKey);
    }
  }

  private invalidateLeaderboardCache(boardId: string): void {
    const suffix = `:${boardId}`;
    for (const key of [...this.leaderboardCache.keys()]) {
      if (key.endsWith(suffix)) this.leaderboardCache.delete(key);
    }
    for (const key of [...this.leaderboardRequests.keys()]) {
      if (key.endsWith(suffix)) this.leaderboardRequests.delete(key);
    }
  }

  private getLeaderboardCacheKey(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): string {
    return `${scope}:${boardId}`;
  }
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolvePlayerStorageScope(player: YandexPlayer | null): string | null {
  try {
    const uniqueId = player?.getUniqueID?.();
    if (typeof uniqueId === "string" && uniqueId.length > 0) return uniqueId;
  } catch {
    // ignore
  }

  try {
    const fallbackId = player?.getID?.();
    if (typeof fallbackId === "string" && fallbackId.length > 0) return fallbackId;
  } catch {
    // ignore
  }

  return null;
}

function resolveSdkEventName(ysdk: YandexSdk, ...names: string[]): string | null {
  for (const name of names) {
    const resolved = ysdk.EVENTS?.[name];
    if (typeof resolved === "string" && resolved.length > 0) return resolved;
  }

  return names[0] ?? null;
}

function getScopedKey(baseKey: string, scope: string | null): string {
  return scope ? `${baseKey}:${scope}` : baseKey;
}
