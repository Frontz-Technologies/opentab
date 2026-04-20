import { describe, it, expect } from "vitest";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceLineItemSchema,
} from "@/lib/entities/invoice";

const validLineItem = {
  sortOrder: 0,
  name: "Consulting",
  quantity: "1.0",
  unitPrice: "100.00",
  taxRate: "24.00",
};

const validInvoice = {
  contactId: "11111111-1111-4111-9111-111111111111",
  issueDate: "2026-04-20",
  contactName: "Acme Ltd",
  items: [validLineItem],
};

describe("invoice entity schemas", () => {
  it("createInvoiceSchema accepts a minimal valid payload", () => {
    const parsed = createInvoiceSchema.safeParse(validInvoice);
    expect(parsed.success).toBe(true);
  });

  it("createInvoiceSchema rejects when items array is empty", () => {
    const parsed = createInvoiceSchema.safeParse({
      ...validInvoice,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("updateInvoiceSchema matches createInvoiceSchema behaviour", () => {
    expect(updateInvoiceSchema.safeParse(validInvoice).success).toBe(true);
  });

  it("invoiceLineItemSchema rejects quantity with more than 4 decimals", () => {
    const parsed = invoiceLineItemSchema.safeParse({
      ...validLineItem,
      quantity: "1.12345",
    });
    expect(parsed.success).toBe(false);
  });
});
