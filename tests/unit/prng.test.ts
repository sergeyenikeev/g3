import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/prng";

describe("createRng", () => {
  it("детерминирован для одинакового seed", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("разные seed дают разные последовательности", () => {
    const a = createRng("seed-a");
    const b = createRng("seed-b");
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("int выдаёт значения в диапазоне", () => {
    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(2, 4);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
});

