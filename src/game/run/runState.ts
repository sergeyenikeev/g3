import type { RuntimeConfig } from "../../data/runtimeConfig";
import type { Rarity } from "../../data/types";
import type { Rng } from "../../core/prng";
import type { PerkState } from "../effects/applyEffects";

export type RunMode = "run" | "daily";

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

  daily?: { dateUtc: string; variantId: string; specialRule?: Record<string, unknown> };
};
