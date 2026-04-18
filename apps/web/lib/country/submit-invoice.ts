import { db } from "@/lib/db";
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
): Promise<SubmitInvoiceResult[]> {
  const provider = getCountryProvider(orgCtx.countryCode);
  if (provider.integrations.length === 0) return [];

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgCtx.id)));
  if (!invoice) {
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

    let credentials: unknown = undefined;
    let credId: string | undefined;
    if (integration.requiresCredentials !== false) {
      const cred = await loadCredentials(
        orgCtx.id,
        provider.code,
        integration.kind,
      );
      if (!cred) {
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
      const validation = await integration.validate(
        buildInput(orgCtx, invoice, items, credentials),
      );
      if (!validation.ok) {
        results.push({
          kind: integration.kind,
          ok: false,
          error: validation.errors?.join("; "),
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

    const result = await integration.submit(
      buildInput(orgCtx, invoice, items, credentials),
    );

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
      if (credId) {
        await db
          .update(countryIntegrationCredentials)
          .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
          .where(eq(countryIntegrationCredentials.id, credId));
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

    const result = await integration.cancel({
      externalId: latest.externalId,
      orgId: orgCtx.id,
      credentials: cred.configJson,
    });

    if (result.ok) {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED,
          responseJson: result.responsePayload ?? null,
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, latest.id));
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
