import type { Rng } from "../../core/prng";
import type { Balances, EnemyType, PatternDef, PatternsConfig, WaveSet } from "../../data/types";
import { getPressureTargets } from "./pressure";

export type WavePlan = {
  waveIndex: number;
  durationSec: number;
  budget: number;
  spawns: WaveSpawnEvent[];
  patternId?: string;
  caps: { maxShooters: number; maxCutters: number; maxTotal: number };
  pressureTargets: { min: number; max: number };
  extraScrapClusters: number;
  special?: { type: "breather" | "mini_boss" | "sector_event"; finaleId?: string };
};

export type WaveSpawnEvent = {
  t: number;
  type: EnemyType;
  count: number;
  formation: string;
  arcDeg?: number;
};

export type DirectorContext = {
  tailLen: number;
  hpRatio: number;
  dailyRule?: Record<string, unknown>;
};

export function buildWavePlan(
  balances: Pick<Balances, "waves" | "director" | "tail">,
  waveSet: WaveSet,
  patterns: PatternsConfig,
  waveIndex: number,
  ctx: DirectorContext,
  rng: Rng
): WavePlan {
  const durationSec = clamp(
    balances.waves.durationBaseSec + Math.floor((waveIndex - 1) / 5) * balances.waves.durationEvery5PlusSec,
    8,
    balances.waves.durationMaxSec
  );

  const baseBudget = getBudget(balances, waveSet, waveIndex);
  const targets = getPressureTargets({ director: balances.director }, waveIndex);

  let budget = baseBudget;
  let extraScrapClusters = 0;
  const cutterWeightMult =
    ctx.tailLen > balances.director.antiSnowball.bigTailThreshold ? balances.director.antiSnowball.bigTailCutterWeightMult : 1;

  if (ctx.hpRatio < balances.director.antiSnowball.lowHpThreshold) {
    budget *= balances.director.antiSnowball.lowHpBudgetMult;
    extraScrapClusters += balances.director.antiSnowball.lowHpExtraScrapClusters;
  }

  const capsBase = balances.director.caps;
  const maxTotal = Math.floor(capsBase.maxTotalEnemiesBase + capsBase.maxTotalEnemiesPerWave * Math.max(0, waveIndex - 1));
  const maxShooters = capsBase.maxShootersBase;
  let maxCutters = waveIndex <= 10 ? capsBase.maxCuttersUntilWave10 : capsBase.maxCuttersFromWave11;
  if (waveIndex <= 10) maxCutters = Math.min(maxCutters, waveSet.rules.maxCuttersBeforeWave10);

  const isBreather = balances.director.breather.everyWaves > 0 && waveIndex % balances.director.breather.everyWaves === 0;
  const wavePlan: WavePlan = {
    waveIndex,
    durationSec: isBreather ? balances.director.breather.durationSec : durationSec,
    budget,
    spawns: [],
    caps: { maxShooters, maxCutters, maxTotal },
    pressureTargets: targets,
    extraScrapClusters: extraScrapClusters + (isBreather ? balances.director.breather.extraScrapClusters : 0),
    special: isBreather ? { type: "breather" } : undefined,
  };

  if (isBreather) {
    wavePlan.patternId = "breather";
    return wavePlan;
  }

  const pattern = pickPattern(patterns.patterns, waveIndex, rng);
  wavePlan.patternId = pattern?.id;
  if (pattern?.special?.type === "breather") {
    wavePlan.special = { type: "breather" };
    wavePlan.durationSec = balances.director.breather.durationSec;
    wavePlan.extraScrapClusters += balances.director.breather.extraScrapClusters;
    return wavePlan;
  }
  if (pattern?.capsOverride) {
    if (typeof pattern.capsOverride.maxShooters === "number") wavePlan.caps.maxShooters = pattern.capsOverride.maxShooters;
    if (typeof pattern.capsOverride.maxCutters === "number") wavePlan.caps.maxCutters = pattern.capsOverride.maxCutters;
    if (typeof pattern.capsOverride.maxTotal === "number") wavePlan.caps.maxTotal = pattern.capsOverride.maxTotal;
  }

  const allowed = getAllowedTypes(waveSet, waveIndex, ctx.dailyRule);
  const spawns = (pattern?.spawns ?? []).slice().sort((a, b) => a.t - b.t);

  let remaining = budget;
  for (const s of spawns) {
    const type = allowed.has(s.type) ? s.type : "chaser";
    const cost = waveSet.enemyCosts[type];
    const maxCount = cost > 0 ? Math.floor(remaining / cost) : s.count;
    const count = Math.max(0, Math.min(s.count, maxCount));
    if (count <= 0) continue;
    remaining -= count * cost;
    wavePlan.spawns.push({ t: s.t, type, count, formation: s.formation, arcDeg: s.arcDeg });
  }

  if (remaining > 0) {
    const fill = makeBudgetFillEvents(waveSet, waveIndex, allowed, remaining, durationSec, ctx, cutterWeightMult, rng);
    wavePlan.spawns.push(...fill);
    remaining = 0;
  }

  wavePlan.spawns.sort((a, b) => a.t - b.t);
  return wavePlan;
}

