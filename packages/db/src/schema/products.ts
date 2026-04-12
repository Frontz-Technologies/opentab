import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";

export const taxCategoryEnum = pgEnum("tax_category", [
  "standard",
  "reduced",
  "super_reduced",
  "zero_rated",
  "exempt",
  "reverse_charge",
]);

export const products = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    unit: varchar("unit", { length: 50 }).notNull().default("item"),
    taxCategory: taxCategoryEnum("tax_category").notNull().default("standard"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("product_org_id_idx").on(table.orgId),
    index("product_org_active_idx").on(table.orgId, table.active),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
