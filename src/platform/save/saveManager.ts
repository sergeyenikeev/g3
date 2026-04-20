import type { PlatformAdapter, PlatformLoadOptions } from "../platformAdapter";
import { LOCAL_SAVE_BACKUP_KEY, LOCAL_SAVE_MIRROR_KEY } from "../storageKeys";
import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "../utils/localStorage";
import type { LanguageSetting } from "../../i18n/localization";
import { normalizeLanguageSetting } from "../../i18n/localization";

export const SAVE_VERSION = 1 as const;
export type LeaderboardDivisionId = "scrapper" | "raider" | "ace" | "elite" | "legend";
export type LeaderboardCareerMilestoneId = "score_25000" | "wave_20" | "salvage_400" | "legend_league";

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
    rewardedChainCount: number;
    lastFrustrationAtMs: number;
    lastRunStartedAtMs: number;
    lastRunDurationSec: number;
    interstitialDateUtc: string | null;
    interstitialsShownToday: number;
  };
  loginRewards: {
    lastClaimDateUtc: string | null;
    day: number;
  };
  liveops: {
    firstSeenDateUtc: string | null;
    lastSeenDateUtc: string | null;
    sessionsStarted: number;
    lastReturnGapDays: number;
    activation: {
      firstScrapTracked: boolean;
      firstBankTracked: boolean;
      firstUpgradeTracked: boolean;
    };
    onboarding: {
      freeBoostsUsed: number;
    };
    streak: {
      day: number;
      claimedDateUtc: string | null;
    };
    comeback: {
      lastClaimDateUtc: string | null;
      lastEligibleGapDays: number;
    };
    missions: {
      daily: {
        dateUtc: string | null;
        progress: Record<string, number>;
        claimedIds: string[];
      };
      weekly: {
        weekKey: string | null;
        progress: Record<string, number>;
        claimedIds: string[];
      };
    };
    claimedEventRewardIds: string[];
    weeklyLeaderboard: {
      weekKey: string | null;
      entries: LeaderboardEntry[];
      highestDivision: LeaderboardDivisionId;
      claimedRewardDivisions: LeaderboardDivisionId[];
      claimedRewardWeekKeys: string[];
    };
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
    claimedMilestones: LeaderboardCareerMilestoneId[];
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
    ads: {
      lastInterstitialAtMs: 0,
      lastRewardedAtMs: 0,
      rewardedChainCount: 0,
      lastFrustrationAtMs: 0,
      lastRunStartedAtMs: 0,
      lastRunDurationSec: 0,
      interstitialDateUtc: null,
      interstitialsShownToday: 0,
    },
    loginRewards: { lastClaimDateUtc: null, day: 0 },
    liveops: {
      firstSeenDateUtc: null,
      lastSeenDateUtc: null,
      sessionsStarted: 0,
      lastReturnGapDays: 0,
      activation: {
        firstScrapTracked: false,
        firstBankTracked: false,
        firstUpgradeTracked: false,
      },
      onboarding: {
        freeBoostsUsed: 0,
      },
      streak: {
        day: 0,
        claimedDateUtc: null,
      },
      comeback: {
        lastClaimDateUtc: null,
        lastEligibleGapDays: 0,
      },
      missions: {
        daily: { dateUtc: null, progress: {}, claimedIds: [] },
        weekly: { weekKey: null, progress: {}, claimedIds: [] },
      },
      claimedEventRewardIds: [],
      weeklyLeaderboard: {
        weekKey: null,
        entries: [],
        highestDivision: "scrapper",
        claimedRewardDivisions: [],
        claimedRewardWeekKeys: [],
      },
    },
    daily: { lastDateUtc: null, attemptsUsed: 0, bestWave: 0, bestBolts: 0 },
    leaderboard: { entries: [], highestDivision: "scrapper", claimedRewardDivisions: [], claimedMilestones: [] },
  };
}

export class SaveManager {
  private cache: SaveData | null = null;

  constructor(private readonly adapter: PlatformAdapter) {}

  get(): SaveData {
    return this.cache ?? makeDefaultSave();
  }

