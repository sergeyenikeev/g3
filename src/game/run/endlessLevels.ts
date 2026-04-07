import type { Rng } from "../../core/prng";
import type { EnemyType, PatternSpawn } from "../../data/types";

export const WAVES_PER_LEVEL = 4;
const CORE_REWARD_INTERVAL = 3;

export type EndlessLevelModifierId =
  | "salvage_surge"
  | "crossfire_protocol"
  | "razor_parade"
  | "iron_convoy"
  | "ion_storm"
  | "breaker_surge"
  | "reclaimer_uplink";

export type EndlessLevelObjectiveId =
  | "bank_bolts"
  | "deflect_projectiles"
  | "tail_segments"
  | "heavy_scrap"
  | "hull_integrity";

export type EndlessLevelFinaleId =
  | "crossfire_overseer"
  | "blade_dancer"
  | "scrap_juggernaut"
  | "salvage_storm"
  | "ion_tempest"
  | "breaker_ring"
  | "core_monsoon";

type EndlessLevelScrapType = "common" | "heavy" | "rareShard";

type EndlessLevelFinaleBurst = {
  t: number;
  clusters: number;
  scrapType?: EndlessLevelScrapType;
};

type EndlessLevelFinaleProjectileBurst = {
  t: number;
  count: number;
  formation?: PatternSpawn["formation"];
  speedMult?: number;
  damageMult?: number;
  lifetimeSec?: number;
  spreadDeg?: number;
};

export type EndlessLevelObjectiveProgress = {
  id: EndlessLevelObjectiveId;
  mode: "cumulative" | "current";
  target: number;
  progress: number;
  rewardBolts: number;
  rewardCores: number;
};

export type EndlessLevelModifier = {
  id: EndlessLevelModifierId;
  titleKey: string;
  descKey: string;
  objectiveId: EndlessLevelObjectiveId;
  minLevel: number;
  weight: number;
  rewardBoltsBonus: number;
  extraScrapClusters?: number;
  durationBonusSec?: number;
  enemyHpMult?: number;
  enemySpeedMult?: number;
  projectileSpeedMult?: number;
  bankTimeMult?: number;
  bankBoltsMult?: number;
  bankHealMult?: number;
  playerSpeedMult?: number;
  flipCooldownMult?: number;
  dashCooldownMult?: number;
  rareCoreChanceBonus?: number;
  shooterCapBonus?: number;
  cutterCapBonus?: number;
  heavyBoltBonus?: number;
  promoteChaserTo?: EnemyType;
  promoteChance?: number;
};

export type EndlessLevelSnapshot = {
  index: number;
  modifierId: EndlessLevelModifierId;
  objective: EndlessLevelObjectiveProgress;
  finaleId: EndlessLevelFinaleId | null;
};

export type EndlessLevelClearSummary = {
  levelIndex: number;
  modifierId: EndlessLevelModifierId;
  rewardBolts: number;
  rewardCores: number;
  objectiveId: EndlessLevelObjectiveId;
  objectiveProgress: number;
  objectiveTarget: number;
  objectiveCompleted: boolean;
  objectiveRewardBolts: number;
  objectiveRewardCores: number;
  finaleId: EndlessLevelFinaleId | null;
  finaleRewardBolts: number;
  finaleRewardCores: number;
};

export type EndlessLevelProgress = {
  wavesPerLevel: number;
  current: EndlessLevelSnapshot;
  pending: EndlessLevelSnapshot | null;
  lastCleared: EndlessLevelClearSummary | null;
};

export type EndlessLevelFinale = {
  id: EndlessLevelFinaleId;
  kind: "miniBoss" | "sectorEvent";
  minLevel: number;
  rewardBoltsBonus: number;
  rewardCoresBonus: number;
  durationSec: number;
  patternId: string;
  spawns: PatternSpawn[];
  capsOverride?: { maxCutters?: number; maxShooters?: number; maxTotal?: number };
  extraScrapClusters?: number;
  enemyHpMult?: number;
  enemySpeedMult?: number;
  projectileSpeedMult?: number;
  scrapBursts?: EndlessLevelFinaleBurst[];
  projectileBursts?: EndlessLevelFinaleProjectileBurst[];
};

