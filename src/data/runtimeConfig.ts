import { deepMerge } from "../core/deepMerge";
import { applyEffects, type PerkState } from "../game/effects/applyEffects";
import type { BalancePresetsConfig, Balances, MetaTreeConfig } from "./types";
import type { StaticGameData } from "./staticGameData";
import type { EnemiesConfig, EnemyType, RunUpgradeDef, WaveSetsConfig, PatternsConfig, DailyConfig } from "./types";

export type RuntimeConfig = Balances & {
  enemies: EnemiesConfig;
  waveSets: WaveSetsConfig;
  patterns: PatternsConfig;
  daily: DailyConfig;
  runUpgrades: RunUpgradeDef[];
  balancePresets: BalancePresetsConfig;
  metaTree: MetaTreeConfig;
};

export type BuildConfigOptions = {
  presetId?: string;
  metaLevels?: Record<string, number>;
};

export type BuiltConfig = {
  config: RuntimeConfig;
  basePerks: PerkState;
};

export function buildRuntimeConfig(data: StaticGameData, opts: BuildConfigOptions = {}): BuiltConfig {
  const baseBalances = structuredClone(data.balances) as Balances;
  const cfg: RuntimeConfig = {
    ...baseBalances,
    enemies: structuredClone(data.enemies),
    waveSets: structuredClone(data.waveSets),
    patterns: structuredClone(data.patterns),
    daily: structuredClone(data.daily),
    runUpgrades: structuredClone(data.runUpgrades),
    balancePresets: structuredClone(data.balancePresets),
    metaTree: structuredClone(data.metaTree),
  };

  const basePerks: PerkState = {};

  applyBalancePreset(cfg, opts.presetId ?? "normal");
  applyMetaTree(cfg, basePerks, opts.metaLevels ?? {});

  return { config: cfg, basePerks };
}

function applyBalancePreset(cfg: RuntimeConfig, presetId: string): void {
  const preset = cfg.balancePresets.presets.find((p) => p.id === presetId) ?? cfg.balancePresets.presets[0];
  if (!preset) return;

  const overrides = structuredClone(preset.overrides) as any;
  const enemyMults = overrides.enemies as Partial<Record<EnemyType, any>> | undefined;
  delete overrides.enemies;
  deepMerge(cfg, overrides);
  if (enemyMults) applyEnemyMultipliers(cfg.enemies, enemyMults);
}

function applyEnemyMultipliers(enemies: EnemiesConfig, mults: Partial<Record<EnemyType, any>>): void {
  (Object.keys(mults) as EnemyType[]).forEach((type) => {
    const m = mults[type];
    if (!m) return;
    const e = enemies[type];
    if (!e) return;
    if (typeof m.speedMult === "number") e.speed *= m.speedMult;
    if (typeof m.hpMult === "number") e.hp *= m.hpMult;
    if (type === "shooter") {
      const shooter = enemies.shooter;
      if (typeof m.fireCooldownMult === "number") shooter.fireCooldownSec *= m.fireCooldownMult;
      if (typeof m.projectileSpeedMult === "number") shooter.projectile.speed *= m.projectileSpeedMult;
    }
  });
}

function applyMetaTree(cfg: RuntimeConfig, basePerks: PerkState, levels: Record<string, number>): void {
  for (const node of cfg.metaTree.nodes) {
    const lvl = Math.max(0, Math.floor(levels[node.id] ?? 0));
    if (lvl <= 0) continue;

    if (node.effectsPerLevel && node.effectsPerLevel.length > 0) {
      for (let i = 0; i < Math.min(lvl, node.maxLevel); i++) {
        applyEffects({ config: cfg, perks: basePerks }, node.effectsPerLevel);
      }
    }
    if (node.effects && node.effects.length > 0 && lvl > 0) {
      applyEffects({ config: cfg, perks: basePerks }, node.effects);
    }
  }
}
