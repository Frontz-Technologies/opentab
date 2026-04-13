import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { expenses } from "./expenses";

export const expenseAttachments = pgTable(
  "expense_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    aiStatus: varchar("ai_status", { length: 20 }).notNull().default("pending"),
    extractedData: jsonb("extracted_data"),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    aiProcessedAt: timestamp("ai_processed_at"),
  },
  (table) => [
    index("expense_attachment_expense_id_idx").on(table.expenseId),
    index("expense_attachment_hash_idx").on(table.fileHash),
  ],
);

export type ExpenseAttachment = typeof expenseAttachments.$inferSelect;
export type NewExpenseAttachment = typeof expenseAttachments.$inferInsert;
