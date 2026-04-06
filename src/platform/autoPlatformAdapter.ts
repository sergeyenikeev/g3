import type { PlatformAdapter, RewardedResult } from "./platformAdapter";
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

  async load(): Promise<unknown | null> {
    return this.impl.load();
  }

  async submitScore(score: number): Promise<void> {
    await this.impl.submitScore?.(score);
  }
}

function detect(): PlatformAdapter {
  const w = window as any;
  if (w?.YaGames?.init) return new YandexGamesPlatformAdapter();
  if (w?.vkBridge?.send) return new VkPlatformAdapter();
  return new LocalPlatformAdapter();
}
