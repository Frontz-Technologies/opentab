"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createContact } from "../../contacts/actions";

interface SaveSupplierBannerProps {
  expenseId: string;
  supplierName: string | null;
  supplierVat: string | null;
}

export function SaveSupplierBanner({
  supplierName,
  supplierVat,
}: SaveSupplierBannerProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !supplierName) return null;

  function handleSave() {
    const formData = new FormData();
    formData.set("type", "supplier");
    formData.set("classification", "business");
    formData.set("company", supplierName!);
    if (supplierVat) formData.set("vatNumber", supplierVat);
    startTransition(async () => {
      const result = await createContact(formData);
      if (result.success) {
        router.refresh();
        setDismissed(true);
      }
    });
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-blue-400 text-[20px]">
          person_add
        </span>
        <div>
          <p className="text-sm font-medium text-on-surface">
            {t("saveSupplierPrompt")}
          </p>
          <p className="text-xs text-on-surface/60">
            {supplierName}
            {supplierVat ? ` — ${supplierVat}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDismissed(true)}
          disabled={isPending}
        >
          {t("skipSupplier")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "..." : t("saveAsSupplier")}
        </Button>
      </div>
    </div>
  );
}
