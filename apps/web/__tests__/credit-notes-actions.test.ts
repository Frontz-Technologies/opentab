import { describe, it, expect } from "vitest";
import {
  createCreditNoteSchema,
  CREDIT_NOTE_REASON,
} from "../lib/entities/credit-note";

describe("createCreditNoteSchema", () => {
  const validBase = {
    contactId: "12345678-1234-4234-9234-123456789012",
    issueDate: "2026-04-25",
    contactName: "Acme Co",
    reason: CREDIT_NOTE_REASON.RETURN,
    items: [
      {
        sortOrder: 0,
        name: "Refund line",
        quantity: "1",
        unitPrice: "100.00",
        taxRate: "24.00",
      },
    ],
  };

  it("accepts a valid happy-path payload", () => {
    const r = createCreditNoteSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("rejects when reason is missing", () => {
    const { reason: _omit, ...rest } = validBase;
    void _omit;
    const r = createCreditNoteSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("rejects when items array is empty", () => {
    const r = createCreditNoteSchema.safeParse({ ...validBase, items: [] });
    expect(r.success).toBe(false);
  });

  it("rejects when contactId is not a uuid", () => {
    const r = createCreditNoteSchema.safeParse({
      ...validBase,
      contactId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("accepts an optional invoiceId — null/empty string treated as absent", () => {
    const a = createCreditNoteSchema.safeParse({ ...validBase, invoiceId: "" });
    expect(a.success).toBe(true);
    const b = createCreditNoteSchema.safeParse({
      ...validBase,
      invoiceId: "87654321-4321-4321-9321-210987654321",
    });
    expect(b.success).toBe(true);
  });
});
