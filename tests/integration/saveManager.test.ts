import { describe, expect, it } from "vitest";
import type { PlatformAdapter, RewardedResult } from "../../src/platform/platformAdapter";
import { SaveManager } from "../../src/platform/save/saveManager";

class MemoryAdapter implements PlatformAdapter {
  readonly name = "memory";
  private store: unknown | null = null;
  async init(): Promise<void> {}
  async showInterstitial(): Promise<boolean> {
    return true;
  }
  async showRewarded(): Promise<RewardedResult> {
    return { ok: true, rewarded: true };
  }
  async save(data: unknown): Promise<void> {
    this.store = data;
  }
  async load(): Promise<unknown | null> {
    return this.store;
  }
}

describe("SaveManager (integration)", () => {
  it("load без данных даёт дефолт", async () => {
    const sm = new SaveManager(new MemoryAdapter());
    const s = await sm.load();
    expect(s.v).toBe(1);
  });

  it("save+load возвращает данные", async () => {
    const sm = new SaveManager(new MemoryAdapter());
    const s = await sm.load();
    s.stats.bestWave = 10;
    await sm.save(s);
    const s2 = await sm.load();
    expect(s2.stats.bestWave).toBe(10);
  });

  it("невалидная версия сбрасывается в дефолт", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save({ v: 999 });
    const sm = new SaveManager(adapter);
    const s = await sm.load();
    expect(s.v).toBe(1);
  });
});

