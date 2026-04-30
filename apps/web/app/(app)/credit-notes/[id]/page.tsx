import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, and, asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  creditNotes,
  creditNoteItems,
  invoices,
  CREDIT_NOTE_STATUS,
} from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { MoneyWithBase } from "@/components/ui/money-with-base";
import { CreditNoteActions } from "./credit-note-actions";

const statusColors: Record<number, string> = {
  [CREDIT_NOTE_STATUS.DRAFT]:
    "bg-surface-container-highest text-on-surface-variant",
  [CREDIT_NOTE_STATUS.PUBLISHED]:
    "bg-secondary-container text-on-secondary-container",
  [CREDIT_NOTE_STATUS.SENT]:
    "bg-secondary-container text-on-secondary-container",
  [CREDIT_NOTE_STATUS.CANCELLED]: "bg-tertiary-container/20 text-tertiary",
};

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("creditNotes");

  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)));
  if (!cn) notFound();

  const items = await db
    .select()
    .from(creditNoteItems)
    .where(eq(creditNoteItems.creditNoteId, id))
    .orderBy(asc(creditNoteItems.sortOrder));

  let linkedInvoiceNumber: string | null = null;
  if (cn.invoiceId) {
    const [inv] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, cn.invoiceId));
    linkedInvoiceNumber = inv?.invoiceNumber ?? null;
  }

  const statusLabels: Record<number, string> = {
    [CREDIT_NOTE_STATUS.DRAFT]: t("statusDraft"),
    [CREDIT_NOTE_STATUS.PUBLISHED]: t("statusPublished"),
    [CREDIT_NOTE_STATUS.SENT]: t("statusSent"),
    [CREDIT_NOTE_STATUS.CANCELLED]: t("statusCancelled"),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/credit-notes"
            className="text-on-surface/50 hover:text-on-surface"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {cn.creditNoteNumber ?? t("draftHeading")}
          </h1>
          <Badge className={statusColors[cn.status] ?? ""} variant="outline">
            {statusLabels[cn.status]}
          </Badge>
        </div>
        <CreditNoteActions creditNote={cn} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("client")}
            </h3>
            <p className="text-on-surface font-medium">{cn.contactName}</p>
            {cn.contactEmail && (
              <p className="text-on-surface/60 text-sm">{cn.contactEmail}</p>
            )}
            {cn.contactVatNumber && (
              <p className="text-on-surface/60 text-sm font-mono">
                {cn.contactVatNumber}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("issueDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm">{cn.issueDate}</span>
            </div>
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("currency")}:
              </span>{" "}
              <span className="text-on-surface text-sm">{cn.currencyCode}</span>
            </div>
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("reason")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {t(
                  `reason${cn.reason.charAt(0).toUpperCase()}${cn.reason.slice(1)}`,
                )}
              </span>
            </div>
            {linkedInvoiceNumber && cn.invoiceId && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("creditsInvoice")}:
                </span>{" "}
                <Link
                  href={`/invoices/${cn.invoiceId}`}
                  className="text-primary hover:underline font-mono text-sm"
                >
                  {linkedInvoiceNumber}
                </Link>
              </div>
            )}
          </div>
        </div>
        {cn.reasonNote && (
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("reasonNote")}
            </h3>
            <p className="text-on-surface text-sm whitespace-pre-wrap">
              {cn.reasonNote}
            </p>
          </div>
        )}
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
                {t("lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-on-surface/5">
                <td className="px-2 py-3 text-on-surface text-sm">
                  {item.name}
                </td>
                <td className="px-2 py-3 text-right text-on-surface text-sm font-mono">
                  {item.quantity} {item.unit ?? ""}
                </td>
                <td className="px-2 py-3 text-right text-on-surface text-sm font-mono">
                  {item.unitPrice}
                </td>
                <td className="px-2 py-3 text-right text-on-surface text-sm font-mono font-semibold">
                  {item.lineTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <table className="w-64">
            <tbody>
              <tr>
                <td className="text-on-surface/60 text-sm py-1">
                  {t("subtotal")}
                </td>
                <td className="text-right font-mono text-sm py-1">
                  {cn.subtotal}
                </td>
              </tr>
              <tr>
                <td className="text-on-surface/60 text-sm py-1">{t("tax")}</td>
                <td className="text-right font-mono text-sm py-1">
                  {cn.taxAmount}
                </td>
              </tr>
              <tr className="border-t border-on-surface/20">
                <td className="font-bold py-2 text-tertiary">
                  {t("creditTotal")}
                </td>
                <td className="text-right font-mono font-bold py-2 text-tertiary">
                  <MoneyWithBase
                    amount={cn.total}
                    currencyCode={cn.currencyCode}
                    exchangeRate={cn.exchangeRate}
                    baseCurrency={session.org.defaultCurrency}
                    negate
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
