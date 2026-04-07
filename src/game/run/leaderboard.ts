import {
  sanitizePilotName,
  type LeaderboardCareerMilestoneId,
  type LeaderboardDivisionId,
  type LeaderboardEntry,
} from "../../platform/save/saveManager";
import type { RunState } from "./runState";

export const LEADERBOARD_MAX_ENTRIES = 10;
export type LeaderboardFilter = "all" | "run" | "daily";

const CALLSIGN_PREFIXES = ["ARC", "BOLT", "CORE", "FLUX", "ION", "RIG", "RUST", "TAIL"] as const;
const LEADERBOARD_DIVISION_ORDER: LeaderboardDivisionId[] = ["scrapper", "raider", "ace", "elite", "legend"];
const LEADERBOARD_DIVISIONS: Array<{ id: LeaderboardDivisionId; minScore: number }> = [
  { id: "scrapper", minScore: 0 },
  { id: "raider", minScore: 18_000 },
  { id: "ace", minScore: 35_000 },
  { id: "elite", minScore: 60_000 },
  { id: "legend", minScore: 90_000 },
];
const LEADERBOARD_DIVISION_REWARDS: Record<LeaderboardDivisionId, { bolts: number; cores: number }> = {
  scrapper: { bolts: 0, cores: 0 },
  raider: { bolts: 90, cores: 0 },
  ace: { bolts: 160, cores: 1 },
  elite: { bolts: 260, cores: 2 },
  legend: { bolts: 400, cores: 3 },
};
const LEADERBOARD_CAREER_MILESTONES: Array<{
  id: LeaderboardCareerMilestoneId;
  score?: number;
  wave?: number;
  bolts?: number;
  division?: LeaderboardDivisionId;
  reward: { bolts: number; cores: number };
}> = [
  { id: "score_25000", score: 25_000, reward: { bolts: 120, cores: 0 } },
  { id: "wave_20", wave: 20, reward: { bolts: 0, cores: 1 } },
  { id: "salvage_400", bolts: 400, reward: { bolts: 180, cores: 1 } },
  { id: "legend_league", division: "legend", reward: { bolts: 0, cores: 4 } },
];

type LeaderboardRunState = Pick<
  RunState,
  "startedAtMs" | "mode" | "waveIndex" | "bolts" | "cores" | "tailMaxLen" | "endless" | "daily"
>;

export function createLeaderboardEntryId(state: Pick<RunState, "startedAtMs" | "mode">): string {
  return `${state.mode}:${Math.max(0, Math.floor(state.startedAtMs))}`;
}

export function computeRunScore(state: Pick<RunState, "waveIndex" | "bolts" | "cores" | "tailMaxLen">): number {
  const waveScore = Math.max(0, Math.floor(state.waveIndex)) * 1000;
  const boltsScore = Math.max(0, Math.floor(state.bolts)) * 12;
  const coresScore = Math.max(0, Math.floor(state.cores)) * 250;
  const tailScore = Math.max(0, Math.floor(state.tailMaxLen)) * 5;
  return waveScore + boltsScore + coresScore + tailScore;
}

export function buildLeaderboardEntry(
  state: LeaderboardRunState,
  id = createLeaderboardEntryId(state),
  preferredPilotName?: string | null
): LeaderboardEntry {
  const pilotName = sanitizePilotName(preferredPilotName);
  return {
    id,
    pilot: pilotName || createCallsign(state),
    mode: state.mode,
    score: computeRunScore(state),
    level: Math.max(1, Math.floor(state.endless.current.index)),
    wave: Math.max(1, Math.floor(state.waveIndex)),
    bolts: Math.max(0, Math.floor(state.bolts)),
    cores: Math.max(0, Math.floor(state.cores)),
    tailMaxLen: Math.max(0, Math.floor(state.tailMaxLen)),
    createdAtMs: Math.max(0, Math.floor(state.startedAtMs)),
    dailyDateUtc: state.mode === "daily" ? state.daily?.dateUtc ?? null : null,
  };
}

