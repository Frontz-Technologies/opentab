import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  quotes,
  quoteItems,
  contacts,
  organisations,
  users,
  QUOTE_STATUS,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("quotes schema", () => {
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
        displayName: "Acme Corp",
      })
      .returning();
    contactId = contact.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a draft quote", async () => {
    const [quote] = await db
      .insert(quotes)
      .values({
        orgId,
        contactId,
        quoteNumber: "QTE-0001",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
      })
      .returning();

    expect(quote.status).toBe(QUOTE_STATUS.DRAFT);
    expect(quote.quoteNumber).toBe("QTE-0001");
  });

  it("creates quote with line items", async () => {
    const [quote] = await db
      .insert(quotes)
      .values({
        orgId,
        contactId,
        quoteNumber: "QTE-0002",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        subtotal: "200.00",
        taxAmount: "48.00",
        total: "248.00",
        contactName: "Acme Corp",
      })
      .returning();

    const [item] = await db
      .insert(quoteItems)
      .values({
        quoteId: quote.id,
        sortOrder: 0,
        name: "Consulting",
        quantity: "8",
        unitPrice: "25.00",
        taxCategory: "standard",
        taxRate: "24.00",
        taxAmount: "48.00",
        lineTotal: "248.00",
      })
      .returning();

    expect(item.quoteId).toBe(quote.id);
    expect(item.name).toBe("Consulting");
  });

  it("cascades delete of line items when quote deleted", async () => {
    const [quote] = await db
      .insert(quotes)
      .values({
        orgId,
        contactId,
        quoteNumber: "QTE-0003",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
      })
      .returning();

    await db.insert(quoteItems).values({
      quoteId: quote.id,
      sortOrder: 0,
      name: "Item to delete",
      quantity: "1",
      unitPrice: "50.00",
      taxCategory: "standard",
      taxRate: "24.00",
      taxAmount: "12.00",
      lineTotal: "62.00",
    });

    await db.delete(quotes).where(eq(quotes.id, quote.id));

    const remaining = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id));

    expect(remaining.length).toBe(0);
  });

  it("tracks quote status transitions", async () => {
    const [quote] = await db
      .insert(quotes)
      .values({
        orgId,
        contactId,
        quoteNumber: "QTE-0004",
        issueDate: "2026-04-12",
        currencyCode: "EUR",
        contactName: "Acme Corp",
      })
      .returning();

    expect(quote.status).toBe(QUOTE_STATUS.DRAFT);

    const [sent] = await db
      .update(quotes)
      .set({ status: QUOTE_STATUS.SENT })
      .where(eq(quotes.id, quote.id))
      .returning();

    expect(sent.status).toBe(QUOTE_STATUS.SENT);

    const [accepted] = await db
      .update(quotes)
      .set({ status: QUOTE_STATUS.ACCEPTED })
      .where(eq(quotes.id, quote.id))
      .returning();

    expect(accepted.status).toBe(QUOTE_STATUS.ACCEPTED);
  });
});
