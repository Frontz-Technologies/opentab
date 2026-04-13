import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  recurringExpenses,
  recurringExpenseItems,
  RECURRING_EXPENSE_STATUS,
  EXPENSE_FREQUENCY,
} from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { RecurringExpenseActions } from "./recurring-expense-actions";

const statusColors: Record<number, string> = {
  [RECURRING_EXPENSE_STATUS.ACTIVE]: "bg-emerald-500/20 text-emerald-400",
  [RECURRING_EXPENSE_STATUS.PAUSED]: "bg-amber-500/20 text-amber-400",
  [RECURRING_EXPENSE_STATUS.COMPLETED]: "bg-zinc-500/20 text-zinc-400",
};

const frequencyKeys: Record<number, string> = {
  [EXPENSE_FREQUENCY.DAILY]: "frequencyDaily",
  [EXPENSE_FREQUENCY.WEEKLY]: "frequencyWeekly",
  [EXPENSE_FREQUENCY.BIWEEKLY]: "frequencyBiweekly",
  [EXPENSE_FREQUENCY.MONTHLY]: "frequencyMonthly",
  [EXPENSE_FREQUENCY.QUARTERLY]: "frequencyQuarterly",
  [EXPENSE_FREQUENCY.BIANNUALLY]: "frequencyBiannually",
  [EXPENSE_FREQUENCY.ANNUALLY]: "frequencyAnnually",
};

export default async function RecurringExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurringExpenses");

  const [recurring] = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.id, id),
        eq(recurringExpenses.orgId, session.org.id),
      ),
    );

  if (!recurring) notFound();

  const items = await db
    .select()
    .from(recurringExpenseItems)
    .where(eq(recurringExpenseItems.recurringExpenseId, id))
    .orderBy(asc(recurringExpenseItems.sortOrder));

  const statusLabels: Record<number, string> = {
    [RECURRING_EXPENSE_STATUS.ACTIVE]: t("statusActive"),
    [RECURRING_EXPENSE_STATUS.PAUSED]: t("statusPaused"),
    [RECURRING_EXPENSE_STATUS.COMPLETED]: t("statusCompleted"),
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/recurring-expenses"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {recurring.description || t("editRecurring")}
          </h1>
          <Badge
            className={statusColors[recurring.status] ?? ""}
            variant="outline"
          >
            {statusLabels[recurring.status]}
          </Badge>
        </div>
        <RecurringExpenseActions recurring={recurring} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("frequency")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {t(frequencyKeys[recurring.frequency] ?? "frequencyMonthly")}
              </span>
            </div>
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("startDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {recurring.startDate}
              </span>
            </div>
            {recurring.endDate && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("endDate")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {recurring.endDate}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("nextRunDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm font-medium">
                {recurring.nextRunDate}
              </span>
            </div>
            {recurring.remainingCycles !== null && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("remainingCycles")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {recurring.remainingCycles}
                </span>
              </div>
            )}
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("autoConfirm")}:
              </span>{" "}
              <span className="text-on-surface text-sm">
                {recurring.autoConfirm ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-surface-container rounded-xl p-6">
          <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
            Line Items
          </h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-on-surface/10">
                <th className="text-left px-2 py-2 font-label text-sm text-on-surface/60">
                  Item
                </th>
                <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                  Qty
                </th>
                <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                  Unit price
                </th>
                <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                  Tax %
                </th>
                <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60">
                  Total
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
                  </td>
                  <td className="px-2 py-3 text-right text-sm font-mono text-on-surface/60">
                    {item.quantity}
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
        </div>
      )}

      {recurring.notes && (
        <div className="bg-surface-container rounded-xl p-6">
          <h3 className="font-label text-sm text-on-surface/60 mb-1">Notes</h3>
          <p className="text-on-surface text-sm whitespace-pre-wrap">
            {recurring.notes}
          </p>
        </div>
      )}
    </div>
  );
}
