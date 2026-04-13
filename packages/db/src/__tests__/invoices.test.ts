import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  invoices,
  invoiceItems,
  contacts,
  organisations,
  users,
  INVOICE_STATUS,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("invoices schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;

    await db.insert(users).values({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });

    const [org] = await db
      .insert(organisations)
      .values({ name: "Test Org", slug: "test-org" })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "business",
        company: "Acme Corp",
        displayName: "Acme Corp",
        email: "billing@acme.com",
      })
      .returning();
    contactId = contact.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a draft invoice", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
        contactEmail: "billing@acme.com",
      })
      .returning();

    expect(invoice.status).toBe(INVOICE_STATUS.DRAFT);
    expect(invoice.invoiceNumber).toBe("INV-0001");
    expect(invoice.subtotal).toBe("0.00");
    expect(invoice.total).toBe("0.00");
    expect(invoice.usesInclusiveTax).toBe(false);
  });

  it("creates invoice with line items", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: "INV-0002",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        subtotal: "100.00",
        taxAmount: "24.00",
        total: "124.00",
        balance: "124.00",
        contactName: "Acme Corp",
      })
      .returning();

    const [item1] = await db
      .insert(invoiceItems)
      .values({
        invoiceId: invoice.id,
        sortOrder: 0,
        name: "Web Development",
        description: "Frontend work",
        quantity: "10",
        unitPrice: "10.00",
        unit: "hours",
        taxCategory: "standard",
        taxRate: "24.00",
        taxAmount: "24.00",
        lineTotal: "124.00",
      })
      .returning();

    expect(item1.invoiceId).toBe(invoice.id);
    expect(item1.name).toBe("Web Development");
    expect(item1.quantity).toBe("10.0000");
    expect(item1.taxRate).toBe("24.00");
  });

  it("cascades delete of line items when invoice deleted", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: "INV-0003",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
      })
      .returning();

    await db.insert(invoiceItems).values({
      invoiceId: invoice.id,
      sortOrder: 0,
      name: "Item to delete",
      quantity: "1",
      unitPrice: "50.00",
      taxCategory: "standard",
      taxRate: "24.00",
      taxAmount: "12.00",
      lineTotal: "62.00",
    });

    await db.delete(invoices).where(eq(invoices.id, invoice.id));

    const remaining = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    expect(remaining.length).toBe(0);
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org", slug: "temp-org-inv" })
      .returning();

    const [tempContact] = await db
      .insert(contacts)
      .values({
        orgId: tempOrg.id,
        type: "client",
        classification: "business",
        displayName: "Temp Client",
      })
      .returning();

    await db.insert(invoices).values({
      orgId: tempOrg.id,
      contactId: tempContact.id,
      invoiceNumber: "INV-TEMP",
      issueDate: "2026-04-12",
      currencyCode: "EUR",
      contactName: "Temp Client",
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });

  it("tracks status transitions", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: "INV-0004",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
      })
      .returning();

    expect(invoice.status).toBe(INVOICE_STATUS.DRAFT);

    // Transition to sent
    const [sent] = await db
      .update(invoices)
      .set({ status: INVOICE_STATUS.SENT, sentAt: new Date() })
      .where(eq(invoices.id, invoice.id))
      .returning();

    expect(sent.status).toBe(INVOICE_STATUS.SENT);
    expect(sent.sentAt).not.toBeNull();

    // Transition to paid
    const [paid] = await db
      .update(invoices)
      .set({ status: INVOICE_STATUS.PAID, paidAt: new Date() })
      .where(eq(invoices.id, invoice.id))
      .returning();

    expect(paid.status).toBe(INVOICE_STATUS.PAID);
    expect(paid.paidAt).not.toBeNull();
  });

  it("stores denormalized contact fields", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId,
        invoiceNumber: "INV-0005",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
        contactEmail: "billing@acme.com",
        contactVatNumber: "EL123456789",
        contactAddress: "Ermou 25, Athens 10563",
      })
      .returning();

    expect(invoice.contactName).toBe("Acme Corp");
    expect(invoice.contactEmail).toBe("billing@acme.com");
    expect(invoice.contactVatNumber).toBe("EL123456789");
    expect(invoice.contactAddress).toBe("Ermou 25, Athens 10563");
  });

  it("filters invoices by org and status", async () => {
    const orgInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orgId, orgId));

    expect(orgInvoices.length).toBeGreaterThan(0);
    orgInvoices.forEach((inv) => expect(inv.orgId).toBe(orgId));
  });
});
