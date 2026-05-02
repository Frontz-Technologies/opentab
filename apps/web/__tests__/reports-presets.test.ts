import { describe, it, expect } from "vitest";
import { getLastYearRange } from "../lib/reports/presets";

describe("getLastYearRange", () => {
  it("returns Jan 1 to Dec 31 of the previous year", () => {
    const today = new Date(2026, 4, 2); // 2026-05-02
    const { start, end } = getLastYearRange(today);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it("handles a leap-year boundary correctly", () => {
    const today = new Date(2025, 0, 5);
    const { start, end } = getLastYearRange(today);
    expect(start.getFullYear()).toBe(2024);
    expect(end.getFullYear()).toBe(2024);
    expect(end.getDate()).toBe(31);
  });

  it("works on Jan 1", () => {
    const today = new Date(2027, 0, 1);
    const { start, end } = getLastYearRange(today);
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2026);
  });

  it("works on Dec 31", () => {
    const today = new Date(2026, 11, 31);
    const { start, end } = getLastYearRange(today);
    expect(start.getFullYear()).toBe(2025);
    expect(end.getFullYear()).toBe(2025);
  });
});
