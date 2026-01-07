import type {
  Balances,
  BalancePresetsConfig,
  DailyConfig,
  EnemiesConfig,
  MetaTreeConfig,
  PatternsConfig,
  RunUpgradeDef,
  WaveSetsConfig,
} from "./types";

export type StaticGameData = {
  balances: Balances;
  enemies: EnemiesConfig;
  waveSets: WaveSetsConfig;
  patterns: PatternsConfig;
  daily: DailyConfig;
  runUpgrades: RunUpgradeDef[];
  balancePresets: BalancePresetsConfig;
  metaTree: MetaTreeConfig;
};

