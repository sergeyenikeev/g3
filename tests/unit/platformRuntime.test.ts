import { describe, expect, it, vi } from "vitest";
import type { PlatformAdapter, RewardedResult } from "../../src/platform/platformAdapter";
import {
  addPlatformLifecycleListener,
  getPlatformLanguageHint,
  getPlatformNowMs,
  PLATFORM_GAME_READY_SENT_KEY,
  PLATFORM_TIME_OFFSET_MS_KEY,
  resolvePlatformTimeOffsetMs,
  signalPlatformGameReady,
} from "../../src/platform/platformRuntime";

function makeAdapter(overrides: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    name: "test",
    init: async () => {},
    showInterstitial: async () => false,
    showRewarded: async (_placement: string): Promise<RewardedResult> => ({ ok: true, rewarded: false }),
    save: async () => {},
    load: async () => null,
    ...overrides,
  };
}

describe("platformRuntime", () => {
  it("prefers the platform language hint when available", () => {
    expect(getPlatformLanguageHint(makeAdapter({ getPreferredLanguage: () => "ru" }))).toBe("ru");
    expect(getPlatformLanguageHint(makeAdapter())).toBeNull();
  });

  it("computes a stable server-time offset", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const offset = await resolvePlatformTimeOffsetMs(makeAdapter({ getServerTimeMs: async () => 3_500 }));

    expect(offset).toBe(2_500);
    nowSpy.mockRestore();
  });

  it("signals game ready only once per registry", async () => {
    const ready = vi.fn(async () => {});
    const registryStore = new Map<string, unknown>();
    const registry = {
      get: (key: string) => registryStore.get(key),
      set: (key: string, value: unknown) => registryStore.set(key, value),
    };
    const adapter = makeAdapter({ signalGameReady: ready });

    await signalPlatformGameReady(adapter, registry);
    await signalPlatformGameReady(adapter, registry);

    expect(ready).toHaveBeenCalledTimes(1);
    expect(registryStore.get(PLATFORM_GAME_READY_SENT_KEY)).toBe(true);
  });

  it("adds lifecycle listeners defensively", () => {
    const dispose = vi.fn();
    const adapter = makeAdapter({
      addLifecycleListener: () => dispose,
    });

    const registeredDispose = addPlatformLifecycleListener(adapter, { pause: vi.fn(), resume: vi.fn() });
    registeredDispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("uses the platform clock offset when present", () => {
    const registry = {
      get: (key: string) => (key === PLATFORM_TIME_OFFSET_MS_KEY ? 420 : undefined),
    };

    expect(getPlatformNowMs(registry, 1_000)).toBe(1_420);
  });
});
