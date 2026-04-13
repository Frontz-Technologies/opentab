import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { expenseGroups } from "./expense-groups";

export const expenseCategories = pgTable(
  "expense_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    groupCode: varchar("group_code", { length: 30 })
      .notNull()
      .references(() => expenseGroups.code),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 7 }),
    icon: varchar("icon", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("expense_category_org_code_idx").on(table.orgId, table.code),
    index("expense_category_org_group_idx").on(table.orgId, table.groupCode),
    index("expense_category_org_active_idx").on(table.orgId, table.active),
  ],
);

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
