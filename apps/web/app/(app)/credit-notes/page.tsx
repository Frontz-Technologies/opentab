import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { creditNotes, CREDIT_NOTE_STATUS } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          {t("title")}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/import/credit-notes"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-on-surface/20 px-5 font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]">
              upload
            </span>
            {t("import")}
          </Link>
          <Link
            href="/credit-notes/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("addCreditNote")}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            receipt_long
          </span>
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
            {t("noCreditNotes")}
          </h3>
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
                    {cn.currencyCode} -{cn.total}
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
  );
}