export const ENDLESS_LEVEL_MODIFIERS: readonly EndlessLevelModifier[] = [
  {
    id: "salvage_surge",
    titleKey: "level.salvage_surge.title",
    descKey: "level.salvage_surge.desc",
    objectiveId: "bank_bolts",
    minLevel: 1,
    weight: 3.2,
    rewardBoltsBonus: 3,
    extraScrapClusters: 2,
    bankBoltsMult: 1.15,
    enemySpeedMult: 1.08,
    rareCoreChanceBonus: 0.06,
  },
  {
    id: "crossfire_protocol",
    titleKey: "level.crossfire_protocol.title",
    descKey: "level.crossfire_protocol.desc",
    objectiveId: "deflect_projectiles",
    minLevel: 2,
    weight: 2.5,
    rewardBoltsBonus: 4,
    durationBonusSec: 1,
    projectileSpeedMult: 1.18,
    flipCooldownMult: 0.9,
    shooterCapBonus: 1,
    promoteChaserTo: "shooter",
    promoteChance: 0.28,
  },
  {
    id: "razor_parade",
    titleKey: "level.razor_parade.title",
    descKey: "level.razor_parade.desc",
    objectiveId: "tail_segments",
    minLevel: 3,
    weight: 2.1,
    rewardBoltsBonus: 5,
    enemySpeedMult: 1.12,
    bankTimeMult: 0.84,
    playerSpeedMult: 1.05,
    cutterCapBonus: 1,
    promoteChaserTo: "cutter",
    promoteChance: 0.18,
  },
  {
    id: "iron_convoy",
    titleKey: "level.iron_convoy.title",
    descKey: "level.iron_convoy.desc",
    objectiveId: "heavy_scrap",
    minLevel: 2,
    weight: 2.2,
    rewardBoltsBonus: 4,
    extraScrapClusters: 1,
    durationBonusSec: 2,
    enemyHpMult: 1.22,
    bankHealMult: 1.35,
    heavyBoltBonus: 1,
  },
  {
    id: "ion_storm",
    titleKey: "level.ion_storm.title",
    descKey: "level.ion_storm.desc",
    objectiveId: "hull_integrity",
    minLevel: 4,
    weight: 1.8,
    rewardBoltsBonus: 6,
    durationBonusSec: 2,
    enemyHpMult: 1.08,
    enemySpeedMult: 1.16,
    projectileSpeedMult: 1.12,
    dashCooldownMult: 0.9,
    rareCoreChanceBonus: 0.1,
  },
  {
    id: "breaker_surge",
    titleKey: "level.breaker_surge.title",
    descKey: "level.breaker_surge.desc",
    objectiveId: "tail_segments",
    minLevel: 5,
    weight: 1.7,
    rewardBoltsBonus: 7,
    extraScrapClusters: 1,
    enemySpeedMult: 1.18,
    bankTimeMult: 0.82,
    playerSpeedMult: 1.06,
    cutterCapBonus: 2,
    promoteChaserTo: "cutter",
    promoteChance: 0.24,
    heavyBoltBonus: 1,
  },
  {
    id: "reclaimer_uplink",
    titleKey: "level.reclaimer_uplink.title",
    descKey: "level.reclaimer_uplink.desc",
    objectiveId: "hull_integrity",
    minLevel: 6,
    weight: 1.6,
    rewardBoltsBonus: 7,
    extraScrapClusters: 2,
    enemyHpMult: 1.1,
    projectileSpeedMult: 1.08,
    bankBoltsMult: 1.12,
    bankHealMult: 1.2,
    dashCooldownMult: 0.84,
    rareCoreChanceBonus: 0.12,
    shooterCapBonus: 1,
  },
] as const;

