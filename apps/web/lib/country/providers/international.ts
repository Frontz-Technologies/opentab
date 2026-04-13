import type { CountryProvider, TaxCodeMapping } from "../types";

export const internationalProvider: CountryProvider = {
  code: "INTL",
  name: "International",

  capabilities: {
    companyLookup: false,
    taxOfficeList: false,
    eInvoicing: false,
    taxProjection: false,
    vatReport: false,
    expenseClassification: false,
  },

  vatRates: [{ rate: 0, label: "No VAT (0%)", isDefault: true }],

  validateTaxId(_taxId: string): boolean {
    return true;
  },

  getDefaultVatRate(): number {
    return 0;
  },

  mapGroupToTaxCode(_groupCode: string): TaxCodeMapping | null {
    return null;
  },
};
