import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organisations } from "./organisations";

export const contactTypeEnum = pgEnum("contact_type", [
  "client",
  "supplier",
  "both",
]);

export const contactClassificationEnum = pgEnum("contact_classification", [
  "individual",
  "business",
  "government",
]);

export const contacts = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    type: contactTypeEnum("type").notNull().default("client"),
    classification: contactClassificationEnum("classification")
      .notNull()
      .default("business"),
    company: varchar("company", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    vatNumber: varchar("vat_number", { length: 50 }),
    vatValidated: boolean("vat_validated").notNull().default(false),
    countryCode: varchar("country_code", { length: 2 }),
    taxOffice: varchar("tax_office", { length: 255 }),
    arGemi: varchar("ar_gemi", { length: 20 }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    region: varchar("region", { length: 100 }),
    defaultCurrency: varchar("default_currency", { length: 3 }),
    defaultLanguage: varchar("default_language", { length: 5 }),
    defaultPaymentTerms: integer("default_payment_terms"),
    notes: text("notes"),
    // Per-org dedup key for CSV imports (#215). Null for any contact
    // not created via /import/contacts; partial unique index below.
    importIdempotencyKey: varchar("import_idempotency_key", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("contact_org_id_idx").on(table.orgId),
    index("contact_org_type_idx").on(table.orgId, table.type),
    index("contact_org_vat_idx").on(table.orgId, table.vatNumber),
    uniqueIndex("contact_import_idempotency_idx")
      .on(table.orgId, table.importIdempotencyKey)
      .where(sql`${table.importIdempotencyKey} IS NOT NULL`),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
