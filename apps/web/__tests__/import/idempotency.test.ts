import { describe, it, expect } from "vitest";
import { computeIdempotencyKey } from "../../lib/import/core/idempotency";

describe("computeIdempotencyKey (#215)", () => {
  it("is deterministic across calls", () => {
    const a = computeIdempotencyKey(["org-1", "ada@example.com"]);
    const b = computeIdempotencyKey(["org-1", "ada@example.com"]);
    expect(a).toBe(b);
  });

  it("differs when any part differs", () => {
    const a = computeIdempotencyKey(["org-1", "ada@example.com"]);
    const b = computeIdempotencyKey(["org-1", "grace@example.com"]);
    expect(a).not.toBe(b);
  });

  it("returns a hex string of consistent length (sha256 = 64)", () => {
    const k = computeIdempotencyKey(["org-1", "ada@example.com"]);
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });

  it("treats parts as a tuple (different ordering = different key)", () => {
    const a = computeIdempotencyKey(["a", "b"]);
    const b = computeIdempotencyKey(["b", "a"]);
    expect(a).not.toBe(b);
  });
});
