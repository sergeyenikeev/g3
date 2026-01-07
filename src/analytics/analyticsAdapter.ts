export type AnalyticsEventPayload = Record<string, unknown>;

export interface AnalyticsAdapter {
  readonly name: string;
  init(): Promise<void>;
  track(eventName: string, payload?: AnalyticsEventPayload): void;
}

