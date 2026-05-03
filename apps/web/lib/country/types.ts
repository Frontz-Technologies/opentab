import type {
  TaxProjectionInput,
  TaxProjectionResult,
} from "@/lib/reports/tax/types";

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
  arGemi?: string;
  companyStatus?: string;
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

export interface TaxCodeMapping {
  taxCode: string;
  taxCodeLabel: string;
  eurLine?: string;
  deductibility: "full" | "partial" | "none" | "varies";
  deductibilityNote?: string;
}

export interface DocumentTypeSpec {
  code: string;
  label: string;
  nature: "invoice" | "credit_note" | "debit_note" | "receipt";
}

export interface RequiredContactField {
  key: string;
  label: string;
  validator?: (value: string) => boolean;
}

export interface LineItemExtensionField {
  key: string;
  label: string;
  kind: "string" | "number" | "boolean" | "date";
  required?: boolean;
}

export interface TaxRegime {
  code: string;
  label: string;
  appliesTo: "issuer" | "counterpart" | "both";
}

export interface NumberingRule {
  kind: "series" | "branch" | "prefix";
  label: string;
  pattern?: string;
  required?: boolean;
}

export interface VatReportInput {
  orgId: string;
  periodStart: string;
  periodEnd: string;
}

export interface VatReportResult {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  totals: Record<string, number>;
  lines: Array<{ code: string; label: string; amount: number }>;
}

export interface ReturnDeadline {
  code: string;
  label: string;
  cadence: "monthly" | "quarterly" | "annual" | "custom";
  dayOfMonth?: number;
}

export interface AiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, ctx: { orgId: string }) => Promise<unknown>;
}

export interface AiKnowledgeSource {
  id: string;
  title: string;
  url?: string;
  summary: string;
}

export interface IntegrationValidateResult {
  ok: boolean;
  errors?: string[];
}

export interface IntegrationInvoiceInput {
  orgId: string;
  orgTaxId: string | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    currencyCode: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    contactVatNumber: string | null;
  };
  items: Array<{
    id: string;
    sortOrder: number;
    lineTotal: string;
    taxRate: string;
    taxAmount: string;
    unit: string | null;
  }>;
  credentials: unknown;
}

// Credit note submission shape. Mirrors IntegrationInvoiceInput but
// adds the back-reference to the original invoice so plugins that
// need it (myDATA: parent MARK number) can include it in the payload.
export interface IntegrationCreditNoteInput {
  orgId: string;
  orgTaxId: string | null;
  creditNote: {
    id: string;
    creditNoteNumber: string;
    issueDate: string;
    currencyCode: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    contactVatNumber: string | null;
    reason: string;
  };
  /** Original invoice this credit note references; null for standalone credits. */
  parentInvoice: {
    id: string;
    invoiceNumber: string | null;
  } | null;
  items: Array<{
    id: string;
    sortOrder: number;
    lineTotal: string;
    taxRate: string;
    taxAmount: string;
    unit: string | null;
  }>;
  credentials: unknown;
}

export interface IntegrationSubmitResult {
  ok: boolean;
  externalId?: string;
  qrUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

export interface IntegrationStatusResult {
  status: "pending" | "submitted" | "confirmed" | "failed" | "cancelled";
  detail?: string;
}

export interface IntegrationDashboardModule {
  slot: "summary" | "alerts" | "actions";
  component: string;
}

export interface IntegrationSettingsPage {
  slug: string;
  component: string;
}

export interface IntegrationInboundSync {
  cadence: "hourly" | "daily" | "weekly" | "manual";
  run: (ctx: { orgId: string }) => Promise<{ fetched: number }>;
}

export interface Integration {
  kind: string;
  label: string;
  description?: string;

  // Credential lifecycle (Phase 3 wires a generic settings form)
  requiresCredentials?: boolean;
  /** Runtime-validated shape of config_json. Parsed server-side on save. */
  configSchema?: import("zod").ZodSchema;
  /**
   * Field names in config that are NOT encrypted at rest.
   * Everything else is encrypted by default (opt-OUT encryption) —
   * if an integration author adds a new field and forgets to list it,
   * the field defaults to encrypted, not leaked.
   */
  publicFields?: string[];
  validateCredentials?(
    credentials: unknown,
    ctx: { orgId: string },
  ): Promise<IntegrationValidateResult>;

  // Invoice flow
  validate?(input: IntegrationInvoiceInput): Promise<IntegrationValidateResult>;
  submit?(input: IntegrationInvoiceInput): Promise<IntegrationSubmitResult>;

  // Credit-note flow. Sibling of submit() — separate so the existing
  // invoice path is untouched. Refactor to a generic submitDocument()
  // when a third doc type lands.
  submitCreditNote?(
    input: IntegrationCreditNoteInput,
  ): Promise<IntegrationSubmitResult>;
  cancel?(ctx: {
    externalId: string;
    orgId: string;
    credentials: unknown;
  }): Promise<IntegrationSubmitResult>;
  getStatus?(ctx: {
    externalId: string;
    orgId: string;
    credentials: unknown;
  }): Promise<IntegrationStatusResult>;

  // PDF composition (iterated by the invoice PDF renderer in Phase 3)
  renderOnPdf?(ctx: {
    invoice: { invoiceNumber: string };
    submission: { externalId: string | null; qrUrl: string | null };
  }): string | Promise<string>;
  attachToPdf?(ctx: {
    invoice: { invoiceNumber: string };
    submission: { externalId: string | null };
  }): { mime: string; data: Uint8Array };

  // Invoice detail UI — path to a lazy-imported status chip component (Phase 3)
  renderInvoiceStatus?: string;

  dashboardModule?: IntegrationDashboardModule;
  settingsPage?: IntegrationSettingsPage;
  syncInbound?: IntegrationInboundSync;

  aiTools?: AiTool[];
}

export interface CountryProvider {
  code: string;
  name: string;

  capabilities: {
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

  // E-Invoicing (Phase 4)
  resolveDocumentType?(params: DocumentTypeParams): string;
  resolveClassification?(
    documentType: string,
    isService: boolean,
  ): { category: string; type: string };

  // Expense classification (Phase 5+)
  mapGroupToTaxCode?(groupCode: string): TaxCodeMapping | null;

  // Tax projection (Phase 6)
  calculateTax?(input: TaxProjectionInput): TaxProjectionResult;

  // Tax data (Phase 4 defines, Phase 6 uses)
  incomeTaxBrackets?: TaxBracket[];
  corporateTax?: CorporateTaxRates;
  socialSecurity?: SocialSecurityConfig;

  // Country plugin surface (Phase 1 foundation — populated per-provider in Phase 2+)
  integrations: Integration[];
  documentTypes: DocumentTypeSpec[];
  requiredContactFields: RequiredContactField[];
  lineItemExtensions: LineItemExtensionField[];
  taxRegimes: TaxRegime[];
  numberingRules: NumberingRule[];

  vatReport?(input: VatReportInput): Promise<VatReportResult>;
  taxProjection?(input: TaxProjectionInput): TaxProjectionResult;
  returnSchedule?: ReturnDeadline[];

  aiTools?: AiTool[];
  aiContext?(ctx: { orgId: string }): Promise<string>;
  aiKnowledgeSource?: AiKnowledgeSource[];
}