export const ENDLESS_LEVEL_FINALES: readonly EndlessLevelFinale[] = [
  {
    id: "crossfire_overseer",
    kind: "miniBoss",
    minLevel: 2,
    rewardBoltsBonus: 10,
    rewardCoresBonus: 0,
    durationSec: 16,
    patternId: "crossfire_overseer",
    spawns: [
      { t: 0.3, type: "shooter", count: 2, formation: "corners" },
      { t: 2.1, type: "chaser", count: 3, formation: "arc", arcDeg: 120 },
      { t: 5.2, type: "shooter", count: 2, formation: "opposite" },
      { t: 7.8, type: "chaser", count: 4, formation: "random_ring" },
      { t: 10.4, type: "shooter", count: 2, formation: "corners" },
      { t: 12.8, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 14.1, type: "shooter", count: 1, formation: "opposite" },
    ],
    capsOverride: { maxShooters: 4, maxCutters: 2, maxTotal: 10 },
    projectileSpeedMult: 1.16,
    enemySpeedMult: 1.08,
  },
  {
    id: "blade_dancer",
    kind: "miniBoss",
    minLevel: 4,
    rewardBoltsBonus: 12,
    rewardCoresBonus: 1,
    durationSec: 15,
    patternId: "blade_dancer",
    spawns: [
      { t: 0.5, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 1.8, type: "chaser", count: 4, formation: "arc", arcDeg: 140 },
      { t: 4.8, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 7.4, type: "chaser", count: 5, formation: "random_ring" },
      { t: 10.1, type: "cutter", count: 2, formation: "behind_tail_bias" },
      { t: 12.5, type: "shooter", count: 1, formation: "opposite" },
    ],
    capsOverride: { maxShooters: 2, maxCutters: 3, maxTotal: 10 },
    enemySpeedMult: 1.2,
  },
  {
    id: "scrap_juggernaut",
    kind: "miniBoss",
    minLevel: 2,
    rewardBoltsBonus: 14,
    rewardCoresBonus: 1,
    durationSec: 16,
    patternId: "scrap_juggernaut",
    spawns: [
      { t: 0.4, type: "chaser", count: 4, formation: "arc", arcDeg: 90 },
      { t: 3.8, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 6.4, type: "chaser", count: 4, formation: "opposite" },
      { t: 9.6, type: "shooter", count: 1, formation: "corners" },
      { t: 11.7, type: "chaser", count: 5, formation: "random_ring" },
      { t: 13.9, type: "cutter", count: 1, formation: "behind_tail_bias" },
    ],
    capsOverride: { maxShooters: 2, maxCutters: 2, maxTotal: 11 },
    extraScrapClusters: 1,
    enemyHpMult: 1.18,
    scrapBursts: [
      { t: 4.5, clusters: 1, scrapType: "heavy" },
      { t: 8.5, clusters: 1, scrapType: "heavy" },
      { t: 12.5, clusters: 1, scrapType: "heavy" },
    ],
  },
  {
    id: "salvage_storm",
    kind: "sectorEvent",
    minLevel: 3,
    rewardBoltsBonus: 16,
    rewardCoresBonus: 0,
    durationSec: 15,
    patternId: "salvage_storm",
    spawns: [
      { t: 1.2, type: "chaser", count: 3, formation: "random_ring" },
      { t: 4.2, type: "shooter", count: 1, formation: "corners" },
      { t: 6.8, type: "chaser", count: 4, formation: "arc", arcDeg: 160 },
      { t: 10.1, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 12.6, type: "chaser", count: 4, formation: "random_ring" },
    ],
    capsOverride: { maxShooters: 2, maxCutters: 2, maxTotal: 10 },
    extraScrapClusters: 2,
    scrapBursts: [
      { t: 2.2, clusters: 1, scrapType: "common" },
      { t: 5.7, clusters: 1, scrapType: "heavy" },
      { t: 9.2, clusters: 1, scrapType: "common" },
      { t: 12.2, clusters: 1, scrapType: "heavy" },
    ],
  },
  {
    id: "ion_tempest",
    kind: "sectorEvent",
    minLevel: 5,
    rewardBoltsBonus: 12,
    rewardCoresBonus: 1,
    durationSec: 16,
    patternId: "ion_tempest",
    spawns: [
      { t: 0.8, type: "shooter", count: 2, formation: "corners" },
      { t: 4.8, type: "chaser", count: 3, formation: "random_ring" },
      { t: 8.6, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 11.8, type: "shooter", count: 2, formation: "opposite" },
    ],
    capsOverride: { maxShooters: 4, maxCutters: 2, maxTotal: 10 },
    projectileSpeedMult: 1.12,
    scrapBursts: [
      { t: 5.1, clusters: 1, scrapType: "rareShard" },
      { t: 10.3, clusters: 1, scrapType: "rareShard" },
    ],
    projectileBursts: [
      { t: 2.7, count: 4, formation: "corners", speedMult: 1.05, damageMult: 1, spreadDeg: 12 },
      { t: 6.3, count: 4, formation: "opposite", speedMult: 1.1, damageMult: 1, spreadDeg: 14 },
      { t: 9.8, count: 5, formation: "corners", speedMult: 1.12, damageMult: 1, spreadDeg: 16 },
      { t: 13.2, count: 5, formation: "opposite", speedMult: 1.15, damageMult: 1.1, spreadDeg: 18 },
    ],
  },
  {
    id: "breaker_ring",
    kind: "miniBoss",
    minLevel: 5,
    rewardBoltsBonus: 18,
    rewardCoresBonus: 1,
    durationSec: 17,
    patternId: "breaker_ring",
    spawns: [
      { t: 0.4, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 1.8, type: "chaser", count: 4, formation: "arc", arcDeg: 150 },
      { t: 4.2, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 6.8, type: "chaser", count: 4, formation: "opposite" },
      { t: 9.8, type: "shooter", count: 1, formation: "corners" },
      { t: 11.2, type: "cutter", count: 2, formation: "behind_tail_bias" },
      { t: 14.0, type: "chaser", count: 5, formation: "random_ring" },
    ],
    capsOverride: { maxShooters: 2, maxCutters: 4, maxTotal: 12 },
    extraScrapClusters: 1,
    enemySpeedMult: 1.22,
    scrapBursts: [
      { t: 5.4, clusters: 1, scrapType: "heavy" },
      { t: 10.6, clusters: 1, scrapType: "heavy" },
    ],
  },
  {
    id: "core_monsoon",
    kind: "sectorEvent",
    minLevel: 6,
    rewardBoltsBonus: 14,
    rewardCoresBonus: 2,
    durationSec: 17,
    patternId: "core_monsoon",
    spawns: [
      { t: 0.7, type: "shooter", count: 2, formation: "corners" },
      { t: 3.5, type: "chaser", count: 4, formation: "arc", arcDeg: 140 },
      { t: 6.3, type: "cutter", count: 1, formation: "behind_tail_bias" },
      { t: 8.9, type: "shooter", count: 2, formation: "opposite" },
      { t: 12.1, type: "chaser", count: 4, formation: "random_ring" },
      { t: 14.4, type: "shooter", count: 1, formation: "corners" },
    ],
    capsOverride: { maxShooters: 4, maxCutters: 2, maxTotal: 11 },
    extraScrapClusters: 2,
    projectileSpeedMult: 1.08,
    scrapBursts: [
      { t: 2.2, clusters: 1, scrapType: "heavy" },
      { t: 5.8, clusters: 1, scrapType: "rareShard" },
      { t: 9.7, clusters: 1, scrapType: "heavy" },
      { t: 13.1, clusters: 1, scrapType: "rareShard" },
    ],
    projectileBursts: [
      { t: 4.1, count: 4, formation: "corners", speedMult: 1.05, damageMult: 1, spreadDeg: 14 },
      { t: 10.2, count: 5, formation: "opposite", speedMult: 1.08, damageMult: 1, spreadDeg: 16 },
      { t: 13.8, count: 5, formation: "corners", speedMult: 1.12, damageMult: 1.1, spreadDeg: 18 },
    ],
  },
] as const;

