"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  invoices,
  invoiceItems,
  mydataCredentials,
  mydataTransmissions,
  MYDATA_TRANSMISSION_STATUS,
} from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { MyDataClient, MyDataApiError } from "@/lib/mydata/client";
import { decrypt } from "@/lib/mydata/encryption";
import { resolveDocumentType } from "@/lib/mydata/document-types";
import {
  resolveClassification,
  MYDATA_VAT_CATEGORIES,
} from "@/lib/mydata/classification-codes";
import { shouldRetry, getNextRetryAt } from "@/lib/mydata/retry";
import type { MyDataInvoice, MyDataConfig } from "@/lib/mydata/types";

async function getCredentials(
  orgId: string,
): Promise<{ config: MyDataConfig; credId: string } | null> {
  const [cred] = await db
    .select()
    .from(mydataCredentials)
    .where(
      and(
        eq(mydataCredentials.orgId, orgId),
        eq(mydataCredentials.isActive, true),
      ),
    );

  if (!cred) return null;

  return {
    credId: cred.id,
    config: {
      aadeUserId: cred.aadeUserId,
      subscriptionKey: decrypt(cred.subscriptionKey),
      environment: cred.environment as "production" | "sandbox",
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

  // Create transmission record
  const [transmission] = await db
    .insert(mydataTransmissions)
    .values({
      orgId: session.org.id,
      invoiceId,
      documentType,
      classificationCategory: classification.category,
      classificationType: classification.type,
      paymentMethod: 5,
      status: MYDATA_TRANSMISSION_STATUS.PENDING,
    })
    .returning();

  // Update invoice mydata status
  await db
    .update(invoices)
    .set({
      mydataDocumentType: documentType,
      mydataStatus: MYDATA_TRANSMISSION_STATUS.PENDING,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  try {
    const client = new MyDataClient(creds.config);
    const { results, requestXml, responseXml } = await client.sendInvoices([
      myDataInvoice,
    ]);

    const result = results[0];

    if (result.statusCode === "Success") {
      await db
        .update(mydataTransmissions)
        .set({
          status: MYDATA_TRANSMISSION_STATUS.CONFIRMED,
          invoiceUid: result.invoiceUid,
          invoiceMark: result.invoiceMark,
          qrUrl: result.qrUrl,
          requestXml,
          responseXml,
          attemptCount: 1,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mydataTransmissions.id, transmission.id));

      await db
        .update(invoices)
        .set({
          mydataMark: result.invoiceMark,
          mydataQrUrl: result.qrUrl,
          mydataStatus: MYDATA_TRANSMISSION_STATUS.CONFIRMED,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      // Update credential last validated
      await db
        .update(mydataCredentials)
        .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
        .where(eq(mydataCredentials.id, creds.credId));
    } else {
      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      const errorCode = result.errors?.[0]?.code ?? "UNKNOWN";

      await db
        .update(mydataTransmissions)
        .set({
          status: shouldRetry(1)
            ? MYDATA_TRANSMISSION_STATUS.RETRY_SCHEDULED
            : MYDATA_TRANSMISSION_STATUS.FAILED_PERMANENT,
          errorCode,
          errorMessage: errorMsg,
          requestXml,
          responseXml,
          attemptCount: 1,
          nextRetryAt: shouldRetry(1) ? getNextRetryAt(1) : null,
          updatedAt: new Date(),
        })
        .where(eq(mydataTransmissions.id, transmission.id));

      await db
        .update(invoices)
        .set({
          mydataStatus: MYDATA_TRANSMISSION_STATUS.FAILED,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));
    }
  } catch (error) {
    const errorMsg =
      error instanceof MyDataApiError
        ? `HTTP ${error.statusCode}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error";

    await db
      .update(mydataTransmissions)
      .set({
        status: shouldRetry(1)
          ? MYDATA_TRANSMISSION_STATUS.RETRY_SCHEDULED
          : MYDATA_TRANSMISSION_STATUS.FAILED_PERMANENT,
        errorMessage: errorMsg,
        attemptCount: 1,
        nextRetryAt: shouldRetry(1) ? getNextRetryAt(1) : null,
        updatedAt: new Date(),
      })
      .where(eq(mydataTransmissions.id, transmission.id));

    await db
      .update(invoices)
      .set({
        mydataStatus: MYDATA_TRANSMISSION_STATUS.FAILED,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    return { success: false, error: errorMsg, transmissionId: transmission.id };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true, transmissionId: transmission.id };
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
  if (!invoice.mydataMark) {
    return { success: false, error: "Invoice has no myDATA MARK" };
  }

  try {
    const client = new MyDataClient(creds.config);
    const { result, responseXml } = await client.cancelInvoice(
      invoice.mydataMark,
    );

    if (result.statusCode === "Success") {
      // Update transmission
      const [tx] = await db
        .select()
        .from(mydataTransmissions)
        .where(
          and(
            eq(mydataTransmissions.invoiceId, invoiceId),
            eq(
              mydataTransmissions.status,
              MYDATA_TRANSMISSION_STATUS.CONFIRMED,
            ),
          ),
        );

      if (tx) {
        await db
          .update(mydataTransmissions)
          .set({
            status: MYDATA_TRANSMISSION_STATUS.CANCELLED,
            cancellationMark: result.invoiceMark,
            responseXml,
            updatedAt: new Date(),
          })
          .where(eq(mydataTransmissions.id, tx.id));
      }

      await db
        .update(invoices)
        .set({
          mydataStatus: MYDATA_TRANSMISSION_STATUS.CANCELLED,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

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

export async function retryMyDataSubmission(transmissionId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [tx] = await db
    .select()
    .from(mydataTransmissions)
    .where(
      and(
        eq(mydataTransmissions.id, transmissionId),
        eq(mydataTransmissions.orgId, session.org.id),
      ),
    );

  if (!tx) return { success: false, error: "Transmission not found" };

  // Reset and resubmit
  await db
    .update(mydataTransmissions)
    .set({
      status: MYDATA_TRANSMISSION_STATUS.PENDING,
      attemptCount: 0,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
      updatedAt: new Date(),
    })
    .where(eq(mydataTransmissions.id, transmissionId));

  return submitToMyData(tx.invoiceId);
}
