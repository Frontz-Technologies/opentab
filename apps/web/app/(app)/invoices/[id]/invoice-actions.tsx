"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Invoice } from "@opentab/db/schema";
import {
  INVOICE_STATUS,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/components/ui/action-toast";
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
  const [retryResult, setRetryResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [cancelSubmissionResult, setCancelSubmissionResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useActionToast(retryResult, t("mydataRetrySuccess"));
  useActionToast(cancelSubmissionResult, t("mydataCancelSuccess"));

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
            <span className="material-symbols-outlined text-[16px] mr-1">
              publish
            </span>
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
            <span className="material-symbols-outlined text-[16px] mr-1">
              delete
            </span>
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
            <span className="material-symbols-outlined text-[16px] mr-1">
              send
            </span>
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
                setRetryResult(result);
                router.refresh();
              });
            }}
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              refresh
            </span>
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
              setCancelSubmissionResult(result);
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
