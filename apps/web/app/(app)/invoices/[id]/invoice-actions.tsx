"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Invoice } from "@opentab/db/schema";
import { INVOICE_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import {
  sendInvoice,
  markAsPaid,
  cancelInvoice,
  deleteInvoice,
} from "../actions";

interface InvoiceActionsProps {
  invoice: Invoice;
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const t = useTranslations("invoices");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    confirmMessage: string,
    redirectTo?: string,
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(invoice.id);
      if (result.success && redirectTo) {
        router.push(redirectTo);
      }
    });
  }

  return (
    <div className="flex gap-2">
      {invoice.status === INVOICE_STATUS.DRAFT && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(sendInvoice, t("sendConfirm"))}
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              send
            </span>
            {t("send")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(deleteInvoice, t("deleteConfirm"), "/invoices")
            }
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              delete
            </span>
            {t("delete")}
          </Button>
        </>
      )}
      {(invoice.status === INVOICE_STATUS.SENT ||
        invoice.status === INVOICE_STATUS.PARTIAL) && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(markAsPaid, t("paidConfirm"))}
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              check_circle
            </span>
            {t("markAsPaid")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(cancelInvoice, t("cancelConfirm"))}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")}
      >
        <span className="material-symbols-outlined text-[16px] mr-1">
          download
        </span>
        {t("downloadPdf")}
      </Button>
    </div>
  );
}
