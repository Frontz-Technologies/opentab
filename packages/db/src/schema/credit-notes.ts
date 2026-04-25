import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { contacts } from "./contacts";
import { invoices } from "./invoices";

export const CREDIT_NOTE_STATUS = {
  DRAFT: 1,
  PUBLISHED: 2,
  SENT: 3,
  CANCELLED: 4,
} as const;

export const CREDIT_NOTE_REASON = {
  RETURN: "return",
  CORRECTION: "correction",
  DISCOUNT: "discount",
  OTHER: "other",
} as const;

export const creditNotes = pgTable(
  "credit_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id),
    // Nullable per #132 + #138: drafts hold no number; assigned on publish/send.
    creditNoteNumber: varchar("credit_note_number", { length: 50 }),
    // Original invoice this credits against. Nullable — standalone credits exist.
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    status: integer("status").notNull().default(CREDIT_NOTE_STATUS.DRAFT),
    issueDate: date("issue_date").notNull(),
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
    reason: text("reason").notNull(),
    reasonNote: text("reason_note"),
    notes: text("notes"),
    terms: text("terms"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_note_org_id_idx").on(t.orgId),
    index("credit_note_org_status_idx").on(t.orgId, t.status),
    index("credit_note_invoice_id_idx").on(t.invoiceId),
    uniqueIndex("credit_note_org_number_idx").on(t.orgId, t.creditNoteNumber),
  ],
);

export const creditNoteItems = pgTable(
  "credit_note_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
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
  (t) => [index("credit_note_item_cn_id_idx").on(t.creditNoteId)],
);

export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;
export type CreditNoteItem = typeof creditNoteItems.$inferSelect;
export type NewCreditNoteItem = typeof creditNoteItems.$inferInsert;
