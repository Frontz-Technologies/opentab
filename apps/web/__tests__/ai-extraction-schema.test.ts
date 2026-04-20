import { describe, it, expect } from "vitest";
import { buildExtractionSchema } from "../lib/expenses/ai-extraction";

describe("buildExtractionSchema (#173)", () => {
  it("does not throw when building with no categories", () => {
    expect(() => buildExtractionSchema([])).not.toThrow();
  });

  it("does not throw when building with a non-empty category list", () => {
    expect(() => buildExtractionSchema(["gr_rent", "gr_other"])).not.toThrow();
  });

  it("accepts a minimal valid payload (all optional fields omitted)", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.vendorName).toBe(null);
      expect(parsed.data.categoryCode).toBe(null);
      expect(parsed.data.lineItems).toEqual([]);
    }
  });

  it("coerces numeric vendor fields to strings", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({
      vendorName: "Acme",
      totalAmount: 99.5,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.totalAmount).toBe("99.5");
    }
  });

  it("accepts a categoryCode that is in the provided list", () => {
    const schema = buildExtractionSchema(["gr_rent", "gr_other"]);
    const parsed = schema.safeParse({ categoryCode: "gr_rent" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a categoryCode that is not in the provided list", () => {
    const schema = buildExtractionSchema(["gr_rent", "gr_other"]);
    const parsed = schema.safeParse({ categoryCode: "hallucinated_code" });
    expect(parsed.success).toBe(false);
  });

  it("accepts null categoryCode even when enum is set", () => {
    const schema = buildExtractionSchema(["gr_rent"]);
    const parsed = schema.safeParse({ categoryCode: null });
    expect(parsed.success).toBe(true);
  });

  it("forces categoryCode to null when no categories are provided", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({ categoryCode: "anything" });
    expect(parsed.success).toBe(false);
  });

  it("coerces line item values to strings with defaults", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({
      lineItems: [{ name: "Coffee", quantity: 2, unitPrice: 3.5 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lineItems[0]).toEqual({
        name: "Coffee",
        quantity: "2",
        unitPrice: "3.5",
        taxRate: "0",
      });
    }
  });
});
