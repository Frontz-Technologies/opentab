import { describe, it, expect } from "vitest";
import {
  creditNotesImporter,
  groupRowsByCreditNote,
} from "../../lib/import/importers/credit-notes";

describe("credit-notes importer descriptor (#215 PR-B)", () => {
  it("requires creditNoteNumber + issueDate + contactName + total + reason + line", () => {
    const r = creditNotesImporter.rowSchema.safeParse({
      creditNoteNumber: "CN-0001",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a minimum-viable row", () => {
    const r = creditNotesImporter.rowSchema.safeParse({
      creditNoteNumber: "CN-0001",
      issueDate: "2026-04-25",
      contactName: "Acme",
      total: "100.00",
      reason: "return",
      itemName: "Refund line",
      quantity: "1",
      unitPrice: "100.00",
      taxRate: "24",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown reason values", () => {
    const r = creditNotesImporter.rowSchema.safeParse({
      creditNoteNumber: "CN-0001",
      issueDate: "2026-04-25",
      contactName: "Acme",
      total: "100.00",
      reason: "explosion",
      itemName: "Refund",
      quantity: "1",
      unitPrice: "100.00",
      taxRate: "24",
    });
    expect(r.success).toBe(false);
  });

  it("idempotency key includes 'num' tag + creditNoteNumber when number present", () => {
    const k = creditNotesImporter.idempotencyKeyParts(
      { creditNoteNumber: "CN-0001" } as never,
      "org-1",
    );
    expect(k).toEqual(["org-1", "num", "cn-0001"]);
  });

  it("idempotency key falls back to contact+date+total fingerprint when number is empty (v1.1, #220)", () => {
    const k = creditNotesImporter.idempotencyKeyParts(
      {
        contactName: "Acme Co",
        issueDate: "2026-04-26",
        total: "100.00",
      } as never,
      "org-1",
    );
    expect(k).toEqual(["org-1", "nonum", "acme co", "2026-04-26", "100.00"]);
  });

  it("alias table accepts common header variants for parent invoice link", () => {
    expect(creditNotesImporter.aliases.parentInvoiceNumber).toContain(
      "credits invoice",
    );
    expect(creditNotesImporter.aliases.creditNoteNumber).toContain("number");
  });
});

describe("groupRowsByCreditNote (#215 PR-B)", () => {
  it("groups rows whose creditNoteNumber repeats into one credit note", () => {
    const rows = [
      {
        creditNoteNumber: "CN-0001",
        issueDate: "2026-04-25",
        contactName: "Acme",
        total: "100.00",
        currencyCode: "EUR",
        reason: "return" as const,
        itemName: "A",
        quantity: "1",
        unitPrice: "50.00",
        taxRate: "0",
      },
      {
        creditNoteNumber: "CN-0001",
        issueDate: "2026-04-25",
        contactName: "Acme",
        total: "100.00",
        currencyCode: "EUR",
        reason: "return" as const,
        itemName: "B",
        quantity: "1",
        unitPrice: "50.00",
        taxRate: "0",
      },
      {
        creditNoteNumber: "CN-0002",
        issueDate: "2026-04-26",
        contactName: "Beta",
        total: "200.00",
        currencyCode: "EUR",
        reason: "discount" as const,
        itemName: "C",
        quantity: "1",
        unitPrice: "200.00",
        taxRate: "24",
      },
    ];
    const grouped = groupRowsByCreditNote(rows);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].lines).toHaveLength(2);
    expect(grouped[1].lines).toHaveLength(1);
  });
});
