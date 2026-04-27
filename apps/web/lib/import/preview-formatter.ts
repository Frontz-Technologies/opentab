// Renders the "Will create" review card for a mapped CSV row. The
// keys here MUST match the importer's declared `fields[].name` — see
// `apps/web/lib/import/importers/*.ts`. The contract test in
// `__tests__/import/preview-formatter-contract.test.ts` enforces this.

export interface CardShape {
  primary: string;
  secondary: string[];
}

type MappedRow = Record<string, string | undefined>;

const PRIMARY_FIELDS: Record<string, string[]> = {
  invoices: ["invoiceNumber", "contactName"],
  "credit-notes": ["creditNoteNumber", "contactName"],
  contacts: ["company", "firstName", "lastName"],
  expenses: ["supplierName", "expenseNumber"],
};

const SECONDARY_FIELDS: Record<string, string[]> = {
  invoices: ["total", "issueDate"],
  "credit-notes": ["total", "issueDate"],
  contacts: ["countryCode", "email"],
  expenses: ["total", "expenseDate"],
};

const AMOUNT_FIELDS = new Set(["total", "subtotal", "unitPrice", "taxAmount"]);

export const PREVIEW_FIELD_TABLES = {
  PRIMARY_FIELDS,
  SECONDARY_FIELDS,
  AMOUNT_FIELDS,
};

function formatAmount(value: string, currencyCode?: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}

function pick(row: MappedRow, fields: string[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const v = row[f];
    if (!v) continue;
    if (AMOUNT_FIELDS.has(f)) {
      out.push(formatAmount(v, row.currencyCode));
    } else {
      out.push(v);
    }
  }
  return out;
}

// Contacts mirror the app's displayName logic: prefer `company`,
// fall back to `firstName lastName` joined.
function formatContactPrimary(row: MappedRow): string {
  const company = row.company?.trim();
  if (company) return company;
  const first = row.firstName?.trim() ?? "";
  const last = row.lastName?.trim() ?? "";
  return `${first} ${last}`.trim() || "(empty row)";
}

export function formatCard(entityKey: string, row: MappedRow): CardShape {
  const primaryFields = PRIMARY_FIELDS[entityKey];
  const secondaryFields = SECONDARY_FIELDS[entityKey];

  if (!primaryFields || !secondaryFields) {
    const values = Object.values(row).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    return {
      primary: values[0] ?? "(empty row)",
      secondary: values.slice(1, 3),
    };
  }

  const primary =
    entityKey === "contacts"
      ? formatContactPrimary(row)
      : pick(row, primaryFields).join(" · ") || "(empty row)";

  const secondary = pick(row, secondaryFields);

  return { primary, secondary };
}
