"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Invoice } from "@opentab/db/schema";
import {
  INVOICE_STATUS,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface InvoiceListProps {
  invoices: Invoice[];
  showMyData?: boolean;
  mydataStatusByInvoice?: Record<string, number | null>;
}

const statusColors: Record<number, string> = {
  [INVOICE_STATUS.DRAFT]:
    "bg-surface-container-highest text-on-surface-variant",
  [INVOICE_STATUS.PUBLISHED]: "bg-blue-500/20 text-blue-400",
  [INVOICE_STATUS.SENT]: "bg-secondary-container text-secondary",
  [INVOICE_STATUS.PARTIAL]: "bg-amber-500/20 text-amber-400",
  [INVOICE_STATUS.PAID]: "bg-primary-container/20 text-primary",
  [INVOICE_STATUS.CANCELLED]: "bg-tertiary-container/20 text-tertiary",
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
    [INVOICE_STATUS.PUBLISHED]: t("statusPublished"),
    [INVOICE_STATUS.SENT]: t("statusSent"),
    [INVOICE_STATUS.PARTIAL]: t("statusPartial"),
    [INVOICE_STATUS.PAID]: t("statusPaid"),
    [INVOICE_STATUS.CANCELLED]: t("statusCancelled"),
  };
  return labels[invoice.status] ?? "";
}

function getStatusColor(invoice: Invoice): string {
  if (isOverdue(invoice))
    return "bg-tertiary-container/20 text-tertiary-container";
  return statusColors[invoice.status] ?? "";
}

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue";

function MyDataStatusIcon({ status }: { status: number | null }) {
  if (status === null) return null;
  if (status === COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED) {
    return (
      <span
        className="material-symbols-outlined text-[16px] text-emerald-400"
        title="myDATA confirmed"
      >
        check_circle
      </span>
    );
  }
  if (
    status === COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING ||
    status === COUNTRY_INTEGRATION_SUBMISSION_STATUS.SUBMITTED ||
    status === COUNTRY_INTEGRATION_SUBMISSION_STATUS.RETRY_SCHEDULED
  ) {
    return (
      <span
        className="material-symbols-outlined text-[16px] text-blue-400 animate-spin"
        title="myDATA pending"
      >
        sync
      </span>
    );
  }
  if (status === COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED) {
    return (
      <span
        className="material-symbols-outlined text-[16px] text-zinc-400"
        title="myDATA cancelled"
      >
        cancel
      </span>
    );
  }
  return (
    <span
      className="material-symbols-outlined text-[16px] text-red-400"
      title="myDATA failed"
    >
      error
    </span>
  );
}

export function InvoiceList({
  invoices,
  showMyData,
  mydataStatusByInvoice,
}: InvoiceListProps) {
  const t = useTranslations("invoices");
  const router = useRouter();
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
        <AnimatedFilterBar
          items={filters.map((f) => ({ value: f.key, label: f.label }))}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
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
        <>
          <div className="hidden md:block">
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
                    {showMyData && (
                      <th className="text-center px-4 py-3 font-label text-sm text-on-surface/60">
                        myDATA
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
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
                      {showMyData && (
                        <td className="px-4 py-3 text-center">
                          <MyDataStatusIcon
                            status={mydataStatusByInvoice?.[invoice.id] ?? null}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block md:hidden space-y-3">
            {filtered.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-mono text-sm text-on-surface">
                    {invoice.invoiceNumber}
                  </span>
                  <span className="font-label text-lg font-bold text-on-surface">
                    {invoice.currencyCode} {invoice.total}
                  </span>
                </div>
                <p className="text-sm text-on-surface mb-2">
                  {invoice.contactName}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {invoice.issueDate}
                  </span>
                  <Badge className={getStatusColor(invoice)} variant="outline">
                    {getStatusLabel(invoice, t)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
