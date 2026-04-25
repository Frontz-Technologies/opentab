"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CreditNote } from "@opentab/db/schema";
import { CREDIT_NOTE_STATUS } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import {
  publishCreditNote,
  sendCreditNote,
  cancelCreditNote,
  deleteCreditNote,
} from "../actions";

export function CreditNoteActions({ creditNote }: { creditNote: CreditNote }) {
  const t = useTranslations("creditNotes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    confirmMessage: string,
    redirectTo?: string,
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(creditNote.id);
      if (result.success && redirectTo) router.push(redirectTo);
    });
  }

  return (
    <div className="flex gap-2">
      {creditNote.status === CREDIT_NOTE_STATUS.DRAFT && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(publishCreditNote, t("publishConfirm"))}
            disabled={isPending}
          >
            {t("publish")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(
                deleteCreditNote,
                t("deleteConfirm"),
                "/credit-notes",
              )
            }
            disabled={isPending}
          >
            {t("delete")}
          </Button>
        </>
      )}
      {creditNote.status === CREDIT_NOTE_STATUS.PUBLISHED && (
        <>
          <Button
            size="sm"
            onClick={() => handleAction(sendCreditNote, t("sendConfirm"))}
            disabled={isPending}
          >
            {t("send")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(cancelCreditNote, t("cancelConfirm"))}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
        </>
      )}
      {creditNote.status === CREDIT_NOTE_STATUS.SENT && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(cancelCreditNote, t("cancelConfirm"))}
          disabled={isPending}
        >
          {t("cancel")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          window.open(`/api/credit-notes/${creditNote.id}/pdf`, "_blank")
        }
      >
        {t("downloadPdf")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          window.open(
            `/api/credit-notes/${creditNote.id}/activity.csv`,
            "_blank",
          )
        }
      >
        {t("downloadActivityCsv")}
      </Button>
    </div>
  );
}
