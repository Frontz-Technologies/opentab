import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 5 }).notNull().default("en"),
    dateFormat: varchar("date_format", { length: 20 })
      .notNull()
      .default("DD/MM/YYYY"),
    numberFormat: varchar("number_format", { length: 10 })
      .notNull()
      .default("eu"),
    notifyInvoicePaid: boolean("notify_invoice_paid").notNull().default(true),
    notifyExpenseApproved: boolean("notify_expense_approved")
      .notNull()
      .default(true),
    theme: varchar("theme", { length: 20 }).notNull().default("dark"),
    density: varchar("density", { length: 20 })
      .notNull()
      .default("comfortable"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_preferences_user_id_idx").on(table.userId)],
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
