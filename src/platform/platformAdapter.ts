export type RewardedResult =
  | { ok: true; rewarded: true }
  | { ok: true; rewarded: false }
  | { ok: false; error: string };

export interface PlatformAdapter {
  readonly name: string;
  init(): Promise<void>;
  showInterstitial(): Promise<boolean>;
  showRewarded(placement: string): Promise<RewardedResult>;
  save(data: unknown): Promise<void>;
  load(): Promise<unknown | null>;
  submitScore?(score: number): Promise<void>;
}