  async load(options?: PlatformLoadOptions): Promise<SaveData> {
    const storageScope = this.getStorageScope();
    const raw = await this.adapter.load(options);
    const parsed = sanitize(raw);
    if (parsed) {
      this.cache = parsed;
      writeMirror(parsed, storageScope);
      return this.cache;
    }

    const mirror = sanitize(readMirror(storageScope));
    if (mirror) {
      this.cache = mirror;
      writeMirror(mirror, storageScope);
      if (!options?.ignorePlatformData) void this.adapter.save(mirror).catch(() => {});
      return this.cache;
    }

    const backup = sanitize(readBackup(storageScope));
    if (backup) {
      this.cache = backup;
      writeMirror(backup, storageScope);
      if (!options?.ignorePlatformData) void this.adapter.save(backup).catch(() => {});
      return this.cache;
    }

    this.cache = makeDefaultSave();
    return this.cache;
  }

  async save(next: SaveData, options?: { persistToPlatform?: boolean }): Promise<void> {
    const storageScope = this.getStorageScope();
    rotateBackup(storageScope);
    writeMirror(next, storageScope);
    this.cache = next;
    if (options?.persistToPlatform === false) return;
    await this.adapter.save(next);
  }

  clearLocalCopies(): void {
    const storageScope = this.getStorageScope();
    clearScopedStorageKey(LOCAL_SAVE_MIRROR_KEY, storageScope);
    clearScopedStorageKey(LOCAL_SAVE_BACKUP_KEY, storageScope);
  }

