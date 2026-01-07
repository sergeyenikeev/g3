import { AutoPlatformAdapter } from "./autoPlatformAdapter";
import { MockPlatformAdapter } from "./mockPlatformAdapter";
import type { PlatformAdapter } from "./platformAdapter";

export function createPlatformAdapter(): PlatformAdapter {
  const v = (import.meta as any).env?.VITE_PLATFORM_ADAPTER ?? (import.meta as any).env?.VITE_PLATFORM ?? "auto";
  const mode = String(v).toLowerCase();
  if (mode === "mock") return new MockPlatformAdapter();
  return new AutoPlatformAdapter();
}