function getBudget(balances: Pick<Balances, "waves">, waveSet: WaveSet, waveIndex: number): number {
  const scripted = waveSet.waveScript.find((w) => w.wave === waveIndex);
  if (scripted) return scripted.budget;
  const i = Math.max(0, waveIndex - 1);
  return balances.waves.budgetBase + balances.waves.budgetPerWave * i;
}

function pickPattern(all: PatternDef[], waveIndex: number, rng: Rng): PatternDef | null {
  const candidates = all.filter((p) => waveIndex >= p.minWave);
  if (candidates.length === 0) return null;
  return rng.weightedPick(candidates.map((p) => ({ item: p, weight: p.weight })));
}

function getAllowedTypes(waveSet: WaveSet, waveIndex: number, dailyRule?: Record<string, unknown>): Set<EnemyType> {
  let minWaveForShooter = waveSet.rules.minWaveForShooter;
  let minWaveForCutter = waveSet.rules.minWaveForCutter;

  if (dailyRule?.type === "double_shooter_waves" && typeof dailyRule.fromWave === "number") {
    // не меняем allow, но правило будет обработано на уровне mix/fill
  }

  const allowed = new Set<EnemyType>(["chaser"]);
  if (waveIndex >= minWaveForShooter) allowed.add("shooter");
  if (waveIndex >= minWaveForCutter) allowed.add("cutter");
  return allowed;
}

function makeBudgetFillEvents(
  waveSet: WaveSet,
  waveIndex: number,
  allowed: Set<EnemyType>,
  budget: number,
  durationSec: number,
  ctx: DirectorContext,
  cutterWeightMult: number,
  rng: Rng
): WaveSpawnEvent[] {
  const mix = getMixForWave(waveSet, waveIndex);
  const allowedMix = (Object.entries(mix) as Array<[EnemyType, number]>)
    .filter(([t]) => allowed.has(t))
    .map(([type, weight]) => ({ item: type, weight: type === "cutter" ? weight * cutterWeightMult : weight }));
  const events: WaveSpawnEvent[] = [];

  let remaining = budget;
  for (let i = 0; i < 4 && remaining > 0; i++) {
    const t = rng.float(0.5, Math.max(1, durationSec - 1.5));
    const type = allowedMix.length > 0 ? rng.weightedPick(allowedMix) : "chaser";
    const cost = waveSet.enemyCosts[type];
    const maxCount = cost > 0 ? Math.floor(remaining / cost) : 1;
    const count = Math.max(1, Math.min(3, maxCount));
    remaining -= count * cost;
    events.push({ t, type: applyDailyTypeRule(type, ctx.dailyRule, waveIndex, rng), count, formation: "random_ring" });
  }
  return events;
}

function getMixForWave(waveSet: WaveSet, waveIndex: number): Partial<Record<EnemyType, number>> {
  const scripted = waveSet.waveScript.find((w) => w.wave === waveIndex);
  if (scripted) return scripted.mix;
  const last = waveSet.waveScript.reduce((acc, v) => (v.wave > acc.wave ? v : acc), waveSet.waveScript[0]!);
  return last.mix;
}

function applyDailyTypeRule(type: EnemyType, dailyRule: Record<string, unknown> | undefined, waveIndex: number, rng: Rng): EnemyType {
  if (dailyRule?.type === "double_shooter_waves" && typeof dailyRule.fromWave === "number") {
    const chance = typeof (dailyRule as any).chance === "number" ? ((dailyRule as any).chance as number) : 0;
    if (waveIndex >= dailyRule.fromWave && type === "chaser" && chance > 0 && rng.next() < chance) return "shooter";
  }
  return type;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
