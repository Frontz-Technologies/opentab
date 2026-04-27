export interface CardShape {
  primary: string;
  secondary: string[];
}

type MappedRow = Record<string, string | undefined>;

const PRIMARY_FIELDS: Record<string, string[]> = {
  invoices: ["invoiceNumber", "contactName"],
  "credit-notes": ["creditNoteNumber", "contactName"],
  contacts: ["name"],
  expenses: ["vendorName"],
};

const SECONDARY_FIELDS: Record<string, string[]> = {
  invoices: ["totalAmount", "issueDate"],
  "credit-notes": ["totalAmount"],
  contacts: ["countryCode", "email"],
  expenses: ["totalAmount", "date"],
};

const AMOUNT_FIELDS = new Set([
  "totalAmount",
  "amount",
  "unitPrice",
  "subtotal",
]);

function formatAmount(value: string, currency?: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

function pick(row: MappedRow, fields: string[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const v = row[f];
    if (!v) continue;
    if (AMOUNT_FIELDS.has(f)) {
      out.push(formatAmount(v, row.currency));
    } else {
      out.push(v);
    }
  }
  return out;
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

  const primaryValues = pick(row, primaryFields);
  const secondary = pick(row, secondaryFields);

  return {
    primary: primaryValues.join(" · ") || "(empty row)",
    secondary,
  };
}
