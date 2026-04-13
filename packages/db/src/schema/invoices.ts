import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { contacts } from "./contacts";

export const INVOICE_STATUS = {
  DRAFT: 1,
  SENT: 2,
  PARTIAL: 3,
  PAID: 4,
  CANCELLED: 5,
} as const;

export const invoices = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    status: integer("status").notNull().default(INVOICE_STATUS.DRAFT),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .default("EUR"),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 })
      .notNull()
      .default("1.000000"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    total: numeric("total", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    balance: numeric("balance", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    usesInclusiveTax: boolean("uses_inclusive_tax").notNull().default(false),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactVatNumber: varchar("contact_vat_number", { length: 50 }),
    contactAddress: text("contact_address"),
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"),
    sentAt: timestamp("sent_at"),
    paidAt: timestamp("paid_at"),
    recurringInvoiceId: uuid("recurring_invoice_id"),
    quoteId: uuid("quote_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_org_id_idx").on(table.orgId),
    index("invoice_org_status_idx").on(table.orgId, table.status),
    index("invoice_org_contact_idx").on(table.orgId, table.contactId),
    uniqueIndex("invoice_org_number_idx").on(table.orgId, table.invoiceNumber),
  ],
);

export const invoiceItems = pgTable(
  "invoice_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    unit: varchar("unit", { length: 50 }),
    taxCategory: varchar("tax_category", { length: 50 })
      .notNull()
      .default("standard"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("invoice_item_invoice_id_idx").on(table.invoiceId)],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
