import { describe, expect, it } from "vitest";
import { addEnemyDisruption, createEnemyDisruptionState, resolveEnemyVelocity } from "../../src/game/effects/enemyDisruption";

describe("enemyDisruption", () => {
  it("stacks disruption impulses and keeps the strongest control lock", () => {
    const base = createEnemyDisruptionState();
    const next = addEnemyDisruption(base, 120, -40, 0.08);
    const stacked = addEnemyDisruption(next, 30, 20, 0.04);

    expect(stacked).toEqual({
      impulseX: 150,
      impulseY: -20,
      controlLockSec: 0.08,
    });
  });

  it("suppresses AI steering while control lock is active", () => {
    const disrupted = addEnemyDisruption(createEnemyDisruptionState(), 180, 0, 0.08);
    const resolved = resolveEnemyVelocity(-150, 0, disrupted, 0.016);

    expect(resolved.controlLocked).toBe(true);
    expect(resolved.velocityX).toBe(180);
    expect(resolved.next.impulseX).toBeLessThan(180);
    expect(resolved.next.controlLockSec).toBeLessThan(0.08);
  });

  it("blends back into AI steering after the lock expires", () => {
    const disrupted = {
      impulseX: 90,
      impulseY: 0,
      controlLockSec: 0,
    };
    const resolved = resolveEnemyVelocity(-150, 0, disrupted, 0.016);

    expect(resolved.controlLocked).toBe(false);
    expect(resolved.velocityX).toBe(-60);
    expect(resolved.next.impulseX).toBeLessThan(90);
  });
});
