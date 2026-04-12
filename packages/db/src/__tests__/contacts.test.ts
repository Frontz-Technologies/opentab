import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import { contacts, organisations, users } from "../schema/index";
import { eq } from "drizzle-orm";

describe("contacts schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;

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
  });

  afterAll(async () => {
    await teardown();
  });

  it("creates a client contact", async () => {
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

    expect(contact.type).toBe("client");
    expect(contact.classification).toBe("business");
    expect(contact.company).toBe("Acme Corp");
    expect(contact.vatValidated).toBe(false);
  });

  it("creates a supplier contact", async () => {
    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "supplier",
        classification: "business",
        company: "Supplier Ltd",
        displayName: "Supplier Ltd",
      })
      .returning();

    expect(contact.type).toBe("supplier");
  });

  it("creates a contact with VAT number", async () => {
    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "business",
        company: "EU Partner GmbH",
        displayName: "EU Partner GmbH",
        vatNumber: "DE123456789",
        vatValidated: true,
        countryCode: "DE",
      })
      .returning();

    expect(contact.vatNumber).toBe("DE123456789");
    expect(contact.vatValidated).toBe(true);
    expect(contact.countryCode).toBe("DE");
  });

  it("creates a contact with address and defaults", async () => {
    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        classification: "individual",
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe",
        addressLine1: "123 Main St",
        city: "Athens",
        postalCode: "10551",
        countryCode: "GR",
        defaultCurrency: "EUR",
        defaultLanguage: "el",
        defaultPaymentTerms: 30,
      })
      .returning();

    expect(contact.classification).toBe("individual");
    expect(contact.defaultPaymentTerms).toBe(30);
    expect(contact.defaultLanguage).toBe("el");
  });

  it("filters contacts by org", async () => {
    const orgContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.orgId, orgId));

    expect(orgContacts.length).toBeGreaterThan(0);
    orgContacts.forEach((c) => expect(c.orgId).toBe(orgId));
  });

  it("filters contacts by type", async () => {
    const clients = await db
      .select()
      .from(contacts)
      .where(eq(contacts.type, "client"));

    clients.forEach((c) => expect(c.type).toBe("client"));
  });

  it("cascades delete when org is deleted", async () => {
    const [tempOrg] = await db
      .insert(organisations)
      .values({ name: "Temp Org", slug: "temp-org" })
      .returning();

    await db.insert(contacts).values({
      orgId: tempOrg.id,
      type: "client",
      classification: "business",
      company: "Will Be Deleted",
      displayName: "Will Be Deleted",
    });

    await db.delete(organisations).where(eq(organisations.id, tempOrg.id));

    const remaining = await db
      .select()
      .from(contacts)
      .where(eq(contacts.orgId, tempOrg.id));

    expect(remaining.length).toBe(0);
  });
});
