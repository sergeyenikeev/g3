import { grantMetaWallet } from "../meta/metaProgression";
import type { SaveData } from "../../platform/save/saveManager";

export const LOGIN_REWARD_DAY_COUNT = 5 as const;

export type LoginReward = {
  bolts: number;
  cores: number;
};

export type LoginRewardStatus = {
  claimedToday: boolean;
  lastClaimDay: number | null;
  lastClaimReward: LoginReward | null;
  nextDay: number;
  nextReward: LoginReward;
};

export type LoginRewardClaimResult = {
  claimed: boolean;
  save: SaveData;
  day: number | null;
  reward: LoginReward | null;
  status: LoginRewardStatus;
};

const LOGIN_REWARD_SCHEDULE: readonly LoginReward[] = [
  { bolts: 30, cores: 0 },
  { bolts: 60, cores: 0 },
  { bolts: 90, cores: 0 },
  { bolts: 120, cores: 0 },
  { bolts: 150, cores: 0 },
];

export function claimLoginReward(save: SaveData, dateUtc: string): LoginRewardClaimResult {
  const statusBefore = getLoginRewardStatus(save, dateUtc);
  const lastClaimDateUtc = save.loginRewards.lastClaimDateUtc;
  if (typeof lastClaimDateUtc === "string" && lastClaimDateUtc >= dateUtc) {
    return {
      claimed: false,
      save,
      day: null,
      reward: null,
      status: statusBefore,
    };
  }

  const day = getNextLoginRewardDay(save.loginRewards.day);
  const reward = getLoginRewardForDay(day);
  const rewardedSave = grantMetaWallet(save, reward);
  const nextSave: SaveData = {
    ...rewardedSave,
    loginRewards: {
      lastClaimDateUtc: dateUtc,
      day,
    },
  };

  return {
    claimed: true,
    save: nextSave,
    day,
    reward,
    status: getLoginRewardStatus(nextSave, dateUtc),
  };
}

export function getLoginRewardStatus(save: SaveData, dateUtc: string): LoginRewardStatus {
  const lastClaimDay = sanitizeLoginRewardDay(save.loginRewards.day);
  const nextDay = getNextLoginRewardDay(lastClaimDay);

  return {
    claimedToday: save.loginRewards.lastClaimDateUtc === dateUtc,
    lastClaimDay: lastClaimDay > 0 ? lastClaimDay : null,
    lastClaimReward: lastClaimDay > 0 ? getLoginRewardForDay(lastClaimDay) : null,
    nextDay,
    nextReward: getLoginRewardForDay(nextDay),
  };
}

export function getLoginRewardForDay(day: number): LoginReward {
  const safeDay = sanitizeLoginRewardDay(day) || 1;
  const reward = LOGIN_REWARD_SCHEDULE[safeDay - 1] ?? LOGIN_REWARD_SCHEDULE[0]!;
  return { bolts: reward.bolts, cores: reward.cores };
}

export function getNextLoginRewardDay(day: number): number {
  const safeDay = sanitizeLoginRewardDay(day);
  if (safeDay <= 0) return 1;
  return safeDay >= LOGIN_REWARD_DAY_COUNT ? 1 : safeDay + 1;
}

function sanitizeLoginRewardDay(day: number): number {
  const value = Number.isFinite(day) ? Math.floor(day) : 0;
  return Math.max(0, Math.min(LOGIN_REWARD_DAY_COUNT, value));
}
