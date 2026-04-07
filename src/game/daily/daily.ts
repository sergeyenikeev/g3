import { createRng } from "../../core/prng";
import { applyEffects, type PerkState } from "../effects/applyEffects";
import type { DailyConfig, Effect } from "../../data/types";

export type DailySelection = {
  dateUtc: string;
  variantId: string;
  specialRule?: Record<string, unknown>;
};

export function getUtcYyyymmdd(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function pickDailyVariant(cfg: DailyConfig, dateUtc: string): DailySelection {
  const rng = createRng(`daily:${dateUtc}`);
  const activeRotation =
    cfg.rotations?.find((rotation) => rotation.fromDateUtc <= dateUtc && dateUtc <= rotation.toDateUtc) ?? null;
  const allowedIds = activeRotation?.variantIds?.length ? new Set(activeRotation.variantIds) : null;
  const pool = allowedIds ? cfg.dailyVariants.filter((variant) => allowedIds.has(variant.id)) : cfg.dailyVariants;
  const entries = (pool.length > 0 ? pool : cfg.dailyVariants).map((v) => ({ item: v, weight: v.weight }));
  const variant = rng.weightedPick(entries);
  return { dateUtc, variantId: variant.id, specialRule: variant.specialRule as any };
}

export function applyDailyToConfig(cfg: unknown, perks: PerkState, dailyCfg: DailyConfig, sel: DailySelection): void {
  const variant = dailyCfg.dailyVariants.find((v) => v.id === sel.variantId);
  if (!variant) return;
  const effects = variant.modifiers as unknown as Effect[];
  applyEffects({ config: cfg, perks }, effects);
}
