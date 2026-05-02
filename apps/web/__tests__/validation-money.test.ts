import { describe, it, expect } from "vitest";
import {
  normalizeMoneyString,
  moneyString,
  taxRateString,
  quantityString,
  localizeSeparators,
} from "../lib/validation/money";

describe("normalizeMoneyString", () => {
  it("rounds >2-decimal values to 2 decimals when maxDecimals=2", () => {
    expect(normalizeMoneyString(0.9975, "0", 2)).toBe("1");
  });
  it("rounds >4-decimal values to 4 decimals when maxDecimals=4", () => {
    expect(normalizeMoneyString(1.123456, "1", 4)).toBe("1.1235");
  });
  it("converts comma decimal separator to period", () => {
    expect(normalizeMoneyString("3,99", "0", 2)).toBe("3.99");
  });
  it("strips trailing currency symbols", () => {
    expect(normalizeMoneyString("3.99 €", "0", 2)).toBe("3.99");
  });
  it("strips leading currency symbols", () => {
    expect(normalizeMoneyString("$ 12.50", "0", 2)).toBe("12.5");
  });
  it("falls back to default for unparseable strings", () => {
    expect(normalizeMoneyString("not a price", "0", 2)).toBe("0");
  });
  it("falls back to default for negative numbers", () => {
    expect(normalizeMoneyString(-5, "0", 2)).toBe("0");
  });
  it("falls back to default for non-finite numbers", () => {
    expect(normalizeMoneyString(Number.NaN, "0", 2)).toBe("0");
    expect(normalizeMoneyString(Number.POSITIVE_INFINITY, "0", 2)).toBe("0");
  });
  it("preserves clean numeric input as-is", () => {
    expect(normalizeMoneyString(12.5, "0", 2)).toBe("12.5");
    expect(normalizeMoneyString(24, "0", 2)).toBe("24");
  });
  it("returns fallback for null/undefined input", () => {
    expect(normalizeMoneyString(null, "1", 4)).toBe("1");
    expect(normalizeMoneyString(undefined, "1", 4)).toBe("1");
  });
});

describe("moneyString / taxRateString / quantityString Zod helpers", () => {
  it("moneyString accepts a clean 2dp string (trailing zero dropped to satisfy the regex)", () => {
    expect(moneyString.parse("12.50")).toBe("12.5");
  });
  it("moneyString normalizes a comma-decimal string before validation", () => {
    expect(moneyString.parse("12,50")).toBe("12.5");
  });
  it("moneyString rounds >2dp before validation", () => {
    expect(moneyString.parse("0.9975")).toBe("1");
  });
  it("moneyString falls back to 0 for negative/garbage", () => {
    expect(moneyString.parse("-5")).toBe("0");
    expect(moneyString.parse("garbage")).toBe("0");
  });
  it("quantityString allows up to 4 decimals and falls back to 1", () => {
    expect(quantityString.parse("2.5")).toBe("2.5");
    expect(quantityString.parse("1.12345")).toBe("1.1235");
    expect(quantityString.parse("garbage")).toBe("1");
  });
  it("taxRateString allows 2dp and falls back to 0", () => {
    expect(taxRateString.parse("24")).toBe("24");
    expect(taxRateString.parse("13.5")).toBe("13.5");
    expect(taxRateString.parse("garbage")).toBe("0");
  });
});

describe("localizeSeparators", () => {
  it("returns canonical us format unchanged", () => {
    expect(localizeSeparators("1,234.56", "us")).toBe("1,234.56");
  });
  it("rewrites us → eu", () => {
    expect(localizeSeparators("1,234.56", "eu")).toBe("1.234,56");
  });
  it("rewrites us → fr (narrow no-break space thousand)", () => {
    expect(localizeSeparators("1,234.56", "fr")).toBe("1 234,56");
  });
  it("handles values with no thousand separator", () => {
    expect(localizeSeparators("234.56", "eu")).toBe("234,56");
  });
  it("handles values with no decimal", () => {
    expect(localizeSeparators("1,234", "eu")).toBe("1.234");
  });
});
