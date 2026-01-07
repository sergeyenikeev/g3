import type { PlatformAdapter, RewardedResult } from "./platformAdapter";

const STORAGE_KEY = "magnet-caravan:platform-save";

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  async load(): Promise<unknown | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

