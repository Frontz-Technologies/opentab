import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type {
  Integration,
  IntegrationCreditNoteInput,
  IntegrationInvoiceInput,
  IntegrationSubmitResult,
  IntegrationValidateResult,
} from "@/lib/country/types";
import { db } from "@/lib/db";
import {
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { MyDataClient, MyDataApiError } from "./client";
import { decrypt } from "./encryption";
import { resolveDocumentType } from "./document-types";
import {
  resolveClassification,
  MYDATA_VAT_CATEGORIES,
} from "./classification-codes";
import type { MyDataConfig, MyDataInvoice } from "./types";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("mydata");

interface MydataCredentials {
  aadeUserId: string;
  subscriptionKey: string;
  environment: "production" | "sandbox";
}

function decryptCredentials(raw: unknown): MyDataConfig {
  const cfg = raw as MydataCredentials;
  return {
    aadeUserId: cfg.aadeUserId,
    subscriptionKey: decrypt(cfg.subscriptionKey),
    environment: cfg.environment,
  };
}

async function findParentMark(
  orgId: string,
  parentInvoiceId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ externalId: countryIntegrationSubmissions.externalId })
    .from(countryIntegrationSubmissions)
    .where(
      and(
        eq(countryIntegrationSubmissions.orgId, orgId),
        eq(countryIntegrationSubmissions.invoiceId, parentInvoiceId),
        eq(countryIntegrationSubmissions.kind, "mydata"),
        eq(
          countryIntegrationSubmissions.status,
          COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
        ),
      ),
    )
    .orderBy(desc(countryIntegrationSubmissions.submittedAt))
    .limit(1);
  return row?.externalId ?? null;
}

function buildMyDataCreditNote(
  input: IntegrationCreditNoteInput,
  documentType: string,
  classification: { category: string; type: string },
  parentMark: string | null,
): MyDataInvoice {
  const { creditNote, items, orgTaxId } = input;
  const isB2C = !creditNote.contactVatNumber;
  const series = creditNote.creditNoteNumber.replace(/[-\d]+$/, "") || "CN";

  const invoiceDetails = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, idx) => {
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
    issuer: { vatNumber: orgTaxId ?? "", country: "GR", branch: 0 },
    counterpart: isB2C
      ? undefined
      : {
          vatNumber: creditNote.contactVatNumber!,
          country: "GR",
          branch: 0,
        },
    invoiceHeader: {
      series,
      aa: creditNote.creditNoteNumber,
      issueDate: creditNote.issueDate,
      invoiceType: documentType,
      currency: creditNote.currencyCode,
    },
    correlatedInvoices: parentMark ? [parentMark] : undefined,
    paymentMethods: [{ type: 5, amount: creditNote.total }],
    invoiceDetails,
    invoiceSummary: {
      totalNetValue: creditNote.subtotal,
      totalVatAmount: creditNote.taxAmount,
      totalWithheldAmount: "0.00",
      totalFeesAmount: "0.00",
      totalStampDutyAmount: "0.00",
      totalOtherTaxesAmount: "0.00",
      totalDeductionsAmount: "0.00",
      totalGrossValue: creditNote.total,
      incomeClassification: {
        classificationType: classification.type,
        classificationCategory: classification.category,
        amount: creditNote.subtotal,
      },
    },
  };
}

