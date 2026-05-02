"use client";

import { useTranslations } from "next-intl";

export function RequiredFieldsHint() {
  const t = useTranslations("common");
  return (
    <p role="note" className="text-xs text-on-surface-variant mt-2">
      <span className="text-tertiary">*</span> {t("requiredFieldHint")}
    </p>
  );
}
