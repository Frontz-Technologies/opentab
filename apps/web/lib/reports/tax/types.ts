export type EntityType = "freelancer" | "ike" | "epe" | "ae";

export interface TaxProjectionInput {
  annualRevenue: number;
  deductibleExpenses: number;
  entityType: EntityType;
  birthDate?: string;
  efkaCategory: number;
  isFirstYear: boolean;
}

export interface BracketBreakdown {
  from: number;
  to: number;
  rate: number;
  taxAmount: number;
}

export interface TaxProjectionResult {
  taxableIncome: number;
  incomeTax: number;
  taxPrepayment: number;
  efkaAnnual: number;
  dividendTax: number | null;
  totalObligations: number;
  effectiveRate: number;
  bracketBreakdown: BracketBreakdown[];
}

export interface OrgTaxSettings {
  entityType?: EntityType;
  efkaCategory?: number;
  ownerBirthDate?: string;
  isFirstYear?: boolean;
}
