"use client";

import { useTranslations } from "next-intl";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";

interface CurrencyComboboxProps {
  value: SupportedCurrencyCode;
  onChange: (next: SupportedCurrencyCode) => void;
  /** Optional name to mirror via a hidden <input> for FormData round-trip. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

const items: ComboboxOption<SupportedCurrencyCode>[] =
  SUPPORTED_CURRENCIES.slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.name}`,
    }));

export function CurrencyCombobox({
  value,
  onChange,
  name,
  disabled,
  className,
}: CurrencyComboboxProps) {
  const t = useTranslations("common");
  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Combobox<SupportedCurrencyCode>
        options={items}
        value={value}
        onChange={onChange}
        placeholder={t("currencyPlaceholder")}
        searchPlaceholder={t("currencySearchPlaceholder")}
        emptyText={t("currencyEmpty")}
        disabled={disabled}
        triggerClassName={className}
      />
    </>
  );
}
