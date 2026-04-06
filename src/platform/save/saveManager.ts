import type { PlatformAdapter } from "../platformAdapter";
import { LOCAL_SAVE_BACKUP_KEY, LOCAL_SAVE_MIRROR_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageSet } from "../utils/localStorage";
import type { LanguageSetting } from "../../i18n/localization";
import { normalizeLanguageSetting } from "../../i18n/localization";

export const SAVE_VERSION = 1 as const;
export type LeaderboardDivisionId = "scrapper" | "raider" | "ace" | "elite" | "legend";

export type LeaderboardEntry = {
  id: string;
  pilot: string;
  mode: "run" | "daily" | "tutorial";
  score: number;
  level: number;
  wave: number;
  bolts: number;
  cores: number;
  tailMaxLen: number;
  createdAtMs: number;
  dailyDateUtc: string | null;
};

export type SaveDataV1 = {
  v: typeof SAVE_VERSION;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    visualQuality: "auto" | "low" | "medium" | "high";
    language: LanguageSetting;
    pilotName: string;
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
  leaderboard: {
    entries: LeaderboardEntry[];
    highestDivision: LeaderboardDivisionId;
    claimedRewardDivisions: LeaderboardDivisionId[];
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
      pilotName: "",
    },
    tutorial: {
      completed: false,
      skipped: false,
    },
    meta: { nodeLevels: {}, wallet: { bolts: 0, cores: 0 } },
    stats: { bestWave: 0, bestBolts: 0, runsCompleted: 0 },
    ads: { lastInterstitialAtMs: 0, lastRewardedAtMs: 0 },
    daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
    leaderboard: { entries: [], highestDivision: "scrapper", claimedRewardDivisions: [] },
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
  const pilotName = sanitizePilotName((raw as any).settings?.pilotName);

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
  const leaderboardEntries = sanitizeLeaderboardEntries((raw as any).leaderboard?.entries);
  const highestDivision = sanitizeLeaderboardHighestDivision((raw as any).leaderboard?.highestDivision, leaderboardEntries);
  const claimedRewardDivisions = sanitizeClaimedRewardDivisions(
    (raw as any).leaderboard?.claimedRewardDivisions,
    highestDivision,
    leaderboardEntries.length > 0
  );

  const lastInterstitialAtMs = clampNum((raw as any).ads?.lastInterstitialAtMs, 0, 0, 9e15);
  const lastRewardedAtMs = clampNum((raw as any).ads?.lastRewardedAtMs, 0, 0, 9e15);

  return {
    v: SAVE_VERSION,
    settings: { sfxVolume, musicVolume, visualQuality, language, pilotName },
    tutorial: { completed, skipped },
    meta: { nodeLevels, wallet },
    stats: { bestWave, bestBolts, runsCompleted },
    ads: { lastInterstitialAtMs, lastRewardedAtMs },
    daily: { lastDateUtc, attemptsUsed, bestWave: dailyBestWave, bestBolts: dailyBestBolts },
    leaderboard: { entries: leaderboardEntries, highestDivision, claimedRewardDivisions },
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

export function sanitizePilotName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 18);
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

function sanitizeLeaderboardEntries(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];

  const entries: LeaderboardEntry[] = [];
  for (const item of raw) {
    const entry = sanitizeLeaderboardEntry(item);
    if (entry) entries.push(entry);
    if (entries.length >= 32) break;
  }

  return entries;
}

function sanitizeLeaderboardEntry(raw: unknown): LeaderboardEntry | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof (raw as any).id === "string" ? ((raw as any).id as string).slice(0, 80) : "";
  if (!id) return null;

  const pilot = typeof (raw as any).pilot === "string" ? ((raw as any).pilot as string).slice(0, 24) : "RIG-100";
  const mode = sanitizeLeaderboardMode((raw as any).mode);
  const dailyDateUtc = typeof (raw as any).dailyDateUtc === "string" ? ((raw as any).dailyDateUtc as string).slice(0, 32) : null;

  return {
    id,
    pilot,
    mode,
    score: clampNum((raw as any).score, 0, 0, 9e15),
    level: clampNum((raw as any).level, 1, 1, 9999),
    wave: clampNum((raw as any).wave, 1, 1, 9999),
    bolts: clampNum((raw as any).bolts, 0, 0, 1e9),
    cores: clampNum((raw as any).cores, 0, 0, 1e6),
    tailMaxLen: clampNum((raw as any).tailMaxLen, 0, 0, 9999),
    createdAtMs: clampNum((raw as any).createdAtMs, 0, 0, 9e15),
    dailyDateUtc,
  };
}

function sanitizeLeaderboardMode(raw: unknown): LeaderboardEntry["mode"] {
  if (raw === "daily" || raw === "tutorial") return raw;
  return "run";
}

function sanitizeLeaderboardHighestDivision(raw: unknown, entries: readonly LeaderboardEntry[]): LeaderboardDivisionId {
  const explicit = sanitizeLeaderboardDivisionId(raw);
  if (explicit) return explicit;
  const bestScore = entries.reduce((best, entry) => Math.max(best, entry.score), 0);
  if (bestScore >= 90_000) return "legend";
  if (bestScore >= 60_000) return "elite";
  if (bestScore >= 35_000) return "ace";
  if (bestScore >= 18_000) return "raider";
  return "scrapper";
}

function sanitizeClaimedRewardDivisions(
  raw: unknown,
  highestDivision: LeaderboardDivisionId,
  hasExistingEntries: boolean
): LeaderboardDivisionId[] {
  if (Array.isArray(raw)) {
    const unique = new Set<LeaderboardDivisionId>();
    for (const item of raw) {
      const division = sanitizeLeaderboardDivisionId(item);
      if (division && division !== "scrapper") unique.add(division);
    }
    return LEADERBOARD_DIVISION_ORDER.filter((division) => division !== "scrapper" && unique.has(division));
  }

  if (!hasExistingEntries) return [];
  return LEADERBOARD_DIVISION_ORDER.slice(1, LEADERBOARD_DIVISION_ORDER.indexOf(highestDivision) + 1);
}

function sanitizeLeaderboardDivisionId(raw: unknown): LeaderboardDivisionId | null {
  if (raw === "scrapper" || raw === "raider" || raw === "ace" || raw === "elite" || raw === "legend") return raw;
  return null;
}

const LEADERBOARD_DIVISION_ORDER: LeaderboardDivisionId[] = ["scrapper", "raider", "ace", "elite", "legend"];

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
