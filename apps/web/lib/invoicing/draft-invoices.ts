import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts,
  invoices,
  invoiceItems,
  organisations,
} from "@opentab/db/schema";
import { db } from "@/lib/db";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/invoicing/calculations";
import { getFxRate } from "@/lib/fx/get-rate";
import {
  isSupportedCurrency,
  type SupportedCurrencyCode,
} from "@/lib/currency/supported";
import { assertProductsInOrg } from "@/lib/security/assert-same-org";
import {
  moneyString,
  quantityString,
  taxRateString,
} from "@/lib/validation/money";

const draftInvoiceItemSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  quantity: quantityString,
  unitPrice: moneyString,
  unit: z.string().max(50).optional().default(""),
  taxCategory: z.string().max(50).default("standard"),
  taxRate: taxRateString,
});

export const createDraftInvoiceInputSchema = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currencyCode: z.string().length(3).default("EUR"),
  usesInclusiveTax: z.coerce.boolean().default(false),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  internalNotes: z.string().optional().default(""),
  items: z.array(draftInvoiceItemSchema).min(1),
});

export type CreateDraftInvoiceInput = z.infer<
  typeof createDraftInvoiceInputSchema
>;

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function formatContactAddress(contact: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
}) {
  return [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function createDraftInvoice(
  orgId: string,
  input: CreateDraftInvoiceInput,
) {
  const data = createDraftInvoiceInputSchema.parse(input);
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, data.contactId), eq(contacts.orgId, orgId)))
    .limit(1);

  if (!contact) {
    throw new Error("Contact not found");
  }

  // #274 carry-over: validate every line-item productId belongs to
  // the org. The Zod schema accepts any UUID for productId; without
  // this batch check a cross-org id would either trip the FK
  // constraint (opaque) or silently link the line to another org's
  // product. Mirror of the updateInvoice carry-over.
  const productIds = data.items
    .map((i) => i.productId)
    .filter((id): id is string => !!id);
  await assertProductsInOrg(db, productIds, orgId);

  const dueDate =
    data.dueDate ||
    (contact.defaultPaymentTerms
      ? addDays(data.issueDate, contact.defaultPaymentTerms)
      : "");

  const totals = calculateInvoiceTotals(
    data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
    })),
    data.usesInclusiveTax,
  );

  const resolvedCurrency =
    data.currencyCode || contact.defaultCurrency || "EUR";

  // Snapshot the FX rate at save time so historical reports stay
  // stable even if ECB later revises a published rate. When the
  // invoice currency matches the org default currency, getFxRate's
  // identity branch returns 1 — kept explicit so the fallthrough is
  // obvious to future readers.
  const [org] = await db
    .select({ defaultCurrency: organisations.defaultCurrency })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  const orgDefaultCurrency = org?.defaultCurrency ?? "EUR";

  let exchangeRate = "1.000000";
  if (
    isSupportedCurrency(resolvedCurrency) &&
    isSupportedCurrency(orgDefaultCurrency)
  ) {
    const fx = await getFxRate(
      new Date(`${data.issueDate}T00:00:00Z`),
      resolvedCurrency as SupportedCurrencyCode,
      orgDefaultCurrency as SupportedCurrencyCode,
    );
    exchangeRate = fx.rate.toFixed(6);
  }

  // #132: drafts no longer reserve an invoice number. The number is
  // assigned on the first publish/send via assignInvoiceNumberIfMissing.
  const [invoice] = await db
    .insert(invoices)
    .values({
      orgId,
      contactId: contact.id,
      invoiceNumber: null,
      issueDate: data.issueDate,
      dueDate: dueDate || null,
      currencyCode: resolvedCurrency,
      exchangeRate,
      usesInclusiveTax: data.usesInclusiveTax,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      balance: totals.total,
      contactName: contact.displayName,
      contactEmail: contact.email || null,
      contactVatNumber: contact.vatNumber || null,
      contactAddress: formatContactAddress(contact) || null,
      notes: data.notes || null,
      terms: data.terms || null,
      internalNotes: data.internalNotes || null,
    })
    .returning();

  for (const item of data.items) {
    const lineTotals = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      usesInclusiveTax: data.usesInclusiveTax,
    });

    await db.insert(invoiceItems).values({
      invoiceId: invoice.id,
      productId: item.productId || null,
      sortOrder: item.sortOrder,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unit: item.unit || null,
      taxCategory: item.taxCategory,
      taxRate: item.taxRate,
      taxAmount: lineTotals.taxAmount,
      lineTotal: lineTotals.lineTotal,
    });
  }

  return { invoice };
}
