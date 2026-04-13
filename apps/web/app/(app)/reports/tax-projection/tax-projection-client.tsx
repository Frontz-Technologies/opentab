"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  calculateGreekTax,
  getDefaultProjectionInput,
} from "@/lib/reports/tax/gr-tax-calculator";
import type { EntityType, OrgTaxSettings } from "@/lib/reports/tax/types";
import { TaxProjectionSlider } from "@/components/reports/tax-projection-slider";
import { TaxBracketTable } from "@/components/reports/tax-bracket-table";
import { GREEK_EFKA_2026 } from "@/lib/country/providers/gr";

function formatEur(n: number): string {
  return `\u20AC${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TaxProjectionClient({
  initialData,
}: {
  initialData: {
    ytdRevenue: number;
    ytdExpenses: number;
    monthsElapsed: number;
    taxSettings: OrgTaxSettings | null;
  };
}) {
  const t = useTranslations("taxProjection");

  const defaultAnnual = getDefaultProjectionInput(
    initialData.ytdRevenue,
    initialData.monthsElapsed,
    initialData.taxSettings?.efkaCategory ?? 1,
  );

  const [annualRevenue, setAnnualRevenue] = useState(defaultAnnual);
  const [entityType, setEntityType] = useState<EntityType>(
    initialData.taxSettings?.entityType ?? "freelancer",
  );
  const [efkaCategory, setEfkaCategory] = useState(
    initialData.taxSettings?.efkaCategory ?? 1,
  );
  const [isFirstYear, setIsFirstYear] = useState(
    initialData.taxSettings?.isFirstYear ?? false,
  );

  const expenseRatio =
    initialData.ytdRevenue > 0
      ? initialData.ytdExpenses / initialData.ytdRevenue
      : 0;
  const deductibleExpenses = Math.round(annualRevenue * expenseRatio);

  const result = useMemo(
    () =>
      calculateGreekTax({
        annualRevenue,
        deductibleExpenses,
        entityType,
        birthDate: initialData.taxSettings?.ownerBirthDate,
        efkaCategory,
        isFirstYear,
      }),
    [
      annualRevenue,
      deductibleExpenses,
      entityType,
      efkaCategory,
      isFirstYear,
      initialData.taxSettings?.ownerBirthDate,
    ],
  );

  return (
    <div>
      {/* Revenue Scenario Slider */}
      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 mb-8">
        <h3 className="font-label text-sm text-on-surface-variant mb-4">
          {t("revenueScenario")}
        </h3>
        <TaxProjectionSlider
          defaultRevenue={defaultAnnual}
          max={Math.max(200000, defaultAnnual * 2)}
          onChange={setAnnualRevenue}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="text-xs text-on-surface-variant block mb-1">
            {t("entityType")}
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className="bg-surface-container rounded-lg px-3 py-2 text-sm text-on-surface border border-outline-variant/20"
          >
            <option value="freelancer">{t("freelancer")}</option>
            <option value="ike">{t("ike")}</option>
            <option value="epe">{t("epe")}</option>
            <option value="ae">{t("ae")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant block mb-1">
            {t("efkaCategory")}
          </label>
          <select
            value={efkaCategory}
            onChange={(e) => setEfkaCategory(Number(e.target.value))}
            className="bg-surface-container rounded-lg px-3 py-2 text-sm text-on-surface border border-outline-variant/20"
          >
            {GREEK_EFKA_2026.selfEmployed.categories.map((cat) => (
              <option key={cat.level} value={cat.level}>
                {cat.label} (\u20AC{cat.monthly}/mo)
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={isFirstYear}
              onChange={(e) => setIsFirstYear(e.target.checked)}
              className="accent-primary"
            />
            {t("firstYear")}
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {[
            { label: t("taxableIncome"), value: result.taxableIncome },
            { label: t("incomeTax"), value: result.incomeTax },
            { label: t("taxPrepayment"), value: result.taxPrepayment },
            { label: t("efka"), value: result.efkaAnnual },
            ...(result.dividendTax !== null
              ? [
                  {
                    label: t("dividendTax"),
                    value: result.dividendTax,
                  },
                ]
              : []),
          ].map((item) => (
            <div
              key={item.label}
              className="flex justify-between items-center py-2 border-b border-outline-variant/10"
            >
              <span className="text-sm text-on-surface-variant">
                {item.label}
              </span>
              <span className="font-mono font-bold text-on-surface">
                {formatEur(item.value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 border-t-2 border-primary/30">
            <span className="text-sm font-bold text-on-surface">
              {t("totalObligations")}
            </span>
            <span className="font-mono text-lg font-bold text-primary">
              {formatEur(result.totalObligations)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
            <span className="text-xs text-on-surface-variant">
              {t("effectiveRate")}:
            </span>
            <span className="text-sm font-bold text-primary">
              {result.effectiveRate.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
          <h3 className="font-label text-sm text-on-surface-variant mb-4">
            {t("bracketBreakdown")}
          </h3>
          <TaxBracketTable
            breakdown={result.bracketBreakdown}
            entityType={entityType}
          />
        </div>
      </div>
    </div>
  );
}
