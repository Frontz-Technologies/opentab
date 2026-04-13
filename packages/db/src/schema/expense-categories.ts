import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";

export const expenseCategories = pgTable(
  "expense_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    parentId: uuid("parent_id"),
    code: varchar("code", { length: 50 }).notNull(),
    nameEn: varchar("name_en", { length: 255 }).notNull(),
    nameEs: varchar("name_es", { length: 255 }),
    nameEl: varchar("name_el", { length: 255 }),
    color: varchar("color", { length: 7 }),
    icon: varchar("icon", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    depth: integer("depth").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("expense_category_org_id_idx").on(table.orgId),
    index("expense_category_org_parent_idx").on(table.orgId, table.parentId),
    index("expense_category_org_active_idx").on(table.orgId, table.active),
    uniqueIndex("expense_category_org_code_idx").on(table.orgId, table.code),
  ],
);

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
