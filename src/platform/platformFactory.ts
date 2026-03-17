import { AutoPlatformAdapter } from "./autoPlatformAdapter";
import { MockPlatformAdapter } from "./mockPlatformAdapter";
import { LocalPlatformAdapter } from "./localPlatformAdapter";
import type { PlatformAdapter } from "./platformAdapter";
import { VkPlatformAdapter } from "./adapters/vkPlatformAdapter";
import { YandexGamesPlatformAdapter } from "./adapters/yandexGamesPlatformAdapter";

export function createPlatformAdapter(): PlatformAdapter {
  const v = (import.meta as any).env?.VITE_PLATFORM_ADAPTER ?? (import.meta as any).env?.VITE_PLATFORM ?? "auto";
  const mode = String(v).toLowerCase();
  if (mode === "mock") return new MockPlatformAdapter();
  if (mode === "local" || mode === "web" || mode === "generic") return new LocalPlatformAdapter();
  if (mode === "yandex" || mode === "yandexgames" || mode === "ya") return new YandexGamesPlatformAdapter();
  if (mode === "vk") return new VkPlatformAdapter();
  return new AutoPlatformAdapter();
}
