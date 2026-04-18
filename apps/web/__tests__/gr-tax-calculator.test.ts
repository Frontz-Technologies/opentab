import { describe, it, expect } from "vitest";
import {
  calculateGreekTax,
  getDefaultProjectionInput,
} from "../lib/country/providers/gr/tax-calculator";
import type { TaxProjectionInput } from "../lib/reports/tax/types";
import { GREEK_EFKA_2026 } from "../lib/country/providers/gr";

function makeInput(
  overrides: Partial<TaxProjectionInput> = {},
): TaxProjectionInput {
  return {
    annualRevenue: 50000,
    deductibleExpenses: 0,
    entityType: "freelancer",
    efkaCategory: 1,
    isFirstYear: false,
    ...overrides,
  };
}

describe("calculateGreekTax", () => {
  describe("freelancer progressive brackets", () => {
    it("calculates tax for 10000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 10000 }));
      expect(result.taxableIncome).toBe(10000);
      // 10000 * 0.09 = 900
      expect(result.incomeTax).toBe(900);
      expect(result.dividendTax).toBeNull();
    });

    it("calculates tax for 20000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 20000 }));
      // 10000 * 0.09 + 10000 * 0.20 = 900 + 2000 = 2900
      expect(result.incomeTax).toBe(2900);
    });

    it("calculates tax for 30000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 30000 }));
      // 900 + 2000 + 10000 * 0.26 = 900 + 2000 + 2600 = 5500
      expect(result.incomeTax).toBe(5500);
    });

    it("calculates tax for 40000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 40000 }));
      // 900 + 2000 + 2600 + 10000 * 0.34 = 5500 + 3400 = 8900
      expect(result.incomeTax).toBe(8900);
    });

    it("calculates tax for 50000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 50000 }));
      // 900 + 2000 + 2600 + 3400 + 10000 * 0.39 = 8900 + 3900 = 12800
      expect(result.incomeTax).toBe(12800);
    });

    it("calculates tax for 100000 income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 100000 }));
      // 900 + 2000 + 2600 + 3400 + 20000*0.39 + 40000*0.44 = 900+2000+2600+3400+7800+17600 = 34300
      expect(result.incomeTax).toBe(34300);
    });

    it("calculates zero income", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 0 }));
      expect(result.taxableIncome).toBe(0);
      expect(result.incomeTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it("clamps negative taxable income to zero", () => {
      const result = calculateGreekTax(
        makeInput({
          annualRevenue: 5000,
          deductibleExpenses: 10000,
        }),
      );
      expect(result.taxableIncome).toBe(0);
      expect(result.incomeTax).toBe(0);
    });
  });

  describe("youth discount", () => {
    it("applies 0% for first two brackets when under 25", () => {
      const birthYear = new Date().getFullYear() - 22;
      const result = calculateGreekTax(
        makeInput({
          annualRevenue: 30000,
          birthDate: `${birthYear}-06-15`,
        }),
      );
      // First two brackets at 0%: 0 + 0 + 10000*0.26 = 2600
      expect(result.incomeTax).toBe(2600);
    });

    it("applies 9% for second bracket when age 26-30", () => {
      const birthYear = new Date().getFullYear() - 28;
      const result = calculateGreekTax(
        makeInput({
          annualRevenue: 30000,
          birthDate: `${birthYear}-06-15`,
        }),
      );
      // 10000*0.09 + 10000*0.09 + 10000*0.26 = 900 + 900 + 2600 = 4400
      expect(result.incomeTax).toBe(4400);
    });
  });

  describe("corporate tax (IKE)", () => {
    it("calculates flat corporate rate", () => {
      const result = calculateGreekTax(
        makeInput({ annualRevenue: 50000, entityType: "ike" }),
      );
      expect(result.incomeTax).toBe(11000); // 50000 * 0.22
      expect(result.dividendTax).toBe(2500); // 50000 * 0.05
    });

    it("applies corporate bracket for EPE and AE too", () => {
      for (const entityType of ["epe", "ae"] as const) {
        const result = calculateGreekTax(
          makeInput({ annualRevenue: 100000, entityType }),
        );
        expect(result.incomeTax).toBe(22000);
        expect(result.dividendTax).toBe(5000);
      }
    });
  });

  describe("tax prepayment", () => {
    it("uses 55% for normal years", () => {
      const result = calculateGreekTax(
        makeInput({
          annualRevenue: 10000,
          isFirstYear: false,
        }),
      );
      // incomeTax = 900, prepayment = 900 * 0.55 = 495
      expect(result.taxPrepayment).toBe(495);
    });

    it("uses 50% for first year", () => {
      const result = calculateGreekTax(
        makeInput({
          annualRevenue: 10000,
          isFirstYear: true,
        }),
      );
      // incomeTax = 900, prepayment = 900 * 0.50 = 450
      expect(result.taxPrepayment).toBe(450);
    });
  });

  describe("EFKA categories", () => {
    it("calculates annual for all 6 categories", () => {
      const categories = GREEK_EFKA_2026.selfEmployed.categories;
      for (let i = 0; i < categories.length; i++) {
        const result = calculateGreekTax(makeInput({ efkaCategory: i + 1 }));
        const expected = Math.round(categories[i].monthly * 12 * 100) / 100;
        expect(result.efkaAnnual).toBe(expected);
      }
    });
  });

  describe("effective rate", () => {
    it("computes total obligations and effective rate", () => {
      const result = calculateGreekTax(makeInput({ annualRevenue: 50000 }));
      const efkaAnnual =
        Math.round(
          GREEK_EFKA_2026.selfEmployed.categories[0].monthly * 12 * 100,
        ) / 100;
      const expected = result.incomeTax + result.taxPrepayment + efkaAnnual;
      expect(result.totalObligations).toBeCloseTo(expected, 2);
      expect(result.effectiveRate).toBeCloseTo((expected / 50000) * 100, 2);
    });
  });
});

describe("getDefaultProjectionInput", () => {
  it("extrapolates annual revenue from YTD", () => {
    const projected = getDefaultProjectionInput(25000, 6, 1);
    expect(projected).toBe(50000);
  });

  it("handles zero months elapsed", () => {
    const projected = getDefaultProjectionInput(0, 0, 1);
    expect(projected).toBe(0);
  });
});
