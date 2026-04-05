import type { PlatformAdapter } from "../platformAdapter";
import { LOCAL_SAVE_BACKUP_KEY, LOCAL_SAVE_MIRROR_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";
import type { LanguageSetting } from "../../i18n/localization";
import { normalizeLanguageSetting } from "../../i18n/localization";

export const SAVE_VERSION = 1 as const;

export type SaveDataV1 = {
  v: typeof SAVE_VERSION;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    visualQuality: "auto" | "low" | "medium" | "high";
    language: LanguageSetting;
  };
  tutorial: {
    completed: boolean;
    skipped: boolean;
  };
  meta: {
    nodeLevels: Record<string, number>;
    wallet: Record<string, number>;
  };
  stats: {
    bestWave: number;
    bestBolts: number;
    runsCompleted: number;
  };
  ads: {
    lastInterstitialAtMs: number;
    lastRewardedAtMs: number;
  };
  daily: {
    lastDateUtc: string | null;
    attemptsUsed: number;
    bestWave: number;
    bestBolts: number;
  };
};

export type SaveData = SaveDataV1;

export function makeDefaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    settings: {
      sfxVolume: 0.8,
      musicVolume: 0.6,
      visualQuality: "auto",
      language: "auto",
    },
    tutorial: {
      completed: false,
      skipped: false,
    },
    meta: { nodeLevels: {}, wallet: { bolts: 0, cores: 0 } },
    stats: { bestWave: 0, bestBolts: 0, runsCompleted: 0 },
    ads: { lastInterstitialAtMs: 0, lastRewardedAtMs: 0 },
    daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
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
    if (parsed) {
      this.cache = parsed;
      writeMirror(parsed);
      return this.cache;
    }

    const mirror = sanitize(readMirror());
    if (mirror) {
      this.cache = mirror;
      writeMirror(mirror);
      void this.adapter.save(mirror).catch(() => {});
      return this.cache;
    }

    const backup = sanitize(readBackup());
    if (backup) {
      this.cache = backup;
      writeMirror(backup);
      void this.adapter.save(backup).catch(() => {});
      return this.cache;
    }

    this.cache = makeDefaultSave();
    return this.cache;
  }

  async save(next: SaveData): Promise<void> {
    rotateBackup();
    writeMirror(next);
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
  const visualQuality = sanitizeVisualQuality((raw as any).settings?.visualQuality);
  const language = normalizeLanguageSetting((raw as any).settings?.language);

  const bestWave = clampNum((raw as any).stats?.bestWave, 0, 0, 9999);
  const bestBolts = clampNum((raw as any).stats?.bestBolts, 0, 0, 1e9);
  const runsCompleted = clampNum((raw as any).stats?.runsCompleted, 0, 0, 9e15);

  const completed = Boolean((raw as any).tutorial?.completed);
  const skipped = Boolean((raw as any).tutorial?.skipped);

  const nodeLevels = isPlainObject((raw as any).meta?.nodeLevels) ? ((raw as any).meta.nodeLevels as Record<string, number>) : {};
  const wallet = sanitizeWallet((raw as any).meta?.wallet);

  const lastDateUtc = typeof (raw as any).daily?.lastDateUtc === "string" ? ((raw as any).daily.lastDateUtc as string) : null;
  const attemptsUsed = clampNum((raw as any).daily?.attemptsUsed, 0, 0, 99);
  const dailyBestWave = clampNum((raw as any).daily?.bestWave, 0, 0, 9999);
  const dailyBestBolts = clampNum((raw as any).daily?.bestBolts, 0, 0, 1e9);

  const lastInterstitialAtMs = clampNum((raw as any).ads?.lastInterstitialAtMs, 0, 0, 9e15);
  const lastRewardedAtMs = clampNum((raw as any).ads?.lastRewardedAtMs, 0, 0, 9e15);

  return {
    v: SAVE_VERSION,
    settings: { sfxVolume, musicVolume, visualQuality, language },
    tutorial: { completed, skipped },
    meta: { nodeLevels, wallet },
    stats: { bestWave, bestBolts, runsCompleted },
    ads: { lastInterstitialAtMs, lastRewardedAtMs },
    daily: { lastDateUtc, attemptsUsed, bestWave: dailyBestWave, bestBolts: dailyBestBolts },
  };
}

function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeVisualQuality(v: unknown): "auto" | "low" | "medium" | "high" {
  if (v === "auto" || v === "low" || v === "medium" || v === "high") return v;
  return "auto";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function sanitizeWallet(raw: unknown): Record<string, number> {
  const out: Record<string, number> = { bolts: 0, cores: 0 };
  if (!isPlainObject(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    out[key] = clampNum(value, out[key] ?? 0, 0, 1e12);
  }

  return out;
}

function readMirror(): unknown | null {
  return safeJsonParse(safeLocalStorageGet(LOCAL_SAVE_MIRROR_KEY));
}

function readBackup(): unknown | null {
  return safeJsonParse(safeLocalStorageGet(LOCAL_SAVE_BACKUP_KEY));
}

function rotateBackup(): void {
  const mirrorRaw = safeLocalStorageGet(LOCAL_SAVE_MIRROR_KEY);
  if (mirrorRaw) safeLocalStorageSet(LOCAL_SAVE_BACKUP_KEY, mirrorRaw);
}

function writeMirror(data: unknown): void {
  const raw = safeJsonStringify(data);
  if (!raw) return;
  safeLocalStorageSet(LOCAL_SAVE_MIRROR_KEY, raw);
}
