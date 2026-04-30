import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  SUPPORTED_CURRENCY_CODES,
} from "../lib/currency/supported";

describe("SUPPORTED_CURRENCIES", () => {
  it("contains EUR (the pivot) plus the 30 ECB-published currencies", () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(31);
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === "EUR")).toBeDefined();
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === "USD")).toBeDefined();
    expect(SUPPORTED_CURRENCIES.find((c) => c.code === "TRY")).toBeDefined();
  });

  it("does not include Gulf currencies (Frankfurter doesn't cover them)", () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).not.toContain("SAR");
    expect(codes).not.toContain("AED");
    expect(codes).not.toContain("KWD");
  });

  it("isSupportedCurrency() recognises a code in the set", () => {
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("XXX")).toBe(false);
  });

  it("SUPPORTED_CURRENCY_CODES is the typed code list (Zod-friendly)", () => {
    expect(SUPPORTED_CURRENCY_CODES).toContain("EUR");
    expect(SUPPORTED_CURRENCY_CODES.length).toBe(31);
  });
});
