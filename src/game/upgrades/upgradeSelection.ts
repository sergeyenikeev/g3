import type { Rng } from "../../core/prng";
import type { Balances, Rarity, RunUpgradeDef } from "../../data/types";
import { rollUpgradeRarity, type RarityRollState } from "./rarity";

export type OfferContext = {
  waveIndex: number;
  rarityState: RarityRollState;
  pickedCounts: Record<string, number>;
  offerSize: number;
};

export type UpgradeOfferItem = {
  upgrade: RunUpgradeDef;
  rolledRarity: Rarity;
};

export function makeUpgradeOffer(cfg: Pick<Balances, "upgradeRarityRoll">, all: RunUpgradeDef[], ctx: OfferContext, rng: Rng): UpgradeOfferItem[] {
  const size = ctx.offerSize;
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
    const buildIds = [...new Set([...Object.keys(pickedCounts).filter((id) => (pickedCounts[id] ?? 0) > 0), ...Array.from(offered)])];
    const buildTags = collectBuildTags(all, buildIds);
    const entries = candidates.map((u) => ({
      item: u,
      weight: scoreUpgradeWeight(u, buildIds, buildTags, pickedCounts[u.id] ?? 0),
    }));
    return rng.weightedPick(entries);
  }

  return null;
}

function scoreUpgradeWeight(upgrade: RunUpgradeDef, buildIds: string[], buildTags: Set<string>, pickedStacks: number): number {
  let weight = Math.max(1, upgrade.weight);
  if (buildIds.length <= 0) return weight;

  const synergyHits = (upgrade.synergy?.worksWith ?? []).filter((id) => buildIds.includes(id)).length;
  const sharedTagCount = (upgrade.tags ?? []).filter((tag, idx, arr) => arr.indexOf(tag) === idx && buildTags.has(tag)).length;

  const synergyBoost = 1 + synergyHits * 0.75 + sharedTagCount * 0.14;
  const stackPenalty = pickedStacks > 0 ? 1 / (1 + pickedStacks * 0.4) : 1.08;

  weight *= synergyBoost * stackPenalty;
  return Math.max(1, weight);
}

function collectBuildTags(all: RunUpgradeDef[], buildIds: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of buildIds) {
    const upgrade = all.find((u) => u.id === id);
    if (!upgrade) continue;
    for (const tag of upgrade.tags ?? []) out.add(tag);
  }
  return out;
}
