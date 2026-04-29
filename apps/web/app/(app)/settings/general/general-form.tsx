"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function GeneralForm({ initialData }: GeneralFormProps) {
  const t = useTranslations("settingsGeneral");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>(initialData.locale);
  const [dateFormat, setDateFormat] = useState<string>(initialData.dateFormat);
  const [numberFormat, setNumberFormat] = useState<string>(
    initialData.numberFormat,
  );
  const [notifyInvoicePaid, setNotifyInvoicePaid] = useState<boolean>(
    initialData.notifyInvoicePaid,
  );
  const [notifyExpenseApproved, setNotifyExpenseApproved] = useState<boolean>(
    initialData.notifyExpenseApproved,
  );

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
        <Select value={locale} onValueChange={(v) => setLocale(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("languageEn")}</SelectItem>
            <SelectItem value="el">{t("languageEl")}</SelectItem>
            <SelectItem value="es">{t("languageEs")}</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="locale" value={locale} />
      </SettingsSection>

      <SettingsSection title={t("dateFormat")}>
        <Select value={dateFormat} onValueChange={(v) => setDateFormat(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((fmt) => (
              <SelectItem key={fmt} value={fmt}>
                {fmt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="dateFormat" value={dateFormat} />
      </SettingsSection>

      <SettingsSection title={t("numberFormat")}>
        <Select value={numberFormat} onValueChange={(v) => setNumberFormat(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu">{t("numberFormatEu")}</SelectItem>
            <SelectItem value="us">{t("numberFormatUs")}</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="numberFormat" value={numberFormat} />
      </SettingsSection>

      <SettingsSection title={t("notifications")}>
        <div className="space-y-3">
          <label
            htmlFor="notifyInvoicePaid"
            className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer"
          >
            <Checkbox
              id="notifyInvoicePaid"
              checked={notifyInvoicePaid}
              onCheckedChange={(v) => setNotifyInvoicePaid(v === true)}
            />
            {t("notifyInvoicePaid")}
          </label>
          <input
            type="hidden"
            name="notifyInvoicePaid"
            value={notifyInvoicePaid ? "on" : ""}
          />
          <label
            htmlFor="notifyExpenseApproved"
            className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer"
          >
            <Checkbox
              id="notifyExpenseApproved"
              checked={notifyExpenseApproved}
              onCheckedChange={(v) => setNotifyExpenseApproved(v === true)}
            />
            {t("notifyExpenseApproved")}
          </label>
          <input
            type="hidden"
            name="notifyExpenseApproved"
            value={notifyExpenseApproved ? "on" : ""}
          />
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
