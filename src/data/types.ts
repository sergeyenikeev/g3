export type EnemyType = "chaser" | "shooter" | "cutter";

export type Rarity = "common" | "uncommon" | "rare" | "epic";

export type Effect =
  | { op: "add"; path: string; value: number }
  | { op: "mul"; path: string; value: number }
  | { op: "set"; path: string; value: unknown }
  | { op: "heal"; value: number }
  | { op: "grant_perk"; perkId: string; params?: Record<string, unknown> };

export type Balances = {
  player: {
    speedBase: number;
    speedMin: number;
    tailSpeedPenaltyPerSegment: number;
    turnSmoothing: number;
    hpMax: number;
    invulnOnHitSec: number;
  };
  dash: {
    enabledByDefault: boolean;
    speedMult: number;
    durationSec: number;
    cooldownSec: number;
    iframesSec: number;
  };
  magnet: {
    radiusBase: number;
    radiusMax: number;
    pullAccelBase: number;
    pullAccelCoreScale: number;
    pullMaxSpeed: number;
    captureDistance: number;
    captureCooldownSec: number;
  };
  tail: {
    segmentSpacing: number;
    segmentRadius: number;
    maxLenBase: number;
    maxLenCap: number;
    followStiffness: number;
    damping: number;
    lossOnCutter: number;
    lossOnProjectile: number;
    lossOnObstacle: number;
  };
  flip: {
    cooldownBaseSec: number;
    pulseDurationSec: number;
    radius: number;
    pushForce: number;
    deflectProjectiles: boolean;
    postFlipInvulnSec: number;
    shrapnel: {
      enabled: boolean;
      count: number;
      damage: number;
      speed: number;
      lifetimeSec: number;
    };
  };
  scrap: {
    clusterCountBase: number;
    clusterCountPerWave: number;
    clusterCountCap: number;
    clusterRadius: number;
    clusterSizeMin: number;
    clusterSizeMax: number;
    respawnTimeSec: number;
    types: {
      common: { weight: number; valueBolts: number };
      heavy: { weight: number; valueBolts: number };
      rareShard: { weight: number; coreDropChance: number };
    };
  };
  recycler: {
    count: number;
    radius: number;
    bankTimeSec: number;
    healOnBank: number;
    boltsPerScrapCommon: number;
    boltsPerScrapHeavy: number;
  };
  arena: {
    width: number;
    height: number;
    recyclerPos: { x: number; y: number };
  };
  waves: {
    durationBaseSec: number;
    durationEvery5PlusSec: number;
    durationMaxSec: number;
    enemyHpMultPerWave: number;
    enemyHpMultCap: number;
    enemySpeedMultPerWave: number;
    enemySpeedMultCap: number;
    scrapMultPerWave: number;
    scrapMultCap: number;
    budgetBase: number;
    budgetPerWave: number;
  };
  director: {
    safeSpawnDist: number;
    recyclerSafeDist: number;
    telegraphSec: number;
    caps: {
      maxShootersBase: number;
      maxCuttersUntilWave10: number;
      maxCuttersFromWave11: number;
      maxTotalEnemiesBase: number;
      maxTotalEnemiesPerWave: number;
    };
    breather: {
      everyWaves: number;
      durationSec: number;
      enemyRateMult: number;
      extraScrapClusters: number;
    };
    antiSnowball: {
      lowHpThreshold: number;
      lowHpBudgetMult: number;
      lowHpExtraScrapClusters: number;
      bigTailThreshold: number;
      bigTailCutterWeightMult: number;
    };
    pressure: {
      radiusNearEnemies: number;
      radiusNearProjectiles: number;
      recentHitWindowSec: number;
      weights: {
        nearEnemies: number;
        nearProjectiles: number;
        recentHits: number;
        tailLenFactor: number;
      };
      targetMinBase: number;
      targetMinPerWave: number;
      targetMaxBase: number;
      targetMaxPerWave: number;
    };
  };
  ads: {
    interstitialCooldownSec: number;
    disableInterstitialUntilTutorialDone: boolean;
    rewarded: {
      revive: {
        enabled: boolean;
        hpRestoreFrac: number;
        invulnSec: number;
        clearEnemies: boolean;
      };
      x2Results: {
        enabled: boolean;
        mult: number;
      };
      reroll: {
        enabled: boolean;
      };
    };
  };
  upgradeRarityRoll: {
    pityNoRareOrEpicPicks: number;
    pityBoost: { rare: number; epic: number; takeFrom: Rarity };
    tables: Array<{
      fromWave: number;
      toWave: number;
      common: number;
      uncommon: number;
      rare: number;
      epic: number;
    }>;
  };
};

export type EnemyDef = {
  hp: number;
  speed: number;
  contactDamage?: number;
  knockback?: number;
  keepDistance?: number;
  fireCooldownSec?: number;
  projectile?: { speed: number; damage: number; lifetimeSec: number };
  tailCut?: number;
  cooldownAfterCutSec?: number;
  ai: { type: "chase" | "kite" | "tail_hunt"; zigzag?: number; preferTail?: boolean };
};

export type EnemiesConfig = Record<EnemyType, EnemyDef>;

export type WaveScriptEntry = { wave: number; budget: number; mix: Partial<Record<EnemyType, number>> };

export type WaveSet = {
  rules: {
    minWaveForShooter: number;
    minWaveForCutter: number;
    maxCuttersBeforeWave10: number;
  };
  enemyCosts: Record<EnemyType, number>;
  waveScript: WaveScriptEntry[];
};

export type WaveSetsConfig = Record<string, WaveSet>;

export type PatternSpawn = {
  t: number;
  type: EnemyType;
  count: number;
  formation: "arc" | "opposite" | "corners" | "random_ring" | "behind_tail_bias";
  arcDeg?: number;
};

export type PatternDef = {
  id: string;
  weight: number;
  minWave: number;
  spawns?: PatternSpawn[];
  special?: { type: "breather" };
  capsOverride?: { maxCutters?: number; maxShooters?: number; maxTotal?: number };
};

export type PatternsConfig = { patterns: PatternDef[] };

export type DailyConfig = {
  seedMode: "utc_date_yyyymmdd";
  dailyRewards: {
    firstRunBonusBoltsMult: number;
    extraAttemptRewardedMax: number;
    coreDropBonus: number;
  };
  dailyVariants: Array<{
    id: string;
    weight: number;
    modifiers: Array<{ op: "mul" | "add" | "set"; path: string; value: unknown }>;
    specialRule?: Record<string, unknown>;
  }>;
};

export type RunUpgradeDef = {
  id: string;
  name: string;
  rarity: Rarity;
  weight: number;
  maxStacks: number;
  tags?: string[];
  ui?: { title?: string; desc?: string };
  effects: Effect[];
};

export type BalancePreset = {
  id: string;
  name: string;
  overrides: Partial<Balances> & {
    enemies?: Partial<
      Record<
        EnemyType,
        {
          speedMult?: number;
          hpMult?: number;
          fireCooldownMult?: number;
          projectileSpeedMult?: number;
        }
      >
    >;
  };
};

export type BalancePresetsConfig = { presets: BalancePreset[] };

export type MetaTreeConfig = {
  currencies: string[];
  costFormula: { type: "exponential"; base: number; growth: number };
  nodes: Array<{
    id: string;
    name: string;
    maxLevel: number;
    costCurrency?: string;
    cost?: { currency: string; amount: number };
    effectsPerLevel?: Effect[];
    effects?: Effect[];
  }>;
};
