import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  recurringInvoices,
  recurringInvoiceItems,
  invoices,
  RECURRING_STATUS,
  FREQUENCY,
} from "@opentab/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { RecurringActions } from "./recurring-actions";

const statusColors: Record<number, string> = {
  [RECURRING_STATUS.ACTIVE]: "bg-primary text-on-primary",
  [RECURRING_STATUS.PAUSED]: "bg-warning/15 text-warning",
  [RECURRING_STATUS.COMPLETED]:
    "bg-surface-container-high text-on-surface-variant",
};

export default async function RecurringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurring");

  const [recurring] = await db
    .select()
    .from(recurringInvoices)
    .where(
      and(
        eq(recurringInvoices.id, id),
        eq(recurringInvoices.orgId, session.org.id),
      ),
    );

  if (!recurring) notFound();

  const items = await db
    .select()
    .from(recurringInvoiceItems)
    .where(eq(recurringInvoiceItems.recurringInvoiceId, id))
    .orderBy(asc(recurringInvoiceItems.sortOrder));

  const generatedInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.recurringInvoiceId, id),
        eq(invoices.orgId, session.org.id),
      ),
    )
    .orderBy(desc(invoices.createdAt));

  const frequencyLabels: Record<number, string> = {
    [FREQUENCY.DAILY]: t("frequencyDaily"),
    [FREQUENCY.WEEKLY]: t("frequencyWeekly"),
    [FREQUENCY.BIWEEKLY]: t("frequencyBiweekly"),
    [FREQUENCY.MONTHLY]: t("frequencyMonthly"),
    [FREQUENCY.QUARTERLY]: t("frequencyQuarterly"),
    [FREQUENCY.BIANNUALLY]: t("frequencyBiannually"),
    [FREQUENCY.ANNUALLY]: t("frequencyAnnually"),
  };

  const statusLabels: Record<number, string> = {
    [RECURRING_STATUS.ACTIVE]: t("statusActive"),
    [RECURRING_STATUS.PAUSED]: t("statusPaused"),
    [RECURRING_STATUS.COMPLETED]: t("statusCompleted"),
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/recurring"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {t("editRecurring")}
          </h1>
          <Badge
            className={statusColors[recurring.status] ?? ""}
            variant="outline"
          >
            {statusLabels[recurring.status]}
          </Badge>
        </div>
        <RecurringActions recurring={recurring} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <span className="font-label text-sm text-on-surface/60">
              {t("frequency")}:
            </span>{" "}
            <span className="text-on-surface text-sm">
              {frequencyLabels[recurring.frequency]}
            </span>
          </div>
          <div>
            <span className="font-label text-sm text-on-surface/60">
              {t("nextSendDate")}:
            </span>{" "}
            <span className="text-on-surface text-sm">
              {recurring.nextSendDate}
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
      </div>

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
                <td className="px-2 py-3 text-on-surface text-sm font-medium">
                  {item.name}
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

      {generatedInvoices.length > 0 && (
        <div className="bg-surface-container rounded-xl p-6">
          <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
            {t("generatedInvoices")}
          </h3>
          <div className="space-y-2">
            {generatedInvoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <span className="font-mono text-sm text-on-surface">
                  {inv.invoiceNumber}
                </span>
                <span className="text-sm text-on-surface/60">
                  {inv.issueDate}
                </span>
                <span className="font-mono text-sm text-on-surface">
                  {inv.currencyCode} {inv.total}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
