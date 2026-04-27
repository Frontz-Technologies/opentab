import { describe, it, expect } from "vitest";
import { formatCard } from "@/lib/import/preview-formatter";

describe("formatCard", () => {
  it("formats invoices with number · contact then total · issue date", () => {
    expect(
      formatCard("invoices", {
        invoiceNumber: "INV-2026-001",
        contactName: "Acme Corp",
        total: "1200.50",
        currencyCode: "EUR",
        issueDate: "2026-04-27",
      }),
    ).toEqual({
      primary: "INV-2026-001 · Acme Corp",
      secondary: ["1,200.50 EUR", "2026-04-27"],
    });
  });

  it("formats contacts with company · country · email", () => {
    expect(
      formatCard("contacts", {
        company: "Acme Corp",
        countryCode: "GR",
        email: "billing@acme.example",
      }),
    ).toEqual({
      primary: "Acme Corp",
      secondary: ["GR", "billing@acme.example"],
    });
  });

  it("falls back to firstName lastName when company is missing", () => {
    expect(
      formatCard("contacts", {
        firstName: "John",
        lastName: "Frontzos",
        countryCode: "GR",
      }),
    ).toEqual({
      primary: "John Frontzos",
      secondary: ["GR"],
    });
  });

  it("formats expenses with supplier · total · expenseDate", () => {
    expect(
      formatCard("expenses", {
        supplierName: "Hetzner",
        total: "120.00",
        currencyCode: "EUR",
        expenseDate: "2026-04-15",
      }),
    ).toEqual({
      primary: "Hetzner",
      secondary: ["120.00 EUR", "2026-04-15"],
    });
  });

  it("formats credit-notes with number · contact · total · issue date", () => {
    expect(
      formatCard("credit-notes", {
        creditNoteNumber: "CN-2026-001",
        contactName: "Acme Corp",
        total: "300.00",
        currencyCode: "EUR",
        issueDate: "2026-04-20",
      }),
    ).toEqual({
      primary: "CN-2026-001 · Acme Corp",
      secondary: ["300.00 EUR", "2026-04-20"],
    });
  });

  it("falls back to first 3 mapped values for unknown entity", () => {
    expect(
      formatCard("nonexistent" as never, {
        a: "x",
        b: "y",
        c: "z",
        d: "w",
      }),
    ).toEqual({
      primary: "x",
      secondary: ["y", "z"],
    });
  });

  it("omits empty / undefined values from secondary", () => {
    expect(
      formatCard("invoices", {
        invoiceNumber: "INV-1",
        contactName: "",
        total: "",
        issueDate: "",
      }),
    ).toEqual({
      primary: "INV-1",
      secondary: [],
    });
  });

  it("formats numeric strings with thousand separators when amount field", () => {
    expect(
      formatCard("invoices", {
        invoiceNumber: "X",
        total: "1234567.89",
        currencyCode: "EUR",
      }).secondary,
    ).toContain("1,234,567.89 EUR");
  });

  it("returns (empty row) when contacts has neither company nor name parts", () => {
    expect(
      formatCard("contacts", {
        countryCode: "GR",
      }),
    ).toEqual({
      primary: "(empty row)",
      secondary: ["GR"],
    });
  });
});
