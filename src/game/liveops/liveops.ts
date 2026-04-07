import { createRng } from "../../core/prng";
import type { DailyConfig, LeaderboardsConfig, LiveopsConfig, LiveopsMissionDef, MissionObjectiveType } from "../../data/types";
import { grantMetaWallet } from "../meta/metaProgression";
import {
  getLeaderboardDivision,
  getLeaderboardHigherDivision,
  getLeaderboardRank,
  upsertLeaderboardEntries,
} from "../run/leaderboard";
import type { LeaderboardEntry, LeaderboardDivisionId, SaveData } from "../../platform/save/saveManager";

export type MissionPeriod = "daily" | "weekly";

export type LiveopsRunSummary = {
  mode: "run" | "daily" | "tutorial";
  wave: number;
  score: number;
  totalBolts: number;
  bankedBolts: number;
  heavyScrapCollected: number;
  projectilesDeflected: number;
  flipsUsed: number;
};

export type MissionStatus = {
  def: LiveopsMissionDef;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type NormalizeLiveopsSummary = {
  returnedAfterDays: number;
  streakDay: number;
  streakAdvanced: boolean;
  comebackEligible: boolean;
  weeklyRewardGranted: { division: LeaderboardDivisionId; reward: { bolts: number; cores: number } } | null;
};

type SavePatchResult = {
  save: SaveData;
  changed: boolean;
};

export function getWeekKey(dateUtc: string): string {
  const date = parseUtcDate(dateUtc);
  const day = date.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - delta);
  return formatUtcDate(date);
}

export function getActiveDailyRotation(cfg: DailyConfig, dateUtc: string):
  | { id: string; variantIds?: string[]; ui?: { badge?: string; title?: string; desc?: string } }
  | null {
  const rotations = Array.isArray(cfg.rotations) ? cfg.rotations : [];
  return (
    rotations.find((rotation) => {
      const from = typeof rotation?.fromDateUtc === "string" ? rotation.fromDateUtc : "";
      const to = typeof rotation?.toDateUtc === "string" ? rotation.toDateUtc : "";
      return from <= dateUtc && dateUtc <= to;
    }) ?? null
  );
}

export function normalizeLiveopsSave(
  save: SaveData,
  cfg: LiveopsConfig,
  leaderboardsCfg: LeaderboardsConfig,
  dateUtc: string
): { save: SaveData; summary: NormalizeLiveopsSummary } {
  let next = save;
  let changed = false;
  const weekKey = getWeekKey(dateUtc);
  const previousDate = save.liveops.lastSeenDateUtc;
  const returnedAfterDays = previousDate ? Math.max(0, diffUtcDays(previousDate, dateUtc)) : 0;

  const streakResult = normalizeStreak(next, cfg, dateUtc, returnedAfterDays);
  next = streakResult.save;
  changed = changed || streakResult.changed;

  const missionResult = normalizeMissionState(next, dateUtc, weekKey);
  next = missionResult.save;
  changed = changed || missionResult.changed;

  const weeklyBoardResult = normalizeWeeklyBoard(next, leaderboardsCfg, weekKey);
  next = weeklyBoardResult.save;
  changed = changed || weeklyBoardResult.changed;

  const nextFirstSeen = next.liveops.firstSeenDateUtc ?? dateUtc;
  const nextSessionsStarted = next.liveops.sessionsStarted + 1;
  const comebackEligible = returnedAfterDays >= Math.max(1, Math.floor(cfg.comeback.idleDays));
  const nextLastEligibleGapDays = comebackEligible ? returnedAfterDays : next.liveops.comeback.lastEligibleGapDays;

  if (
    next.liveops.firstSeenDateUtc !== nextFirstSeen ||
    next.liveops.lastSeenDateUtc !== dateUtc ||
    next.liveops.sessionsStarted !== nextSessionsStarted ||
    next.liveops.lastReturnGapDays !== returnedAfterDays ||
    next.liveops.comeback.lastEligibleGapDays !== nextLastEligibleGapDays
  ) {
    next = {
      ...next,
      liveops: {
        ...next.liveops,
        firstSeenDateUtc: nextFirstSeen,
        lastSeenDateUtc: dateUtc,
        sessionsStarted: nextSessionsStarted,
        lastReturnGapDays: returnedAfterDays,
        comeback: {
          ...next.liveops.comeback,
          lastEligibleGapDays: nextLastEligibleGapDays,
        },
      },
    };
    changed = true;
  }

  return {
    save: changed ? next : save,
    summary: {
      returnedAfterDays,
      streakDay: next.liveops.streak.day,
      streakAdvanced: streakResult.streakAdvanced,
      comebackEligible,
      weeklyRewardGranted: weeklyBoardResult.rewardGranted,
    },
  };
}

