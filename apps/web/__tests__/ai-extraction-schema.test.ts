import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  buildExtractionSchema,
  normalizeExtractedData,
} from "../lib/expenses/ai-extraction";

// AI SDK v6 calls zod v4's `z.toJSONSchema()` under the hood when a Zod
// schema is passed to `generateObject({ schema })`. Any feature the
// converter cannot represent (e.g. `.transform()`) makes the whole call
// throw before any network request. These tests pin that the extraction
// schema is always JSON-Schema-convertible.
const toJsonSchema = (s: unknown): unknown =>
  (z as unknown as { toJSONSchema: (s: unknown) => unknown }).toJSONSchema(s);

describe("buildExtractionSchema", () => {
  it("does not throw when building with no categories", () => {
    expect(() => buildExtractionSchema([])).not.toThrow();
  });

  it("does not throw when building with a non-empty category list", () => {
    expect(() => buildExtractionSchema(["gr_rent", "gr_other"])).not.toThrow();
  });

  it("converts cleanly via zod v4 toJSONSchema (empty categories)", () => {
    expect(() => toJsonSchema(buildExtractionSchema([]))).not.toThrow();
  });

  it("converts cleanly via zod v4 toJSONSchema (with categories)", () => {
    expect(() =>
      toJsonSchema(buildExtractionSchema(["gr_rent", "gr_other", "gr_travel"])),
    ).not.toThrow();
  });

  it("accepts a minimal valid payload (all optional fields omitted)", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts numeric fields without requiring a string", () => {
    const schema = buildExtractionSchema([]);
    const parsed = schema.safeParse({
      vendorName: "Acme",
      totalAmount: 99.5,
    });
    expect(parsed.success).toBe(true);
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
});

describe("normalizeExtractedData", () => {
  it("coerces numeric values to strings and keeps nulls", () => {
    const out = normalizeExtractedData({
      vendorName: "Acme",
      totalAmount: 99.5,
      vendorVat: null,
    });
    expect(out.vendorName).toBe("Acme");
    expect(out.totalAmount).toBe("99.5");
    expect(out.vendorVat).toBe(null);
    expect(out.lineItems).toEqual([]);
  });

  it("maps line-item numeric values to strings with defaults", () => {
    const out = normalizeExtractedData({
      lineItems: [
        { name: "Coffee", quantity: 2, unitPrice: 3.5, taxRate: null },
      ],
    });
    expect(out.lineItems).toEqual([
      { name: "Coffee", quantity: "2", unitPrice: "3.5", taxRate: "0" },
    ]);
  });

  it("produces all-nulls and empty list for an empty input", () => {
    const out = normalizeExtractedData({});
    expect(out).toEqual({
      vendorName: null,
      vendorVat: null,
      date: null,
      totalAmount: null,
      currency: null,
      description: null,
      categoryCode: null,
      lineItems: [],
    });
  });

  it("passes categoryCode through unchanged", () => {
    expect(
      normalizeExtractedData({ categoryCode: "gr_rent" }).categoryCode,
    ).toBe("gr_rent");
    expect(normalizeExtractedData({ categoryCode: null }).categoryCode).toBe(
      null,
    );
  });
});
