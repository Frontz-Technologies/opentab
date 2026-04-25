import { describe, it, expect } from "vitest";
import { updateInvoiceNumberingSchema } from "../lib/entities/invoice-sequence";

describe("updateInvoiceNumberingSchema (#138)", () => {
  it("accepts valid simple-mode input (no pattern)", () => {
    const r = updateInvoiceNumberingSchema.safeParse({
      prefix: "INV-",
      digitCount: 4,
      includeYear: true,
      pattern: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pattern).toBeNull();
  });

  it("accepts a valid pattern with {counter:N}", () => {
    const r = updateInvoiceNumberingSchema.safeParse({
      prefix: "INV-",
      digitCount: 4,
      includeYear: false,
      pattern: "{prefix}{year}-{counter:4}",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pattern).toBe("{prefix}{year}-{counter:4}");
  });

  it("rejects a pattern that has no {counter} placeholder", () => {
    const r = updateInvoiceNumberingSchema.safeParse({
      prefix: "INV-",
      digitCount: 4,
      includeYear: false,
      pattern: "{prefix}{year}",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a pattern with counter padding > 10", () => {
    const r = updateInvoiceNumberingSchema.safeParse({
      prefix: "INV-",
      digitCount: 4,
      includeYear: false,
      pattern: "{counter:11}",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing prefix", () => {
    const r = updateInvoiceNumberingSchema.safeParse({
      prefix: "",
      digitCount: 4,
      includeYear: false,
    });
    expect(r.success).toBe(false);
  });

  it("rejects digitCount below 3 or above 10", () => {
    expect(
      updateInvoiceNumberingSchema.safeParse({
        prefix: "X",
        digitCount: 2,
        includeYear: false,
      }).success,
    ).toBe(false);
    expect(
      updateInvoiceNumberingSchema.safeParse({
        prefix: "X",
        digitCount: 11,
        includeYear: false,
      }).success,
    ).toBe(false);
  });
});
