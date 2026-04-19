import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  invoices,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { persistPreflightFailure } from "../lib/country/submit-invoice";

describe("persistPreflightFailure (#153)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;

    const [org] = await db
      .insert(organisations)
      .values({ name: "Acme", slug: "acme", countryCode: "GR" })
      .returning();
    orgId = org.id;

    const [contact] = await db
      .insert(contacts)
      .values({
        orgId,
        type: "client",
        displayName: "Beta Client",
      })
      .returning();

    const [invoice] = await db
      .insert(invoices)
      .values({
        orgId,
        contactId: contact.id,
        invoiceNumber: "INV-0001",
        issueDate: "2026-04-19",
        contactName: "Beta Client",
      })
      .returning();
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("writes a FAILED row with attempt_count=0 and the preflight error_message", async () => {
    const row = await persistPreflightFailure(
      {
        invoiceId,
        orgId,
        countryCode: "GR",
        kind: "mydata",
        errorMessage: "Organisation has no tax ID",
      },
      db,
    );

    expect(row.status).toBe(COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED);
    expect(row.attemptCount).toBe(0);
    expect(row.errorMessage).toBe("Organisation has no tax ID");
    expect(row.invoiceId).toBe(invoiceId);
    expect(row.kind).toBe("mydata");
    expect(row.countryCode).toBe("GR");

    const [readBack] = await db
      .select()
      .from(countryIntegrationSubmissions)
      .where(eq(countryIntegrationSubmissions.id, row.id));

    expect(readBack.status).toBe(COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED);
    expect(readBack.attemptCount).toBe(0);
    expect(readBack.errorMessage).toBe("Organisation has no tax ID");
  });

  it("concatenates multi-line preflight errors into error_message", async () => {
    const row = await persistPreflightFailure(
      {
        invoiceId,
        orgId,
        countryCode: "GR",
        kind: "mydata",
        errorMessage: "Tax ID missing; Issue date in the future",
      },
      db,
    );

    expect(row.errorMessage).toBe("Tax ID missing; Issue date in the future");
    expect(row.attemptCount).toBe(0);
  });

  it("differentiates preflight rows (attempt_count=0) from network-attempt rows (attempt_count>=1)", async () => {
    const preflight = await persistPreflightFailure(
      {
        invoiceId,
        orgId,
        countryCode: "GR",
        kind: "mydata",
        errorMessage: "preflight",
      },
      db,
    );

    const [network] = await db
      .insert(countryIntegrationSubmissions)
      .values({
        orgId,
        countryCode: "GR",
        kind: "mydata",
        invoiceId,
        status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED,
        errorMessage: "AADE 500",
        attemptCount: 1,
      })
      .returning();

    expect(preflight.attemptCount).toBe(0);
    expect(network.attemptCount).toBe(1);
    expect(preflight.status).toBe(network.status);
  });
});
