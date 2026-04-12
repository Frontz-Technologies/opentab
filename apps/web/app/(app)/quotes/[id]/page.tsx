import { getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { quotes, quoteItems, QUOTE_STATUS } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { QuoteActions } from "./quote-actions";

const statusColors: Record<number, string> = {
  [QUOTE_STATUS.DRAFT]: "bg-zinc-500/20 text-zinc-400",
  [QUOTE_STATUS.SENT]: "bg-blue-500/20 text-blue-400",
  [QUOTE_STATUS.ACCEPTED]: "bg-emerald-500/20 text-emerald-400",
  [QUOTE_STATUS.REJECTED]: "bg-red-500/20 text-red-400",
  [QUOTE_STATUS.CONVERTED]: "bg-purple-500/20 text-purple-400",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("quotes");

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)));

  if (!quote) notFound();

  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id))
    .orderBy(asc(quoteItems.sortOrder));

  const statusLabels: Record<number, string> = {
    [QUOTE_STATUS.DRAFT]: t("statusDraft"),
    [QUOTE_STATUS.SENT]: t("statusSent"),
    [QUOTE_STATUS.ACCEPTED]: t("statusAccepted"),
    [QUOTE_STATUS.REJECTED]: t("statusRejected"),
    [QUOTE_STATUS.CONVERTED]: t("statusConverted"),
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/quotes"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {quote.quoteNumber}
          </h1>
          <Badge className={statusColors[quote.status] ?? ""} variant="outline">
            {statusLabels[quote.status]}
          </Badge>
        </div>
        <QuoteActions quote={quote} />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-label text-sm text-on-surface/60 mb-1">
              {t("client")}
            </h3>
            <p className="text-on-surface font-medium">{quote.contactName}</p>
            {quote.contactEmail && (
              <p className="text-on-surface/60 text-sm">{quote.contactEmail}</p>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-label text-sm text-on-surface/60">
                {t("issueDate")}:
              </span>{" "}
              <span className="text-on-surface text-sm">{quote.issueDate}</span>
            </div>
            {quote.validUntil && (
              <div>
                <span className="font-label text-sm text-on-surface/60">
                  {t("validUntil")}:
                </span>{" "}
                <span className="text-on-surface text-sm">
                  {quote.validUntil}
                </span>
              </div>
            )}
          </div>
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
              <span>Subtotal</span>
              <span className="font-mono">{quote.subtotal}</span>
            </div>
            <div className="flex justify-between text-on-surface/60">
              <span>Tax</span>
              <span className="font-mono">{quote.taxAmount}</span>
            </div>
            <div className="flex justify-between text-on-surface font-semibold border-t border-on-surface/10 pt-1">
              <span>Total</span>
              <span className="font-mono">
                {quote.currencyCode} {quote.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
