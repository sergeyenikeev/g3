import type { MetaTreeConfig } from "../../data/types";
import type { SaveData } from "../../platform/save/saveManager";

export type MetaNodeCost = {
  currency: string;
  amount: number;
};

export type MetaPurchaseResult =
  | { ok: true; save: SaveData; cost: MetaNodeCost; nextLevel: number }
  | { ok: false; reason: "missing_node" | "max_level" | "insufficient_funds" | "missing_currency" };

export function getMetaWalletAmount(save: SaveData, currency: string): number {
  return clampInt(save.meta.wallet[currency] ?? 0, 0, 1e12);
}

export function getMetaNodeLevel(save: SaveData, nodeId: string): number {
  return clampInt(save.meta.nodeLevels[nodeId] ?? 0, 0, 999);
}

export function getMetaNodeCost(tree: MetaTreeConfig, nodeId: string, currentLevel: number): MetaNodeCost | null {
  const node = tree.nodes.find((entry) => entry.id === nodeId);
  if (!node) return null;
  if (currentLevel >= node.maxLevel) return null;

  if (node.cost) {
    return {
      currency: node.cost.currency,
      amount: clampInt(node.cost.amount, 0, 1e12),
    };
  }

  const currency = node.costCurrency ?? tree.currencies[0];
  if (!currency) return null;

  const rawAmount = tree.costFormula.base * Math.pow(tree.costFormula.growth, Math.max(0, currentLevel));
  return {
    currency,
    amount: clampInt(Math.round(rawAmount), 0, 1e12),
  };
}

export function canPurchaseMetaNode(tree: MetaTreeConfig, save: SaveData, nodeId: string): boolean {
  const level = getMetaNodeLevel(save, nodeId);
  const cost = getMetaNodeCost(tree, nodeId, level);
  if (!cost) return false;
  return getMetaWalletAmount(save, cost.currency) >= cost.amount;
}

export function purchaseMetaNode(tree: MetaTreeConfig, save: SaveData, nodeId: string): MetaPurchaseResult {
  const node = tree.nodes.find((entry) => entry.id === nodeId);
  if (!node) return { ok: false, reason: "missing_node" };

  const currentLevel = getMetaNodeLevel(save, nodeId);
  if (currentLevel >= node.maxLevel) return { ok: false, reason: "max_level" };

  const cost = getMetaNodeCost(tree, nodeId, currentLevel);
  if (!cost) return { ok: false, reason: "missing_currency" };

  const balance = getMetaWalletAmount(save, cost.currency);
  if (balance < cost.amount) return { ok: false, reason: "insufficient_funds" };

  const nextLevel = currentLevel + 1;
  const nextSave: SaveData = {
    ...save,
    meta: {
      ...save.meta,
      nodeLevels: { ...save.meta.nodeLevels, [nodeId]: nextLevel },
      wallet: { ...save.meta.wallet, [cost.currency]: balance - cost.amount },
    },
  };

  return { ok: true, save: nextSave, cost, nextLevel };
}

export function grantMetaWallet(save: SaveData, rewards: Record<string, number>): SaveData {
  const nextWallet = { ...save.meta.wallet };
  let changed = false;

  for (const [currency, amount] of Object.entries(rewards)) {
    const gain = clampInt(Math.floor(amount), 0, 1e12);
    if (gain <= 0) continue;
    nextWallet[currency] = getMetaWalletAmount(save, currency) + gain;
    changed = true;
  }

  if (!changed) return save;

  return {
    ...save,
    meta: {
      ...save.meta,
      wallet: nextWallet,
    },
  };
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v)));
}
