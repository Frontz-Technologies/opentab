import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";

export const invoiceSequences = pgTable(
  "invoice_number_sequence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    prefix: varchar("prefix", { length: 20 }).notNull().default("INV-"),
    nextNumber: integer("next_number").notNull().default(1),
    digitCount: integer("digit_count").notNull().default(4),
    includeYear: boolean("include_year").notNull().default(false),
    // #138: optional placeholder template. When set, overrides
    // prefix/digitCount/includeYear in the renderer. Null → simple-
    // mode formatting (existing behaviour).
    pattern: text("pattern"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoice_seq_org_type_idx").on(table.orgId, table.type),
  ],
);

export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type NewInvoiceSequence = typeof invoiceSequences.$inferInsert;
