import { describe, it, expect } from "vitest";
import { buildInvoicesDoc } from "../lib/mydata/xml-builder";
import type { MyDataInvoice } from "../lib/mydata/types";

function makeInvoice(overrides: Partial<MyDataInvoice> = {}): MyDataInvoice {
  return {
    issuer: { vatNumber: "123456789", country: "GR", branch: 0 },
    counterpart: { vatNumber: "987654321", country: "GR", branch: 0 },
    invoiceHeader: {
      series: "ΤΠΥ",
      aa: "2026-0042",
      issueDate: "2026-04-12",
      invoiceType: "2.1",
      currency: "EUR",
    },
    paymentMethods: [{ type: 5, amount: "1240.00" }],
    invoiceDetails: [
      {
        lineNumber: 1,
        netValue: "1000.00",
        vatCategory: 1,
        vatAmount: "240.00",
        incomeClassification: {
          classificationType: "E3_561_001",
          classificationCategory: "category1_1",
          amount: "1000.00",
        },
      },
    ],
    invoiceSummary: {
      totalNetValue: "1000.00",
      totalVatAmount: "240.00",
      totalWithheldAmount: "0.00",
      totalFeesAmount: "0.00",
      totalStampDutyAmount: "0.00",
      totalOtherTaxesAmount: "0.00",
      totalDeductionsAmount: "0.00",
      totalGrossValue: "1240.00",
      incomeClassification: {
        classificationType: "E3_561_001",
        classificationCategory: "category1_1",
        amount: "1000.00",
      },
    },
    ...overrides,
  };
}

describe("mydata xml-builder", () => {
  it("builds valid InvoicesDoc XML", () => {
    const xml = buildInvoicesDoc([makeInvoice()]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"',
    );
    expect(xml).toContain("<vatNumber>123456789</vatNumber>");
    expect(xml).toContain("<vatNumber>987654321</vatNumber>");
    expect(xml).toContain("<invoiceType>2.1</invoiceType>");
    expect(xml).toContain("<netValue>1000.00</netValue>");
    expect(xml).toContain("<totalGrossValue>1240.00</totalGrossValue>");
  });

  it("includes income classification", () => {
    const xml = buildInvoicesDoc([makeInvoice()]);

    expect(xml).toContain(
      "<icls:classificationType>E3_561_001</icls:classificationType>",
    );
    expect(xml).toContain(
      "<icls:classificationCategory>category1_1</icls:classificationCategory>",
    );
  });

  it("handles B2C invoice without counterpart", () => {
    const xml = buildInvoicesDoc([
      makeInvoice({
        counterpart: undefined,
        invoiceHeader: {
          series: "ΑΠΥ",
          aa: "2026-0001",
          issueDate: "2026-04-12",
          invoiceType: "11.2",
          currency: "EUR",
        },
      }),
    ]);

    expect(xml).not.toContain("<counterpart>");
    expect(xml).toContain("<invoiceType>11.2</invoiceType>");
  });

  it("handles multiple invoices", () => {
    const xml = buildInvoicesDoc([makeInvoice(), makeInvoice()]);

    const invoiceCount = (xml.match(/<invoice>/g) ?? []).length;
    expect(invoiceCount).toBe(2);
  });

  it("escapes special characters in XML", () => {
    const xml = buildInvoicesDoc([
      makeInvoice({
        invoiceHeader: {
          series: "A&B",
          aa: '<test>"value"',
          issueDate: "2026-04-12",
          invoiceType: "2.1",
          currency: "EUR",
        },
      }),
    ]);

    expect(xml).toContain("<series>A&amp;B</series>");
    expect(xml).toContain("<aa>&lt;test&gt;&quot;value&quot;</aa>");
  });

  it("includes payment methods", () => {
    const xml = buildInvoicesDoc([
      makeInvoice({
        paymentMethods: [
          { type: 3, amount: "500.00" },
          { type: 7, amount: "740.00" },
        ],
      }),
    ]);

    expect(xml).toContain("<type>3</type>");
    expect(xml).toContain("<type>7</type>");
    expect(xml).toContain("<amount>500.00</amount>");
    expect(xml).toContain("<amount>740.00</amount>");
  });
});
