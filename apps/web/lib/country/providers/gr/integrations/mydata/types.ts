export interface MyDataConfig {
  aadeUserId: string;
  subscriptionKey: string;
  environment: "production" | "sandbox";
}

export interface MyDataIssuer {
  vatNumber: string;
  country: string;
  branch: number;
}

export interface MyDataCounterpart {
  vatNumber: string;
  country: string;
  branch: number;
}

export interface MyDataInvoiceHeader {
  series: string;
  aa: string;
  issueDate: string;
  invoiceType: string;
  currency: string;
}

export interface MyDataIncomeClassification {
  classificationType: string;
  classificationCategory: string;
  amount: string;
}

export interface MyDataInvoiceDetail {
  lineNumber: number;
  netValue: string;
  vatCategory: number;
  vatAmount: string;
  incomeClassification?: MyDataIncomeClassification;
}

export interface MyDataPaymentMethodDetail {
  type: number;
  amount: string;
}

export interface MyDataInvoiceSummary {
  totalNetValue: string;
  totalVatAmount: string;
  totalWithheldAmount: string;
  totalFeesAmount: string;
  totalStampDutyAmount: string;
  totalOtherTaxesAmount: string;
  totalDeductionsAmount: string;
  totalGrossValue: string;
  incomeClassification?: MyDataIncomeClassification;
}

export interface MyDataInvoice {
  issuer: MyDataIssuer;
  counterpart?: MyDataCounterpart;
  invoiceHeader: MyDataInvoiceHeader;
  paymentMethods: MyDataPaymentMethodDetail[];
  invoiceDetails: MyDataInvoiceDetail[];
  invoiceSummary: MyDataInvoiceSummary;
  /** Parent MARK numbers referenced by 5.1 (Associated Credit Invoice). */
  correlatedInvoices?: string[];
}

export interface MyDataError {
  code: string;
  message: string;
}

export interface SendInvoiceResult {
  index: number;
  invoiceUid: string;
  invoiceMark: string;
  qrUrl: string;
  statusCode: "Success" | "Error";
  errors?: MyDataError[];
}

export interface MyDataDocumentType {
  code: string;
  name: string;
  nameEn: string;
  category: "income" | "credit" | "expense";
}

export interface MyDataClassification {
  code: string;
  name: string;
  nameEn: string;
}

export interface MyDataPaymentMethod {
  code: number;
  name: string;
  nameEn: string;
}

export interface MyDataVatCategory {
  rate: number;
  category: number;
  label: string;
}

export interface DocumentTypeParams {
  contactCountryCode: string | null;
  contactVatNumber: string | null;
  isService: boolean;
  isCreditNote: boolean;
  relatedInvoiceId: string | null;
}