export function upsertLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
  entry: LeaderboardEntry,
  limit = LEADERBOARD_MAX_ENTRIES
): LeaderboardEntry[] {
  const next = entries.slice();
  const existingIndex = next.findIndex((candidate) => candidate.id === entry.id);
  if (existingIndex >= 0) next.splice(existingIndex, 1, entry);
  else next.push(entry);

  next.sort(compareLeaderboardEntries);
  return next.slice(0, Math.max(1, Math.floor(limit)));
}

export function getLeaderboardRank(entries: readonly LeaderboardEntry[], entryId: string): number | null {
  const index = entries.findIndex((entry) => entry.id === entryId);
  return index >= 0 ? index + 1 : null;
}

export function filterLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
  filter: LeaderboardFilter
): LeaderboardEntry[] {
  if (filter === "all") return entries.slice();
  return entries.filter((entry) => entry.mode === filter);
}

export function getLeaderboardDivision(score: number): { id: LeaderboardDivisionId; minScore: number } {
  const safeScore = Math.max(0, Math.floor(score));
  for (let index = LEADERBOARD_DIVISIONS.length - 1; index >= 0; index -= 1) {
    const division = LEADERBOARD_DIVISIONS[index];
    if (division && safeScore >= division.minScore) return division;
  }
  return LEADERBOARD_DIVISIONS[0]!;
}

export function getLeaderboardBestScore(entries: readonly LeaderboardEntry[], entryId?: string | null): number | null {
  const best = entries
    .filter((candidate) => candidate.id !== entryId)
    .reduce((maxScore, candidate) => Math.max(maxScore, candidate.score), -1);
  return best >= 0 ? best : null;
}

export function getLeaderboardDivisionReward(divisionId: LeaderboardDivisionId): { bolts: number; cores: number } {
  return LEADERBOARD_DIVISION_REWARDS[divisionId] ?? LEADERBOARD_DIVISION_REWARDS.scrapper;
}

export function getLeaderboardNextDivision(score: number): { id: LeaderboardDivisionId; minScore: number } | null {
  const currentDivision = getLeaderboardDivision(score);
  const currentIndex = LEADERBOARD_DIVISION_ORDER.indexOf(currentDivision.id);
  const nextDivisionId = currentIndex >= 0 ? LEADERBOARD_DIVISION_ORDER[currentIndex + 1] : null;
  return nextDivisionId ? LEADERBOARD_DIVISIONS.find((division) => division.id === nextDivisionId) ?? null : null;
}

export function getLeaderboardPromotionRewards(
  highestDivision: LeaderboardDivisionId,
  score: number,
  claimedRewardDivisions: readonly LeaderboardDivisionId[] = []
): { divisions: LeaderboardDivisionId[]; reward: { bolts: number; cores: number } } {
  const currentDivision = getLeaderboardDivision(score).id;
  const highestIndex = LEADERBOARD_DIVISION_ORDER.indexOf(highestDivision);
  const currentIndex = LEADERBOARD_DIVISION_ORDER.indexOf(currentDivision);
  const claimed = new Set(claimedRewardDivisions);
  const divisions = LEADERBOARD_DIVISION_ORDER.slice(Math.max(1, highestIndex + 1), currentIndex + 1)
    .filter((division) => !claimed.has(division));

  return {
    divisions,
    reward: divisions.reduce(
      (total, divisionId) => {
        const reward = getLeaderboardDivisionReward(divisionId);
        return {
          bolts: total.bolts + reward.bolts,
          cores: total.cores + reward.cores,
        };
      },
      { bolts: 0, cores: 0 }
    ),
  };
}

export function getLeaderboardHigherDivision(a: LeaderboardDivisionId, b: LeaderboardDivisionId): LeaderboardDivisionId {
  return LEADERBOARD_DIVISION_ORDER.indexOf(a) >= LEADERBOARD_DIVISION_ORDER.indexOf(b) ? a : b;
}

export function getLeaderboardCareerMilestones(): readonly (typeof LEADERBOARD_CAREER_MILESTONES)[number][] {
  return LEADERBOARD_CAREER_MILESTONES;
}

