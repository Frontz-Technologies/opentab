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

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface CorporateTaxRates {
  corporateRate: number;
  dividendRate: number;
  prepaymentRate: number;
  prepaymentFirstYear: number;
}

export interface SocialSecurityCategory {
  level: number;
  monthly: number;
  label: string;
}

export interface SocialSecurityConfig {
  selfEmployed: {
    categories: SocialSecurityCategory[];
    defaultCategory: number;
  };
  employed: {
    employerRate: number;
    employeeRate: number;
    monthlyCap: number;
  };
}

export interface DocumentTypeParams {
  contactCountryCode: string | null;
  contactVatNumber: string | null;
  isService: boolean;
  isCreditNote: boolean;
  relatedInvoiceId: string | null;
}

export interface ExpenseClassification {
  code: string;
  label: string;
  labelEl: string;
  categoryCode: string;
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

  // E-Invoicing (Phase 4)
  resolveDocumentType?(params: DocumentTypeParams): string;
  resolveClassification?(
    documentType: string,
    isService: boolean,
  ): { category: string; type: string };

  // Expense classification (Phase 5)
  expenseClassifications?: ExpenseClassification[];
  mapCategoryToClassification?(categoryCode: string): string | null;

  // Tax data (Phase 4 defines, Phase 6 uses)
  incomeTaxBrackets?: TaxBracket[];
  corporateTax?: CorporateTaxRates;
  socialSecurity?: SocialSecurityConfig;
}
