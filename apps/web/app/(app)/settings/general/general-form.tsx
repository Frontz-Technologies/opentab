"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateGeneralSettings } from "./actions";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

interface GeneralFormProps {
  initialData: {
    locale: string;
    dateFormat: string;
    numberFormat: string;
    notifyInvoicePaid: boolean;
    notifyExpenseApproved: boolean;
  };
}

const selectClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors appearance-none cursor-pointer";

export function GeneralForm({ initialData }: GeneralFormProps) {
  const t = useTranslations("settingsGeneral");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateGeneralSettings(formData);
      setToast(t("saved"));
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {toast && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium bg-primary/10 text-primary">
          {toast}
        </div>
      )}

      <SettingsSection title={t("language")}>
        <div className="relative">
          <select
            name="locale"
            className={selectClass}
            defaultValue={initialData.locale}
          >
            <option value="en">{t("languageEn")}</option>
            <option value="el">{t("languageEl")}</option>
            <option value="es">{t("languageEs")}</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("dateFormat")}>
        <div className="relative">
          <select
            name="dateFormat"
            className={selectClass}
            defaultValue={initialData.dateFormat}
          >
            {DATE_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("numberFormat")}>
        <div className="relative">
          <select
            name="numberFormat"
            className={selectClass}
            defaultValue={initialData.numberFormat}
          >
            <option value="eu">{t("numberFormatEu")}</option>
            <option value="us">{t("numberFormatUs")}</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("notifications")}>
        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer">
            <input
              name="notifyInvoicePaid"
              type="checkbox"
              defaultChecked={initialData.notifyInvoicePaid}
              className="accent-primary"
            />
            {t("notifyInvoicePaid")}
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer">
            <input
              name="notifyExpenseApproved"
              type="checkbox"
              defaultChecked={initialData.notifyExpenseApproved}
              className="accent-primary"
            />
            {t("notifyExpenseApproved")}
          </label>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : tCommon("save")}
        </button>
      </div>
    </form>
  );
}
