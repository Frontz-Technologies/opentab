// Deterministic PRNG for demo factories. Mulberry32 — 32-bit seed,
// period ~2^32, passes basic statistical tests, zero dependencies.
// Used so every populate produces the same dataset given the same seed
// (screenshots stay consistent, tests can pin on content hashes).
export function createRng(seed: number) {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Float in [0, 1). */
    next,
    /** Integer in [min, max] inclusive. */
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    /** Pick one item from an array. */
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
    /** Pick N distinct items from an array (no replacement). */
    pickN<T>(arr: readonly T[], n: number): T[] {
      const copy = [...arr];
      const out: T[] = [];
      const take = Math.min(n, copy.length);
      for (let i = 0; i < take; i++) {
        const idx = Math.floor(next() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
      }
      return out;
    },
    /** True with probability p. */
    chance(p: number): boolean {
      return next() < p;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
