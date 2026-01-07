import type { AnalyticsAdapter, AnalyticsEventPayload } from "./analyticsAdapter";

export class MockAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = "mock";

  async init(): Promise<void> {
    // no-op
  }

  track(eventName: string, payload?: AnalyticsEventPayload): void {
    try {
      console.info(`[analytics] ${eventName}`, payload ?? {});
    } catch {
      // ignore
    }
  }
}
