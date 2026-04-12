"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Invoice } from "@opentab/db/schema";
import { INVOICE_STATUS } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InvoiceListProps {
  invoices: Invoice[];
}

const statusColors: Record<number, string> = {
  [INVOICE_STATUS.DRAFT]: "bg-zinc-500/20 text-zinc-400",
  [INVOICE_STATUS.SENT]: "bg-blue-500/20 text-blue-400",
  [INVOICE_STATUS.PARTIAL]: "bg-amber-500/20 text-amber-400",
  [INVOICE_STATUS.PAID]: "bg-emerald-500/20 text-emerald-400",
  [INVOICE_STATUS.CANCELLED]: "bg-red-500/20 text-red-400",
};

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status !== INVOICE_STATUS.SENT) return false;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate) < new Date();
}

function getStatusLabel(
  invoice: Invoice,
  t: ReturnType<typeof useTranslations>,
): string {
  if (isOverdue(invoice)) return t("statusOverdue");
  const labels: Record<number, string> = {
    [INVOICE_STATUS.DRAFT]: t("statusDraft"),
    [INVOICE_STATUS.SENT]: t("statusSent"),
    [INVOICE_STATUS.PARTIAL]: t("statusPartial"),
    [INVOICE_STATUS.PAID]: t("statusPaid"),
    [INVOICE_STATUS.CANCELLED]: t("statusCancelled"),
  };
  return labels[invoice.status] ?? "";
}

function getStatusColor(invoice: Invoice): string {
  if (isOverdue(invoice)) return "bg-red-500/20 text-red-400";
  return statusColors[invoice.status] ?? "";
}

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue";

export function InvoiceList({ invoices }: InvoiceListProps) {
  const t = useTranslations("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.contactName.toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "draft")
      matchesStatus = inv.status === INVOICE_STATUS.DRAFT;
    else if (statusFilter === "sent")
      matchesStatus = inv.status === INVOICE_STATUS.SENT && !isOverdue(inv);
    else if (statusFilter === "paid")
      matchesStatus = inv.status === INVOICE_STATUS.PAID;
    else if (statusFilter === "overdue") matchesStatus = isOverdue(inv);

    return matchesSearch && matchesStatus;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "draft", label: t("filterDraft") },
    { key: "sent", label: t("filterSent") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={statusFilter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-on-surface/50">
          <span className="material-symbols-outlined text-4xl mb-2 block">
            receipt_long
          </span>
          <p className="font-label">{t("noInvoices")}</p>
          <p className="text-sm mt-1">{t("noInvoicesDescription")}</p>
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
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("dueDate")}
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
              {filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-on-surface hover:text-primary transition-colors font-medium font-mono text-sm"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface text-sm">
                    {invoice.contactName}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {invoice.issueDate}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {invoice.dueDate || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-on-surface text-sm text-right font-mono">
                    {invoice.currencyCode} {invoice.total}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={getStatusColor(invoice)}
                      variant="outline"
                    >
                      {getStatusLabel(invoice, t)}
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
