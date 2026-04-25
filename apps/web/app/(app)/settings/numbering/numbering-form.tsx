"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renderInvoiceNumberPattern } from "@/lib/invoicing/numbering";
import { updateInvoiceNumbering } from "./actions";

interface InitialState {
  prefix: string;
  digitCount: number;
  includeYear: boolean;
  pattern: string | null;
  nextNumber: number;
}

export function NumberingForm({ initial }: { initial: InitialState }) {
  const t = useTranslations("settingsNumbering");
  const [isPending, startTransition] = useTransition();

  const [prefix, setPrefix] = useState(initial.prefix);
  const [digitCount, setDigitCount] = useState(initial.digitCount);
  const [includeYear, setIncludeYear] = useState(initial.includeYear);
  const [pattern, setPattern] = useState(initial.pattern ?? "");

  // Live preview: same renderer the server uses, so what you see is
  // exactly what the next published invoice will get.
  const preview = pattern
    ? renderInvoiceNumberPattern({
        pattern,
        prefix,
        nextNumber: initial.nextNumber,
      })
    : (() => {
        const padded = String(initial.nextNumber).padStart(digitCount, "0");
        return includeYear
          ? `${prefix}${new Date().getFullYear()}-${padded}`
          : `${prefix}${padded}`;
      })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("prefix", prefix);
    formData.set("digitCount", String(digitCount));
    formData.set("includeYear", includeYear ? "true" : "false");
    formData.set("pattern", pattern);
    startTransition(async () => {
      const result = await updateInvoiceNumbering(formData);
      if (result.success) {
        toast.success(t("saved"));
      } else {
        toast.error(t("validationFailed"));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-surface-container-low rounded-2xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {t("simpleSection")}
        </h2>

        <div>
          <label className="block text-sm font-label text-on-surface mb-1">
            {t("prefix")}
          </label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            maxLength={20}
            disabled={pattern.length > 0}
          />
          <p className="text-xs text-on-surface-variant mt-1">
            {t("prefixHelp")}
          </p>
        </div>

        <div>
          <label className="block text-sm font-label text-on-surface mb-1">
            {t("digitCount")}
          </label>
          <select
            className="bg-surface-container-lowest text-on-surface rounded-lg px-3 h-10 w-32"
            value={digitCount}
            onChange={(e) => setDigitCount(Number(e.target.value))}
            disabled={pattern.length > 0}
          >
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="text-xs text-on-surface-variant mt-1">
            {t("digitCountHelp")}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={includeYear}
            onChange={(e) => setIncludeYear(e.target.checked)}
            disabled={pattern.length > 0}
          />
          {t("includeYear")}
        </label>

        <p className="text-sm text-on-surface-variant">
          {t("nextNumber")}:{" "}
          <span className="font-mono">{initial.nextNumber}</span>
        </p>
      </section>

      <section className="bg-surface-container-low rounded-2xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {t("advancedSection")}
        </h2>

        <div>
          <label className="block text-sm font-label text-on-surface mb-1">
            {t("pattern")}
          </label>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t("patternPlaceholder")}
            maxLength={60}
          />
          <p className="text-xs text-on-surface-variant mt-1">
            {t("patternHelp")}
          </p>
        </div>

        {pattern.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPattern("")}
          >
            {t("useSimpleMode")}
          </Button>
        )}
      </section>

      <section className="bg-surface-container-low rounded-2xl p-6">
        <p className="text-sm text-on-surface-variant mb-2">{t("preview")}</p>
        <p
          data-testid="numbering-preview"
          className="font-mono text-xl font-bold text-primary"
        >
          {preview}
        </p>
      </section>

      <Button type="submit" disabled={isPending}>
        {t("save")}
      </Button>
    </form>
  );
}
