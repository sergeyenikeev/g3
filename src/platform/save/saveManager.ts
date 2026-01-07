import type { PlatformAdapter } from "../platformAdapter";

export const SAVE_VERSION = 1 as const;

export type SaveDataV1 = {
  v: typeof SAVE_VERSION;
  settings: {
    sfxVolume: number;
    musicVolume: number;
  };
  tutorial: {
    completed: boolean;
    skipped: boolean;
  };
  meta: {
    nodeLevels: Record<string, number>;
  };
  stats: {
    bestWave: number;
    bestBolts: number;
  };
  daily: {
    lastDateUtc: string | null;
    attemptsUsed: number;
  };
};

export type SaveData = SaveDataV1;

export function makeDefaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    settings: {
      sfxVolume: 0.8,
      musicVolume: 0.6,
    },
    tutorial: {
      completed: false,
      skipped: false,
    },
    meta: { nodeLevels: {} },
    stats: { bestWave: 0, bestBolts: 0 },
    daily: { lastDateUtc: null, attemptsUsed: 0 },
  };
}

export class SaveManager {
  private cache: SaveData | null = null;

  constructor(private readonly adapter: PlatformAdapter) {}

  get(): SaveData {
    return this.cache ?? makeDefaultSave();
  }

  async load(): Promise<SaveData> {
    const raw = await this.adapter.load();
    const parsed = sanitize(raw);
    this.cache = parsed ?? makeDefaultSave();
    return this.cache;
  }

  async save(next: SaveData): Promise<void> {
    this.cache = next;
    await this.adapter.save(next);
  }
}

function sanitize(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as any).v;
  if (v !== SAVE_VERSION) return null;

  const sfxVolume = clampNum((raw as any).settings?.sfxVolume, 0.8, 0, 1);
  const musicVolume = clampNum((raw as any).settings?.musicVolume, 0.6, 0, 1);

  const bestWave = clampNum((raw as any).stats?.bestWave, 0, 0, 9999);
  const bestBolts = clampNum((raw as any).stats?.bestBolts, 0, 0, 1e9);

  const completed = Boolean((raw as any).tutorial?.completed);
  const skipped = Boolean((raw as any).tutorial?.skipped);

  const nodeLevels = isPlainObject((raw as any).meta?.nodeLevels) ? ((raw as any).meta.nodeLevels as Record<string, number>) : {};

  const lastDateUtc = typeof (raw as any).daily?.lastDateUtc === "string" ? ((raw as any).daily.lastDateUtc as string) : null;
  const attemptsUsed = clampNum((raw as any).daily?.attemptsUsed, 0, 0, 99);

  return {
    v: SAVE_VERSION,
    settings: { sfxVolume, musicVolume },
    tutorial: { completed, skipped },
    meta: { nodeLevels },
    stats: { bestWave, bestBolts },
    daily: { lastDateUtc, attemptsUsed },
  };
}

function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

