import { describe, it, expect } from "vitest";
import {
  invoicesImporter,
  groupRowsByInvoice,
} from "../../lib/import/importers/invoices";

describe("invoices importer descriptor", () => {
  it("requires invoiceNumber + issueDate + contactName + total", () => {
    const r = invoicesImporter.rowSchema.safeParse({
      invoiceNumber: "INV-0001",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a minimum-viable row", () => {
    const r = invoicesImporter.rowSchema.safeParse({
      invoiceNumber: "INV-0001",
      issueDate: "2026-04-25",
      contactName: "Acme",
      total: "100.00",
      itemName: "Consulting",
      quantity: "1",
      unitPrice: "100.00",
      taxRate: "24",
    });
    expect(r.success).toBe(true);
  });

  it("idempotency key includes 'num' tag + invoiceNumber when number present", () => {
    const k = invoicesImporter.idempotencyKeyParts(
      { invoiceNumber: "INV-0001" } as never,
      "org-1",
    );
    expect(k).toEqual(["org-1", "num", "inv-0001"]);
  });

  it("idempotency key falls back to contact+date+total fingerprint when number is empty (v1.1)", () => {
    const k = invoicesImporter.idempotencyKeyParts(
      {
        contactName: "Acme Co",
        issueDate: "2026-04-26",
        total: "100.00",
      } as never,
      "org-1",
    );
    expect(k).toEqual(["org-1", "nonum", "acme co", "2026-04-26", "100.00"]);
  });
});

describe("groupRowsByInvoice", () => {
  it("groups rows whose invoiceNumber repeats into one invoice with multiple lines", () => {
    const rows = [
      {
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-25",
        contactName: "Acme",
        total: "100.00",
        currencyCode: "EUR",
        itemName: "Hours",
        quantity: "10",
        unitPrice: "10.00",
        taxRate: "0",
      },
      {
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-25",
        contactName: "Acme",
        total: "100.00",
        currencyCode: "EUR",
        itemName: "Setup",
        quantity: "1",
        unitPrice: "50.00",
        taxRate: "0",
      },
      {
        invoiceNumber: "INV-0002",
        issueDate: "2026-04-26",
        contactName: "Beta",
        total: "200.00",
        currencyCode: "EUR",
        itemName: "License",
        quantity: "1",
        unitPrice: "200.00",
        taxRate: "24",
      },
    ];
    const grouped = groupRowsByInvoice(rows);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].lines).toHaveLength(2);
    expect(grouped[1].lines).toHaveLength(1);
  });
});
