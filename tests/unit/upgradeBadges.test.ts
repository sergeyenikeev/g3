import { describe, expect, it } from "vitest";
import { getDashHudBadgeSpecs, getUpgradeBadgeSpecs } from "../../src/game/upgrades/upgradeBadges";
import type { RunUpgradeDef } from "../../src/data/types";

describe("upgradeBadges", () => {
  it("prioritizes dash branch badges on upgrade cards", () => {
    const upgrade: RunUpgradeDef = {
      id: "ion_ram",
      name: "Ion Ram",
      rarity: "rare",
      weight: 10,
      maxStacks: 1,
      tags: ["dash", "combat", "flip"],
      effects: [],
    };

    const badges = getUpgradeBadgeSpecs("en", upgrade);

    expect(badges.map((badge) => badge.key)).toEqual(["ion", "dash", "combat"]);
  });

  it("localizes short badge labels", () => {
    const upgrade: RunUpgradeDef = {
      id: "salvage_siphon",
      name: "Salvage Siphon",
      rarity: "rare",
      weight: 10,
      maxStacks: 1,
      tags: ["dash", "collection", "economy"],
      effects: [],
    };

    const badges = getUpgradeBadgeSpecs("ru", upgrade);

    expect(badges[0]?.label).toBe("СИФОН");
    expect(badges[1]?.label).toBe("РЫВОК");
  });

  it("prefers finisher badges in the dash HUD", () => {
    const badges = getDashHudBadgeSpecs("en", {
      dash_module: true,
      dash_ram: true,
      dash_wake: true,
      dash_arc: true,
      dash_siphon: true,
    });

    expect(badges.map((badge) => badge.key)).toEqual(["ion", "siphon"]);
  });
});
