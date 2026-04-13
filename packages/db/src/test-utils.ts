import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export async function createTestDb(): Promise<{
  db: TestDatabase;
  teardown: () => Promise<void>;
}> {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });
  await pushSchema(pglite);
  return {
    db,
    teardown: async () => {
      await pglite.close();
    },
  };
}

async function pushSchema(pglite: PGlite) {
  const statements = [
    `CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'accountant')`,

    `CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY,
      "email" varchar(255) NOT NULL UNIQUE,
      "name" varchar(255) NOT NULL,
      "password_hash" text NOT NULL DEFAULT '',
      "email_verified" boolean NOT NULL DEFAULT false,
      "locale" varchar(5) NOT NULL DEFAULT 'en',
      "timezone" varchar(50) NOT NULL DEFAULT 'UTC',
      "image" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "organisation" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(255) NOT NULL,
      "slug" varchar(100) NOT NULL UNIQUE,
      "tax_id" varchar(50),
      "tax_authority" varchar(255),
      "country_code" varchar(2),
      "default_currency" varchar(3) NOT NULL DEFAULT 'EUR',
      "fiscal_year_start" integer NOT NULL DEFAULT 1,
      "address_line1" varchar(255),
      "address_line2" varchar(255),
      "city" varchar(100),
      "postal_code" varchar(20),
      "region" varchar(100),
      "phone" varchar(50),
      "logo_url" text,
      "tax_settings" jsonb,
      "setup_completed_steps" jsonb NOT NULL DEFAULT '[]',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "org_membership" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "role" org_role NOT NULL DEFAULT 'owner',
      "invited_at" timestamp,
      "accepted_at" timestamp,
      CONSTRAINT "org_membership_user_id_unique" UNIQUE ("user_id")
    )`,

    `CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "token" text NOT NULL UNIQUE,
      "expires_at" timestamp NOT NULL,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "access_token" text,
      "refresh_token" text,
      "access_token_expires_at" timestamp,
      "refresh_token_expires_at" timestamp,
      "scope" text,
      "id_token" text,
      "password" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TYPE contact_type AS ENUM ('client', 'supplier', 'both')`,

    `CREATE TYPE contact_classification AS ENUM ('individual', 'business', 'government')`,

    `CREATE TABLE IF NOT EXISTS "contact" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "type" contact_type NOT NULL DEFAULT 'client',
      "classification" contact_classification NOT NULL DEFAULT 'business',
      "company" varchar(255),
      "first_name" varchar(255),
      "last_name" varchar(255),
      "display_name" varchar(255) NOT NULL,
      "email" varchar(255),
      "phone" varchar(50),
      "vat_number" varchar(50),
      "vat_validated" boolean NOT NULL DEFAULT false,
      "country_code" varchar(2),
      "tax_office" varchar(255),
      "address_line1" varchar(255),
      "address_line2" varchar(255),
      "city" varchar(100),
      "postal_code" varchar(20),
      "region" varchar(100),
      "default_currency" varchar(3),
      "default_language" varchar(5),
      "default_payment_terms" integer,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TYPE tax_category AS ENUM ('standard', 'reduced', 'super_reduced', 'zero_rated', 'exempt', 'reverse_charge')`,

    `CREATE TABLE IF NOT EXISTS "product" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "name" varchar(255) NOT NULL,
      "description" text,
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "unit" varchar(50) NOT NULL DEFAULT 'item',
      "tax_category" tax_category NOT NULL DEFAULT 'standard',
      "vat_rate" numeric(5,2),
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "invoice" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "contact_id" uuid NOT NULL REFERENCES "contact"("id"),
      "status" integer NOT NULL DEFAULT 1,
      "invoice_number" varchar(50) NOT NULL,
      "issue_date" date NOT NULL,
      "due_date" date,
      "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
      "exchange_rate" numeric(12,6) NOT NULL DEFAULT '1.000000',
      "subtotal" numeric(12,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "amount_paid" numeric(12,2) NOT NULL DEFAULT '0.00',
      "balance" numeric(12,2) NOT NULL DEFAULT '0.00',
      "uses_inclusive_tax" boolean NOT NULL DEFAULT false,
      "contact_name" varchar(255) NOT NULL,
      "contact_email" varchar(255),
      "contact_vat_number" varchar(50),
      "contact_address" text,
      "notes" text,
      "terms" text,
      "internal_notes" text,
      "sent_at" timestamp,
      "paid_at" timestamp,
      "recurring_invoice_id" uuid,
      "quote_id" uuid,
      "mydata_mark" varchar(50),
      "mydata_qr_url" text,
      "mydata_document_type" varchar(10),
      "mydata_status" integer,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE UNIQUE INDEX "invoice_org_number_idx" ON "invoice" ("org_id", "invoice_number")`,

    `CREATE TABLE IF NOT EXISTS "invoice_item" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "invoice_id" uuid NOT NULL REFERENCES "invoice"("id") ON DELETE CASCADE,
      "product_id" uuid,
      "sort_order" integer NOT NULL DEFAULT 0,
      "name" varchar(255) NOT NULL,
      "description" text,
      "quantity" numeric(12,4) NOT NULL DEFAULT '1',
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "unit" varchar(50),
      "tax_category" varchar(50) NOT NULL DEFAULT 'standard',
      "tax_rate" numeric(5,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "line_total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "invoice_number_sequence" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "type" varchar(20) NOT NULL,
      "prefix" varchar(20) NOT NULL DEFAULT 'INV-',
      "next_number" integer NOT NULL DEFAULT 1,
      "digit_count" integer NOT NULL DEFAULT 4,
      "include_year" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE UNIQUE INDEX "invoice_seq_org_type_idx" ON "invoice_number_sequence" ("org_id", "type")`,

    `CREATE TABLE IF NOT EXISTS "quote" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "contact_id" uuid NOT NULL REFERENCES "contact"("id"),
      "status" integer NOT NULL DEFAULT 1,
      "quote_number" varchar(50) NOT NULL,
      "issue_date" date NOT NULL,
      "valid_until" date,
      "invoice_id" uuid,
      "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
      "exchange_rate" numeric(12,6) NOT NULL DEFAULT '1.000000',
      "subtotal" numeric(12,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "uses_inclusive_tax" boolean NOT NULL DEFAULT false,
      "contact_name" varchar(255) NOT NULL,
      "contact_email" varchar(255),
      "contact_vat_number" varchar(50),
      "contact_address" text,
      "notes" text,
      "terms" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE UNIQUE INDEX "quote_org_number_idx" ON "quote" ("org_id", "quote_number")`,

    `CREATE TABLE IF NOT EXISTS "quote_item" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
      "product_id" uuid,
      "sort_order" integer NOT NULL DEFAULT 0,
      "name" varchar(255) NOT NULL,
      "description" text,
      "quantity" numeric(12,4) NOT NULL DEFAULT '1',
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "unit" varchar(50),
      "tax_category" varchar(50) NOT NULL DEFAULT 'standard',
      "tax_rate" numeric(5,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "line_total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "recurring_invoice" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "contact_id" uuid NOT NULL REFERENCES "contact"("id"),
      "status" integer NOT NULL DEFAULT 1,
      "frequency" integer NOT NULL DEFAULT 5,
      "start_date" date NOT NULL,
      "end_date" date,
      "next_send_date" date NOT NULL,
      "remaining_cycles" integer,
      "auto_send" boolean NOT NULL DEFAULT false,
      "uses_inclusive_tax" boolean NOT NULL DEFAULT false,
      "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
      "notes" text,
      "terms" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "recurring_invoice_item" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "recurring_invoice_id" uuid NOT NULL REFERENCES "recurring_invoice"("id") ON DELETE CASCADE,
      "product_id" uuid,
      "sort_order" integer NOT NULL DEFAULT 0,
      "name" varchar(255) NOT NULL,
      "description" text,
      "quantity" numeric(12,4) NOT NULL DEFAULT '1',
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "unit" varchar(50),
      "tax_category" varchar(50) NOT NULL DEFAULT 'standard',
      "tax_rate" numeric(5,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "line_total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "mydata_credentials" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "aade_user_id" varchar(100) NOT NULL,
      "subscription_key" text NOT NULL,
      "environment" varchar(20) NOT NULL DEFAULT 'sandbox',
      "is_active" boolean NOT NULL DEFAULT true,
      "last_validated_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE UNIQUE INDEX "mydata_credentials_org_id_idx" ON "mydata_credentials" ("org_id")`,

    `CREATE TABLE IF NOT EXISTS "expense_group" (
      "code" varchar(30) PRIMARY KEY,
      "name_en" varchar(100) NOT NULL,
      "name_es" varchar(100),
      "name_el" varchar(100),
      "name_de" varchar(100),
      "description_en" text,
      "icon" varchar(50),
      "sort_order" integer NOT NULL DEFAULT 0,
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `INSERT INTO "expense_group" ("code", "name_en", "sort_order") VALUES
      ('rent', 'Rent & Leasing', 1),
      ('utilities', 'Utilities', 2),
      ('telecom', 'Telecommunications', 3),
      ('office_supplies', 'Office Supplies & Materials', 4),
      ('software', 'Software & Subscriptions', 5),
      ('hardware', 'Hardware & Equipment', 6),
      ('professional_services', 'Professional Services', 7),
      ('marketing', 'Marketing & Advertising', 8),
      ('travel', 'Travel', 9),
      ('transport', 'Local Transport', 10),
      ('insurance', 'Insurance', 11),
      ('meals_entertainment', 'Meals & Entertainment', 12),
      ('bank_fees', 'Bank & Financial Fees', 13),
      ('training', 'Training & Education', 14),
      ('taxes_contributions', 'Taxes & Social Contributions', 15),
      ('other', 'Other Expenses', 16)
    ON CONFLICT DO NOTHING`,

    `CREATE TABLE IF NOT EXISTS "expense_category" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "group_code" varchar(30) NOT NULL REFERENCES "expense_group"("code"),
      "code" varchar(50) NOT NULL,
      "name" varchar(255) NOT NULL,
      "color" varchar(7),
      "icon" varchar(50),
      "sort_order" integer NOT NULL DEFAULT 0,
      "active" boolean NOT NULL DEFAULT true,
      "is_default" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      UNIQUE("org_id", "code")
    )`,

    `CREATE TABLE IF NOT EXISTS "expense" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "contact_id" uuid REFERENCES "contact"("id"),
      "category_id" uuid REFERENCES "expense_category"("id"),
      "status" integer NOT NULL DEFAULT 1,
      "expense_number" varchar(50) NOT NULL,
      "supplier_invoice_number" varchar(100),
      "expense_date" date NOT NULL,
      "payment_date" date,
      "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
      "exchange_rate" numeric(12,6) NOT NULL DEFAULT '1.000000',
      "subtotal" numeric(12,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "uses_inclusive_tax" boolean NOT NULL DEFAULT false,
      "contact_name" varchar(255),
      "contact_vat_number" varchar(50),
      "description" text,
      "notes" text,
      "recurring_expense_id" uuid,
      "source" varchar(20) NOT NULL DEFAULT 'manual',
      "file_hash" varchar(64),
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      UNIQUE("org_id", "expense_number")
    )`,

    `CREATE TABLE IF NOT EXISTS "expense_item" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "expense_id" uuid NOT NULL REFERENCES "expense"("id") ON DELETE CASCADE,
      "sort_order" integer NOT NULL DEFAULT 0,
      "name" varchar(255) NOT NULL,
      "description" text,
      "quantity" numeric(12,4) NOT NULL DEFAULT '1',
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "tax_rate" numeric(5,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "line_total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "expense_attachment" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "expense_id" uuid NOT NULL REFERENCES "expense"("id") ON DELETE CASCADE,
      "file_path" text NOT NULL,
      "file_name" varchar(255) NOT NULL,
      "mime_type" varchar(100) NOT NULL,
      "file_size" integer NOT NULL,
      "file_hash" varchar(64) NOT NULL,
      "ai_status" varchar(20) NOT NULL DEFAULT 'pending',
      "extracted_data" jsonb,
      "ai_confidence" numeric(3,2),
      "uploaded_at" timestamp NOT NULL DEFAULT now(),
      "ai_processed_at" timestamp
    )`,

    `CREATE TABLE IF NOT EXISTS "recurring_expense" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "contact_id" uuid REFERENCES "contact"("id"),
      "category_id" uuid REFERENCES "expense_category"("id"),
      "status" integer NOT NULL DEFAULT 1,
      "frequency" integer NOT NULL DEFAULT 4,
      "start_date" date NOT NULL,
      "end_date" date,
      "next_run_date" date NOT NULL,
      "remaining_cycles" integer,
      "auto_confirm" boolean NOT NULL DEFAULT false,
      "currency_code" varchar(3) NOT NULL DEFAULT 'EUR',
      "uses_inclusive_tax" boolean NOT NULL DEFAULT false,
      "description" text,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "recurring_expense_item" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "recurring_expense_id" uuid NOT NULL REFERENCES "recurring_expense"("id") ON DELETE CASCADE,
      "sort_order" integer NOT NULL DEFAULT 0,
      "name" varchar(255) NOT NULL,
      "description" text,
      "quantity" numeric(12,4) NOT NULL DEFAULT '1',
      "unit_price" numeric(12,2) NOT NULL DEFAULT '0.00',
      "tax_rate" numeric(5,2) NOT NULL DEFAULT '0.00',
      "tax_amount" numeric(12,2) NOT NULL DEFAULT '0.00',
      "line_total" numeric(12,2) NOT NULL DEFAULT '0.00',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "mydata_transmission" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "invoice_id" uuid NOT NULL REFERENCES "invoice"("id") ON DELETE CASCADE,
      "status" integer NOT NULL DEFAULT 1,
      "document_type" varchar(10) NOT NULL,
      "classification_category" varchar(50),
      "classification_type" varchar(50),
      "payment_method" integer,
      "request_xml" text,
      "response_xml" text,
      "invoice_uid" varchar(100),
      "invoice_mark" varchar(50),
      "qr_url" text,
      "cancellation_mark" varchar(50),
      "error_code" varchar(50),
      "error_message" text,
      "attempt_count" integer NOT NULL DEFAULT 0,
      "next_retry_at" timestamp,
      "submitted_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  ];

  for (const sql of statements) {
    await pglite.query(sql);
  }
}
