import {
  pgTable,
  uuid,
  text,
  pgEnum,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { organisations } from "./organisations.js";

export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "member",
  "accountant",
]);

export const orgMemberships = pgTable(
  "org_membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("owner"),
    invitedAt: timestamp("invited_at"),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [unique("org_membership_user_id_unique").on(table.userId)],
);

export type OrgMembership = typeof orgMemberships.$inferSelect;
export type NewOrgMembership = typeof orgMemberships.$inferInsert;
