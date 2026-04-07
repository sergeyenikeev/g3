import type {
  Balances,
  BalancePresetsConfig,
  DailyConfig,
  EnemiesConfig,
  LeaderboardsConfig,
  LiveopsConfig,
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
  liveops: LiveopsConfig;
  leaderboards: LeaderboardsConfig;
  runUpgrades: RunUpgradeDef[];
  balancePresets: BalancePresetsConfig;
  metaTree: MetaTreeConfig;
};
