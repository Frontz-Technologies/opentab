"use client";

import { useTranslations } from "next-intl";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface Category {
  id: string;
  name: string;
  groupCode: string;
}

interface CategoryComboboxProps {
  value?: string;
  onChange: (id: string) => void;
  categories: Category[];
  groupNameForLocale: (groupCode: string) => string;
}

export function CategoryCombobox({
  value,
  onChange,
  categories,
  groupNameForLocale,
}: CategoryComboboxProps) {
  const t = useTranslations("expenses");

  const options: ComboboxOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
    groupKey: c.groupCode,
    groupLabel: groupNameForLocale(c.groupCode),
  }));

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("selectCategory")}
      searchPlaceholder={t("searchCategory")}
      emptyText={t("noCategoryFound")}
    />
  );
}
