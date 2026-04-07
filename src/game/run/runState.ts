import type { RuntimeConfig } from "../../data/runtimeConfig";
import type { Rarity } from "../../data/types";
import type { Rng } from "../../core/prng";
import type { PerkState } from "../effects/applyEffects";
import type { EndlessLevelProgress } from "./endlessLevels";

export type RunMode = "run" | "daily" | "tutorial";

export type PendingStartBoosterPayload = {
  addTailSegments: number;
  addBolts: number;
  addCores: number;
  source: "rewarded" | "onboarding";
};

export type RunMetrics = {
  scrapCollected: number;
  heavyScrapCollected: number;
  banksCompleted: number;
  boltsBanked: number;
  projectilesDeflected: number;
  flipsUsed: number;
  upgradesPicked: number;
  reviveOffers: number;
  revivesAccepted: number;
  startBoosterSource: PendingStartBoosterPayload["source"] | null;
};

export type RunState = {
  mode: RunMode;
  rng: Rng;
  config: RuntimeConfig;
  perks: PerkState;

  startedAtMs: number;
  tailMaxLen: number;
  deathReason?: string;

  waveIndex: number;
  bolts: number;
  cores: number;

  hp: number;
  recentHits: Array<{ t: number }>;

  pickedUpgrades: Record<string, { stacks: number; rarity: Rarity }>;
  pityNoRareOrEpicPicks: number;
  endless: EndlessLevelProgress;
  metrics: RunMetrics;

  daily?: { dateUtc: string; variantId: string; specialRule?: Record<string, unknown> };
};
