import { describe, expect, it } from "vitest";
import { canPurchaseMetaNode, getMetaNodeCost, grantMetaWallet, purchaseMetaNode } from "../../src/game/meta/metaProgression";
import type { MetaTreeConfig } from "../../src/data/types";
import { makeDefaultSave } from "../../src/platform/save/saveManager";

const tree: MetaTreeConfig = {
  currencies: ["bolts", "cores"],
  costFormula: { type: "exponential", base: 100, growth: 1.5 },
  nodes: [
    {
      id: "magnet",
      name: "Magnet",
      maxLevel: 3,
      costCurrency: "bolts",
      effectsPerLevel: [{ op: "add", path: "magnet.radiusBase", value: 5 }],
    },
    {
      id: "dash",
      name: "Dash",
      maxLevel: 1,
      cost: { currency: "cores", amount: 2 },
      effects: [{ op: "set", path: "dash.enabledByDefault", value: true }],
    },
  ],
};

describe("metaProgression", () => {
  it("computes exponential costs from current level", () => {
    expect(getMetaNodeCost(tree, "magnet", 0)).toEqual({ currency: "bolts", amount: 100 });
    expect(getMetaNodeCost(tree, "magnet", 1)).toEqual({ currency: "bolts", amount: 150 });
  });

  it("grants wallet rewards without losing existing currency", () => {
    const save = makeDefaultSave();
    save.meta.wallet.bolts = 40;

    const next = grantMetaWallet(save, { bolts: 25, cores: 2 });
    expect(next.meta.wallet.bolts).toBe(65);
    expect(next.meta.wallet.cores).toBe(2);
  });

  it("purchases nodes when the wallet has enough currency", () => {
    const save = makeDefaultSave();
    save.meta.wallet.bolts = 200;

    expect(canPurchaseMetaNode(tree, save, "magnet")).toBe(true);
    const result = purchaseMetaNode(tree, save, "magnet");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.save.meta.nodeLevels.magnet).toBe(1);
    expect(result.save.meta.wallet.bolts).toBe(100);
  });

  it("rejects purchases when funds are insufficient", () => {
    const save = makeDefaultSave();
    save.meta.wallet.cores = 1;

    const result = purchaseMetaNode(tree, save, "dash");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("insufficient_funds");
  });
});