export function createEndlessLevelProgress(rng: Rng): EndlessLevelProgress {
  const first = createLevelSnapshot(1, pickNextModifier(1, rng, null).id);
  return {
    wavesPerLevel: WAVES_PER_LEVEL,
    current: first,
    pending: null,
    lastCleared: null,
  };
}

export function getWaveInEndlessLevel(waveIndex: number, wavesPerLevel = WAVES_PER_LEVEL): number {
  const safeWave = Math.max(1, Math.floor(waveIndex));
  return ((safeWave - 1) % Math.max(1, wavesPerLevel)) + 1;
}

export function isEndlessLevelFinalWave(waveIndex: number, wavesPerLevel = WAVES_PER_LEVEL): boolean {
  return getWaveInEndlessLevel(waveIndex, wavesPerLevel) === Math.max(1, wavesPerLevel);
}

export function getEndlessLevelModifier(id: EndlessLevelModifierId): EndlessLevelModifier {
  const modifier = ENDLESS_LEVEL_MODIFIERS.find((entry) => entry.id === id);
  if (!modifier) throw new Error(`Unknown endless level modifier: ${id}`);
  return modifier;
}

export function getCurrentEndlessLevelModifier(progress: EndlessLevelProgress): EndlessLevelModifier {
  return getEndlessLevelModifier(progress.current.modifierId);
}

