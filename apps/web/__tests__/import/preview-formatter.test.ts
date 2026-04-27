import { describe, it, expect } from "vitest";
import { formatCard } from "@/lib/import/preview-formatter";

describe("formatCard", () => {
  it("formats invoices with number · contact · amount · date", () => {
    expect(
      formatCard("invoices", {
        invoiceNumber: "INV-2026-001",
        contactName: "Acme Corp",
        totalAmount: "1200.50",
        currency: "EUR",
        issueDate: "2026-04-27",
      }),
    ).toEqual({
      primary: "INV-2026-001 · Acme Corp",
      secondary: ["1,200.50 EUR", "2026-04-27"],
    });
  });

  it("formats contacts with name · country · email", () => {
    expect(
      formatCard("contacts", {
        name: "Acme Corp",
        countryCode: "GR",
        email: "billing@acme.example",
      }),
    ).toEqual({
      primary: "Acme Corp",
      secondary: ["GR", "billing@acme.example"],
    });
  });

  it("formats expenses with vendor · amount · date", () => {
    expect(
      formatCard("expenses", {
        vendorName: "Hetzner",
        totalAmount: "120.00",
        currency: "EUR",
        date: "2026-04-15",
      }),
    ).toEqual({
      primary: "Hetzner",
      secondary: ["120.00 EUR", "2026-04-15"],
    });
  });

  it("formats credit-notes with number · contact · amount", () => {
    expect(
      formatCard("credit-notes", {
        creditNoteNumber: "CN-2026-001",
        contactName: "Acme Corp",
        totalAmount: "300.00",
        currency: "EUR",
      }),
    ).toEqual({
      primary: "CN-2026-001 · Acme Corp",
      secondary: ["300.00 EUR"],
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
        totalAmount: "",
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
        totalAmount: "1234567.89",
      }).secondary,
    ).toContain("1,234,567.89");
  });
});