export function getLeaderboardCareerProgress(progress: {
  bestScore: number;
  bestWave: number;
  bestBolts: number;
  highestDivision: LeaderboardDivisionId;
}): {
  bestScore: number;
  bestWave: number;
  bestBolts: number;
  highestDivision: LeaderboardDivisionId;
} {
  return {
    bestScore: Math.max(0, Math.floor(progress.bestScore)),
    bestWave: Math.max(0, Math.floor(progress.bestWave)),
    bestBolts: Math.max(0, Math.floor(progress.bestBolts)),
    highestDivision: progress.highestDivision,
  };
}

export function getUnlockedLeaderboardCareerMilestones(progress: {
  bestScore: number;
  bestWave: number;
  bestBolts: number;
  highestDivision: LeaderboardDivisionId;
}): LeaderboardCareerMilestoneId[] {
  const safe = getLeaderboardCareerProgress(progress);
  return LEADERBOARD_CAREER_MILESTONES.filter((milestone) => isCareerMilestoneUnlocked(safe, milestone)).map((milestone) => milestone.id);
}

export function getLeaderboardCareerMilestoneUnlocks(
  progress: {
    bestScore: number;
    bestWave: number;
    bestBolts: number;
    highestDivision: LeaderboardDivisionId;
  },
  claimedMilestones: readonly LeaderboardCareerMilestoneId[] = []
): { ids: LeaderboardCareerMilestoneId[]; reward: { bolts: number; cores: number } } {
  const safe = getLeaderboardCareerProgress(progress);
  const claimed = new Set(claimedMilestones);
  const ids = LEADERBOARD_CAREER_MILESTONES.filter(
    (milestone) => !claimed.has(milestone.id) && isCareerMilestoneUnlocked(safe, milestone)
  ).map((milestone) => milestone.id);

  return {
    ids,
    reward: ids.reduce(
      (total, id) => {
        const milestone = LEADERBOARD_CAREER_MILESTONES.find((entry) => entry.id === id);
        return {
          bolts: total.bolts + (milestone?.reward.bolts ?? 0),
          cores: total.cores + (milestone?.reward.cores ?? 0),
        };
      },
      { bolts: 0, cores: 0 }
    ),
  };
}

export function getNextLeaderboardCareerMilestone(
  progress: {
    bestScore: number;
    bestWave: number;
    bestBolts: number;
    highestDivision: LeaderboardDivisionId;
  },
  claimedMilestones: readonly LeaderboardCareerMilestoneId[] = []
): (typeof LEADERBOARD_CAREER_MILESTONES)[number] | null {
  const safe = getLeaderboardCareerProgress(progress);
  const claimed = new Set(claimedMilestones);
  return LEADERBOARD_CAREER_MILESTONES.find((milestone) => !claimed.has(milestone.id) && !isCareerMilestoneUnlocked(safe, milestone)) ?? null;
}

function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.wave !== a.wave) return b.wave - a.wave;
  if (b.bolts !== a.bolts) return b.bolts - a.bolts;
  if (b.cores !== a.cores) return b.cores - a.cores;
  return b.createdAtMs - a.createdAtMs;
}

function createCallsign(state: LeaderboardRunState): string {
  const seed =
    Math.max(0, Math.floor(state.startedAtMs)) +
    Math.max(0, Math.floor(state.waveIndex)) * 31 +
    Math.max(0, Math.floor(state.bolts)) * 7 +
    Math.max(0, Math.floor(state.cores)) * 13 +
    Math.max(0, Math.floor(state.tailMaxLen)) * 17;
  const prefix = CALLSIGN_PREFIXES[Math.abs(seed) % CALLSIGN_PREFIXES.length] ?? "RIG";
  const suffix = 100 + (Math.abs(seed) % 900);
  return `${prefix}-${suffix}`;
}

function isCareerMilestoneUnlocked(
  progress: {
    bestScore: number;
    bestWave: number;
    bestBolts: number;
    highestDivision: LeaderboardDivisionId;
  },
  milestone: (typeof LEADERBOARD_CAREER_MILESTONES)[number]
): boolean {
  if (typeof milestone.score === "number" && progress.bestScore < milestone.score) return false;
  if (typeof milestone.wave === "number" && progress.bestWave < milestone.wave) return false;
  if (typeof milestone.bolts === "number" && progress.bestBolts < milestone.bolts) return false;
  if (milestone.division && progress.highestDivision !== milestone.division) return false;
  return true;
}
