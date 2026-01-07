import type { Balances, Rarity } from "../../data/types";
import type { Rng } from "../../core/prng";

export type RarityRollState = {
  noRareOrEpicPicks: number;
};

export function rollUpgradeRarity(
  cfg: Pick<Balances, "upgradeRarityRoll">,
  waveIndex: number,
  state: RarityRollState,
  rng: Rng
): Rarity {
  const table = cfg.upgradeRarityRoll.tables.find((t) => waveIndex >= t.fromWave && waveIndex <= t.toWave);
  const base = table ?? cfg.upgradeRarityRoll.tables[cfg.upgradeRarityRoll.tables.length - 1]!;

  const p = { common: base.common, uncommon: base.uncommon, rare: base.rare, epic: base.epic };
  const pityAfter = cfg.upgradeRarityRoll.pityNoRareOrEpicPicks;
  if (state.noRareOrEpicPicks >= pityAfter) {
    const boost = cfg.upgradeRarityRoll.pityBoost;
    p.rare += boost.rare;
    p.epic += boost.epic;
    p[boost.takeFrom] = Math.max(0, p[boost.takeFrom] - (boost.rare + boost.epic));
  }

  const sum = p.common + p.uncommon + p.rare + p.epic;
  if (!(sum > 0)) return "common";
  const r = rng.next() * sum;

  let acc = 0;
  acc += p.common;
  if (r < acc) return "common";
  acc += p.uncommon;
  if (r < acc) return "uncommon";
  acc += p.rare;
  if (r < acc) return "rare";
  return "epic";
}

export function updatePityAfterPick(state: RarityRollState, pickedRarity: Rarity): void {
  if (pickedRarity === "rare" || pickedRarity === "epic") {
    state.noRareOrEpicPicks = 0;
  } else {
    state.noRareOrEpicPicks += 1;
  }
}

