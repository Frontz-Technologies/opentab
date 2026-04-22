import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  invoices,
  invoiceItems,
  countryIntegrationSubmissions,
  INVOICE_STATUS,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "./invoice-actions";
import { MYDATA_DOCUMENT_TYPES } from "@/lib/country/providers/gr/integrations/mydata/document-types";
import { getCountryProvider } from "@/lib/country";

// Unified with the list-view map in ../invoice-list.tsx — same states,
// same tokens (semantic, not raw Tailwind), same chips across detail
// and list surfaces.
const statusColors: Record<number, string> = {
  [INVOICE_STATUS.DRAFT]:
    "bg-surface-container-highest text-on-surface-variant",
  [INVOICE_STATUS.PUBLISHED]: "bg-warning/15 text-warning",
  [INVOICE_STATUS.SENT]: "bg-secondary-container text-secondary",
  [INVOICE_STATUS.PARTIAL]: "bg-warning/15 text-warning",
  [INVOICE_STATUS.PAID]: "bg-primary-container/20 text-primary",
  [INVOICE_STATUS.CANCELLED]: "bg-tertiary-container/20 text-tertiary",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("invoices");

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) notFound();

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.sortOrder));

  const provider = getCountryProvider(session.org.countryCode);
  const mydataIntegration = provider.integrations.find(
    (i) => i.kind === "mydata",
  );
  let latestTransmission:
    | typeof countryIntegrationSubmissions.$inferSelect
    | null = null;
  if (mydataIntegration) {
    const [tx] = await db
      .select()
      .from(countryIntegrationSubmissions)
      .where(
        and(
          eq(countryIntegrationSubmissions.invoiceId, id),
          eq(countryIntegrationSubmissions.countryCode, provider.code),
          eq(countryIntegrationSubmissions.kind, "mydata"),
        ),
      )
      .orderBy(desc(countryIntegrationSubmissions.createdAt))
      .limit(1);
    latestTransmission = tx ?? null;
  }
  const hasMyData = latestTransmission !== null;
  const mydataStatus = latestTransmission?.status ?? null;
  const mydataMark = latestTransmission?.externalId ?? null;
  const mydataError = latestTransmission?.errorMessage ?? null;
  const mydataDocumentType =
    (latestTransmission?.requestJson as { documentType?: string } | null)
      ?.documentType ?? null;

  const statusLabels: Record<number, string> = {
    [INVOICE_STATUS.DRAFT]: t("statusDraft"),
    [INVOICE_STATUS.PUBLISHED]: t("statusPublished"),
    [INVOICE_STATUS.SENT]: t("statusSent"),
    [INVOICE_STATUS.PARTIAL]: t("statusPartial"),
    [INVOICE_STATUS.PAID]: t("statusPaid"),
    [INVOICE_STATUS.CANCELLED]: t("statusCancelled"),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {invoice.invoiceNumber}
          </h1>
          <Badge
            className={statusColors[invoice.status] ?? ""}
            variant="outline"
          >
            {statusLabels[invoice.status]}
          </Badge>
        </div>
        <InvoiceActions invoice={invoice} mydataStatus={mydataStatus} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("client")}
            </h3>
            <p className="text-on-surface font-medium">{invoice.contactName}</p>
            {invoice.contactEmail && (
              <p className="text-on-surface/60 text-sm">
                {invoice.contactEmail}
              </p>
            )}
            {invoice.contactVatNumber && (
              <p className="text-on-surface/60 text-sm font-mono">
                {invoice.contactVatNumber}
              </p>
            )}
            {invoice.contactAddress && (
              <p className="text-on-surface/60 text-sm">
                {invoice.contactAddress}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("issueDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {invoice.issueDate}
              </span>
            </div>
            {invoice.dueDate && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("dueDate")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {invoice.dueDate}
                </span>
              </div>
            )}
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("currency")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {invoice.currencyCode}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          {t("lineItems")}
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-on-surface/10">
              <th className="text-left px-2 py-2 font-label text-sm text-on-surface/60">
                {t("itemName")}
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                {t("quantity")}
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                {t("unitPrice")}
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                {t("taxRate")}
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                {t("lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-on-surface/5">
                <td className="px-2 py-3">
                  <p className="text-on-surface text-sm font-medium">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-on-surface/50 text-xs">
                      {item.description}
                    </p>
                  )}
                </td>
                <td className="px-2 py-3 text-right text-sm font-mono text-on-surface/60">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-2 py-3 text-right text-sm font-mono text-on-surface/60">
                  {item.unitPrice}
                </td>
                <td className="px-2 py-3 text-right text-sm font-mono text-on-surface/60">
                  {item.taxRate}%
                </td>
                <td className="px-2 py-3 text-right text-sm font-mono text-on-surface font-medium">
                  {item.lineTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-on-surface/60">
              <span>{t("subtotal")}</span>
              <span className="font-mono">{invoice.subtotal}</span>
            </div>
            <div className="flex justify-between text-on-surface/60">
              <span>{t("taxAmount")}</span>
              <span className="font-mono">{invoice.taxAmount}</span>
            </div>
            <div className="flex justify-between text-on-surface font-semibold border-t border-on-surface/10 pt-1">
              <span>{t("totalAmount")}</span>
              <span className="font-mono">
                {invoice.currencyCode} {invoice.total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div className="bg-surface-container rounded-xl p-6 space-y-4">
          {invoice.notes && (
            <div>
              <h3 className="font-label text-sm text-on-surface/60 mb-1">
                {t("notes")}
              </h3>
              <p className="text-on-surface text-sm whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <h3 className="font-label text-sm text-on-surface/60 mb-1">
                {t("terms")}
              </h3>
              <p className="text-on-surface text-sm whitespace-pre-wrap">
                {invoice.terms}
              </p>
            </div>
          )}
        </div>
      )}

      {hasMyData && (
        <div className="bg-surface-container rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              myDATA
            </h3>
            <Badge
              className={
                mydataStatus === COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED
                  ? "bg-primary text-on-primary"
                  : mydataStatus ===
                        COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING ||
                      mydataStatus ===
                        COUNTRY_INTEGRATION_SUBMISSION_STATUS.SUBMITTED
                    ? "bg-warning/15 text-warning"
                    : mydataStatus ===
                        COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED
                      ? "bg-surface-container-high text-on-surface-variant"
                      : "bg-tertiary-container/20 text-tertiary"
              }
              variant="outline"
            >
              {mydataStatus === COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED
                ? t("mydataConfirmed")
                : mydataStatus === COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING
                  ? t("mydataPending")
                  : mydataStatus ===
                      COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED
                    ? t("mydataCancelled")
                    : t("mydataFailed")}
            </Badge>
          </div>

          {mydataStatus === COUNTRY_INTEGRATION_SUBMISSION_STATUS.FAILED &&
            mydataError && (
              <div
                role="alert"
                className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error flex items-start gap-2"
              >
                <span className="material-symbols-outlined text-[16px] leading-none">
                  error
                </span>
                <span>{t("mydataFailedTooltip", { error: mydataError })}</span>
              </div>
            )}

          <div className="grid grid-cols-2 gap-4">
            {mydataMark && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  MARK:
                </span>{" "}
                <span className="text-on-surface text-sm font-mono">
                  {mydataMark}
                </span>
              </div>
            )}
            {mydataDocumentType && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("mydataDocumentType")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {mydataDocumentType}{" "}
                  {MYDATA_DOCUMENT_TYPES[mydataDocumentType]?.nameEn ?? ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
