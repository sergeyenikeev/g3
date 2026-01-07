import { describe, expect, it } from "vitest";
import type { Rng } from "../../src/core/prng";
import { rollUpgradeRarity, updatePityAfterPick } from "../../src/game/upgrades/rarity";
import type { Balances } from "../../src/data/types";

function makeRng(nextValue: number): Rng {
  return {
    next: () => nextValue,
    int: () => {
      throw new Error("not used");
    },
    float: () => {
      throw new Error("not used");
    },
    pick: () => {
      throw new Error("not used");
    },
    weightedPick: () => {
      throw new Error("not used");
    },
    shuffleInPlace: () => {
      // no-op
    },
  };
}

describe("rollUpgradeRarity + pity", () => {
  const cfg: Pick<Balances, "upgradeRarityRoll"> = {
    upgradeRarityRoll: {
      pityNoRareOrEpicPicks: 6,
      pityBoost: { rare: 0.06, epic: 0.01, takeFrom: "common" },
      tables: [{ fromWave: 1, toWave: 999, common: 0.78, uncommon: 0.2, rare: 0.02, epic: 0 }],
    },
  };

  it("без pity тот же roll даёт более низкую редкость", () => {
    const rng = makeRng(0.95);
    const rarity = rollUpgradeRarity(cfg, 1, { noRareOrEpicPicks: 0 }, rng);
    expect(rarity).toBe("uncommon");
  });

  it("с pity тот же roll становится rare", () => {
    const rng = makeRng(0.95);
    const rarity = rollUpgradeRarity(cfg, 1, { noRareOrEpicPicks: 6 }, rng);
    expect(rarity).toBe("rare");
  });

  it("pity сбрасывается при rare/epic", () => {
    const st = { noRareOrEpicPicks: 10 };
    updatePityAfterPick(st, "rare");
    expect(st.noRareOrEpicPicks).toBe(0);
  });
});

