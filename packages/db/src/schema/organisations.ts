import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const organisations = pgTable("organisation", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  taxId: varchar("tax_id", { length: 50 }),
  taxAuthority: varchar("tax_authority", { length: 255 }),
  countryCode: varchar("country_code", { length: 2 }),
  defaultCurrency: varchar("default_currency", { length: 3 })
    .notNull()
    .default("EUR"),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  region: varchar("region", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  logoUrl: text("logo_url"),
  setupCompletedSteps: jsonb("setup_completed_steps")
    .notNull()
    .$type<string[]>()
    .default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Organisation = typeof organisations.$inferSelect;
export type NewOrganisation = typeof organisations.$inferInsert;