export function getCurrentEndlessLevelObjective(progress: EndlessLevelProgress): EndlessLevelObjectiveProgress {
  return progress.current.objective;
}

export function getEndlessLevelFinale(id: EndlessLevelFinaleId): EndlessLevelFinale {
  const finale = ENDLESS_LEVEL_FINALES.find((entry) => entry.id === id);
  if (!finale) throw new Error(`Unknown endless level finale: ${id}`);
  return finale;
}

export function getCurrentEndlessLevelFinale(progress: EndlessLevelProgress): EndlessLevelFinale | null {
  return progress.current.finaleId ? getEndlessLevelFinale(progress.current.finaleId) : null;
}

export function getPendingEndlessLevelModifier(progress: EndlessLevelProgress): EndlessLevelModifier | null {
  if (!progress.pending) return null;
  return getEndlessLevelModifier(progress.pending.modifierId);
}

export function getPendingEndlessLevelObjective(progress: EndlessLevelProgress): EndlessLevelObjectiveProgress | null {
  if (!progress.pending) return null;
  return progress.pending.objective;
}

export function getPendingEndlessLevelFinale(progress: EndlessLevelProgress): EndlessLevelFinale | null {
  return progress.pending?.finaleId ? getEndlessLevelFinale(progress.pending.finaleId) : null;
}

export function getEndlessLevelFinaleForLevel(
  levelIndex: number,
  modifierId: EndlessLevelModifierId
): EndlessLevelFinale | null {
  const finaleId = pickLevelFinale(levelIndex, modifierId);
  return finaleId ? getEndlessLevelFinale(finaleId) : null;
}

export function queueNextEndlessLevel(progress: EndlessLevelProgress, rng: Rng): EndlessLevelProgress {
  if (progress.pending) return progress;

  const currentModifier = getCurrentEndlessLevelModifier(progress);
  const objective = progress.current.objective;
  const finale = getCurrentEndlessLevelFinale(progress);
  const objectiveCompleted = isEndlessLevelObjectiveComplete(objective);
  const reward = computeEndlessLevelReward(progress.current.index, currentModifier, objectiveCompleted ? objective : null, finale);
  const nextIndex = progress.current.index + 1;
  const nextModifier = createLevelSnapshot(nextIndex, pickNextModifier(nextIndex, rng, currentModifier.id).id);

  return {
    ...progress,
    pending: nextModifier,
    lastCleared: {
      levelIndex: progress.current.index,
      modifierId: currentModifier.id,
      rewardBolts: reward.rewardBolts,
      rewardCores: reward.rewardCores,
      objectiveId: objective.id,
      objectiveProgress: objective.progress,
      objectiveTarget: objective.target,
      objectiveCompleted,
      objectiveRewardBolts: objectiveCompleted ? objective.rewardBolts : 0,
      objectiveRewardCores: objectiveCompleted ? objective.rewardCores : 0,
      finaleId: finale?.id ?? null,
      finaleRewardBolts: Math.max(0, Math.floor(finale?.rewardBoltsBonus ?? 0)),
      finaleRewardCores: Math.max(0, Math.floor(finale?.rewardCoresBonus ?? 0)),
    },
  };
}

export function promotePendingEndlessLevel(progress: EndlessLevelProgress): EndlessLevelProgress {
  if (!progress.pending) return progress;
  return {
    ...progress,
    current: progress.pending,
    pending: null,
    lastCleared: null,
  };
}

export function computeEndlessLevelReward(
  levelIndex: number,
  modifier: Pick<EndlessLevelModifier, "rewardBoltsBonus">,
  objective: Pick<EndlessLevelObjectiveProgress, "rewardBolts" | "rewardCores"> | null,
  finale: Pick<EndlessLevelFinale, "rewardBoltsBonus" | "rewardCoresBonus"> | null
): { rewardBolts: number; rewardCores: number } {
  const safeLevel = Math.max(1, Math.floor(levelIndex));
  return {
    rewardBolts:
      6 +
      safeLevel * 4 +
      Math.max(0, Math.floor(modifier.rewardBoltsBonus)) +
      Math.max(0, Math.floor(objective?.rewardBolts ?? 0)) +
      Math.max(0, Math.floor(finale?.rewardBoltsBonus ?? 0)),
    rewardCores:
      (safeLevel % CORE_REWARD_INTERVAL === 0 ? 1 : 0) +
      Math.max(0, Math.floor(objective?.rewardCores ?? 0)) +
      Math.max(0, Math.floor(finale?.rewardCoresBonus ?? 0)),
  };
}

