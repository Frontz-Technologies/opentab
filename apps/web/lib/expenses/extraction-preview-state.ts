import type { LineItem } from "@/components/invoicing/line-items-builder";

export interface CurrentFormState {
  contactId: string;
  supplierName: string;
  expenseDate: string;
  currencyCode: string;
  description: string;
  categoryId: string;
  items: LineItem[];
}

export interface ExtractedData {
  vendorName: string | null;
  date: string | null;
  currency: string | null;
  description: string | null;
  categoryId: string | null;
  totalAmount: string | null;
  lineItems: unknown[];
}

export type PreviewableFieldName =
  | "contactId"
  | "supplierName"
  | "expenseDate"
  | "currencyCode"
  | "description"
  | "categoryId";

export type Snapshot = Partial<{
  contactId: string;
  supplierName: string;
  expenseDate: string;
  currencyCode: string;
  description: string;
  categoryId: string;
  items: LineItem[];
}>;

interface AcceptInput {
  state: CurrentFormState;
  defaultCurrency: string;
  defaultTaxRate: string;
  usesInclusiveTax: boolean;
  supplierMatch: { contactId: string } | null;
  data: ExtractedData;
  builtItems: LineItem[];
}

interface AcceptOutput {
  nextState: CurrentFormState;
  previewFields: Set<PreviewableFieldName>;
  previewLineItems: Set<string>;
  snapshot: Snapshot;
}

export function acceptExtractionPreview(input: AcceptInput): AcceptOutput {
  const { state, defaultCurrency, supplierMatch, data, builtItems } = input;

  const next: CurrentFormState = { ...state };
  const previewFields = new Set<PreviewableFieldName>();
  const previewLineItems = new Set<string>();
  const snapshot: Snapshot = {};

  if (supplierMatch) {
    snapshot.contactId = state.contactId;
    next.contactId = supplierMatch.contactId;
    previewFields.add("contactId");
  } else if (data.vendorName && !state.contactId) {
    snapshot.supplierName = state.supplierName;
    next.supplierName = data.vendorName;
    previewFields.add("supplierName");
  }

  if (data.date) {
    snapshot.expenseDate = state.expenseDate;
    next.expenseDate = data.date;
    previewFields.add("expenseDate");
  }

  if (data.currency && state.currencyCode === defaultCurrency) {
    snapshot.currencyCode = state.currencyCode;
    next.currencyCode = data.currency;
    previewFields.add("currencyCode");
  }

  if (data.description && !state.description) {
    snapshot.description = state.description;
    next.description = data.description;
    previewFields.add("description");
  }

  if (data.categoryId && !state.categoryId) {
    snapshot.categoryId = state.categoryId;
    next.categoryId = data.categoryId;
    previewFields.add("categoryId");
  }

  if (state.items.length === 0 && builtItems.length > 0) {
    snapshot.items = state.items;
    next.items = builtItems;
    for (const item of builtItems) {
      previewLineItems.add(item.id);
    }
  }

  return { nextState: next, previewFields, previewLineItems, snapshot };
}
