"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  invoices,
  invoiceItems,
  countryIntegrationCredentials,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  MyDataClient,
  MyDataApiError,
} from "@/lib/country/providers/gr/integrations/mydata/client";
import { decrypt } from "@/lib/country/providers/gr/integrations/mydata/encryption";
import { resolveDocumentType } from "@/lib/country/providers/gr/integrations/mydata/document-types";
import {
  resolveClassification,
  MYDATA_VAT_CATEGORIES,
} from "@/lib/country/providers/gr/integrations/mydata/classification-codes";
import {
  shouldRetry,
  getNextRetryAt,
} from "@/lib/country/providers/gr/integrations/mydata/retry";
import type {
  MyDataInvoice,
  MyDataConfig,
} from "@/lib/country/providers/gr/integrations/mydata/types";

const GR = "GR";
const MYDATA = "mydata";

interface MydataCredConfig {
  aadeUserId: string;
  subscriptionKey: string;
  environment: "production" | "sandbox";
}

async function getCredentials(
  orgId: string,
): Promise<{ config: MyDataConfig; credId: string } | null> {
  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, orgId),
        eq(countryIntegrationCredentials.countryCode, GR),
        eq(countryIntegrationCredentials.kind, MYDATA),
        eq(countryIntegrationCredentials.isActive, true),
      ),
    );

  if (!cred) return null;

  const cfg = cred.configJson as MydataCredConfig;

  return {
    credId: cred.id,
    config: {
      aadeUserId: cfg.aadeUserId,
      subscriptionKey: decrypt(cfg.subscriptionKey),
      environment: cfg.environment,
    },
  };
}

function buildMyDataInvoice(
  invoice: typeof invoices.$inferSelect,
  items: (typeof invoiceItems.$inferSelect)[],
  orgTaxId: string,
  documentType: string,
  classification: { category: string; type: string },
): MyDataInvoice {
  const isB2C = !invoice.contactVatNumber;

  // Determine series from invoice number prefix
  const series = invoice.invoiceNumber.replace(/[-\d]+$/, "") || "INV";

  const invoiceDetails = items.map((item, idx) => {
    const taxRate = Number(item.taxRate);
    const vatCat = MYDATA_VAT_CATEGORIES[taxRate]?.category ?? 1;

    return {
      lineNumber: idx + 1,
      netValue: item.lineTotal,
      vatCategory: vatCat,
      vatAmount: item.taxAmount,
      incomeClassification: {
        classificationType: classification.type,
        classificationCategory: classification.category,
        amount: item.lineTotal,
      },
    };
  });

  return {
    issuer: {
      vatNumber: orgTaxId,
      country: "GR",
      branch: 0,
    },
    counterpart: isB2C
      ? undefined
      : {
          vatNumber: invoice.contactVatNumber!,
          country: "GR",
          branch: 0,
        },
    invoiceHeader: {
      series,
      aa: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      invoiceType: documentType,
      currency: invoice.currencyCode,
    },
    paymentMethods: [{ type: 5, amount: invoice.total }],
    invoiceDetails,
    invoiceSummary: {
      totalNetValue: invoice.subtotal,
      totalVatAmount: invoice.taxAmount,
      totalWithheldAmount: "0.00",
      totalFeesAmount: "0.00",
      totalStampDutyAmount: "0.00",
      totalOtherTaxesAmount: "0.00",
      totalDeductionsAmount: "0.00",
      totalGrossValue: invoice.total,
      incomeClassification: {
        classificationType: classification.type,
        classificationCategory: classification.category,
        amount: invoice.subtotal,
      },
    },
  };
}

