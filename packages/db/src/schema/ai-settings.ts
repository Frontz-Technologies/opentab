import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";

export const aiSettings = pgTable(
  "ai_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    apiKeyEncrypted: text("api_key_encrypted"),
    apiKeyIv: varchar("api_key_iv", { length: 32 }),
    apiKeyLast4: varchar("api_key_last4", { length: 4 }),
    chatModel: text("chat_model"),
    extractionModel: text("extraction_model"),
    receiptExtractionEnabled: boolean("receipt_extraction_enabled")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_settings_org_id_idx").on(table.orgId)],
);

export type AiSettings = typeof aiSettings.$inferSelect;
export type NewAiSettings = typeof aiSettings.$inferInsert;
