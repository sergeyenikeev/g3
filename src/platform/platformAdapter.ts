export type RewardedResult =
  | { ok: true; rewarded: true }
  | { ok: true; rewarded: false }
  | { ok: false; error: string };

export type PlatformLifecycleListener = {
  pause?: () => void;
  resume?: () => void;
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
  submitScore?(score: number): Promise<void>;
}