export async function submitToMyData(invoiceId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const creds = await getCredentials(session.org.id);
  if (!creds) return { success: false, error: "No myDATA credentials found" };

  if (!session.org.taxId) {
    return { success: false, error: "Organisation has no tax ID" };
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, session.org.id)));

  if (!invoice) return { success: false, error: "Invoice not found" };

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.sortOrder));

  // Determine if service-based (simple heuristic: check if any item has unit "hour" or "day")
  const isService = items.some(
    (i) => i.unit === "hour" || i.unit === "day" || i.unit === "service",
  );

  const documentType = resolveDocumentType({
    contactCountryCode: "GR",
    contactVatNumber: invoice.contactVatNumber,
    isService,
    isCreditNote: false,
    relatedInvoiceId: null,
  });

  const classification = resolveClassification(documentType, isService);

  const myDataInvoice = buildMyDataInvoice(
    invoice,
    items,
    session.org.taxId,
    documentType,
    classification,
  );

  const [submission] = await db
    .insert(countryIntegrationSubmissions)
    .values({
      orgId: session.org.id,
      countryCode: GR,
      kind: MYDATA,
      invoiceId,
      status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING,
      requestJson: {
        documentType,
        classificationCategory: classification.category,
        classificationType: classification.type,
        paymentMethod: 5,
      },
    })
    .returning();

  try {
    const client = new MyDataClient(creds.config);
    const { results, requestXml, responseXml } = await client.sendInvoices([
      myDataInvoice,
    ]);

    const result = results[0];

    if (result.statusCode === "Success") {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
          externalId: result.invoiceMark,
          qrUrl: result.qrUrl,
          requestJson: {
            documentType,
            classificationCategory: classification.category,
            classificationType: classification.type,
            paymentMethod: 5,
            invoiceUid: result.invoiceUid,
            xml: requestXml,
          },
          responseJson: { xml: responseXml },
          attemptCount: 1,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, submission.id));

      await db
        .update(countryIntegrationCredentials)
        .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
        .where(eq(countryIntegrationCredentials.id, creds.credId));
    } else {
      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      const errorCode = result.errors?.[0]?.code ?? "UNKNOWN";

      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: shouldRetry(1)
            ? COUNTRY_INTEGRATION_SUBMISSION_STATUS.RETRY_SCHEDULED
            : COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED_PERMANENT,
          errorCode,
          errorMessage: errorMsg,
          requestJson: {
            documentType,
            classificationCategory: classification.category,
            classificationType: classification.type,
            paymentMethod: 5,
            xml: requestXml,
          },
          responseJson: { xml: responseXml },
          attemptCount: 1,
          nextRetryAt: shouldRetry(1) ? getNextRetryAt(1) : null,
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, submission.id));
    }
  } catch (error) {
    const errorMsg =
      error instanceof MyDataApiError
        ? `HTTP ${error.statusCode}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error";

    await db
      .update(countryIntegrationSubmissions)
      .set({
        status: shouldRetry(1)
          ? COUNTRY_INTEGRATION_SUBMISSION_STATUS.RETRY_SCHEDULED
          : COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED_PERMANENT,
        errorMessage: errorMsg,
        attemptCount: 1,
        nextRetryAt: shouldRetry(1) ? getNextRetryAt(1) : null,
        updatedAt: new Date(),
      })
      .where(eq(countryIntegrationSubmissions.id, submission.id));

    return { success: false, error: errorMsg, submissionId: submission.id };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true, submissionId: submission.id };
}

export async function cancelOnMyData(invoiceId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const creds = await getCredentials(session.org.id);
  if (!creds) return { success: false, error: "No myDATA credentials found" };

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, session.org.id)));

  if (!invoice) return { success: false, error: "Invoice not found" };

  const [latest] = await db
    .select()
    .from(countryIntegrationSubmissions)
    .where(
      and(
        eq(countryIntegrationSubmissions.invoiceId, invoiceId),
        eq(countryIntegrationSubmissions.countryCode, GR),
        eq(countryIntegrationSubmissions.kind, MYDATA),
        eq(
          countryIntegrationSubmissions.status,
          COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
        ),
      ),
    )
    .orderBy(desc(countryIntegrationSubmissions.createdAt))
    .limit(1);

  if (!latest?.externalId) {
    return { success: false, error: "Invoice has no myDATA MARK" };
  }

  try {
    const client = new MyDataClient(creds.config);
    const { result, responseXml } = await client.cancelInvoice(
      latest.externalId,
    );

    if (result.statusCode === "Success") {
      await db
        .update(countryIntegrationSubmissions)
        .set({
          status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED,
          responseJson: {
            xml: responseXml,
            cancellationMark: result.invoiceMark,
          },
          updatedAt: new Date(),
        })
        .where(eq(countryIntegrationSubmissions.id, latest.id));

      revalidatePath("/invoices");
      revalidatePath(`/invoices/${invoiceId}`);
      return { success: true };
    } else {
      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMsg };
  }
}

export async function retryMyDataSubmission(submissionId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [sub] = await db
    .select()
    .from(countryIntegrationSubmissions)
    .where(
      and(
        eq(countryIntegrationSubmissions.id, submissionId),
        eq(countryIntegrationSubmissions.orgId, session.org.id),
      ),
    );

  if (!sub) return { success: false, error: "Submission not found" };
  if (!sub.invoiceId)
    return { success: false, error: "Submission has no invoice" };

  // Reset and resubmit
  await db
    .update(countryIntegrationSubmissions)
    .set({
      status: COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING,
      attemptCount: 0,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
      updatedAt: new Date(),
    })
    .where(eq(countryIntegrationSubmissions.id, submissionId));

  return submitToMyData(sub.invoiceId);
}
