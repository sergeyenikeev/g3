import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/prng";
import { makeUpgradeOffer } from "../../src/game/upgrades/upgradeSelection";
import type { Balances, RunUpgradeDef } from "../../src/data/types";

describe("makeUpgradeOffer", () => {
  it("does not repeat upgrades and respects maxStacks", () => {
    const rng = createRng("offer-seed");

    const cfg: Pick<Balances, "upgradeRarityRoll"> = {
      upgradeRarityRoll: {
        pityNoRareOrEpicPicks: 6,
        pityBoost: { rare: 0, epic: 0, takeFrom: "common" },
        tables: [{ fromWave: 1, toWave: 999, common: 1, uncommon: 0, rare: 0, epic: 0 }],
      },
    };

    const upgrades: RunUpgradeDef[] = [
      { id: "a", name: "A", rarity: "common", weight: 10, maxStacks: 1, effects: [] },
      { id: "b", name: "B", rarity: "common", weight: 10, maxStacks: 2, effects: [] },
      { id: "c", name: "C", rarity: "common", weight: 10, maxStacks: 2, effects: [] },
      { id: "d", name: "D", rarity: "common", weight: 10, maxStacks: 2, effects: [] },
    ];

    const offer = makeUpgradeOffer(
      cfg,
      upgrades,
      { waveIndex: 1, rarityState: { noRareOrEpicPicks: 0 }, pickedCounts: { a: 1 }, offerSize: 3 },
      rng
    );

    expect(offer).toHaveLength(3);
    const ids = offer.map((o) => o.upgrade.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("a");
  });
});

