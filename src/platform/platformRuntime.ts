import type { PlatformAdapter, PlatformLifecycleListener } from "./platformAdapter";

export const PLATFORM_GAME_READY_SENT_KEY = "platformGameReadySent";
export const PLATFORM_TIME_OFFSET_MS_KEY = "platformTimeOffsetMs";

type RegistryLike = {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
};

export function getPlatformLanguageHint(adapter: PlatformAdapter | null | undefined): string | null {
  try {
    const value = adapter?.getPreferredLanguage?.();
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function resolvePlatformTimeOffsetMs(adapter: PlatformAdapter | null | undefined): Promise<number> {
  try {
    const serverTimeMs = await adapter?.getServerTimeMs?.();
    if (typeof serverTimeMs !== "number" || !Number.isFinite(serverTimeMs)) return 0;
    return serverTimeMs - Date.now();
  } catch {
    return 0;
  }
}

export async function signalPlatformGameReady(
  adapter: PlatformAdapter | null | undefined,
  registry?: RegistryLike | null
): Promise<void> {
  if (!adapter?.signalGameReady) return;
  if (registry?.get(PLATFORM_GAME_READY_SENT_KEY) === true) return;

  try {
    await adapter.signalGameReady();
    registry?.set(PLATFORM_GAME_READY_SENT_KEY, true);
  } catch {
    // ignore
  }
}

export async function signalPlatformGameplayStart(adapter: PlatformAdapter | null | undefined): Promise<void> {
  try {
    await adapter?.signalGameplayStart?.();
  } catch {
    // ignore
  }
}

export async function signalPlatformGameplayStop(adapter: PlatformAdapter | null | undefined): Promise<void> {
  try {
    await adapter?.signalGameplayStop?.();
  } catch {
    // ignore
  }
}

export function addPlatformLifecycleListener(
  adapter: PlatformAdapter | null | undefined,
  listener: PlatformLifecycleListener
): () => void {
  if (!adapter?.addLifecycleListener) return () => {};

  try {
    const dispose = adapter.addLifecycleListener(listener);
    return typeof dispose === "function" ? dispose : () => {};
  } catch {
    return () => {};
  }
}

export function getPlatformNowMs(registry: Pick<RegistryLike, "get"> | null | undefined, fallbackNowMs = Date.now()): number {
  const rawOffset = registry?.get(PLATFORM_TIME_OFFSET_MS_KEY);
  const offset = typeof rawOffset === "number" && Number.isFinite(rawOffset) ? rawOffset : 0;
  return fallbackNowMs + offset;
}
