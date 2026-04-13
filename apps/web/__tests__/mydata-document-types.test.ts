import { describe, it, expect } from "vitest";
import { resolveDocumentType } from "../lib/mydata/document-types";
import { resolveClassification } from "../lib/mydata/classification-codes";

describe("resolveDocumentType", () => {
  it("Greek B2B service → 2.1", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: "123456789",
        isService: true,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("2.1");
  });

  it("Greek B2B goods → 1.1", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: "123456789",
        isService: false,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("1.1");
  });

  it("EU B2B service → 2.2", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "DE",
        contactVatNumber: "DE123456789",
        isService: true,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("2.2");
  });

  it("EU B2B goods → 1.2", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "FR",
        contactVatNumber: "FR12345678901",
        isService: false,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("1.2");
  });

  it("third country service → 2.3", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "US",
        contactVatNumber: "US12345",
        isService: true,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("2.3");
  });

  it("third country goods → 1.3", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "JP",
        contactVatNumber: "JP12345",
        isService: false,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("1.3");
  });

  it("B2C service (no VAT) → 11.2", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: null,
        isService: true,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("11.2");
  });

  it("B2C goods (no VAT) → 11.1", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: null,
        isService: false,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("11.1");
  });

  it("credit note linked → 5.1", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: "123456789",
        isService: true,
        isCreditNote: true,
        relatedInvoiceId: "some-id",
      }),
    ).toBe("5.1");
  });

  it("credit note standalone → 5.2", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: "GR",
        contactVatNumber: "123456789",
        isService: true,
        isCreditNote: true,
        relatedInvoiceId: null,
      }),
    ).toBe("5.2");
  });

  it("null country defaults to Greek", () => {
    expect(
      resolveDocumentType({
        contactCountryCode: null,
        contactVatNumber: "123456789",
        isService: true,
        isCreditNote: false,
        relatedInvoiceId: null,
      }),
    ).toBe("2.1");
  });
});

describe("resolveClassification", () => {
  it("service invoice 2.1 → category1_3, E3_561_001", () => {
    const result = resolveClassification("2.1", true);
    expect(result.category).toBe("category1_3");
    expect(result.type).toBe("E3_561_001");
  });

  it("goods invoice 1.1 → category1_1, E3_561_001", () => {
    const result = resolveClassification("1.1", false);
    expect(result.category).toBe("category1_1");
    expect(result.type).toBe("E3_561_001");
  });

  it("intra-community goods 1.2 → E3_561_003", () => {
    const result = resolveClassification("1.2", false);
    expect(result.type).toBe("E3_561_003");
  });

  it("retail service 11.2 → category1_3, E3_561_002", () => {
    const result = resolveClassification("11.2", true);
    expect(result.category).toBe("category1_3");
    expect(result.type).toBe("E3_561_002");
  });

  it("unknown document type falls back to default", () => {
    const result = resolveClassification("99.9", true);
    expect(result.category).toBe("category1_3");
    expect(result.type).toBe("E3_561_001");
  });
});
