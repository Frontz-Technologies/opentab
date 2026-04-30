import { db } from "@/lib/db";
import {
  creditNotes,
  creditNoteItems,
  invoices,
  countryIntegrationCredentials,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import type { IntegrationCreditNoteInput } from "@/lib/country/types";
import { ACTIVITY_TYPE, ENTITY_TYPE } from "@/lib/entities/activity";
import { recordActivity } from "@/lib/activities/record";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("country-submit-cn");

export interface SubmitCreditNoteResult {
  kind: string;
  ok: boolean;
  submissionId?: string;
  externalId?: string;
  error?: string;
}

interface OrgContext {
  id: string;
  taxId: string | null;
  countryCode: string | null;
}

async function loadCredentials(
  orgId: string,
  countryCode: string,
  kind: string,
) {
  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, orgId),
        eq(countryIntegrationCredentials.countryCode, countryCode),
        eq(countryIntegrationCredentials.kind, kind),
        eq(countryIntegrationCredentials.isActive, true),
      ),
    );
  return cred;
}

function buildInput(
  orgCtx: OrgContext,
  cn: typeof creditNotes.$inferSelect,
  parentInvoice: { id: string; invoiceNumber: string | null } | null,
  items: (typeof creditNoteItems.$inferSelect)[],
  credentials: unknown,
): IntegrationCreditNoteInput {
  if (cn.creditNoteNumber === null) {
    throw new Error(
      `submit-credit-note: ${cn.id} has no number — cannot submit to plugins`,
    );
  }
  return {
    orgId: orgCtx.id,
    orgTaxId: orgCtx.taxId,
    creditNote: {
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      issueDate: cn.issueDate,
      currencyCode: cn.currencyCode,
      subtotal: cn.subtotal,
      taxAmount: cn.taxAmount,
      total: cn.total,
      contactVatNumber: cn.contactVatNumber,
      reason: cn.reason,
    },
    parentInvoice,
    items: items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      lineTotal: item.lineTotal,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      unit: item.unit,
    })),
    credentials,
  };
}

export async function submitCreditNoteThroughPlugins(
  creditNoteId: string,
  orgCtx: OrgContext,
  userId: string | null = null,
): Promise<SubmitCreditNoteResult[]> {
  const provider = getCountryProvider(orgCtx.countryCode);
  if (provider.integrations.length === 0) return [];

  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(
      and(eq(creditNotes.id, creditNoteId), eq(creditNotes.orgId, orgCtx.id)),
    );
  if (!cn) {
    log.warn("submit-cn: credit note not found", {
      creditNoteId,
      orgId: orgCtx.id,
    });
    return [{ kind: "unknown", ok: false, error: "Credit note not found" }];
  }

  // #274: scope the parent-invoice lookup by orgId. cn.invoiceId is a
  // foreign-key field that the create/update flow does not validate as
  // same-org (the schema accepts any UUID). Without the orgId clause,
  // an attacker who set cn.invoiceId to another org's invoice would
  // leak that invoice's number through the country-plugin payload
  // (myDATA, etc). Mirror of the credit-notes/[id]/page.tsx fix.
  let parentInvoice: { id: string; invoiceNumber: string | null } | null = null;
  if (cn.invoiceId) {
    const [inv] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.id, cn.invoiceId), eq(invoices.orgId, orgCtx.id)));
    parentInvoice = inv ?? null;
  }

  const items = await db
    .select()
    .from(creditNoteItems)
    .where(eq(creditNoteItems.creditNoteId, creditNoteId))
    .orderBy(asc(creditNoteItems.sortOrder));

  const results: SubmitCreditNoteResult[] = [];

  for (const integration of provider.integrations) {
    if (!integration.submitCreditNote) continue;

    const ctx = {
      creditNoteId,
      orgId: orgCtx.id,
      countryCode: provider.code,
      kind: integration.kind,
    };

    let credentials: unknown = undefined;
    if (integration.requiresCredentials !== false) {
      const cred = await loadCredentials(
        orgCtx.id,
        provider.code,
        integration.kind,
      );
      if (!cred) {
        log.info("submit-cn: skipping — no credentials configured", ctx);
        results.push({
          kind: integration.kind,
          ok: false,
          error: `No ${integration.label} credentials`,
        });
        continue;
      }
      credentials = cred.configJson;
    }

    const [submission] = await db
      .insert(countryIntegrationSubmissions)
      .values({
        orgId: orgCtx.id,
        countryCode: provider.code,
        kind: integration.kind,
        creditNoteId,
        status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING,
      })
      .returning();

    if (integration.kind === "mydata") {
      await recordActivity({
        orgId: orgCtx.id,
        entityType: ENTITY_TYPE.CREDIT_NOTE,
        entityId: creditNoteId,
        userId,
        type: ACTIVITY_TYPE.MYDATA_SUBMITTED,
        payload: { kind: integration.kind, submissionId: submission.id },
      });
    }

    let result;
    try {
      result = await integration.submitCreditNote(
        buildInput(orgCtx, cn, parentInvoice, items, credentials),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "submitCreditNote threw";
      log.error("submit-cn: threw", { ...ctx, errorMessage });
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED,
          errorMessage,
          attemptCount: 1,
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, submission.id));
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.CREDIT_NOTE,
          entityId: creditNoteId,
          userId,
          type: ACTIVITY_TYPE.MYDATA_FAILED,
          payload: {
            kind: integration.kind,
            submissionId: submission.id,
            errorMessage,
          },
        });
      }
      results.push({
        kind: integration.kind,
        ok: false,
        submissionId: submission.id,
        error: errorMessage,
      });
      continue;
    }

    if (result.ok) {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
          externalId: result.externalId,
          qrUrl: result.qrUrl,
          requestJson: result.requestPayload ?? null,
          responseJson: result.responsePayload ?? null,
          attemptCount: 1,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, submission.id));
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.CREDIT_NOTE,
          entityId: creditNoteId,
          userId,
          type: ACTIVITY_TYPE.MYDATA_CONFIRMED,
          payload: {
            kind: integration.kind,
            submissionId: submission.id,
            externalId: result.externalId,
          },
        });
      }
    } else {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          requestJson: result.requestPayload ?? null,
          responseJson: result.responsePayload ?? null,
          attemptCount: 1,
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, submission.id));
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.CREDIT_NOTE,
          entityId: creditNoteId,
          userId,
          type: ACTIVITY_TYPE.MYDATA_FAILED,
          payload: {
            kind: integration.kind,
            submissionId: submission.id,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          },
        });
      }
    }

    results.push({
      kind: integration.kind,
      ok: result.ok,
      submissionId: submission.id,
      externalId: result.externalId,
      error: result.errorMessage,
    });
  }

  return results;
}
