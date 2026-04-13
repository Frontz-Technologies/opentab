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

export const QUOTE_STATUS = {
  DRAFT: 1,
  SENT: 2,
  ACCEPTED: 3,
  REJECTED: 4,
  CONVERTED: 5,
} as const;

export const quotes = pgTable(
  "quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    status: integer("status").notNull().default(QUOTE_STATUS.DRAFT),
    quoteNumber: varchar("quote_number", { length: 50 }).notNull(),
    issueDate: date("issue_date").notNull(),
    validUntil: date("valid_until"),
    invoiceId: uuid("invoice_id"),
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
    usesInclusiveTax: boolean("uses_inclusive_tax").notNull().default(false),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactVatNumber: varchar("contact_vat_number", { length: 50 }),
    contactAddress: text("contact_address"),
    notes: text("notes"),
    terms: text("terms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("quote_org_id_idx").on(table.orgId),
    index("quote_org_status_idx").on(table.orgId, table.status),
    uniqueIndex("quote_org_number_idx").on(table.orgId, table.quoteNumber),
  ],
);

export const quoteItems = pgTable(
  "quote_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
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
  (table) => [index("quote_item_quote_id_idx").on(table.quoteId)],
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
