"use client";

import { useMemo } from "react";
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
  /** When set, pin this currency at the top of the list (typically the
   *  org's defaultCurrency) so the dominant choice is one click away. */
  defaultCurrency?: SupportedCurrencyCode;
  disabled?: boolean;
  className?: string;
}

export function CurrencyCombobox({
  value,
  onChange,
  name,
  defaultCurrency,
  disabled,
  className,
}: CurrencyComboboxProps) {
  const t = useTranslations("common");
  const items = useMemo<ComboboxOption<SupportedCurrencyCode>[]>(() => {
    const sorted = SUPPORTED_CURRENCIES.slice().sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    if (!defaultCurrency) {
      return sorted.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      }));
    }
    const pinned = sorted.find((c) => c.code === defaultCurrency);
    const rest = sorted.filter((c) => c.code !== defaultCurrency);
    const ordered = pinned ? [pinned, ...rest] : sorted;
    return ordered.map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.name}`,
    }));
  }, [defaultCurrency]);
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
