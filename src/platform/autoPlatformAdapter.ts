import type { PlatformAdapter, PlatformLeaderboardSnapshot, PlatformLoadOptions, RewardedResult } from "./platformAdapter";
import { LocalPlatformAdapter } from "./localPlatformAdapter";
import { VkPlatformAdapter } from "./adapters/vkPlatformAdapter";
import { YandexGamesPlatformAdapter } from "./adapters/yandexGamesPlatformAdapter";

export class AutoPlatformAdapter implements PlatformAdapter {
  readonly name = "auto";
  private impl: PlatformAdapter = new LocalPlatformAdapter();

  async init(): Promise<void> {
    // Авто-детект: если SDK доступен на странице — используем его, иначе деградируем в localStorage без рекламы.
    this.impl = detect();
    await this.impl.init();
  }

  async showInterstitial(): Promise<boolean> {
    return this.impl.showInterstitial();
  }

  async showRewarded(placement: string): Promise<RewardedResult> {
    return this.impl.showRewarded(placement);
  }

  async save(data: unknown): Promise<void> {
    return this.impl.save(data);
  }

  async load(options?: PlatformLoadOptions): Promise<unknown | null> {
    return this.impl.load(options);
  }

  markBootCompleted(): void {
    this.impl.markBootCompleted?.();
  }

  async submitScore(boardId: string, score: number): Promise<void> {
    await this.impl.submitScore?.(boardId, score);
  }

  async getLeaderboard(boardId: string, scope: PlatformLeaderboardSnapshot["scope"]): Promise<PlatformLeaderboardSnapshot | null> {
    return (await this.impl.getLeaderboard?.(boardId, scope)) ?? null;
  }
}

function detect(): PlatformAdapter {
  const w = window as any;
  if (w?.YaGames?.init) return new YandexGamesPlatformAdapter();
  if (w?.vkBridge?.send) return new VkPlatformAdapter();
  return new LocalPlatformAdapter();
}
