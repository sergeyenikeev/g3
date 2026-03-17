import type { AnalyticsAdapter } from "./analyticsAdapter";
import { MockAnalyticsAdapter } from "./mockAnalyticsAdapter";
import { PlatformAnalyticsAdapter } from "./platformAnalyticsAdapter";

export function createAnalyticsAdapter(): AnalyticsAdapter {
  const v = (import.meta as any).env?.VITE_ANALYTICS ?? (import.meta as any).env?.VITE_PLATFORM_ANALYTICS ?? "auto";
  const mode = String(v).toLowerCase();
  if (mode === "mock") return new MockAnalyticsAdapter();
  if (mode === "vk" || mode === "yandex") return new PlatformAnalyticsAdapter(mode);
  if (mode !== "auto") return new MockAnalyticsAdapter();

  const w = window as any;
  if (w?.vkBridge?.send) return new PlatformAnalyticsAdapter("vk");
  if (w?.YaGames?.init) return new PlatformAnalyticsAdapter("yandex");
  return new MockAnalyticsAdapter();
}