  private getStorageScope(): string | null {
    try {
      const value = this.adapter.getStorageScope?.();
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch {
      return null;
    }
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

  const loginRewardLastClaimDateUtc =
    typeof (raw as any).loginRewards?.lastClaimDateUtc === "string" ? ((raw as any).loginRewards.lastClaimDateUtc as string) : null;
  const loginRewardDay = clampNum((raw as any).loginRewards?.day, 0, 0, 5);
  const liveopsFirstSeenDateUtc =
    typeof (raw as any).liveops?.firstSeenDateUtc === "string" ? ((raw as any).liveops.firstSeenDateUtc as string) : null;
  const liveopsLastSeenDateUtc =
    typeof (raw as any).liveops?.lastSeenDateUtc === "string" ? ((raw as any).liveops.lastSeenDateUtc as string) : null;
  const liveopsSessionsStarted = clampNum((raw as any).liveops?.sessionsStarted, 0, 0, 9e15);
  const liveopsLastReturnGapDays = clampNum((raw as any).liveops?.lastReturnGapDays, 0, 0, 999);
  const activation = sanitizeActivation((raw as any).liveops?.activation);
  const freeBoostsUsed = clampNum((raw as any).liveops?.onboarding?.freeBoostsUsed, 0, 0, 99);
  const streakDay = clampNum((raw as any).liveops?.streak?.day, 0, 0, 999);
  const streakClaimedDateUtc =
    typeof (raw as any).liveops?.streak?.claimedDateUtc === "string" ? ((raw as any).liveops.streak.claimedDateUtc as string) : null;
  const comebackLastClaimDateUtc =
    typeof (raw as any).liveops?.comeback?.lastClaimDateUtc === "string"
      ? ((raw as any).liveops.comeback.lastClaimDateUtc as string)
      : null;
  const comebackLastEligibleGapDays = clampNum((raw as any).liveops?.comeback?.lastEligibleGapDays, 0, 0, 999);
  const missionDailyDateUtc =
    typeof (raw as any).liveops?.missions?.daily?.dateUtc === "string" ? ((raw as any).liveops.missions.daily.dateUtc as string) : null;
  const missionWeeklyWeekKey =
    typeof (raw as any).liveops?.missions?.weekly?.weekKey === "string"
      ? ((raw as any).liveops.missions.weekly.weekKey as string)
      : null;
  const dailyMissionProgress = sanitizeProgressMap((raw as any).liveops?.missions?.daily?.progress);
  const weeklyMissionProgress = sanitizeProgressMap((raw as any).liveops?.missions?.weekly?.progress);
  const dailyMissionClaimedIds = sanitizeStringList((raw as any).liveops?.missions?.daily?.claimedIds, 24, 80);
  const weeklyMissionClaimedIds = sanitizeStringList((raw as any).liveops?.missions?.weekly?.claimedIds, 32, 80);
  const claimedEventRewardIds = sanitizeStringList((raw as any).liveops?.claimedEventRewardIds, 48, 96);
  const weeklyLeaderboardWeekKey =
    typeof (raw as any).liveops?.weeklyLeaderboard?.weekKey === "string"
      ? ((raw as any).liveops.weeklyLeaderboard.weekKey as string)
      : null;
  const weeklyLeaderboardEntries = sanitizeLeaderboardEntries((raw as any).liveops?.weeklyLeaderboard?.entries);
  const weeklyLeaderboardHighestDivision = sanitizeLeaderboardHighestDivision(
    (raw as any).liveops?.weeklyLeaderboard?.highestDivision,
    weeklyLeaderboardEntries
  );
  const weeklyClaimedRewardDivisions = sanitizeClaimedRewardDivisions(
    (raw as any).liveops?.weeklyLeaderboard?.claimedRewardDivisions,
    weeklyLeaderboardHighestDivision,
    weeklyLeaderboardEntries.length > 0
  );
  const weeklyClaimedRewardWeekKeys = sanitizeStringList((raw as any).liveops?.weeklyLeaderboard?.claimedRewardWeekKeys, 32, 32);

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
  const claimedMilestones = sanitizeClaimedMilestones(
    (raw as any).leaderboard?.claimedMilestones,
    highestDivision,
    bestWave,
    bestBolts,
    leaderboardEntries
  );

  const lastInterstitialAtMs = clampNum((raw as any).ads?.lastInterstitialAtMs, 0, 0, 9e15);
  const lastRewardedAtMs = clampNum((raw as any).ads?.lastRewardedAtMs, 0, 0, 9e15);
  const rewardedChainCount = clampNum((raw as any).ads?.rewardedChainCount, 0, 0, 99);
  const lastFrustrationAtMs = clampNum((raw as any).ads?.lastFrustrationAtMs, 0, 0, 9e15);
  const lastRunStartedAtMs = clampNum((raw as any).ads?.lastRunStartedAtMs, 0, 0, 9e15);
  const lastRunDurationSec = clampNum((raw as any).ads?.lastRunDurationSec, 0, 0, 60 * 60 * 24);
  const interstitialDateUtc = typeof (raw as any).ads?.interstitialDateUtc === "string" ? ((raw as any).ads.interstitialDateUtc as string) : null;
  const interstitialsShownToday = clampNum((raw as any).ads?.interstitialsShownToday, 0, 0, 99);

  return {
    v: SAVE_VERSION,
    settings: { sfxVolume, musicVolume, visualQuality, language, pilotName },
    tutorial: { completed, skipped },
    meta: { nodeLevels, wallet },
    stats: { bestWave, bestBolts, runsCompleted },
    ads: {
      lastInterstitialAtMs,
      lastRewardedAtMs,
      rewardedChainCount,
      lastFrustrationAtMs,
      lastRunStartedAtMs,
      lastRunDurationSec,
      interstitialDateUtc,
      interstitialsShownToday,
    },
    loginRewards: { lastClaimDateUtc: loginRewardLastClaimDateUtc, day: loginRewardDay },
    liveops: {
      firstSeenDateUtc: liveopsFirstSeenDateUtc,
      lastSeenDateUtc: liveopsLastSeenDateUtc,
      sessionsStarted: liveopsSessionsStarted,
      lastReturnGapDays: liveopsLastReturnGapDays,
      activation,
      onboarding: {
        freeBoostsUsed,
      },
      streak: {
        day: streakDay,
        claimedDateUtc: streakClaimedDateUtc,
      },
      comeback: {
        lastClaimDateUtc: comebackLastClaimDateUtc,
        lastEligibleGapDays: comebackLastEligibleGapDays,
      },
      missions: {
        daily: {
          dateUtc: missionDailyDateUtc,
          progress: dailyMissionProgress,
          claimedIds: dailyMissionClaimedIds,
        },
        weekly: {
          weekKey: missionWeeklyWeekKey,
          progress: weeklyMissionProgress,
          claimedIds: weeklyMissionClaimedIds,
        },
      },
      claimedEventRewardIds,
      weeklyLeaderboard: {
        weekKey: weeklyLeaderboardWeekKey,
        entries: weeklyLeaderboardEntries,
        highestDivision: weeklyLeaderboardHighestDivision,
        claimedRewardDivisions: weeklyClaimedRewardDivisions,
        claimedRewardWeekKeys: weeklyClaimedRewardWeekKeys,
      },
    },
    daily: { lastDateUtc, attemptsUsed, bestWave: dailyBestWave, bestBolts: dailyBestBolts },
    leaderboard: { entries: leaderboardEntries, highestDivision, claimedRewardDivisions, claimedMilestones },
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

function sanitizeActivation(raw: unknown): SaveData["liveops"]["activation"] {
  return {
    firstScrapTracked: Boolean((raw as any)?.firstScrapTracked),
    firstBankTracked: Boolean((raw as any)?.firstBankTracked),
    firstUpgradeTracked: Boolean((raw as any)?.firstUpgradeTracked),
  };
}

function sanitizeProgressMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== "string" || key.length === 0) continue;
    out[key.slice(0, 80)] = clampNum(value, 0, 0, 9e15);
  }
  return out;
}

function sanitizeStringList(raw: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.slice(0, maxLength);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= limit) break;
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

function sanitizeLeaderboardCareerMilestoneId(raw: unknown): LeaderboardCareerMilestoneId | null {
  if (raw === "score_25000" || raw === "wave_20" || raw === "salvage_400" || raw === "legend_league") return raw;
  return null;
}

function sanitizeClaimedMilestones(
  raw: unknown,
  highestDivision: LeaderboardDivisionId,
  bestWave: number,
  bestBolts: number,
  entries: readonly LeaderboardEntry[]
): LeaderboardCareerMilestoneId[] {
  if (Array.isArray(raw)) {
    const unique = new Set<LeaderboardCareerMilestoneId>();
    for (const item of raw) {
      const milestone = sanitizeLeaderboardCareerMilestoneId(item);
      if (milestone) unique.add(milestone);
    }
    return LEADERBOARD_CAREER_MILESTONE_ORDER.filter((milestone) => unique.has(milestone));
  }

  const bestScore = entries.reduce((best, entry) => Math.max(best, entry.score), 0);
  const unlocked = new Set<LeaderboardCareerMilestoneId>();
  if (bestScore >= 25_000) unlocked.add("score_25000");
  if (bestWave >= 20) unlocked.add("wave_20");
  if (bestBolts >= 400) unlocked.add("salvage_400");
  if (highestDivision === "legend") unlocked.add("legend_league");
  return LEADERBOARD_CAREER_MILESTONE_ORDER.filter((milestone) => unlocked.has(milestone));
}

const LEADERBOARD_DIVISION_ORDER: LeaderboardDivisionId[] = ["scrapper", "raider", "ace", "elite", "legend"];
const LEADERBOARD_CAREER_MILESTONE_ORDER: LeaderboardCareerMilestoneId[] = [
  "score_25000",
  "wave_20",
  "salvage_400",
  "legend_league",
];

function readMirror(scope: string | null): unknown | null {
  return safeJsonParse(safeLocalStorageGet(getScopedStorageKey(LOCAL_SAVE_MIRROR_KEY, scope)));
}

function readBackup(scope: string | null): unknown | null {
  return safeJsonParse(safeLocalStorageGet(getScopedStorageKey(LOCAL_SAVE_BACKUP_KEY, scope)));
}

function rotateBackup(scope: string | null): void {
  const mirrorKey = getScopedStorageKey(LOCAL_SAVE_MIRROR_KEY, scope);
  const backupKey = getScopedStorageKey(LOCAL_SAVE_BACKUP_KEY, scope);
  const mirrorRaw = safeLocalStorageGet(mirrorKey);
  if (mirrorRaw) safeLocalStorageSet(backupKey, mirrorRaw);
}

function writeMirror(data: unknown, scope: string | null): void {
  const raw = safeJsonStringify(data);
  if (!raw) return;
  safeLocalStorageSet(getScopedStorageKey(LOCAL_SAVE_MIRROR_KEY, scope), raw);
}

function getScopedStorageKey(baseKey: string, scope: string | null): string {
  return scope ? `${baseKey}:${scope}` : baseKey;
}

function clearScopedStorageKey(baseKey: string, scope: string | null): void {
  safeLocalStorageRemove(baseKey);
  if (scope) safeLocalStorageRemove(getScopedStorageKey(baseKey, scope));
}
