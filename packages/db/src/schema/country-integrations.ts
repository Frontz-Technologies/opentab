import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { invoices } from "./invoices";
import { expenses } from "./expenses";

export const COUNTRY_INTEGRATION_SUBMISSION_STATUS = {
  PENDING: 1,
  SUBMITTED: 2,
  CONFIRMED: 3,
  FAILED: 4,
  RETRY_SCHEDULED: 5,
  FAILED_PERMANENT: 6,
  CANCELLED: 7,
} as const;

export const INBOUND_DOCUMENT_STATUS = {
  UNMATCHED: 1,
  MATCHED: 2,
  IGNORED: 3,
  CONFIRMED: 4,
} as const;

export const countryIntegrationCredentials = pgTable(
  "country_integration_credential",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    configJson: jsonb("config_json").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastValidatedAt: timestamp("last_validated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("country_integration_credential_org_kind_idx").on(
      table.orgId,
      table.countryCode,
      table.kind,
    ),
  ],
);

export const countryIntegrationSubmissions = pgTable(
  "country_integration_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "cascade",
    }),
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "cascade",
    }),
    status: integer("status")
      .notNull()
      .default(COUNTRY_INTEGRATION_SUBMISSION_STATUS.PENDING),
    externalId: varchar("external_id", { length: 100 }),
    qrUrl: text("qr_url"),
    requestJson: jsonb("request_json"),
    responseJson: jsonb("response_json"),
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at"),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("country_integration_submission_org_status_idx").on(
      table.orgId,
      table.status,
    ),
    index("country_integration_submission_invoice_idx").on(table.invoiceId),
    index("country_integration_submission_kind_status_idx").on(
      table.kind,
      table.status,
    ),
    index("country_integration_submission_external_id_idx").on(
      table.externalId,
    ),
  ],
);

export const inboundDocuments = pgTable(
  "inbound_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    counterpartyTaxId: varchar("counterparty_tax_id", { length: 50 }),
    counterpartyName: varchar("counterparty_name", { length: 255 }),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    issueDate: date("issue_date"),
    externalRef: varchar("external_ref", { length: 100 }),
    rawPayloadJson: jsonb("raw_payload_json"),
    status: integer("status")
      .notNull()
      .default(INBOUND_DOCUMENT_STATUS.UNMATCHED),
    matchedExpenseId: uuid("matched_expense_id").references(() => expenses.id, {
      onDelete: "set null",
    }),
    matchedInvoiceId: uuid("matched_invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("inbound_document_org_status_idx").on(table.orgId, table.status),
    index("inbound_document_matched_expense_idx").on(table.matchedExpenseId),
    index("inbound_document_external_ref_idx").on(table.externalRef),
  ],
);

export type CountryIntegrationCredential =
  typeof countryIntegrationCredentials.$inferSelect;
export type NewCountryIntegrationCredential =
  typeof countryIntegrationCredentials.$inferInsert;
export type CountryIntegrationSubmission =
  typeof countryIntegrationSubmissions.$inferSelect;
export type NewCountryIntegrationSubmission =
  typeof countryIntegrationSubmissions.$inferInsert;
export type InboundDocument = typeof inboundDocuments.$inferSelect;
export type NewInboundDocument = typeof inboundDocuments.$inferInsert;