export function getOnboardingBoostStatus(save: SaveData, cfg: LiveopsConfig): {
  eligible: boolean;
  usesLeft: number;
  addTailSegments: number;
  addBolts: number;
  addCores: number;
} {
  const maxUses = Math.max(0, Math.floor(cfg.onboarding.freeBoostedRunUses));
  const used = Math.max(0, Math.floor(save.liveops.onboarding.freeBoostsUsed));
  return {
    eligible: used < maxUses,
    usesLeft: Math.max(0, maxUses - used),
    addTailSegments: Math.max(0, Math.floor(cfg.onboarding.freeBoostTailSegments)),
    addBolts: Math.max(0, Math.floor(cfg.onboarding.freeBoostBolts)),
    addCores: Math.max(0, Math.floor(cfg.onboarding.freeBoostCores)),
  };
}

export function consumeOnboardingBoost(save: SaveData): SaveData {
  return {
    ...save,
    liveops: {
      ...save.liveops,
      onboarding: {
        ...save.liveops.onboarding,
        freeBoostsUsed: Math.max(0, Math.floor(save.liveops.onboarding.freeBoostsUsed)) + 1,
      },
    },
  };
}

export function markActivationFlag(
  save: SaveData,
  flag: keyof SaveData["liveops"]["activation"]
): { save: SaveData; changed: boolean } {
  if (save.liveops.activation[flag]) return { save, changed: false };
  return {
    changed: true,
    save: {
      ...save,
      liveops: {
        ...save.liveops,
        activation: {
          ...save.liveops.activation,
          [flag]: true,
        },
      },
    },
  };
}

export function getMissionStatuses(save: SaveData, cfg: LiveopsConfig, period: MissionPeriod, dateUtc: string): MissionStatus[] {
  const defs = getActiveMissionDefs(cfg, period, dateUtc);
  const store = period === "daily" ? save.liveops.missions.daily : save.liveops.missions.weekly;
  return defs.map((def) => {
    const progress = Math.max(0, Math.floor(store.progress[def.id] ?? 0));
    const target = Math.max(1, Math.floor(def.objective.target));
    return {
      def,
      progress,
      completed: progress >= target,
      claimed: store.claimedIds.includes(def.id),
    };
  });
}

export function applyRunSummaryToLiveops(save: SaveData, cfg: LiveopsConfig, dateUtc: string, run: LiveopsRunSummary): SaveData {
  const weekKey = getWeekKey(dateUtc);
  let next = save;
  next = applyMissionProgress(next, getActiveMissionDefs(cfg, "daily", dateUtc), "daily", run, dateUtc);
  next = applyMissionProgress(next, getActiveMissionDefs(cfg, "weekly", dateUtc), "weekly", run, weekKey);
  return next;
}

export function claimMissionReward(
  save: SaveData,
  cfg: LiveopsConfig,
  period: MissionPeriod,
  dateUtc: string,
  missionId: string
): { ok: true; save: SaveData; reward: { bolts: number; cores: number } } | { ok: false; reason: string; save: SaveData } {
  const statuses = getMissionStatuses(save, cfg, period, dateUtc);
  const status = statuses.find((entry) => entry.def.id === missionId);
  if (!status) return { ok: false, reason: "missing_mission", save };
  if (!status.completed) return { ok: false, reason: "not_complete", save };
  if (status.claimed) return { ok: false, reason: "already_claimed", save };

  const store = period === "daily" ? save.liveops.missions.daily : save.liveops.missions.weekly;
  const reward = status.def.reward;
  const rewarded = grantMetaWallet(save, reward);
  return {
    ok: true,
    reward,
    save: {
      ...rewarded,
      liveops: {
        ...rewarded.liveops,
        missions: {
          ...rewarded.liveops.missions,
          [period]: {
            ...store,
            claimedIds: [...store.claimedIds, missionId],
          },
        },
        claimedEventRewardIds: appendUniqueId(rewarded.liveops.claimedEventRewardIds, `${period}:mission:${missionId}:${period === "daily" ? dateUtc : getWeekKey(dateUtc)}`),
      },
    },
  };
}

