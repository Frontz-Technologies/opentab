import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { invoices } from "./invoices";

export const MYDATA_TRANSMISSION_STATUS = {
  PENDING: 1,
  SUBMITTED: 2,
  CONFIRMED: 3,
  FAILED: 4,
  RETRY_SCHEDULED: 5,
  FAILED_PERMANENT: 6,
  CANCELLED: 7,
} as const;

export const mydataCredentials = pgTable(
  "mydata_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    aadeUserId: varchar("aade_user_id", { length: 100 }).notNull(),
    subscriptionKey: text("subscription_key").notNull(),
    environment: varchar("environment", { length: 20 })
      .notNull()
      .default("sandbox"),
    isActive: boolean("is_active").notNull().default(true),
    lastValidatedAt: timestamp("last_validated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("mydata_credentials_org_id_idx").on(table.orgId)],
);

export const mydataTransmissions = pgTable(
  "mydata_transmission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    status: integer("status")
      .notNull()
      .default(MYDATA_TRANSMISSION_STATUS.PENDING),
    documentType: varchar("document_type", { length: 10 }).notNull(),
    classificationCategory: varchar("classification_category", { length: 50 }),
    classificationType: varchar("classification_type", { length: 50 }),
    paymentMethod: integer("payment_method"),
    requestXml: text("request_xml"),
    responseXml: text("response_xml"),
    invoiceUid: varchar("invoice_uid", { length: 100 }),
    invoiceMark: varchar("invoice_mark", { length: 50 }),
    qrUrl: text("qr_url"),
    cancellationMark: varchar("cancellation_mark", { length: 50 }),
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("mydata_transmission_org_id_idx").on(table.orgId),
    index("mydata_transmission_org_invoice_idx").on(
      table.orgId,
      table.invoiceId,
    ),
    index("mydata_transmission_status_retry_idx").on(
      table.status,
      table.nextRetryAt,
    ),
    index("mydata_transmission_mark_idx").on(table.invoiceMark),
  ],
);

export type MydataCredentials = typeof mydataCredentials.$inferSelect;
export type NewMydataCredentials = typeof mydataCredentials.$inferInsert;
export type MydataTransmission = typeof mydataTransmissions.$inferSelect;
export type NewMydataTransmission = typeof mydataTransmissions.$inferInsert;
