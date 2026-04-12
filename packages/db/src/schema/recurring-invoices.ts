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
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { contacts } from "./contacts";

export const RECURRING_STATUS = {
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
} as const;

export const FREQUENCY = {
  DAILY: 1,
  WEEKLY: 2,
  BIWEEKLY: 3,
  MONTHLY: 4,
  QUARTERLY: 5,
  BIANNUALLY: 6,
  ANNUALLY: 7,
} as const;

export const recurringInvoices = pgTable(
  "recurring_invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    status: integer("status").notNull().default(RECURRING_STATUS.ACTIVE),
    frequency: integer("frequency").notNull().default(FREQUENCY.QUARTERLY),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextSendDate: date("next_send_date").notNull(),
    remainingCycles: integer("remaining_cycles"),
    autoSend: boolean("auto_send").notNull().default(false),
    usesInclusiveTax: boolean("uses_inclusive_tax").notNull().default(false),
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .default("EUR"),
    notes: text("notes"),
    terms: text("terms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("recurring_invoice_org_id_idx").on(table.orgId),
    index("recurring_invoice_org_status_idx").on(table.orgId, table.status),
    index("recurring_invoice_next_send_idx").on(
      table.nextSendDate,
      table.status,
    ),
  ],
);

export const recurringInvoiceItems = pgTable(
  "recurring_invoice_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringInvoiceId: uuid("recurring_invoice_id")
      .notNull()
      .references(() => recurringInvoices.id, { onDelete: "cascade" }),
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
  (table) => [
    index("recurring_item_recurring_id_idx").on(table.recurringInvoiceId),
  ],
);

export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type NewRecurringInvoice = typeof recurringInvoices.$inferInsert;
export type RecurringInvoiceItem = typeof recurringInvoiceItems.$inferSelect;
export type NewRecurringInvoiceItem = typeof recurringInvoiceItems.$inferInsert;
