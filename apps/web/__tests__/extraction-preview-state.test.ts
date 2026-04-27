import { describe, it, expect } from "vitest";
import {
  acceptExtractionPreview,
  type CurrentFormState,
  type ExtractedData,
} from "@/lib/expenses/extraction-preview-state";
import type { LineItem } from "@/components/invoicing/line-items-builder";

const baseState: CurrentFormState = {
  contactId: "",
  supplierName: "",
  expenseDate: "2026-04-27",
  currencyCode: "EUR",
  description: "",
  categoryId: "",
  items: [],
};

const baseExtraction: ExtractedData = {
  vendorName: null,
  date: null,
  currency: null,
  description: null,
  categoryId: null,
  totalAmount: null,
  lineItems: [],
};

describe("acceptExtractionPreview", () => {
  it("returns empty preview state when extraction has no data", () => {
    const result = acceptExtractionPreview({
      state: baseState,
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: baseExtraction,
      builtItems: [],
    });

    expect(result.previewFields.size).toBe(0);
    expect(result.previewLineItems.size).toBe(0);
    expect(result.snapshot).toEqual({});
    expect(result.nextState).toEqual(baseState);
  });

  it("previews supplierName when vendor present and no contactId set", () => {
    const result = acceptExtractionPreview({
      state: baseState,
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: { ...baseExtraction, vendorName: "Acme Inc" },
      builtItems: [],
    });

    expect(result.previewFields.has("supplierName")).toBe(true);
    expect(result.previewFields.has("contactId")).toBe(false);
    expect(result.snapshot.supplierName).toBe("");
    expect(result.nextState.supplierName).toBe("Acme Inc");
  });

  it("previews contactId from supplierMatch (not supplierName)", () => {
    const result = acceptExtractionPreview({
      state: baseState,
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: { contactId: "contact-uuid-1" },
      data: { ...baseExtraction, vendorName: "Acme Inc" },
      builtItems: [],
    });

    expect(result.previewFields.has("contactId")).toBe(true);
    expect(result.previewFields.has("supplierName")).toBe(false);
    expect(result.snapshot.contactId).toBe("");
    expect(result.nextState.contactId).toBe("contact-uuid-1");
  });

  it("does not preview vendorName→supplierName when contactId is already set", () => {
    const result = acceptExtractionPreview({
      state: { ...baseState, contactId: "user-picked-uuid" },
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: { ...baseExtraction, vendorName: "Acme Inc" },
      builtItems: [],
    });

    expect(result.previewFields.size).toBe(0);
    expect(result.nextState.supplierName).toBe("");
  });

  it("previews currency only when currencyCode equals defaultCurrency", () => {
    const userPickedCurrency = acceptExtractionPreview({
      state: { ...baseState, currencyCode: "USD" },
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: { ...baseExtraction, currency: "GBP" },
      builtItems: [],
    });
    expect(userPickedCurrency.previewFields.has("currencyCode")).toBe(false);
    expect(userPickedCurrency.nextState.currencyCode).toBe("USD");

    const stillDefault = acceptExtractionPreview({
      state: baseState,
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: { ...baseExtraction, currency: "GBP" },
      builtItems: [],
    });
    expect(stillDefault.previewFields.has("currencyCode")).toBe(true);
    expect(stillDefault.nextState.currencyCode).toBe("GBP");
    expect(stillDefault.snapshot.currencyCode).toBe("EUR");
  });

  it("previews line items when items[] is empty and builtItems is non-empty", () => {
    const built: LineItem[] = [
      {
        id: "item-1",
        productId: "",
        sortOrder: 0,
        name: "Coffee",
        description: "",
        quantity: "1",
        unitPrice: "3.00",
        unit: "",
        taxCategory: "standard",
        taxRate: "24.00",
        taxAmount: "0.72",
        lineTotal: "3.72",
      },
    ];
    const result = acceptExtractionPreview({
      state: baseState,
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: baseExtraction,
      builtItems: built,
    });

    expect(result.previewLineItems.has("item-1")).toBe(true);
    expect(result.nextState.items).toEqual(built);
  });

  it("does not preview line items when items[] is already non-empty", () => {
    const existingItem: LineItem = {
      id: "user-item",
      productId: "",
      sortOrder: 0,
      name: "User-typed",
      description: "",
      quantity: "1",
      unitPrice: "1.00",
      unit: "",
      taxCategory: "standard",
      taxRate: "24.00",
      taxAmount: "0.24",
      lineTotal: "1.24",
    };
    const result = acceptExtractionPreview({
      state: { ...baseState, items: [existingItem] },
      defaultCurrency: "EUR",
      defaultTaxRate: "24.00",
      usesInclusiveTax: false,
      supplierMatch: null,
      data: baseExtraction,
      builtItems: [
        {
          ...existingItem,
          id: "ai-item",
          name: "AI-built",
        },
      ],
    });

    expect(result.previewLineItems.size).toBe(0);
    expect(result.nextState.items).toEqual([existingItem]);
  });
});
