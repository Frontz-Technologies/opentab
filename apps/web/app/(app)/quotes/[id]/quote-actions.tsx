"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Quote } from "@opentab/db/schema";
import { QUOTE_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import {
  sendQuote,
  acceptQuote,
  rejectQuote,
  convertToInvoice,
  deleteQuote,
} from "../actions";

interface QuoteActionsProps {
  quote: Quote;
}

export function QuoteActions({ quote }: QuoteActionsProps) {
  const t = useTranslations("quotes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction(
    action: (id: string) => Promise<{
      success: boolean;
      error?: string;
      invoiceId?: string;
    }>,
    confirmMessage: string,
    redirectTo?: string,
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(quote.id);
      if (result.success) {
        if (redirectTo) {
          router.push(redirectTo);
        } else if (result.invoiceId) {
          router.push(`/invoices/${result.invoiceId}`);
        }
      }
    });
  }

  return (
    <div className="flex gap-2">
      {quote.status === QUOTE_STATUS.DRAFT && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(sendQuote, "Send this quote to the client?")
            }
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
              handleAction(deleteQuote, t("deleteConfirm"), "/quotes")
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
      {quote.status === QUOTE_STATUS.SENT && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(acceptQuote, "Accept this quote?")}
            disabled={isPending}
          >
            {t("accept")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(rejectQuote, "Reject this quote?")}
            disabled={isPending}
          >
            {t("reject")}
          </Button>
        </>
      )}
      {quote.status === QUOTE_STATUS.ACCEPTED && (
        <Button
          size="sm"
          onClick={() => handleAction(convertToInvoice, t("convertConfirm"))}
          disabled={isPending}
        >
          <span className="material-symbols-outlined text-[16px] mr-1">
            receipt
          </span>
          {t("convertToInvoice")}
        </Button>
      )}
    </div>
  );
}
