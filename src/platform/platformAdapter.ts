export type RewardedResult =
  | { ok: true; rewarded: true }
  | { ok: true; rewarded: false }
  | { ok: false; error: string };

export type PlatformLifecycleListener = {
  pause?: () => void;
  resume?: () => void;
};

export type PlatformLeaderboardEntry = {
  rank: number;
  score: number;
  playerName: string;
  isCurrentPlayer?: boolean;
};

export type PlatformLeaderboardSnapshot = {
  boardId: string;
  scope: "daily" | "weekly" | "all_time";
  source: "platform" | "local";
  entries: PlatformLeaderboardEntry[];
  currentPlayerRank: number | null;
  currentPlayerScore: number | null;
};

export interface PlatformAdapter {
  readonly name: string;
  init(): Promise<void>;
  getPreferredLanguage?(): string | null;
  getServerTimeMs?(): Promise<number | null>;
  signalGameReady?(): Promise<void>;
  signalGameplayStart?(): Promise<void>;
  signalGameplayStop?(): Promise<void>;
  addLifecycleListener?(listener: PlatformLifecycleListener): (() => void) | void;
  showInterstitial(): Promise<boolean>;
  showRewarded(placement: string): Promise<RewardedResult>;
  save(data: unknown): Promise<void>;
  load(): Promise<unknown | null>;
  submitScore?(boardId: string, score: number): Promise<void>;
  getLeaderboard?(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): Promise<PlatformLeaderboardSnapshot | null>;
}
