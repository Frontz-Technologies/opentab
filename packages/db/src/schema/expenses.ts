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
import { expenseCategories } from "./expense-categories";

export const EXPENSE_SOURCE = {
  MANUAL: "manual",
  EMAIL: "email",
  AI_EXTRACT: "ai_extract",
  RECURRING: "recurring",
} as const;

export const expenses = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id),
    categoryId: uuid("category_id").references(() => expenseCategories.id),
    expenseNumber: varchar("expense_number", { length: 50 }).notNull(),
    supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
    expenseDate: date("expense_date").notNull(),
    paymentDate: date("payment_date"),
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
    contactName: varchar("contact_name", { length: 255 }),
    contactVatNumber: varchar("contact_vat_number", { length: 50 }),
    description: text("description"),
    notes: text("notes"),
    recurringExpenseId: uuid("recurring_expense_id"),
    source: varchar("source", { length: 20 }).notNull().default("manual"),
    fileHash: varchar("file_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("expense_org_id_idx").on(table.orgId),
    index("expense_org_contact_idx").on(table.orgId, table.contactId),
    index("expense_org_category_idx").on(table.orgId, table.categoryId),
    index("expense_org_date_idx").on(table.orgId, table.expenseDate),
    index("expense_org_hash_idx").on(table.orgId, table.fileHash),
    uniqueIndex("expense_org_number_idx").on(table.orgId, table.expenseNumber),
  ],
);

export const expenseItems = pgTable(
  "expense_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
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
  (table) => [index("expense_item_expense_id_idx").on(table.expenseId)],
);

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseItem = typeof expenseItems.$inferSelect;
export type NewExpenseItem = typeof expenseItems.$inferInsert;