function buildMyDataInvoice(
  input: IntegrationInvoiceInput,
  documentType: string,
  classification: { category: string; type: string },
): MyDataInvoice {
  const { invoice, items, orgTaxId, credentials: _c } = input;
  const isB2C = !invoice.contactVatNumber;
  const series = invoice.invoiceNumber.replace(/[-\d]+$/, "") || "INV";

  const invoiceDetails = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, idx) => {
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
      vatNumber: orgTaxId ?? "",
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

const mydataConfigSchema = z.object({
  aadeUserId: z.string().min(1),
  subscriptionKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

export const MydataIntegration: Integration = {
  kind: "mydata",
  label: "myDATA (AADE)",
  description: "Submits Greek invoices to the AADE e-invoicing platform",

  requiresCredentials: true,
  configSchema: mydataConfigSchema,
  publicFields: ["aadeUserId", "environment"],

  async validateCredentials(raw, ctx): Promise<IntegrationValidateResult> {
    let config: MyDataConfig;
    try {
      config = decryptCredentials(raw);
    } catch (error) {
      log.error("validateCredentials: decrypt failed", {
        orgId: ctx.orgId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        errors: ["Unable to decrypt credentials — contact support"],
      };
    }

    if (!config.aadeUserId || !config.subscriptionKey) {
      log.warn("validateCredentials: missing fields", {
        orgId: ctx.orgId,
        environment: config.environment,
      });
      return { ok: false, errors: ["Missing aadeUserId or subscriptionKey"] };
    }

    try {
      const client = new MyDataClient(config);
      await client.checkCredentials();
      log.info("validateCredentials: ok", {
        orgId: ctx.orgId,
        environment: config.environment,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof MyDataApiError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          log.warn("validateCredentials: invalid credentials", {
            orgId: ctx.orgId,
            status: error.statusCode,
          });
          return { ok: false, errors: ["Invalid credentials"] };
        }
        log.error("validateCredentials: non-auth HTTP error", {
          orgId: ctx.orgId,
          status: error.statusCode,
        });
        return {
          ok: false,
          errors: [`myDATA returned HTTP ${error.statusCode}`],
        };
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log.error("validateCredentials: network error", {
        orgId: ctx.orgId,
        errorMessage,
      });
      // Don't surface raw fetch error messages to the browser — they may
      // include endpoint URLs, DNS names, etc. Log detail server-side.
      return { ok: false, errors: ["Network error"] };
    }
  },

  async validate(input): Promise<IntegrationValidateResult> {
    const errors: string[] = [];
    if (!input.orgTaxId) errors.push("Organisation has no tax ID");
    if (!input.invoice.invoiceNumber) errors.push("Invoice has no number");
    if (input.items.length === 0) errors.push("Invoice has no items");
    return {
      ok: errors.length === 0,
      errors: errors.length ? errors : undefined,
    };
  },

  async submit(input): Promise<IntegrationSubmitResult> {
    if (!input.orgTaxId) {
      return { ok: false, errorMessage: "Organisation has no tax ID" };
    }

    const isService = input.items.some(
      (i) => i.unit === "hour" || i.unit === "day" || i.unit === "service",
    );

    const documentType = resolveDocumentType({
      contactCountryCode: "GR",
      contactVatNumber: input.invoice.contactVatNumber,
      isService,
      isCreditNote: false,
      relatedInvoiceId: null,
    });

    const classification = resolveClassification(documentType, isService);
    const myDataInvoice = buildMyDataInvoice(
      input,
      documentType,
      classification,
    );

    let config: MyDataConfig;
    try {
      config = decryptCredentials(input.credentials);
    } catch (error) {
      log.error("submit: decrypt failed", {
        orgId: input.orgId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        errorMessage: "Unable to decrypt credentials — contact support",
      };
    }

    try {
      const client = new MyDataClient(config);
      const { results, requestXml, responseXml } = await client.sendInvoices([
        myDataInvoice,
      ]);
      const result = results[0];

      if (result.statusCode === "Success") {
        return {
          ok: true,
          externalId: result.invoiceMark,
          qrUrl: result.qrUrl,
          requestPayload: {
            documentType,
            classificationCategory: classification.category,
            classificationType: classification.type,
            paymentMethod: 5,
            invoiceUid: result.invoiceUid,
            xml: requestXml,
          },
          responsePayload: { xml: responseXml },
        };
      }

      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      const errorCode = result.errors?.[0]?.code ?? "UNKNOWN";
      return {
        ok: false,
        errorCode,
        errorMessage: errorMsg,
        requestPayload: {
          documentType,
          classificationCategory: classification.category,
          classificationType: classification.type,
          paymentMethod: 5,
          xml: requestXml,
        },
        responsePayload: { xml: responseXml },
      };
    } catch (error) {
      const errorMsg =
        error instanceof MyDataApiError
          ? `HTTP ${error.statusCode}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Unknown error";
      return { ok: false, errorMessage: errorMsg };
    }
  },

  async submitCreditNote(
    input: IntegrationCreditNoteInput,
  ): Promise<IntegrationSubmitResult> {
    if (!input.orgTaxId) {
      return { ok: false, errorMessage: "Organisation has no tax ID" };
    }

    const isService = input.items.some(
      (i) => i.unit === "hour" || i.unit === "day" || i.unit === "service",
    );

    const documentType = resolveDocumentType({
      contactCountryCode: "GR",
      contactVatNumber: input.creditNote.contactVatNumber,
      isService,
      isCreditNote: true,
      relatedInvoiceId: input.parentInvoice?.id ?? null,
    });

    const classification = resolveClassification(documentType, isService);

    let parentMark: string | null = null;
    if (input.parentInvoice && documentType === "5.1") {
      parentMark = await findParentMark(input.orgId, input.parentInvoice.id);
      if (!parentMark) {
        log.warn("submitCreditNote: parent has no confirmed MARK", {
          orgId: input.orgId,
          parentInvoiceId: input.parentInvoice.id,
          creditNoteId: input.creditNote.id,
        });
        return {
          ok: false,
          errorCode: "MISSING_PARENT_MARK",
          errorMessage:
            "Parent invoice has no confirmed myDATA MARK — cannot submit as 5.1",
        };
      }
    }

    const myDataInvoice = buildMyDataCreditNote(
      input,
      documentType,
      classification,
      parentMark,
    );

    let config: MyDataConfig;
    try {
      config = decryptCredentials(input.credentials);
    } catch (error) {
      log.error("submitCreditNote: decrypt failed", {
        orgId: input.orgId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        errorMessage: "Unable to decrypt credentials — contact support",
      };
    }

    try {
      const client = new MyDataClient(config);
      const { results, requestXml, responseXml } = await client.sendInvoices([
        myDataInvoice,
      ]);
      const result = results[0];

      if (result.statusCode === "Success") {
        return {
          ok: true,
          externalId: result.invoiceMark,
          qrUrl: result.qrUrl,
          requestPayload: {
            documentType,
            classificationCategory: classification.category,
            classificationType: classification.type,
            paymentMethod: 5,
            invoiceUid: result.invoiceUid,
            parentMark,
            xml: requestXml,
          },
          responsePayload: { xml: responseXml },
        };
      }

      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      const errorCode = result.errors?.[0]?.code ?? "UNKNOWN";
      return {
        ok: false,
        errorCode,
        errorMessage: errorMsg,
        requestPayload: {
          documentType,
          classificationCategory: classification.category,
          classificationType: classification.type,
          paymentMethod: 5,
          parentMark,
          xml: requestXml,
        },
        responsePayload: { xml: responseXml },
      };
    } catch (error) {
      const errorMsg =
        error instanceof MyDataApiError
          ? `HTTP ${error.statusCode}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Unknown error";
      return { ok: false, errorMessage: errorMsg };
    }
  },

  async cancel({
    externalId,
    orgId,
    credentials,
  }): Promise<IntegrationSubmitResult> {
    let config: MyDataConfig;
    try {
      config = decryptCredentials(credentials);
    } catch (error) {
      log.error("cancel: decrypt failed", {
        orgId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        errorMessage: "Unable to decrypt credentials — contact support",
      };
    }
    try {
      const client = new MyDataClient(config);
      const { result, responseXml } = await client.cancelInvoice(externalId);
      if (result.statusCode === "Success") {
        return {
          ok: true,
          externalId: result.invoiceMark,
          responsePayload: {
            xml: responseXml,
            cancellationMark: result.invoiceMark,
          },
        };
      }
      const errorMsg =
        result.errors?.map((e) => e.message).join("; ") ?? "Unknown error";
      return { ok: false, errorMessage: errorMsg };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return { ok: false, errorMessage: errorMsg };
    }
  },

  async renderOnPdf({ submission }) {
    if (!submission.externalId && !submission.qrUrl) return "";
    const parts: string[] = [];
    if (submission.externalId) {
      parts.push(
        `<div class="mydata-stamp" style="background:#f3f4f6;border-radius:6px;padding:8px 12px;display:inline-block;margin-top:4px;">
          <div class="mark-label" style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">MARK</div>
          <div class="mark-number" style="font-family:monospace;font-size:14px;color:#1a1a2e;font-weight:600;">${submission.externalId}</div>
        </div>`,
      );
    }
    if (submission.qrUrl) {
      const { generateMyDataQR } = await import("./qr");
      const dataUrl = await generateMyDataQR(submission.qrUrl);
      parts.push(
        `<div class="mydata-footer" style="margin-top:30px;display:flex;justify-content:flex-end;align-items:flex-end;gap:12px;">
          <div>
            <img src="${dataUrl}" alt="myDATA QR" width="80" height="80" />
            <span class="qr-label" style="font-size:9px;color:#6b7280;display:block;text-align:center;margin-top:4px;">Verify on myDATA</span>
          </div>
        </div>`,
      );
    }
    return parts.join("\n");
  },

  renderInvoiceStatus: "./render-status",

  settingsPage: {
    slug: "mydata",
    component: "./settings-form",
  },

  dashboardModule: {
    slot: "summary",
    component: "./dashboard",
  },

  syncInbound: {
    cadence: "daily",
    async run(_ctx) {
      // Phase 3 implements AADE inbound pull → inbound_documents table
      return { fetched: 0 };
    },
  },
};
