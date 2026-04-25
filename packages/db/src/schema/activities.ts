import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { users } from "./users";

// Polymorphic audit log. One row per state-changing event on any entity
// (#131). v1 writers cover the 7 invoice Server Actions + the 3 myDATA
// lifecycle transitions; the table accepts any entity_type from day 1
// so future quote / expense / payment audits land without a migration.
//
// `entityId` has no FK constraint because the target table varies by
// `entityType`. Orphans on parent delete are cleaned up at the
// application layer in the parent's deleteX action.
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byEntity: index("activities_entity_idx").on(
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
    byOrg: index("activities_org_idx").on(t.orgId, t.createdAt),
  }),
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
