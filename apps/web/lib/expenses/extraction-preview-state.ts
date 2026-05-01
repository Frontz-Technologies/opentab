import type { LineItem } from "@/components/invoicing/line-items-builder";

export interface CurrentFormState {
  contactId: string;
  supplierName: string;
  supplierVat: string;
  expenseDate: string;
  currencyCode: string;
  description: string;
  categoryId: string;
  items: LineItem[];
}

export interface ExtractedData {
  vendorName: string | null;
  vendorVat: string | null;
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
  | "supplierVat"
  | "expenseDate"
  | "currencyCode"
  | "description"
  | "categoryId";

export type Snapshot = Partial<{
  contactId: string;
  supplierName: string;
  supplierVat: string;
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

  if (data.vendorVat && !state.contactId && !state.supplierVat) {
    snapshot.supplierVat = state.supplierVat;
    next.supplierVat = data.vendorVat;
    previewFields.add("supplierVat");
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

interface DiscardInput {
  state: CurrentFormState;
  previewFields: Set<PreviewableFieldName>;
  previewLineItems: Set<string>;
  snapshot: Snapshot;
}

interface DiscardOutput {
  nextState: CurrentFormState;
}

export function discardPreview(input: DiscardInput): DiscardOutput {
  const { state, previewFields, previewLineItems, snapshot } = input;
  const next: CurrentFormState = { ...state };

  for (const name of previewFields) {
    if (name === "contactId" && snapshot.contactId !== undefined) {
      next.contactId = snapshot.contactId;
    } else if (name === "supplierName" && snapshot.supplierName !== undefined) {
      next.supplierName = snapshot.supplierName;
    } else if (name === "supplierVat" && snapshot.supplierVat !== undefined) {
      next.supplierVat = snapshot.supplierVat;
    } else if (name === "expenseDate" && snapshot.expenseDate !== undefined) {
      next.expenseDate = snapshot.expenseDate;
    } else if (name === "currencyCode" && snapshot.currencyCode !== undefined) {
      next.currencyCode = snapshot.currencyCode;
    } else if (name === "description" && snapshot.description !== undefined) {
      next.description = snapshot.description;
    } else if (name === "categoryId" && snapshot.categoryId !== undefined) {
      next.categoryId = snapshot.categoryId;
    }
  }

  if (previewLineItems.size > 0) {
    if (snapshot.items !== undefined) {
      next.items = snapshot.items;
    } else {
      next.items = state.items.filter((it) => !previewLineItems.has(it.id));
    }
  }

  return { nextState: next };
}

interface ExitFieldInput {
  name: PreviewableFieldName;
  previewFields: Set<PreviewableFieldName>;
  snapshot: Snapshot;
}

interface ExitFieldOutput {
  previewFields: Set<PreviewableFieldName>;
  snapshot: Snapshot;
}

export function exitFieldPreview(input: ExitFieldInput): ExitFieldOutput {
  const previewFields = new Set(input.previewFields);
  previewFields.delete(input.name);
  const snapshot: Snapshot = { ...input.snapshot };
  delete snapshot[input.name];
  return { previewFields, snapshot };
}

interface ExitItemInput {
  id: string;
  previewLineItems: Set<string>;
}

interface ExitItemOutput {
  previewLineItems: Set<string>;
}

export function exitItemPreview(input: ExitItemInput): ExitItemOutput {
  const previewLineItems = new Set(input.previewLineItems);
  previewLineItems.delete(input.id);
  return { previewLineItems };
}
