import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/entities/product";

const validProduct = {
  name: "Consulting Hour",
  unitPrice: "100",
  unit: "hour" as const,
  taxCategory: "standard" as const,
};

describe("product entity schemas", () => {
  it("createProductSchema accepts a minimal valid payload", () => {
    const parsed = createProductSchema.safeParse(validProduct);
    expect(parsed.success).toBe(true);
  });

  it("createProductSchema rejects a negative unit price", () => {
    const parsed = createProductSchema.safeParse({
      ...validProduct,
      unitPrice: "-1",
    });
    expect(parsed.success).toBe(false);
  });

  it("updateProductSchema matches createProductSchema behaviour", () => {
    expect(updateProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects an unknown tax category enum", () => {
    const parsed = createProductSchema.safeParse({
      ...validProduct,
      taxCategory: "nonsense",
    });
    expect(parsed.success).toBe(false);
  });
});
