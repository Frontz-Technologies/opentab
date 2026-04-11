import { pgTable, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  locale: varchar("locale", { length: 5 }).notNull().default("en"),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
