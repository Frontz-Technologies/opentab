export interface VatRate {
  rate: number;
  label: string;
  isDefault: boolean;
}

export interface TaxOffice {
  code: string;
  name: string;
}

export interface CompanyLookupResult {
  name: string;
  tradeName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxOffice?: string;
  activity?: string;
}

export interface CountryProvider {
  code: string;
  name: string;

  capabilities: {
    companyLookup: boolean;
    taxOfficeList: boolean;
    eInvoicing: boolean;
    taxProjection: boolean;
    vatReport: boolean;
    expenseClassification: boolean;
  };

  vatRates: VatRate[];
  taxOffices?: TaxOffice[];

  validateTaxId(taxId: string): boolean;
  getDefaultVatRate(): number;

  lookupCompany?(taxId: string): Promise<CompanyLookupResult>;
}
