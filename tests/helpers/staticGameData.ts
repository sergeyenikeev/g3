import type { StaticGameData } from "../../src/data/staticGameData";
import type {
  BalancePresetsConfig,
  Balances,
  DailyConfig,
  EnemiesConfig,
  MetaTreeConfig,
  PatternsConfig,
  RunUpgradeDef,
  WaveSetsConfig,
} from "../../src/data/types";
import { readJson } from "./readJson";

export async function loadStaticGameData(): Promise<StaticGameData> {
  return {
    balances: await readJson<Balances>("public/assets/data/balances.json"),
    enemies: await readJson<EnemiesConfig>("public/assets/data/enemies.json"),
    waveSets: await readJson<WaveSetsConfig>("public/assets/data/wave_sets.json"),
    patterns: await readJson<PatternsConfig>("public/assets/data/patterns.json"),
    daily: await readJson<DailyConfig>("public/assets/data/daily.json"),
    runUpgrades: await readJson<RunUpgradeDef[]>("public/assets/data/run_upgrades.json"),
    balancePresets: await readJson<BalancePresetsConfig>("public/assets/data/balance_presets.json"),
    metaTree: await readJson<MetaTreeConfig>("public/assets/data/meta_tree.json"),
  };
}

