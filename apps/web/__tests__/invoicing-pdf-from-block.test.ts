import { describe, it, expect } from "vitest";
import type { Invoice, InvoiceItem, Organisation } from "@opentab/db/schema";
import { renderInvoicePdfHtml } from "../components/invoicing/invoice-pdf-template";

// Minimal stub objects — the renderer only reads a handful of fields, so
// we cast through `unknown` rather than constructing fully-typed rows.
function makeOrg(overrides: Partial<Organisation> = {}): Organisation {
  return {
    name: "Acme Co",
    taxId: "EL123456789",
    addressLine1: "1 Main St",
    city: "Athens",
    postalCode: "10001",
    phone: "+30 210 0000000",
    email: null,
    ...overrides,
  } as unknown as Organisation;
}

function makeInvoice(): Invoice {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    invoiceNumber: "INV-001",
    issueDate: "2026-05-01",
    dueDate: "2026-05-31",
    contactName: "Customer Co",
    contactEmail: null,
    contactVatNumber: null,
    contactAddress: null,
    currencyCode: "EUR",
    subtotal: "100.00",
    taxAmount: "24.00",
    total: "124.00",
    notes: null,
    terms: null,
  } as unknown as Invoice;
}

const items: InvoiceItem[] = [];

describe("invoice PDF From block — org email line (#285)", () => {
  it("emits the org email line in the From block when org.email is set", () => {
    const html = renderInvoicePdfHtml({
      invoice: makeInvoice(),
      items,
      org: makeOrg({ email: "ops@acme.com" }),
    });

    expect(html).toContain("ops@acme.com");
    // Phone must come before email in the From block ordering.
    const phoneIdx = html.indexOf("+30 210 0000000");
    const emailIdx = html.indexOf("ops@acme.com");
    expect(phoneIdx).toBeGreaterThan(-1);
    expect(emailIdx).toBeGreaterThan(phoneIdx);
  });

  it("omits the email line entirely when org.email is null", () => {
    const html = renderInvoicePdfHtml({
      invoice: makeInvoice(),
      items,
      org: makeOrg({ email: null }),
    });

    // No email-shaped string should appear inside the org From block.
    // (The template emits "Bill To" / contact email separately, but the
    // contact stub here has contactEmail: null, so no '@' should appear.)
    expect(html).not.toContain("@");
  });

  it("escapes HTML-meta characters in the email", () => {
    const html = renderInvoicePdfHtml({
      invoice: makeInvoice(),
      items,
      org: makeOrg({ email: 'a"b&c<d>@x.io' }),
    });

    expect(html).toContain("a&quot;b&amp;c&lt;d&gt;@x.io");
    expect(html).not.toContain('a"b&c<d>@x.io');
  });
});
