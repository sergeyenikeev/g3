export type WeightedEntry<T> = { item: T; weight: number };

export type Rng = {
  next: () => number;
  int: (min: number, maxInclusive: number) => number;
  float: (min: number, maxInclusive: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  weightedPick: <T>(entries: readonly WeightedEntry<T>[]) => T;
  shuffleInPlace: <T>(arr: T[]) => void;
};

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number | string): Rng {
  const seedNum = typeof seed === "number" ? (seed >>> 0) : xmur3(seed)();
  const gen = mulberry32(seedNum);

  const rng: Rng = {
    next: () => gen(),
    int: (min: number, maxInclusive: number) => {
      if (!Number.isFinite(min) || !Number.isFinite(maxInclusive)) {
        throw new Error("Rng.int: min/max must be finite numbers");
      }
      if (maxInclusive < min) {
        throw new Error("Rng.int: maxInclusive must be >= min");
      }
      const r = gen();
      const span = maxInclusive - min + 1;
      return min + Math.floor(r * span);
    },
    float: (min: number, maxInclusive: number) => {
      if (!Number.isFinite(min) || !Number.isFinite(maxInclusive)) {
        throw new Error("Rng.float: min/max must be finite numbers");
      }
      if (maxInclusive < min) {
        throw new Error("Rng.float: maxInclusive must be >= min");
      }
      return min + gen() * (maxInclusive - min);
    },
    pick: <T>(arr: readonly T[]) => {
      if (arr.length === 0) throw new Error("Rng.pick: empty array");
      return arr[Math.floor(gen() * arr.length)]!;
    },
    weightedPick: <T>(entries: readonly WeightedEntry<T>[]) => {
      if (entries.length === 0) throw new Error("Rng.weightedPick: empty entries");
      let total = 0;
      for (const e of entries) total += Math.max(0, e.weight);
      if (total <= 0) throw new Error("Rng.weightedPick: total weight <= 0");
      let roll = gen() * total;
      for (const e of entries) {
        const w = Math.max(0, e.weight);
        if (w === 0) continue;
        if (roll < w) return e.item;
        roll -= w;
      }
      return entries[entries.length - 1]!.item;
    },
    shuffleInPlace: <T>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
    },
  };

  return rng;
}

