import { describe, expect, it } from "vitest";
import { applyEffects, type PerkState } from "../../src/game/effects/applyEffects";
import type { Effect } from "../../src/data/types";

describe("applyEffects", () => {
  it("применяет add/mul/set и вызывает heal/grant_perk", () => {
    const cfg = {
      magnet: { radiusBase: 100 },
      player: { hpMax: 50 },
      flip: { shrapnel: { enabled: false } },
    };
    const perks: PerkState = {};
    let hp = 10;

    const effects: Effect[] = [
      { op: "mul", path: "magnet.radiusBase", value: 1.1 },
      { op: "add", path: "player.hpMax", value: 10 },
      { op: "set", path: "flip.shrapnel.enabled", value: true },
      { op: "grant_perk", perkId: "test_perk", params: { a: 1 } },
      { op: "heal", value: 5 },
    ];

    applyEffects({ config: cfg, perks, heal: (v) => (hp += v) }, effects);

    expect(cfg.magnet.radiusBase).toBeCloseTo(110);
    expect(cfg.player.hpMax).toBe(60);
    expect(cfg.flip.shrapnel.enabled).toBe(true);
    expect(perks.test_perk).toEqual({ stacks: 1, params: { a: 1 } });
    expect(hp).toBe(15);
  });

  it("grant_perk увеличивает stacks", () => {
    const cfg = { player: { hpMax: 100 } };
    const perks: PerkState = {};
    applyEffects({ config: cfg, perks }, [{ op: "grant_perk", perkId: "p" }]);
    applyEffects({ config: cfg, perks }, [{ op: "grant_perk", perkId: "p" }]);
    expect(perks.p?.stacks).toBe(2);
  });
});

