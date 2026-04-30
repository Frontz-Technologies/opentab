"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  History,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Invoice } from "@opentab/db/schema";
import {
  INVOICE_STATUS,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import {
  publishInvoice,
  sendInvoice,
  markAsPaid,
  cancelInvoice,
  deleteInvoice,
} from "../actions";
import {
  retryIntegrationSubmission,
  cancelIntegrationSubmission,
} from "../integration-actions";

interface InvoiceActionsProps {
  invoice: Invoice;
  mydataStatus?: number | null;
}

export function InvoiceActions({ invoice, mydataStatus }: InvoiceActionsProps) {
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
            size="sm"
            onClick={() => handleAction(publishInvoice, t("publishConfirm"))}
            disabled={isPending}
          >
            <FileCheck2 className="h-4 w-4 mr-1" />
            {t("publish")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(deleteInvoice, t("deleteConfirm"), "/invoices")
            }
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("delete")}
          </Button>
        </>
      )}
      {invoice.status === INVOICE_STATUS.PUBLISHED && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(sendInvoice, t("sendConfirm"))}
            disabled={isPending}
          >
            <Send className="h-4 w-4 mr-1" />
            {t("send")}
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
      {(invoice.status === INVOICE_STATUS.SENT ||
        invoice.status === INVOICE_STATUS.PARTIAL) && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(markAsPaid, t("paidConfirm"))}
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
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
        <Download className="h-4 w-4 mr-1" />
        {t("downloadPdf")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          window.open(`/api/invoices/${invoice.id}/activity.csv`, "_blank")
        }
      >
        <History className="h-4 w-4 mr-1" />
        {t("downloadActivityCsv")}
      </Button>
      {(invoice.status === INVOICE_STATUS.SENT ||
        invoice.status === INVOICE_STATUS.PARTIAL ||
        invoice.status === INVOICE_STATUS.PAID ||
        invoice.status === INVOICE_STATUS.CANCELLED) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/credit-notes/new?invoiceId=${invoice.id}`)
          }
        >
          <Undo2 className="h-4 w-4 mr-1" />
          {t("issueCreditNote")}
        </Button>
      )}
      {mydataStatus !== null &&
        mydataStatus !== undefined &&
        mydataStatus !== COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED &&
        mydataStatus !== COUNTRY_INTEGRATION_SUBMISSION_STATUS.CANCELLED &&
        invoice.status !== INVOICE_STATUS.DRAFT && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              startTransition(async () => {
                const result = await retryIntegrationSubmission(invoice.id);
                if (result.success) {
                  toast.success(t("mydataRetrySuccess"));
                } else if (result.error) {
                  toast.error(result.error);
                }
                router.refresh();
              });
            }}
            disabled={isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("mydataRetry")}
          </Button>
        )}
      {mydataStatus === COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!confirm(t("mydataCancelConfirm"))) return;
            startTransition(async () => {
              const result = await cancelIntegrationSubmission(invoice.id);
              if (result.success) {
                toast.success(t("mydataCancelSuccess"));
              } else if (result.error) {
                toast.error(result.error);
              }
              router.refresh();
            });
          }}
          disabled={isPending}
        >
          {t("mydataCancel")}
        </Button>
      )}
    </div>
  );
}
