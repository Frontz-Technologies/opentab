import { describe, it, expect } from "vitest";
import { createRng } from "../lib/demo/rng";

describe("createRng (#119)", () => {
  it("produces the same sequence given the same seed", () => {
    const a = createRng(0xdeadbeef);
    const b = createRng(0xdeadbeef);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("diverges across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    let anyDiff = false;
    for (let i = 0; i < 100; i++) {
      if (a.next() !== b.next()) anyDiff = true;
    }
    expect(anyDiff).toBe(true);
  });

  it("int() stays within inclusive bounds", () => {
    const r = createRng(42);
    for (let i = 0; i < 500; i++) {
      const v = r.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("pickN returns requested count without duplicates", () => {
    const r = createRng(7);
    const src = ["a", "b", "c", "d", "e"];
    const out = r.pickN(src, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect(src).toContain(v);
  });

  it("pickN clamps when n exceeds array length", () => {
    const r = createRng(7);
    const src = ["a", "b", "c"];
    const out = r.pickN(src, 10);
    expect(out).toHaveLength(3);
  });

  it("chance() is deterministic", () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) {
      expect(a.chance(0.5)).toBe(b.chance(0.5));
    }
  });
});
