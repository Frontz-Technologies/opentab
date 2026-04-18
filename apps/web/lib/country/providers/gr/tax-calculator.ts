import {
  GREEK_INCOME_TAX_BRACKETS_2026,
  GREEK_CORPORATE_TAX,
  GREEK_EFKA_2026,
} from "@/lib/country/providers/gr";
import type {
  TaxProjectionInput,
  TaxProjectionResult,
  BracketBreakdown,
} from "@/lib/reports/tax/types";

function getAge(birthDate: string, atDate: Date): number {
  const birth = new Date(birthDate);
  let age = atDate.getFullYear() - birth.getFullYear();
  const monthDiff = atDate.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && atDate.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

export function calculateGreekTax(
  input: TaxProjectionInput,
): TaxProjectionResult {
  const taxableIncome = Math.max(
    0,
    input.annualRevenue - input.deductibleExpenses,
  );

  let incomeTax = 0;
  let dividendTax: number | null = null;
  const bracketBreakdown: BracketBreakdown[] = [];

  if (input.entityType === "freelancer") {
    // Progressive brackets
    const age = input.birthDate
      ? getAge(input.birthDate, new Date(new Date().getFullYear(), 11, 31))
      : null;

    let taxed = 0;
    for (const bracket of GREEK_INCOME_TAX_BRACKETS_2026) {
      if (taxed >= taxableIncome) break;
      const bracketCeiling =
        bracket.max === Infinity ? taxableIncome : bracket.max;
      const taxable = Math.min(taxableIncome, bracketCeiling) - taxed;
      if (taxable <= 0) continue;

      let effectiveRate = bracket.rate;
      // Youth discount
      if (age !== null) {
        if (age < 25) {
          // First two brackets (0-10000 and 10001-20000) at 0%
          if (bracket.max <= 20000) {
            effectiveRate = 0;
          }
        } else if (age >= 26 && age <= 30) {
          // Second bracket at 9% instead of 20%
          if (bracket.min === 10001) {
            effectiveRate = 0.09;
          }
        }
      }

      const taxAmount = Math.round(taxable * effectiveRate * 100) / 100;
      incomeTax += taxAmount;
      bracketBreakdown.push({
        from: bracket.min,
        to: bracket.max === Infinity ? taxableIncome : bracket.max,
        rate: effectiveRate,
        taxAmount,
      });
      taxed += taxable;
    }
  } else {
    // Corporate: IKE, EPE, AE
    incomeTax =
      Math.round(taxableIncome * GREEK_CORPORATE_TAX.corporateRate * 100) / 100;
    dividendTax =
      Math.round(taxableIncome * GREEK_CORPORATE_TAX.dividendRate * 100) / 100;
    bracketBreakdown.push({
      from: 0,
      to: taxableIncome,
      rate: GREEK_CORPORATE_TAX.corporateRate,
      taxAmount: incomeTax,
    });
  }

  const prepaymentRate = input.isFirstYear
    ? GREEK_CORPORATE_TAX.prepaymentFirstYear
    : GREEK_CORPORATE_TAX.prepaymentRate;
  const taxPrepayment = Math.round(incomeTax * prepaymentRate * 100) / 100;

  const efkaCategories = GREEK_EFKA_2026.selfEmployed.categories;
  const categoryIndex = Math.max(
    0,
    Math.min(input.efkaCategory - 1, efkaCategories.length - 1),
  );
  const efkaAnnual =
    Math.round(efkaCategories[categoryIndex].monthly * 12 * 100) / 100;

  const totalObligations =
    Math.round(
      (incomeTax + taxPrepayment + efkaAnnual + (dividendTax ?? 0)) * 100,
    ) / 100;

  const effectiveRate =
    input.annualRevenue > 0
      ? Math.round((totalObligations / input.annualRevenue) * 10000) / 100
      : 0;

  return {
    taxableIncome,
    incomeTax,
    taxPrepayment,
    efkaAnnual,
    dividendTax,
    totalObligations,
    effectiveRate,
    bracketBreakdown,
  };
}

export function getDefaultProjectionInput(
  ytdRevenue: number,
  monthsElapsed: number,
  _efkaCategory: number,
): number {
  if (monthsElapsed <= 0) return ytdRevenue;
  return Math.round((ytdRevenue / monthsElapsed) * 12 * 100) / 100;
}
