import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils";
import {
  mydataCredentials,
  mydataTransmissions,
  invoices,
  contacts,
  organisations,
  users,
  MYDATA_TRANSMISSION_STATUS,
} from "../schema/index";
import { eq } from "drizzle-orm";

describe("mydata schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;
  let orgId: string;
  let invoiceId: string;

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
      .values({ name: "Test Org", slug: "test-org", countryCode: "GR" })
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
      })
      .returning();

    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId: contact.id,
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-12",
        contactName: "Acme Corp",
      })
      .returning();
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    await teardown();
  });

  describe("mydata_credentials", () => {
    it("creates credentials for an org", async () => {
      const [cred] = await db
        .insert(mydataCredentials)
        .values({
          orgId,
          aadeUserId: "testuser",
          subscriptionKey: "encrypted-key-data",
          environment: "sandbox",
        })
        .returning();

      expect(cred.aadeUserId).toBe("testuser");
      expect(cred.subscriptionKey).toBe("encrypted-key-data");
      expect(cred.environment).toBe("sandbox");
      expect(cred.isActive).toBe(true);
      expect(cred.lastValidatedAt).toBeNull();
    });

    it("enforces unique org_id", async () => {
      await expect(
        db.insert(mydataCredentials).values({
          orgId,
          aadeUserId: "another-user",
          subscriptionKey: "another-key",
        }),
      ).rejects.toThrow();
    });

    it("updates credentials", async () => {
      await db
        .update(mydataCredentials)
        .set({
          environment: "production",
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mydataCredentials.orgId, orgId));

      const [updated] = await db
        .select()
        .from(mydataCredentials)
        .where(eq(mydataCredentials.orgId, orgId));

      expect(updated.environment).toBe("production");
      expect(updated.lastValidatedAt).not.toBeNull();
    });
  });

  describe("mydata_transmission", () => {
    it("creates a pending transmission", async () => {
      const [tx] = await db
        .insert(mydataTransmissions)
        .values({
          orgId,
          invoiceId,
          documentType: "2.1",
          classificationCategory: "category1_3",
          classificationType: "E3_561_001",
          paymentMethod: 5,
        })
        .returning();

      expect(tx.status).toBe(MYDATA_TRANSMISSION_STATUS.PENDING);
      expect(tx.documentType).toBe("2.1");
      expect(tx.attemptCount).toBe(0);
      expect(tx.invoiceMark).toBeNull();
    });

    it("updates to confirmed with MARK", async () => {
      const [tx] = await db
        .select()
        .from(mydataTransmissions)
        .where(eq(mydataTransmissions.invoiceId, invoiceId));

      await db
        .update(mydataTransmissions)
        .set({
          status: MYDATA_TRANSMISSION_STATUS.CONFIRMED,
          invoiceUid: "A1B2C3D4-E5F6-7890",
          invoiceMark: "400001234567890",
          qrUrl: "https://mydata.aade.gr/qr/test",
          attemptCount: 1,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mydataTransmissions.id, tx.id));

      const [updated] = await db
        .select()
        .from(mydataTransmissions)
        .where(eq(mydataTransmissions.id, tx.id));

      expect(updated.status).toBe(MYDATA_TRANSMISSION_STATUS.CONFIRMED);
      expect(updated.invoiceMark).toBe("400001234567890");
      expect(updated.qrUrl).toBe("https://mydata.aade.gr/qr/test");
    });

    it("stores error info on failure", async () => {
      const [tx] = await db
        .insert(mydataTransmissions)
        .values({
          orgId,
          invoiceId,
          documentType: "1.1",
          status: MYDATA_TRANSMISSION_STATUS.FAILED,
          errorCode: "XML_VALIDATION_ERROR",
          errorMessage: "Invalid VAT number format",
          attemptCount: 1,
        })
        .returning();

      expect(tx.status).toBe(MYDATA_TRANSMISSION_STATUS.FAILED);
      expect(tx.errorCode).toBe("XML_VALIDATION_ERROR");
      expect(tx.errorMessage).toBe("Invalid VAT number format");
    });
  });

  describe("invoice mydata fields", () => {
    it("stores mydata mark on invoice", async () => {
      await db
        .update(invoices)
        .set({
          mydataMark: "400001234567890",
          mydataQrUrl: "https://mydata.aade.gr/qr/test",
          mydataDocumentType: "2.1",
          mydataStatus: MYDATA_TRANSMISSION_STATUS.CONFIRMED,
        })
        .where(eq(invoices.id, invoiceId));

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      expect(updated.mydataMark).toBe("400001234567890");
      expect(updated.mydataQrUrl).toBe("https://mydata.aade.gr/qr/test");
      expect(updated.mydataDocumentType).toBe("2.1");
      expect(updated.mydataStatus).toBe(MYDATA_TRANSMISSION_STATUS.CONFIRMED);
    });

    it("mydata fields default to null", async () => {
      const [contact] = await db
        .insert(contacts)
        .values({
          orgId,
          type: "client",
          classification: "business",
          displayName: "New Client",
        })
        .returning();

      const [inv] = await db
        .insert(invoices)
        .values({
          orgId,
          contactId: contact.id,
          invoiceNumber: "INV-0099",
          issueDate: "2026-04-12",
          contactName: "New Client",
        })
        .returning();

      expect(inv.mydataMark).toBeNull();
      expect(inv.mydataQrUrl).toBeNull();
      expect(inv.mydataDocumentType).toBeNull();
      expect(inv.mydataStatus).toBeNull();
    });
  });

  describe("cascade delete", () => {
    it("deletes credentials when org is deleted", async () => {
      // Create a separate org for cascade test
      const [org2] = await db
        .insert(organisations)
        .values({ name: "Org 2", slug: "org-2" })
        .returning();

      await db.insert(mydataCredentials).values({
        orgId: org2.id,
        aadeUserId: "user2",
        subscriptionKey: "key2",
      });

      await db.delete(organisations).where(eq(organisations.id, org2.id));

      const remaining = await db
        .select()
        .from(mydataCredentials)
        .where(eq(mydataCredentials.orgId, org2.id));

      expect(remaining).toHaveLength(0);
    });
  });
});
