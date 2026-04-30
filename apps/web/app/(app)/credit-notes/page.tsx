import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, desc } from "drizzle-orm";
import { Plus, ReceiptText, Upload } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { creditNotes, CREDIT_NOTE_STATUS } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { MoneyWithBase } from "@/components/ui/money-with-base";
import { PageHeader } from "@/components/layout/page-header";

const statusColors: Record<number, string> = {
  [CREDIT_NOTE_STATUS.DRAFT]:
    "bg-surface-container-highest text-on-surface-variant",
  [CREDIT_NOTE_STATUS.PUBLISHED]:
    "bg-secondary-container text-on-secondary-container",
  [CREDIT_NOTE_STATUS.SENT]:
    "bg-secondary-container text-on-secondary-container",
  [CREDIT_NOTE_STATUS.CANCELLED]: "bg-tertiary-container/20 text-tertiary",
};

export default async function CreditNotesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("creditNotes");

  const rows = await db
    .select()
    .from(creditNotes)
    .where(eq(creditNotes.orgId, session.org.id))
    .orderBy(desc(creditNotes.createdAt));

  const statusLabels: Record<number, string> = {
    [CREDIT_NOTE_STATUS.DRAFT]: t("statusDraft"),
    [CREDIT_NOTE_STATUS.PUBLISHED]: t("statusPublished"),
    [CREDIT_NOTE_STATUS.SENT]: t("statusSent"),
    [CREDIT_NOTE_STATUS.CANCELLED]: t("statusCancelled"),
  };

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/import/credit-notes"
              aria-label={t("import")}
              className="inline-flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg border border-on-surface/20 text-on-surface font-medium text-sm hover:bg-surface-container-low transition-colors"
            >
              <Upload className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline">{t("import")}</span>
            </Link>
            <Link
              href="/credit-notes/new"
              aria-label={t("addCreditNote")}
              className="inline-flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
            >
              <Plus className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline">{t("addCreditNote")}</span>
            </Link>
          </div>
        }
      />
      <div className="px-6 py-6 space-y-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <ReceiptText className="h-12 w-12 text-on-surface-variant mb-4" />
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
              {t("noCreditNotes")}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm mb-6">
              {t("noCreditNotesDescription")}
            </p>
            <Link
              href="/credit-notes/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <Plus className="h-[18px] w-[18px]" />
              {t("addCreditNote")}
            </Link>
          </div>
        ) : (
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-on-surface/10">
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("number")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("client")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("issueDate")}
                  </th>
                  <th className="text-right px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("total")}
                  </th>
                  <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                    {t("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((cn) => (
                  <tr
                    key={cn.id}
                    className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm">
                      <Link
                        href={`/credit-notes/${cn.id}`}
                        className="text-on-surface hover:text-primary"
                      >
                        {cn.creditNoteNumber ?? t("placeholderDraft")}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface text-sm">
                      {cn.contactName}
                    </td>
                    <td className="px-4 py-3 text-on-surface/60 text-sm">
                      {cn.issueDate}
                    </td>
                    <td className="px-4 py-3 text-on-surface text-sm text-right font-mono">
                      <MoneyWithBase
                        amount={cn.total}
                        currencyCode={cn.currencyCode}
                        exchangeRate={cn.exchangeRate}
                        baseCurrency={session.org.defaultCurrency}
                        negate
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={statusColors[cn.status] ?? ""}
                        variant="outline"
                      >
                        {statusLabels[cn.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
