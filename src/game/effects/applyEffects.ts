import { addAtPath, mulAtPath, setAtPath } from "../../core/deepPath";
import type { Effect } from "../../data/types";

export type PerkState = Record<string, { stacks: number; params?: Record<string, unknown> }>;

export type EffectTargets = {
  config: unknown;
  perks: PerkState;
  heal?: (amount: number) => void;
};

export function applyEffects(targets: EffectTargets, effects: readonly Effect[]): void {
  for (const e of effects) {
    switch (e.op) {
      case "add":
        addAtPath(targets.config, e.path, e.value);
        break;
      case "mul":
        mulAtPath(targets.config, e.path, e.value);
        break;
      case "set":
        setAtPath(targets.config, e.path, e.value);
        break;
      case "heal":
        targets.heal?.(e.value);
        break;
      case "grant_perk": {
        const existing = targets.perks[e.perkId];
        if (existing) {
          existing.stacks += 1;
        } else {
          targets.perks[e.perkId] = { stacks: 1, params: e.params };
        }
        break;
      }
      default: {
        const _exhaustive: never = e;
        throw new Error(`Неизвестный op: ${(e as any).op}`);
      }
    }
  }
}

