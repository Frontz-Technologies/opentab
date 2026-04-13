import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  expenses,
  expenseItems,
  expenseAttachments,
  EXPENSE_STATUS,
} from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ExpenseActions } from "./expense-actions";

const statusColors: Record<number, string> = {
  [EXPENSE_STATUS.DRAFT]: "bg-zinc-500/20 text-zinc-400",
  [EXPENSE_STATUS.CONFIRMED]: "bg-emerald-500/20 text-emerald-400",
  [EXPENSE_STATUS.CANCELLED]: "bg-red-500/20 text-red-400",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenses");

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, session.org.id)));

  if (!expense) notFound();

  const items = await db
    .select()
    .from(expenseItems)
    .where(eq(expenseItems.expenseId, id))
    .orderBy(asc(expenseItems.sortOrder));

  const attachments = await db
    .select()
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, id));

  const statusLabels: Record<number, string> = {
    [EXPENSE_STATUS.DRAFT]: t("statusDraft"),
    [EXPENSE_STATUS.CONFIRMED]: t("statusConfirmed"),
    [EXPENSE_STATUS.CANCELLED]: t("statusCancelled"),
  };

  const sourceLabels: Record<string, string> = {
    manual: t("sourceManual"),
    email: t("sourceEmail"),
    ai_extract: t("sourceAiExtract"),
    recurring: t("sourceRecurring"),
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {expense.expenseNumber}
          </h1>
          <Badge
            className={statusColors[expense.status] ?? ""}
            variant="outline"
          >
            {statusLabels[expense.status]}
          </Badge>
          <Badge
            className="bg-surface-container-low text-on-surface/50"
            variant="outline"
          >
            {sourceLabels[expense.source] ?? expense.source}
          </Badge>
        </div>
        <ExpenseActions expense={expense} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("supplier")}
            </h3>
            <p className="text-on-surface font-medium">
              {expense.contactName || "\u2014"}
            </p>
            {expense.contactVatNumber && (
              <p className="text-on-surface/60 text-sm font-mono">
                {expense.contactVatNumber}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("issueDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {expense.issueDate}
              </span>
            </div>
            {expense.paymentDate && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("paymentDate")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {expense.paymentDate}
                </span>
              </div>
            )}
            {expense.supplierInvoiceNumber && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("supplierInvoiceNumber")}:
                </span>{" "}
                <span className="text-on-surface text-sm font-mono">
                  {expense.supplierInvoiceNumber}
                </span>
              </div>
            )}
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("currency")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {expense.currencyCode}
              </span>
            </div>
          </div>
        </div>
        {expense.description && (
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("description")}
            </h3>
            <p className="text-on-surface text-sm">{expense.description}</p>
          </div>
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          {t("lineItems")}
        </h3>
        {items.length > 0 ? (
          <>
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
                  <span className="font-mono">{expense.subtotal}</span>
                </div>
                <div className="flex justify-between text-on-surface/60">
                  <span>{t("taxAmount")}</span>
                  <span className="font-mono">{expense.taxAmount}</span>
                </div>
                <div className="flex justify-between text-on-surface font-semibold border-t border-on-surface/10 pt-1">
                  <span>{t("totalAmount")}</span>
                  <span className="font-mono">
                    {expense.currencyCode} {expense.total}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-on-surface/50 text-sm">
            {expense.source === "ai_extract"
              ? t("processing")
              : "No line items"}
          </p>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="bg-surface-container rounded-xl p-6">
          <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
            Attachments
          </h3>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3"
              >
                <span className="material-symbols-outlined text-on-surface/40">
                  attach_file
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface text-sm truncate">
                    {att.fileName}
                  </p>
                  <p className="text-on-surface/40 text-xs">
                    {(att.fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Badge
                  className={
                    att.aiStatus === "completed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : att.aiStatus === "failed"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                  }
                  variant="outline"
                >
                  {att.aiStatus}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {expense.notes && (
        <div className="bg-surface-container rounded-xl p-6">
          <h3 className="font-label text-sm text-on-surface/60 mb-1">
            {t("notes")}
          </h3>
          <p className="text-on-surface text-sm whitespace-pre-wrap">
            {expense.notes}
          </p>
        </div>
      )}
    </div>
  );
}
