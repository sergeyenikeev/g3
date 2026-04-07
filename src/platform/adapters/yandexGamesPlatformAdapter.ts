import type { PlatformAdapter, PlatformLifecycleListener, PlatformLeaderboardSnapshot, RewardedResult } from "../platformAdapter";
import { PLATFORM_SAVE_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";

type YandexPlayer = {
  getData?: () => Promise<unknown>;
  setData?: (data: unknown, flush?: boolean) => Promise<unknown>;
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
};

export class YandexGamesPlatformAdapter implements PlatformAdapter {
  readonly name = "yandex";
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

  async init(): Promise<void> {
    const api = (window as any)?.YaGames;
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
      this.player = (await getPlayer({ scopes: false, signed: false })) ?? null;
    } catch {
      this.player = null;
    }

    try {
      this.leaderboards = (await this.ysdk?.getLeaderboards?.()) ?? null;
    } catch {
      this.leaderboards = null;
    }
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
    const bind = (eventName: string, callback?: () => void) => {
      if (!callback) return;

      try {
        const maybeDispose = ysdk.on?.(eventName, callback);
        if (typeof maybeDispose === "function") {
          disposers.push(maybeDispose);
          return;
        }

        if (ysdk.off) {
          disposers.push(() => {
            try {
              ysdk.off?.(eventName, callback);
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
        if (data && typeof data === "object") return data;
      } catch {
        // fallback
      }
    }

    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }

  async submitScore(boardId: string, score: number): Promise<void> {
    const safeScore = Math.max(0, Math.floor(score));
    if (this.leaderboards?.setLeaderboardScore) {
      try {
        await this.leaderboards.setLeaderboardScore(boardId, safeScore);
        return;
      } catch {
        // fallback
      }
    }
    const fallback = safeJsonParse(safeLocalStorageGet(`${PLATFORM_SAVE_KEY}:leaderboards:${boardId}`));
    const nextScore = typeof fallback === "number" && Number.isFinite(fallback) ? Math.max(fallback, safeScore) : safeScore;
    safeLocalStorageSet(`${PLATFORM_SAVE_KEY}:leaderboards:${boardId}`, String(nextScore));
  }

  async getLeaderboard(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): Promise<PlatformLeaderboardSnapshot | null> {
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
        return {
          boardId,
          scope,
          source: "platform",
          entries,
          currentPlayerRank: typeof res?.userRank === "number" ? Math.max(1, Math.floor(res.userRank)) : null,
          currentPlayerScore: typeof res?.userScore === "number" ? Math.max(0, Math.floor(res.userScore)) : null,
        };
      } catch {
        // fallback
      }
    }

    const raw = safeLocalStorageGet(`${PLATFORM_SAVE_KEY}:leaderboards:${boardId}`);
    const score = raw ? Number.parseInt(raw, 10) : 0;
    return {
      boardId,
      scope,
      source: "local",
      entries: score > 0 ? [{ rank: 1, score, playerName: "YOU", isCurrentPlayer: true }] : [],
      currentPlayerRank: score > 0 ? 1 : null,
      currentPlayerScore: score > 0 ? score : null,
    };
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
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
