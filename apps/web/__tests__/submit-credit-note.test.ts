import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  contacts,
  creditNotes,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
  CREDIT_NOTE_STATUS,
  CREDIT_NOTE_REASON,
} from "@opentab/db/schema";

// Tester PR #214 Critical regression. The orchestrator used to write
// the credit-note UUID into country_integration_submission.invoice_id
// — a column whose FK references invoice(id). Every "Send" on a
// credit-note for a myDATA-configured GR org failed with an FK
// violation, but no test exercised this path so CI was silent.
//
// This test seeds a credit note + a stub myDATA-shaped integration
// that returns ok:true, then asserts the row inserts cleanly with
// creditNoteId set and invoiceId null.

const { dbHolder, getProviderMock, recordActivityMock } = vi.hoisted(() => ({
  dbHolder: {
    current: null as unknown as Awaited<
      ReturnType<typeof import("@opentab/db/test-utils").createTestDb>
    >["db"],
  },
  getProviderMock: vi.fn(),
  recordActivityMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

vi.mock("@/lib/country", () => ({
  getCountryProvider: getProviderMock,
}));

vi.mock("@/lib/activities/record", () => ({
  recordActivity: recordActivityMock,
}));

import { submitCreditNoteThroughPlugins } from "../lib/country/submit-credit-note";

describe("submitCreditNoteThroughPlugins (#133 / PR #214 Critical fix)", () => {
  let teardown: () => Promise<void>;
  let orgId: string;
  let contactId: string;
  let creditNoteId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [org] = await ctx.db
      .insert(organisations)
      .values({
        name: "Test Org",
        slug: "test-org-cn-submit",
        countryCode: "GR",
      })
      .returning();
    orgId = org.id;

    const [contact] = await ctx.db
      .insert(contacts)
      .values({ orgId, displayName: "Test Client" })
      .returning();
    contactId = contact.id;

    const [cn] = await ctx.db
      .insert(creditNotes)
      .values({
        orgId,
        contactId,
        creditNoteNumber: "CN-0001",
        status: CREDIT_NOTE_STATUS.SENT,
        issueDate: "2026-04-25",
        contactName: "Test Client",
        reason: CREDIT_NOTE_REASON.RETURN,
      })
      .returning();
    creditNoteId = cn.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("inserts the submission row with creditNoteId set, NOT invoiceId — no FK violation", async () => {
    getProviderMock.mockReturnValue({
      code: "GR",
      integrations: [
        {
          kind: "mydata",
          label: "myDATA stub",
          requiresCredentials: false,
          submitCreditNote: vi.fn().mockResolvedValue({
            ok: true,
            externalId: "MARK-12345",
            qrUrl: "https://aade.example/qr",
          }),
        },
      ],
    });

    const results = await submitCreditNoteThroughPlugins(
      creditNoteId,
      { id: orgId, taxId: "123456789", countryCode: "GR" },
      null,
    );

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].kind).toBe("mydata");
    expect(results[0].externalId).toBe("MARK-12345");

    const [row] = await dbHolder.current
      .select()
      .from(countryIntegrationSubmissions)
      .where(eq(countryIntegrationSubmissions.id, results[0].submissionId!));

    expect(row).toBeDefined();
    expect(row.creditNoteId).toBe(creditNoteId);
    expect(row.invoiceId).toBeNull();
    expect(row.status).toBe(COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED);
    expect(row.externalId).toBe("MARK-12345");
  });

  it("writes a FAILED row (still with creditNoteId) when the integration returns ok:false", async () => {
    const [cn2] = await dbHolder.current
      .insert(creditNotes)
      .values({
        orgId,
        contactId,
        creditNoteNumber: "CN-0002",
        status: CREDIT_NOTE_STATUS.SENT,
        issueDate: "2026-04-25",
        contactName: "Test Client",
        reason: CREDIT_NOTE_REASON.RETURN,
      })
      .returning();

    getProviderMock.mockReturnValue({
      code: "GR",
      integrations: [
        {
          kind: "mydata",
          label: "myDATA stub",
          requiresCredentials: false,
          submitCreditNote: vi.fn().mockResolvedValue({
            ok: false,
            errorCode: "AADE_VAL_001",
            errorMessage: "Validation failed",
          }),
        },
      ],
    });

    const results = await submitCreditNoteThroughPlugins(
      cn2.id,
      { id: orgId, taxId: "123456789", countryCode: "GR" },
      null,
    );

    expect(results[0].ok).toBe(false);

    const [row] = await dbHolder.current
      .select()
      .from(countryIntegrationSubmissions)
      .where(eq(countryIntegrationSubmissions.id, results[0].submissionId!));

    expect(row.creditNoteId).toBe(cn2.id);
    expect(row.invoiceId).toBeNull();
    expect(row.status).toBe(COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED);
    expect(row.errorCode).toBe("AADE_VAL_001");
  });
});
