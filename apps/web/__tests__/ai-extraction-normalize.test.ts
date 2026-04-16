import { describe, it, expect } from "vitest";
import {
  parseExtractionResponse,
  getExtractionStrategy,
} from "../lib/expenses/ai-extraction";

describe("parseExtractionResponse", () => {
  it("parses Format A (nested) correctly", () => {
    const raw = {
      vendorName: { value: "Acme", confidence: 0.95 },
      vendorVat: { value: "EL123456789", confidence: 0.9 },
      date: { value: "2026-04-10", confidence: 0.85 },
      totalAmount: { value: "124.00", confidence: 0.92 },
      currency: { value: "EUR", confidence: 0.99 },
      description: { value: "Office supplies", confidence: 0.7 },
      category: { value: "office_supplies", confidence: 0.8 },
    };

    const result = parseExtractionResponse(raw);
    expect(result.vendorName).toBe("Acme");
    expect(result.vendorVat).toBe("EL123456789");
    expect(result.totalAmount).toBe("124.00");
    expect(result.confidence.vendorName).toBe(0.95);
    expect(result.confidence.currency).toBe(0.99);
  });

  it("parses Format B (flat) correctly", () => {
    const raw = {
      vendorName: "Acme",
      vendorName_confidence: 0.95,
      vendorVat: "EL123456789",
      vendorVat_confidence: 0.9,
      date: "2026-04-10",
      date_confidence: 0.85,
      totalAmount: "124.00",
      totalAmount_confidence: 0.92,
      currency: "EUR",
      currency_confidence: 0.99,
      description: "Office supplies",
      description_confidence: 0.7,
      category: "office_supplies",
      category_confidence: 0.8,
    };

    const result = parseExtractionResponse(raw);
    expect(result.vendorName).toBe("Acme");
    expect(result.totalAmount).toBe("124.00");
    expect(result.confidence.vendorName).toBe(0.95);
    expect(result.confidence.totalAmount).toBe(0.92);
  });

  it("returns null for missing fields", () => {
    const raw = {
      vendorName: "Acme",
      vendorName_confidence: 0.9,
    };

    const result = parseExtractionResponse(raw);
    expect(result.vendorName).toBe("Acme");
    expect(result.vendorVat).toBeNull();
    expect(result.date).toBeNull();
    expect(result.totalAmount).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.description).toBeNull();
    expect(result.category).toBeNull();
  });

  it("handles mixed formats (some nested, some flat)", () => {
    const raw = {
      vendorName: { value: "Mixed Corp", confidence: 0.88 },
      totalAmount: "250.00",
      totalAmount_confidence: 0.91,
      currency: { value: "USD", confidence: 0.95 },
    };

    const result = parseExtractionResponse(raw);
    expect(result.vendorName).toBe("Mixed Corp");
    expect(result.confidence.vendorName).toBe(0.88);
    expect(result.totalAmount).toBe("250.00");
    expect(result.confidence.totalAmount).toBe(0.91);
    expect(result.currency).toBe("USD");
    expect(result.confidence.currency).toBe(0.95);
  });

  it("defaults confidence to 0 when missing", () => {
    const raw = {
      vendorName: "No Confidence Corp",
      totalAmount: { value: "100.00" },
    };

    const result = parseExtractionResponse(raw);
    expect(result.vendorName).toBe("No Confidence Corp");
    expect(result.confidence.vendorName).toBe(0);
    expect(result.totalAmount).toBe("100.00");
    expect(result.confidence.totalAmount).toBe(0);
  });

  it("parses lineItems array", () => {
    const raw = {
      vendorName: "Shop",
      vendorName_confidence: 0.9,
      lineItems: [
        { name: "Widget", quantity: "2", unitPrice: "10.00", taxRate: "24" },
        { name: "Gadget", quantity: "1", unitPrice: "50.00", taxRate: "24" },
      ],
    };

    const result = parseExtractionResponse(raw);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toEqual({
      name: "Widget",
      quantity: "2",
      unitPrice: "10.00",
      taxRate: "24",
    });
    expect(result.lineItems[1]).toEqual({
      name: "Gadget",
      quantity: "1",
      unitPrice: "50.00",
      taxRate: "24",
    });
  });

  it("returns empty lineItems when not provided", () => {
    const raw = {
      vendorName: "Shop",
      vendorName_confidence: 0.9,
    };

    const result = parseExtractionResponse(raw);
    expect(result.lineItems).toEqual([]);
  });

  it("handles lineItems with missing fields using defaults", () => {
    const raw = {
      lineItems: [{ name: "Partial item" }, { unitPrice: "5.00" }],
    };

    const result = parseExtractionResponse(raw);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toEqual({
      name: "Partial item",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
    });
    expect(result.lineItems[1]).toEqual({
      name: "",
      quantity: "1",
      unitPrice: "5.00",
      taxRate: "0",
    });
  });

  it("ignores non-array lineItems", () => {
    const raw = {
      lineItems: "not an array",
    };

    const result = parseExtractionResponse(raw);
    expect(result.lineItems).toEqual([]);
  });
});

describe("getExtractionStrategy", () => {
  it("returns 'file' for PDF when model supports file", () => {
    const caps = { text: true, image: true, file: true };
    expect(getExtractionStrategy("application/pdf", caps)).toBe("file");
  });

  it("returns 'image' for PDF when model supports image but not file", () => {
    const caps = { text: true, image: true, file: false };
    expect(getExtractionStrategy("application/pdf", caps)).toBe("image");
  });

  it("returns null for PDF when model supports neither image nor file", () => {
    const caps = { text: true, image: false, file: false };
    expect(getExtractionStrategy("application/pdf", caps)).toBeNull();
  });

  it("returns 'image' for image files when model supports image", () => {
    const caps = { text: true, image: true, file: false };
    expect(getExtractionStrategy("image/png", caps)).toBe("image");
    expect(getExtractionStrategy("image/jpeg", caps)).toBe("image");
  });

  it("returns null for image files when model has no image support", () => {
    const caps = { text: true, image: false, file: false };
    expect(getExtractionStrategy("image/png", caps)).toBeNull();
  });

  it("returns null for unsupported file types", () => {
    const caps = { text: true, image: true, file: true };
    expect(getExtractionStrategy("text/plain", caps)).toBeNull();
  });
});