export function getStreakStatus(
  save: SaveData,
  cfg: LiveopsConfig,
  dateUtc: string
): {
  day: number;
  reward: { bolts: number; cores: number };
  canClaim: boolean;
} {
  const day = clampDay(save.liveops.streak.day, cfg.streak.maxDay);
  return {
    day,
    reward: getStreakReward(cfg, day),
    canClaim: day > 0 && save.liveops.streak.claimedDateUtc !== dateUtc,
  };
}

export function claimStreakReward(
  save: SaveData,
  cfg: LiveopsConfig,
  dateUtc: string
): { ok: true; save: SaveData; day: number; reward: { bolts: number; cores: number } } | { ok: false; reason: string; save: SaveData } {
  const status = getStreakStatus(save, cfg, dateUtc);
  if (!status.canClaim) return { ok: false, reason: "not_available", save };
  const rewarded = grantMetaWallet(save, status.reward);
  return {
    ok: true,
    day: status.day,
    reward: status.reward,
    save: {
      ...rewarded,
      liveops: {
        ...rewarded.liveops,
        streak: {
          ...rewarded.liveops.streak,
          claimedDateUtc: dateUtc,
        },
        claimedEventRewardIds: appendUniqueId(rewarded.liveops.claimedEventRewardIds, `streak:${dateUtc}`),
      },
    },
  };
}

export function getComebackStatus(save: SaveData, cfg: LiveopsConfig): {
  eligible: boolean;
  reward: { bolts: number; cores: number };
  daysAway: number;
} {
  const daysAway = Math.max(0, Math.floor(save.liveops.lastReturnGapDays));
  return {
    eligible:
      daysAway >= Math.max(1, Math.floor(cfg.comeback.idleDays)) &&
      save.liveops.lastSeenDateUtc !== null &&
      save.liveops.comeback.lastClaimDateUtc !== save.liveops.lastSeenDateUtc,
    reward: cfg.comeback.reward,
    daysAway,
  };
}

export function claimComebackReward(
  save: SaveData,
  cfg: LiveopsConfig,
  dateUtc: string
): { ok: true; save: SaveData; reward: { bolts: number; cores: number }; daysAway: number } | { ok: false; reason: string; save: SaveData } {
  const status = getComebackStatus(save, cfg);
  if (!status.eligible) return { ok: false, reason: "not_available", save };
  const rewarded = grantMetaWallet(save, status.reward);
  return {
    ok: true,
    reward: status.reward,
    daysAway: status.daysAway,
    save: {
      ...rewarded,
      liveops: {
        ...rewarded.liveops,
        comeback: {
          ...rewarded.liveops.comeback,
          lastClaimDateUtc: dateUtc,
        },
        claimedEventRewardIds: appendUniqueId(rewarded.liveops.claimedEventRewardIds, `comeback:${dateUtc}`),
      },
    },
  };
}

export function getTomorrowOfferPreview(cfg: LiveopsConfig): { title: string; desc: string; reward: { bolts: number; cores: number } } {
  return {
    title: cfg.tomorrowOffer.ui?.title ?? "Tomorrow's Yard Bonus",
    desc: cfg.tomorrowOffer.ui?.desc ?? "",
    reward: cfg.tomorrowOffer.reward,
  };
}

export function getBoardId(cfg: LeaderboardsConfig, key: "daily" | "weekly" | "all_time"): string {
  return cfg.boards.find((board) => board.key === key)?.id ?? `magnet_caravan_${key}`;
}

export function upsertWeeklyLeaderboardEntry(
  save: SaveData,
  cfg: LeaderboardsConfig,
  weekKey: string,
  entry: LeaderboardEntry
): {
  save: SaveData;
  rank: number | null;
  highestDivision: LeaderboardDivisionId;
} {
  const limit = Math.max(1, Math.floor(cfg.localEntryLimit || 10));
  const nextEntries = upsertLeaderboardEntries(save.liveops.weeklyLeaderboard.entries, entry, limit);
  const rank = getLeaderboardRank(nextEntries, entry.id);
  const highestDivision = getLeaderboardHigherDivision(
    save.liveops.weeklyLeaderboard.highestDivision,
    getLeaderboardDivision(entry.score).id
  );
  return {
    rank,
    highestDivision,
    save: {
      ...save,
      liveops: {
        ...save.liveops,
        weeklyLeaderboard: {
          ...save.liveops.weeklyLeaderboard,
          weekKey,
          entries: nextEntries,
          highestDivision,
        },
      },
    },
  };
}

