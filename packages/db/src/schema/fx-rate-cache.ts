import {
  date,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const fxRateCache = pgTable(
  "fx_rate_cache",
  {
    date: date("date").notNull(),
    fromCurrency: varchar("from_currency", { length: 3 }).notNull(),
    toCurrency: varchar("to_currency", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 9 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.fromCurrency, t.toCurrency] }),
  }),
);

export type FxRateCacheRow = typeof fxRateCache.$inferSelect;
export type NewFxRateCacheRow = typeof fxRateCache.$inferInsert;
