import type { AnalyticsAdapter, AnalyticsEventPayload } from "./analyticsAdapter";

type VkBridge = {
  send: (method: string, params?: any) => Promise<any>;
};

export class PlatformAnalyticsAdapter implements AnalyticsAdapter {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async init(): Promise<void> {
    // no-op
  }

  track(eventName: string, payload?: AnalyticsEventPayload): void {
    const w = window as any;

    // VK (best-effort). Payload is intentionally minimal; no PII.
    const bridge = (w?.vkBridge as VkBridge | undefined) ?? null;
    if (bridge?.send) {
      try {
        void bridge.send("VKWebAppStatsTrackEvent", { event_name: eventName, ...payload });
        return;
      } catch {
        // fallback
      }
    }

    try {
      console.info(`[analytics:${this.name}] ${eventName}`, payload ?? {});
    } catch {
      // ignore
    }
  }
}
