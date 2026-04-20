import type { PlatformAdapter, PlatformLeaderboardSnapshot, PlatformLoadOptions, RewardedResult } from "./platformAdapter";
import { PLATFORM_LEADERBOARD_KEY, PLATFORM_SAVE_KEY } from "./storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "./utils/localStorage";

export class MockPlatformAdapter implements PlatformAdapter {
  readonly name = "mock";

  async init(): Promise<void> {
    // no-op
  }

  async showInterstitial(): Promise<boolean> {
    await delay(250);
    return true;
  }

  async showRewarded(_placement: string): Promise<RewardedResult> {
    await delay(350);
    return { ok: true, rewarded: true };
  }

  async save(data: unknown): Promise<void> {
    const raw = safeJsonStringify(data);
    if (!raw) return;
    safeLocalStorageSet(PLATFORM_SAVE_KEY, raw);
  }

  async load(_options?: PlatformLoadOptions): Promise<unknown | null> {
    return safeJsonParse(safeLocalStorageGet(PLATFORM_SAVE_KEY));
  }

  async submitScore(boardId: string, score: number): Promise<void> {
    const store = readLeaderboards();
    const entries = Array.isArray(store[boardId]) ? store[boardId] : [];
    entries.push({
      score: Math.max(0, Math.floor(score)),
      playerName: `MOCK-${entries.length + 1}`,
      createdAtMs: Date.now(),
    });
    entries.sort((a, b) => b.score - a.score || b.createdAtMs - a.createdAtMs);
    store[boardId] = entries.slice(0, 20);
    writeLeaderboards(store);
  }

  async getLeaderboard(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): Promise<PlatformLeaderboardSnapshot | null> {
    const store = readLeaderboards();
    const entries = (Array.isArray(store[boardId]) ? store[boardId] : []).map((entry, index) => ({
      rank: index + 1,
      score: Math.max(0, Math.floor(entry.score)),
      playerName: typeof entry.playerName === "string" ? entry.playerName : `MOCK-${index + 1}`,
      isCurrentPlayer: index === 0,
    }));
    return {
      boardId,
      scope,
      source: "local",
      entries,
      currentPlayerRank: entries[0]?.rank ?? null,
      currentPlayerScore: entries[0]?.score ?? null,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type LocalLeaderboardStore = Record<string, Array<{ score: number; playerName: string; createdAtMs: number }>>;

function readLeaderboards(): LocalLeaderboardStore {
  const raw = safeJsonParse(safeLocalStorageGet(PLATFORM_LEADERBOARD_KEY));
  if (!raw || typeof raw !== "object") return {};
  return raw as LocalLeaderboardStore;
}

function writeLeaderboards(value: LocalLeaderboardStore): void {
  const raw = safeJsonStringify(value);
  if (!raw) return;
  safeLocalStorageSet(PLATFORM_LEADERBOARD_KEY, raw);
}
