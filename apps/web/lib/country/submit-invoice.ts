import { db } from "@/lib/db";
import type { Db } from "@opentab/db";
import {
  invoices,
  invoiceItems,
  countryIntegrationCredentials,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import type { Integration, IntegrationInvoiceInput } from "@/lib/country/types";
import { createLogger } from "@/lib/logging/logger";
import { recordActivity } from "@/lib/activities/record";
import { ACTIVITY_TYPE, ENTITY_TYPE } from "@/lib/entities/activity";

const log = createLogger("country-submit");

export interface SubmitInvoiceResult {
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
  invoice: typeof invoices.$inferSelect,
  items: (typeof invoiceItems.$inferSelect)[],
  credentials: unknown,
): IntegrationInvoiceInput {
  // invoice_number is nullable on drafts. submit-invoice only runs
  // from sendInvoice / scheduler paths AFTER
  // assignInvoiceNumberIfMissing has assigned a number, so this
  // should never fire — guard defensively rather than crash on a
  // hypothetical mis-ordering.
  if (invoice.invoiceNumber === null) {
    throw new Error(
      `submit-invoice: invoice ${invoice.id} has no number — cannot submit to plugins`,
    );
  }

  return {
    orgId: orgCtx.id,
    orgTaxId: orgCtx.taxId,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      currencyCode: invoice.currencyCode,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      contactVatNumber: invoice.contactVatNumber,
    },
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

export async function submitInvoiceThroughPlugins(
  invoiceId: string,
  orgCtx: OrgContext,
  userId: string | null = null,
): Promise<SubmitInvoiceResult[]> {
  const provider = getCountryProvider(orgCtx.countryCode);
  if (provider.integrations.length === 0) return [];

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgCtx.id)));
  if (!invoice) {
    log.warn("submit: invoice not found", { invoiceId, orgId: orgCtx.id });
    return [{ kind: "unknown", ok: false, error: "Invoice not found" }];
  }

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.sortOrder));

  const results: SubmitInvoiceResult[] = [];

  for (const integration of provider.integrations) {
    if (!integration.submit) continue;

    const ctx = {
      invoiceId,
      orgId: orgCtx.id,
      countryCode: provider.code,
      kind: integration.kind,
    };

    let credentials: unknown = undefined;
    let credId: string | undefined;
    if (integration.requiresCredentials !== false) {
      const cred = await loadCredentials(
        orgCtx.id,
        provider.code,
        integration.kind,
      );
      if (!cred) {
        log.info("submit: skipping — no credentials configured", ctx);
        results.push({
          kind: integration.kind,
          ok: false,
          error: `No ${integration.label} credentials`,
        });
        continue;
      }
      credentials = cred.configJson;
      credId = cred.id;
    }

    if (integration.validate) {
      let validation;
      try {
        validation = await integration.validate(
          buildInput(orgCtx, invoice, items, credentials),
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Validation threw";
        log.error("submit: validate() threw", { ...ctx, errorMessage });
        await persistPreflightFailure({
          ...ctx,
          errorMessage: `validate threw: ${errorMessage}`,
        });
        results.push({
          kind: integration.kind,
          ok: false,
          error: errorMessage,
        });
        continue;
      }
      if (!validation.ok) {
        const errorMessage =
          validation.errors?.join("; ") ?? "Validation failed";
        log.info("submit: preflight rejected", { ...ctx, errorMessage });
        const { id: submissionId } = await persistPreflightFailure({
          ...ctx,
          errorMessage,
        });
        results.push({
          kind: integration.kind,
          ok: false,
          submissionId,
          error: errorMessage,
        });
        continue;
      }
    }

    const [submission] = await db
      .insert(countryIntegrationSubmissions)
      .values({
        orgId: orgCtx.id,
        countryCode: provider.code,
        kind: integration.kind,
        invoiceId,
        status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING,
      })
      .returning();

    // Audit log: only myDATA in v1; future country plugins get their
    // own activity types when they land. The kind check keeps
    // ACTIVITY_TYPE a closed union.
    if (integration.kind === "mydata") {
      await recordActivity({
        orgId: orgCtx.id,
        entityType: ENTITY_TYPE.INVOICE,
        entityId: invoiceId,
        userId,
        type: ACTIVITY_TYPE.MYDATA_SUBMITTED,
        payload: { kind: integration.kind, submissionId: submission.id },
      });
    }

    const done = log.time("submit");
    let result;
    try {
      result = await integration.submit(
        buildInput(orgCtx, invoice, items, credentials),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Submit threw";
      done("submit threw", {
        ...ctx,
        submissionId: submission.id,
        errorMessage,
      });
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED,
          errorMessage,
          attemptCount: 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(countryIntegrationSubmissions.id, submission.id),
            eq(countryIntegrationSubmissions.orgId, orgCtx.id),
          ),
        );
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.INVOICE,
          entityId: invoiceId,
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

    done("submit finished", {
      ...ctx,
      submissionId: submission.id,
      ok: result.ok,
      ...(result.externalId ? { externalId: result.externalId } : {}),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    });

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
        .where(
          and(
            eq(countryIntegrationSubmissions.id, submission.id),
            eq(countryIntegrationSubmissions.orgId, orgCtx.id),
          ),
        );
      if (credId) {
        await db
          .update(countryIntegrationCredentials)
          .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(countryIntegrationCredentials.id, credId),
              eq(countryIntegrationCredentials.orgId, orgCtx.id),
            ),
          );
      }
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.INVOICE,
          entityId: invoiceId,
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
        .where(
          and(
            eq(countryIntegrationSubmissions.id, submission.id),
            eq(countryIntegrationSubmissions.orgId, orgCtx.id),
          ),
        );
      if (integration.kind === "mydata") {
        await recordActivity({
          orgId: orgCtx.id,
          entityType: ENTITY_TYPE.INVOICE,
          entityId: invoiceId,
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

export async function persistPreflightFailure(
  input: {
    invoiceId: string;
    orgId: string;
    countryCode: string;
    kind: string;
    errorMessage: string;
  },
  dbInstance: Db = db,
) {
  const [row] = await dbInstance
    .insert(countryIntegrationSubmissions)
    .values({
      orgId: input.orgId,
      countryCode: input.countryCode,
      kind: input.kind,
      invoiceId: input.invoiceId,
      status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED,
      errorMessage: input.errorMessage,
      attemptCount: 0,
    })
    .returning();
  return row;
}

export async function cancelInvoiceOnPlugins(
  invoiceId: string,
  orgCtx: OrgContext,
): Promise<SubmitInvoiceResult[]> {
  const provider = getCountryProvider(orgCtx.countryCode);
  const results: SubmitInvoiceResult[] = [];

  for (const integration of provider.integrations) {
    if (!integration.cancel) continue;

    const [latest] = await db
      .select()
      .from(countryIntegrationSubmissions)
      .where(
        and(
          eq(countryIntegrationSubmissions.orgId, orgCtx.id),
          eq(countryIntegrationSubmissions.countryCode, provider.code),
          eq(countryIntegrationSubmissions.kind, integration.kind),
          eq(countryIntegrationSubmissions.invoiceId, invoiceId),
          eq(
            countryIntegrationSubmissions.status,
            COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
          ),
        ),
      )
      .orderBy(desc(countryIntegrationSubmissions.createdAt))
      .limit(1);

    if (!latest?.externalId) continue;

    const cred = await loadCredentials(
      orgCtx.id,
      provider.code,
      integration.kind,
    );
    if (!cred) continue;

    const ctx = {
      invoiceId,
      orgId: orgCtx.id,
      countryCode: provider.code,
      kind: integration.kind,
      externalId: latest.externalId,
    };
    const done = log.time("cancel");

    let result;
    try {
      result = await integration.cancel({
        externalId: latest.externalId,
        orgId: orgCtx.id,
        credentials: cred.configJson,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Cancel threw";
      done("cancel threw", { ...ctx, errorMessage });
      results.push({
        kind: integration.kind,
        ok: false,
        submissionId: latest.id,
        error: errorMessage,
      });
      continue;
    }

    done("cancel finished", { ...ctx, ok: result.ok });

    if (result.ok) {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED,
          responseJson: result.responsePayload ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(countryIntegrationSubmissions.id, latest.id),
            eq(countryIntegrationSubmissions.orgId, orgCtx.id),
          ),
        );
    }

    results.push({
      kind: integration.kind,
      ok: result.ok,
      submissionId: latest.id,
      error: result.errorMessage,
    });
  }

  return results;
}
