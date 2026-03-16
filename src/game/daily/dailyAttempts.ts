import type { DailyConfig } from "../../data/types";
import type { SaveData } from "../../platform/save/saveManager";

export type DailyAttemptsInfo = {
  dateUtc: string;
  attemptsUsed: number;
  maxAttempts: number;
  canStartFree: boolean;
  canStartRewarded: boolean;
  attemptsLeft: number;
};

export type DailyStartPlan =
  | {
      canStart: true;
      kind: "free" | "rewarded" | "boosted_free" | "boosted_rewarded";
      needsAttemptRewarded: boolean;
      needsBoosterRewarded: boolean;
      attemptWasRewarded: boolean;
    }
  | {
      canStart: false;
      kind: "unavailable";
      reason: "no_attempts_left" | "booster_disabled";
      needsAttemptRewarded: false;
      needsBoosterRewarded: false;
      attemptWasRewarded: false;
    };

export function normalizeDailySave(save: SaveData, dateUtc: string): SaveData {
  const last = save.daily.lastDateUtc;
  if (last === dateUtc) return save;

  return {
    ...save,
    daily: {
      ...save.daily,
      lastDateUtc: dateUtc,
      attemptsUsed: 0,
      bestWave: 0,
      bestBolts: 0,
    },
  };
}

export function getDailyAttemptsInfo(cfg: DailyConfig, save: SaveData, dateUtc: string): DailyAttemptsInfo {
  const normalized = normalizeDailySave(save, dateUtc);
  const extraMax = Math.max(0, Math.floor(cfg.dailyRewards.extraAttemptRewardedMax));
  const maxAttempts = 1 + extraMax;
  const attemptsUsed = clampInt(normalized.daily.attemptsUsed, 0, 999);
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);

  const canStartFree = attemptsUsed < 1;
  const canStartRewarded = attemptsUsed >= 1 && attemptsUsed < maxAttempts;

  return {
    dateUtc,
    attemptsUsed,
    maxAttempts,
    canStartFree,
    canStartRewarded,
    attemptsLeft,
  };
}

export function consumeDailyAttempt(save: SaveData, dateUtc: string): SaveData {
  const normalized = normalizeDailySave(save, dateUtc);
  return {
    ...normalized,
    daily: {
      ...normalized.daily,
      attemptsUsed: clampInt(normalized.daily.attemptsUsed + 1, 0, 999),
    },
  };
}

export function planDailyStart(
  info: DailyAttemptsInfo,
  options: { boosted: boolean; boosterEnabled: boolean }
): DailyStartPlan {
  if (options.boosted) {
    if (!options.boosterEnabled) {
      return {
        canStart: false,
        kind: "unavailable",
        reason: "booster_disabled",
        needsAttemptRewarded: false,
        needsBoosterRewarded: false,
        attemptWasRewarded: false,
      };
    }

    if (info.canStartFree) {
      return {
        canStart: true,
        kind: "boosted_free",
        needsAttemptRewarded: false,
        needsBoosterRewarded: true,
        attemptWasRewarded: false,
      };
    }

    if (info.canStartRewarded) {
      return {
        canStart: true,
        kind: "boosted_rewarded",
        needsAttemptRewarded: false,
        needsBoosterRewarded: true,
        attemptWasRewarded: true,
      };
    }
  } else {
    if (info.canStartFree) {
      return {
        canStart: true,
        kind: "free",
        needsAttemptRewarded: false,
        needsBoosterRewarded: false,
        attemptWasRewarded: false,
      };
    }

    if (info.canStartRewarded) {
      return {
        canStart: true,
        kind: "rewarded",
        needsAttemptRewarded: true,
        needsBoosterRewarded: false,
        attemptWasRewarded: true,
      };
    }
  }

  return {
    canStart: false,
    kind: "unavailable",
    reason: "no_attempts_left",
    needsAttemptRewarded: false,
    needsBoosterRewarded: false,
    attemptWasRewarded: false,
  };
}

function clampInt(v: number, min: number, max: number): number {
  const n = Number.isFinite(v) ? Math.floor(v) : min;
  return Math.max(min, Math.min(max, n));
}
