import type { Rng } from "../../core/prng";
import type { Balances, Rarity, RunUpgradeDef } from "../../data/types";
import { rollUpgradeRarity, type RarityRollState } from "./rarity";

export type OfferContext = {
  waveIndex: number;
  rarityState: RarityRollState;
  pickedCounts: Record<string, number>;
  offerSize?: number;
};

export type UpgradeOfferItem = {
  upgrade: RunUpgradeDef;
  rolledRarity: Rarity;
};

export function makeUpgradeOffer(cfg: Pick<Balances, "upgradeRarityRoll">, all: RunUpgradeDef[], ctx: OfferContext, rng: Rng): UpgradeOfferItem[] {
  const size = ctx.offerSize ?? 3;
  const offered = new Set<string>();
  const result: UpgradeOfferItem[] = [];

  for (let i = 0; i < size; i++) {
    const rolled = rollUpgradeRarity(cfg, ctx.waveIndex, ctx.rarityState, rng);
    const picked = pickUpgrade(all, rolled, offered, ctx.pickedCounts, rng);
    if (!picked) break;
    offered.add(picked.id);
    result.push({ upgrade: picked, rolledRarity: rolled });
  }

  return result;
}

function pickUpgrade(
  all: RunUpgradeDef[],
  rarity: Rarity,
  offered: Set<string>,
  pickedCounts: Record<string, number>,
  rng: Rng
): RunUpgradeDef | null {
  const rarityOrder: Rarity[] = ["epic", "rare", "uncommon", "common"];
  const startIdx = rarityOrder.indexOf(rarity);
  const tryRarities = startIdx >= 0 ? rarityOrder.slice(startIdx) : rarityOrder;

  for (const r of tryRarities) {
    const candidates = all.filter((u) => u.rarity === r && !offered.has(u.id) && (pickedCounts[u.id] ?? 0) < u.maxStacks);
    if (candidates.length === 0) continue;
    const entries = candidates.map((u) => ({ item: u, weight: u.weight }));
    return rng.weightedPick(entries);
  }

  return null;
}

