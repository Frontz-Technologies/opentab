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
import { expenseCategories } from "./expense-categories";

export const RECURRING_EXPENSE_STATUS = {
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
} as const;

export const EXPENSE_FREQUENCY = {
  DAILY: 1,
  WEEKLY: 2,
  BIWEEKLY: 3,
  MONTHLY: 4,
  QUARTERLY: 5,
  BIANNUALLY: 6,
  ANNUALLY: 7,
} as const;

export const recurringExpenses = pgTable(
  "recurring_expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id),
    categoryId: uuid("category_id").references(() => expenseCategories.id),
    status: integer("status")
      .notNull()
      .default(RECURRING_EXPENSE_STATUS.ACTIVE),
    frequency: integer("frequency")
      .notNull()
      .default(EXPENSE_FREQUENCY.MONTHLY),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextRunDate: date("next_run_date").notNull(),
    remainingCycles: integer("remaining_cycles"),
    autoConfirm: boolean("auto_confirm").notNull().default(false),
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .default("EUR"),
    usesInclusiveTax: boolean("uses_inclusive_tax").notNull().default(false),
    description: text("description"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("recurring_expense_org_id_idx").on(table.orgId),
    index("recurring_expense_org_status_idx").on(table.orgId, table.status),
    index("recurring_expense_next_run_idx").on(table.nextRunDate, table.status),
  ],
);

export const recurringExpenseItems = pgTable(
  "recurring_expense_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringExpenseId: uuid("recurring_expense_id")
      .notNull()
      .references(() => recurringExpenses.id, { onDelete: "cascade" }),
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
  (table) => [
    index("recurring_expense_item_parent_idx").on(table.recurringExpenseId),
  ],
);

export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type NewRecurringExpense = typeof recurringExpenses.$inferInsert;
export type RecurringExpenseItem = typeof recurringExpenseItems.$inferSelect;
export type NewRecurringExpenseItem = typeof recurringExpenseItems.$inferInsert;