export function isEndlessLevelObjectiveComplete(objective: EndlessLevelObjectiveProgress): boolean {
  return objective.progress >= objective.target;
}

function createLevelSnapshot(levelIndex: number, modifierId: EndlessLevelModifierId): EndlessLevelSnapshot {
  const modifier = getEndlessLevelModifier(modifierId);
  return {
    index: levelIndex,
    modifierId,
    objective: createObjectiveProgress(modifier.objectiveId, levelIndex),
    finaleId: pickLevelFinale(levelIndex, modifierId),
  };
}

function createObjectiveProgress(objectiveId: EndlessLevelObjectiveId, levelIndex: number): EndlessLevelObjectiveProgress {
  const level = Math.max(1, Math.floor(levelIndex));

  switch (objectiveId) {
    case "bank_bolts":
      return {
        id: objectiveId,
        mode: "cumulative",
        target: 18 + Math.floor((level - 1) / 2) * 4,
        progress: 0,
        rewardBolts: 6 + Math.floor(level / 2) * 2,
        rewardCores: 1,
      };
    case "deflect_projectiles":
      return {
        id: objectiveId,
        mode: "cumulative",
        target: 4 + Math.floor((level - 1) / 3),
        progress: 0,
        rewardBolts: 10 + Math.floor(level / 3) * 2,
        rewardCores: 0,
      };
    case "tail_segments":
      return {
        id: objectiveId,
        mode: "current",
        target: Math.min(14, 8 + Math.floor((level - 1) / 3)),
        progress: 0,
        rewardBolts: 4 + Math.floor(level / 3) * 2,
        rewardCores: 1,
      };
    case "heavy_scrap":
      return {
        id: objectiveId,
        mode: "cumulative",
        target: 3 + Math.floor((level - 1) / 4),
        progress: 0,
        rewardBolts: 12 + Math.floor(level / 2) * 2,
        rewardCores: 0,
      };
    case "hull_integrity":
      return {
        id: objectiveId,
        mode: "current",
        target: Math.min(90, 60 + Math.floor((level - 1) / 3) * 5),
        progress: 0,
        rewardBolts: 6 + Math.floor(level / 3) * 2,
        rewardCores: 1,
      };
  }
}

function pickNextModifier(levelIndex: number, rng: Rng, previousId: EndlessLevelModifierId | null): EndlessLevelModifier {
  const candidates = ENDLESS_LEVEL_MODIFIERS.filter((entry) => entry.minLevel <= levelIndex && entry.id !== previousId);
  const pool = candidates.length > 0 ? candidates : ENDLESS_LEVEL_MODIFIERS.filter((entry) => entry.minLevel <= levelIndex);
  return rng.weightedPick(pool.map((entry) => ({ item: entry, weight: entry.weight })));
}

function pickLevelFinale(levelIndex: number, modifierId: EndlessLevelModifierId): EndlessLevelFinaleId | null {
  const level = Math.max(1, Math.floor(levelIndex));

  switch (modifierId) {
    case "crossfire_protocol":
      return level >= 2 ? "crossfire_overseer" : null;
    case "razor_parade":
      return level >= 4 && level % 2 === 1 ? "blade_dancer" : null;
    case "iron_convoy":
      return level >= 2 && level % 2 === 0 ? "scrap_juggernaut" : null;
    case "salvage_surge":
      return level >= 3 && level % 3 === 0 ? "salvage_storm" : null;
    case "ion_storm":
      return level >= 5 && level % 4 === 1 ? "ion_tempest" : null;
    case "breaker_surge":
      return level >= 5 && level % 3 === 2 ? "breaker_ring" : null;
    case "reclaimer_uplink":
      return level >= 6 && level % 4 === 2 ? "core_monsoon" : null;
  }
}