function normalizeStreak(save: SaveData, cfg: LiveopsConfig, dateUtc: string, returnedAfterDays: number): SavePatchResult & { streakAdvanced: boolean } {
  const maxDay = Math.max(1, Math.floor(cfg.streak.maxDay));
  const graceDays = Math.max(0, Math.floor(cfg.streak.graceDays));
  const prevDay = Math.max(0, Math.floor(save.liveops.streak.day));
  let nextDay = prevDay;
  let changed = false;
  let streakAdvanced = false;

  if (!save.liveops.firstSeenDateUtc) {
    nextDay = 1;
    changed = true;
    streakAdvanced = true;
  } else if (returnedAfterDays > 0) {
    if (returnedAfterDays <= graceDays + 1) {
      nextDay = clampDay(prevDay <= 0 ? 1 : prevDay + 1, maxDay);
    } else {
      nextDay = 1;
    }
    changed = nextDay !== prevDay || save.liveops.streak.claimedDateUtc !== null;
    streakAdvanced = nextDay !== prevDay;
  }

  if (!changed) return { save, changed: false, streakAdvanced };
  return {
    changed: true,
    streakAdvanced,
    save: {
      ...save,
      liveops: {
        ...save.liveops,
        streak: {
          day: nextDay,
          claimedDateUtc: returnedAfterDays > 0 || !save.liveops.firstSeenDateUtc ? null : save.liveops.streak.claimedDateUtc,
        },
      },
    },
  };
}

function normalizeMissionState(save: SaveData, dateUtc: string, weekKey: string): SavePatchResult {
  let changed = false;
  let next = save;
  if (save.liveops.missions.daily.dateUtc !== dateUtc) {
    next = {
      ...next,
      liveops: {
        ...next.liveops,
        missions: {
          ...next.liveops.missions,
          daily: {
            dateUtc,
            progress: {},
            claimedIds: [],
          },
        },
      },
    };
    changed = true;
  }
  if (next.liveops.missions.weekly.weekKey !== weekKey) {
    next = {
      ...next,
      liveops: {
        ...next.liveops,
        missions: {
          ...next.liveops.missions,
          weekly: {
            weekKey,
            progress: {},
            claimedIds: [],
          },
        },
      },
    };
    changed = true;
  }
  return { save: changed ? next : save, changed };
}

function normalizeWeeklyBoard(
  save: SaveData,
  cfg: LeaderboardsConfig,
  weekKey: string
): SavePatchResult & { rewardGranted: { division: LeaderboardDivisionId; reward: { bolts: number; cores: number } } | null } {
  const current = save.liveops.weeklyLeaderboard;
  if (current.weekKey === weekKey) return { save, changed: false, rewardGranted: null };

  let next = save;
  let rewardGranted: { division: LeaderboardDivisionId; reward: { bolts: number; cores: number } } | null = null;
  if (current.weekKey && current.entries.length > 0 && !current.claimedRewardWeekKeys.includes(current.weekKey)) {
    const reward = getBoardDivisionReward(cfg, "weekly", current.highestDivision);
    if (reward.bolts > 0 || reward.cores > 0) {
      next = grantMetaWallet(next, reward);
      rewardGranted = { division: current.highestDivision, reward };
    }
    next = {
      ...next,
      liveops: {
        ...next.liveops,
        weeklyLeaderboard: {
          ...next.liveops.weeklyLeaderboard,
          claimedRewardWeekKeys: appendUniqueId(next.liveops.weeklyLeaderboard.claimedRewardWeekKeys, current.weekKey),
        },
      },
    };
  }

  next = {
    ...next,
    liveops: {
      ...next.liveops,
      weeklyLeaderboard: {
        weekKey,
        entries: [],
        highestDivision: "scrapper",
        claimedRewardDivisions: [],
        claimedRewardWeekKeys: next.liveops.weeklyLeaderboard.claimedRewardWeekKeys,
      },
    },
  };
  return { save: next, changed: true, rewardGranted };
}

