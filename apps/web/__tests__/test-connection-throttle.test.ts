import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { throttleTestConnection } from "../lib/country/test-connection-throttle";

describe("throttleTestConnection", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("allows the first call (no prior timestamp)", () => {
    expect(throttleTestConnection(null)).toBeNull();
  });

  it("throttles calls within the 15s window", () => {
    const fiveSecAgo = new Date(Date.now() - 5_000);
    expect(throttleTestConnection(fiveSecAgo)).toMatch(/wait \d+s/);
  });

  it("allows calls after 15s have elapsed", () => {
    const sixteenSecAgo = new Date(Date.now() - 16_000);
    expect(throttleTestConnection(sixteenSecAgo)).toBeNull();
  });

  it("allows calls exactly at the boundary", () => {
    const exactly15SecAgo = new Date(Date.now() - 15_000);
    expect(throttleTestConnection(exactly15SecAgo)).toBeNull();
  });
});
