import type { AnalyticsAdapter, AnalyticsEventPayload } from "./analyticsAdapter";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../platform/utils/localStorage";

type VkBridge = {
  send: (method: string, params?: any) => Promise<any>;
};

type AnalyticsEventRecord = AnalyticsEventPayload & {
  eventName: string;
  platformId: string;
  sessionId: string;
  timestampMs: number;
};

const ANALYTICS_BUFFER_KEY = "magnet_caravan.analytics.buffer";
const ANALYTICS_BUFFER_LIMIT = 200;

export class PlatformAnalyticsAdapter implements AnalyticsAdapter {
  readonly name: string;
  private readonly sessionId: string;

  constructor(name: string) {
    this.name = name;
    this.sessionId = `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async init(): Promise<void> {
    // no-op
  }

  track(eventName: string, payload?: AnalyticsEventPayload): void {
    const w = window as any;
    const event = this.createEventRecord(eventName, payload);
    this.bufferEvent(event);
    this.dispatchBrowserEvent(event);

    const bridge = (w?.vkBridge as VkBridge | undefined) ?? null;
    if (bridge?.send) {
      try {
        void bridge.send("VKWebAppStatsTrackEvent", { event_name: eventName, ...payload });
        return;
      } catch {
        // fallback
      }
    }

    if (this.name === "yandex") {
      const metricaId = resolveYandexMetricaId(w);
      if (metricaId !== null && typeof w?.ym === "function") {
        try {
          w.ym(metricaId, "reachGoal", eventName, event);
          return;
        } catch {
          // fallback
        }
      }
    }

    try {
      if (typeof w?.dataLayer?.push === "function") {
        w.dataLayer.push({ event: eventName, ...event });
        return;
      }
    } catch {
      // fallback
    }

    try {
      console.info(`[analytics:${this.name}] ${eventName}`, event);
    } catch {
      // ignore
    }
  }

  private createEventRecord(eventName: string, payload?: AnalyticsEventPayload): AnalyticsEventRecord {
    return {
      ...(payload ?? {}),
      eventName,
      platformId: this.name,
      sessionId: this.sessionId,
      timestampMs: Date.now(),
    };
  }

  private bufferEvent(event: AnalyticsEventRecord): void {
    const buffer = safeJsonParse<AnalyticsEventRecord[]>(safeLocalStorageGet(ANALYTICS_BUFFER_KEY));
    const next = Array.isArray(buffer) ? buffer.slice(-(ANALYTICS_BUFFER_LIMIT - 1)) : [];
    next.push(event);
    const raw = safeJsonStringify(next);
    if (!raw) return;
    safeLocalStorageSet(ANALYTICS_BUFFER_KEY, raw);
  }

  private dispatchBrowserEvent(event: AnalyticsEventRecord): void {
    try {
      window.dispatchEvent(new CustomEvent("magnet-caravan-analytics", { detail: event }));
    } catch {
      // ignore
    }
  }
}

function resolveYandexMetricaId(w: any): number | null {
  const raw = (import.meta as any).env?.VITE_YANDEX_METRICA_ID ?? w?.__MAGNET_YANDEX_METRICA_ID ?? null;
  const parsed = Number.parseInt(`${raw ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
