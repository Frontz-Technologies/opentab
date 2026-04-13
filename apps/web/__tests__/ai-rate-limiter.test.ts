import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/ai/rate-limiter";

describe("AI rate limiter", () => {
  it("blocks after the configured limit", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });

    expect(limiter.check("user-1").allowed).toBe(true);
    expect(limiter.check("user-1").allowed).toBe(true);
    expect(limiter.check("user-1").allowed).toBe(false);
  });
});