function applyMissionProgress(
  save: SaveData,
  defs: LiveopsMissionDef[],
  period: MissionPeriod,
  run: LiveopsRunSummary,
  periodKey: string
): SaveData {
  if (defs.length <= 0) return save;
  const store = period === "daily" ? save.liveops.missions.daily : save.liveops.missions.weekly;
  let progress = store.progress;
  let changed = false;

  for (const def of defs) {
    const current = Math.max(0, Math.floor(progress[def.id] ?? 0));
    const nextValue = computeMissionProgress(def.objective.type, current, run);
    if (nextValue === current) continue;
    if (!changed) progress = { ...progress };
    progress[def.id] = nextValue;
    changed = true;
  }

  if (!changed) return save;

  return {
    ...save,
    liveops: {
      ...save.liveops,
      missions: {
        ...save.liveops.missions,
        [period]: {
          ...store,
          [period === "daily" ? "dateUtc" : "weekKey"]: periodKey,
          progress,
        },
      },
    },
  };
}

function getActiveMissionDefs(cfg: LiveopsConfig, period: MissionPeriod, dateUtc: string): LiveopsMissionDef[] {
  const poolCfg = cfg.missions[period];
  const seed = period === "daily" ? `mission:daily:${dateUtc}` : `mission:weekly:${getWeekKey(dateUtc)}`;
  return pickMissionDefs(poolCfg.pool, Math.max(1, Math.floor(poolCfg.slots)), seed);
}

function pickMissionDefs(pool: readonly LiveopsMissionDef[], slots: number, seed: string): LiveopsMissionDef[] {
  const rng = createRng(seed);
  const available = pool.slice();
  const picked: LiveopsMissionDef[] = [];
  while (available.length > 0 && picked.length < slots) {
    const candidate = rng.weightedPick(available.map((def) => ({ item: def, weight: Math.max(0, def.weight) })));
    picked.push(candidate);
    const index = available.findIndex((entry) => entry.id === candidate.id);
    if (index >= 0) available.splice(index, 1);
  }
  return picked;
}

function computeMissionProgress(type: MissionObjectiveType, current: number, run: LiveopsRunSummary): number {
  switch (type) {
    case "reach_wave":
      return Math.max(current, Math.max(0, Math.floor(run.wave)));
    case "bank_bolts":
      return current + Math.max(0, Math.floor(run.bankedBolts));
    case "collect_heavy_scrap":
      return current + Math.max(0, Math.floor(run.heavyScrapCollected));
    case "deflect_projectiles":
      return current + Math.max(0, Math.floor(run.projectilesDeflected));
    case "complete_runs":
      return current + (run.mode === "tutorial" ? 0 : 1);
    case "use_flip":
      return current + Math.max(0, Math.floor(run.flipsUsed));
    case "score_points":
      return Math.max(current, Math.max(0, Math.floor(run.score)));
    case "gain_bolts":
      return current + Math.max(0, Math.floor(run.totalBolts));
    default:
      return current;
  }
}

function getStreakReward(cfg: LiveopsConfig, day: number): { bolts: number; cores: number } {
  const safeDay = clampDay(day, cfg.streak.maxDay);
  const reward = cfg.streak.rewards.find((entry) => Math.floor(entry.day) === safeDay) ?? cfg.streak.rewards[cfg.streak.rewards.length - 1];
  return reward ? { bolts: Math.max(0, reward.bolts), cores: Math.max(0, reward.cores) } : { bolts: 0, cores: 0 };
}

function getBoardDivisionReward(cfg: LeaderboardsConfig, key: "daily" | "weekly" | "all_time", division: LeaderboardDivisionId): { bolts: number; cores: number } {
  const reward = cfg.boards.find((board) => board.key === key)?.rewardByDivision?.[division];
  return reward ? { bolts: Math.max(0, reward.bolts), cores: Math.max(0, reward.cores) } : { bolts: 0, cores: 0 };
}

function clampDay(day: number, maxDay: number): number {
  return Math.max(0, Math.min(Math.max(1, Math.floor(maxDay || 1)), Math.floor(day || 0)));
}

function appendUniqueId(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.slice() : [...values, value];
}

function diffUtcDays(fromDateUtc: string, toDateUtc: string): number {
  const from = parseUtcDate(fromDateUtc);
  const to = parseUtcDate(toDateUtc);
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function parseUtcDate(value: string): Date {
  const normalized = typeof value === "string" && value.length >= 8 ? value.slice(0, 8) : "19700101";
  const year = Number.parseInt(normalized.slice(0, 4), 10);
  const month = Number.parseInt(normalized.slice(4, 6), 10) - 1;
  const day = Number.parseInt(normalized.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
