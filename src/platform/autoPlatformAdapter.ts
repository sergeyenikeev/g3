import type { PlatformAdapter, RewardedResult } from "./platformAdapter";
import { MockPlatformAdapter } from "./mockPlatformAdapter";

export class AutoPlatformAdapter implements PlatformAdapter {
  readonly name = "auto";
  private impl: PlatformAdapter = new MockPlatformAdapter();

  async init(): Promise<void> {
    // Сейчас безопасная деградация: если SDK не найден — остаёмся на mock.
    // Реальные SDK-адаптеры подключаем по мере необходимости (CrazyGames/Poki/Yandex/VK).
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
}

