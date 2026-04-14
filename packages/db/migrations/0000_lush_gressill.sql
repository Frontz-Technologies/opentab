CREATE TYPE "public"."contact_classification" AS ENUM('individual', 'business', 'government');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('client', 'supplier', 'both');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'accountant');--> statement-breakpoint
CREATE TYPE "public"."tax_category" AS ENUM('standard', 'reduced', 'super_reduced', 'zero_rated', 'exempt', 'reverse_charge');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"api_key_encrypted" text,
	"api_key_iv" varchar(32),
	"api_key_last4" varchar(4),
	"model" varchar(100) DEFAULT 'anthropic/claude-sonnet-4' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "contact_type" DEFAULT 'client' NOT NULL,
	"classification" "contact_classification" DEFAULT 'business' NOT NULL,
	"company" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"display_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"vat_number" varchar(50),
	"vat_validated" boolean DEFAULT false NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"ai_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"ai_confidence" numeric(3, 2),
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"ai_processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"group_code" varchar(30) NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_group" (
	"code" varchar(30) PRIMARY KEY NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_es" varchar(100),
	"name_el" varchar(100),
	"name_de" varchar(100),
	"description_en" text,
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid,
	"category_id" uuid,
	"status" integer DEFAULT 1 NOT NULL,
	"expense_number" varchar(50) NOT NULL,
	"supplier_invoice_number" varchar(100),
	"expense_date" date NOT NULL,
	"payment_date" date,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1.000000' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"uses_inclusive_tax" boolean DEFAULT false NOT NULL,
	"contact_name" varchar(255),
	"contact_vat_number" varchar(50),
	"description" text,
	"notes" text,
	"recurring_expense_id" uuid,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"file_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(50),
	"tax_category" varchar(50) DEFAULT 'standard' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"prefix" varchar(20) DEFAULT 'INV-' NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"digit_count" integer DEFAULT 4 NOT NULL,
	"include_year" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1.000000' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"uses_inclusive_tax" boolean DEFAULT false NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mydata_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aade_user_id" varchar(100) NOT NULL,
	"subscription_key" text NOT NULL,
	"environment" varchar(20) DEFAULT 'sandbox' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mydata_transmission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
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
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'owner' NOT NULL,
	"invited_at" timestamp,
	"accepted_at" timestamp,
	CONSTRAINT "org_membership_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "organisation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"tax_id" varchar(50),
	"tax_authority" varchar(255),
	"country_code" varchar(2),
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"fiscal_year_start" integer DEFAULT 1 NOT NULL,
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"postal_code" varchar(20),
	"region" varchar(100),
	"phone" varchar(50),
	"logo_url" text,
	"tax_settings" jsonb,
	"setup_completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organisation_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(50) DEFAULT 'item' NOT NULL,
	"tax_category" "tax_category" DEFAULT 'standard' NOT NULL,
	"vat_rate" numeric(5, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(50),
	"tax_category" varchar(50) DEFAULT 'standard' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"quote_number" varchar(50) NOT NULL,
	"issue_date" date NOT NULL,
	"valid_until" date,
	"invoice_id" uuid,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1.000000' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"uses_inclusive_tax" boolean DEFAULT false NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"contact_vat_number" varchar(50),
	"contact_address" text,
	"notes" text,
	"terms" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expense_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_expense_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid,
	"category_id" uuid,
	"status" integer DEFAULT 1 NOT NULL,
	"frequency" integer DEFAULT 4 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_run_date" date NOT NULL,
	"remaining_cycles" integer,
	"auto_confirm" boolean DEFAULT false NOT NULL,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"uses_inclusive_tax" boolean DEFAULT false NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(50),
	"tax_category" varchar(50) DEFAULT 'standard' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"frequency" integer DEFAULT 5 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_send_date" date NOT NULL,
	"remaining_cycles" integer,
	"auto_send" boolean DEFAULT false NOT NULL,
	"uses_inclusive_tax" boolean DEFAULT false NOT NULL,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"terms" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"date_format" varchar(20) DEFAULT 'DD/MM/YYYY' NOT NULL,
	"number_format" varchar(10) DEFAULT 'eu' NOT NULL,
	"notify_invoice_paid" boolean DEFAULT true NOT NULL,
	"notify_expense_approved" boolean DEFAULT true NOT NULL,
	"theme" varchar(20) DEFAULT 'dark' NOT NULL,
	"density" varchar(20) DEFAULT 'comfortable' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachment" ADD CONSTRAINT "expense_attachment_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_group_code_expense_group_code_fk" FOREIGN KEY ("group_code") REFERENCES "public"."expense_group"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_number_sequence" ADD CONSTRAINT "invoice_number_sequence_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mydata_credentials" ADD CONSTRAINT "mydata_credentials_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mydata_transmission" ADD CONSTRAINT "mydata_transmission_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mydata_transmission" ADD CONSTRAINT "mydata_transmission_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense_item" ADD CONSTRAINT "recurring_expense_item_recurring_expense_id_recurring_expense_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_item" ADD CONSTRAINT "recurring_invoice_item_recurring_invoice_id_recurring_invoice_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice" ADD CONSTRAINT "recurring_invoice_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice" ADD CONSTRAINT "recurring_invoice_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_settings_org_id_idx" ON "ai_settings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contact_org_id_idx" ON "contact" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contact_org_type_idx" ON "contact" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "contact_org_vat_idx" ON "contact" USING btree ("org_id","vat_number");--> statement-breakpoint
CREATE INDEX "expense_attachment_expense_id_idx" ON "expense_attachment" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_attachment_hash_idx" ON "expense_attachment" USING btree ("file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_org_code_idx" ON "expense_category" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "expense_category_org_group_idx" ON "expense_category" USING btree ("org_id","group_code");--> statement-breakpoint
CREATE INDEX "expense_category_org_active_idx" ON "expense_category" USING btree ("org_id","active");--> statement-breakpoint
CREATE INDEX "expense_item_expense_id_idx" ON "expense_item" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_org_id_idx" ON "expense" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expense_org_status_idx" ON "expense" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "expense_org_contact_idx" ON "expense" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE INDEX "expense_org_category_idx" ON "expense" USING btree ("org_id","category_id");--> statement-breakpoint
CREATE INDEX "expense_org_date_idx" ON "expense" USING btree ("org_id","expense_date");--> statement-breakpoint
CREATE INDEX "expense_org_hash_idx" ON "expense" USING btree ("org_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_org_number_idx" ON "expense" USING btree ("org_id","expense_number");--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_id_idx" ON "invoice_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_seq_org_type_idx" ON "invoice_number_sequence" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "invoice_org_id_idx" ON "invoice" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invoice_org_status_idx" ON "invoice" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "invoice_org_contact_idx" ON "invoice" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_org_number_idx" ON "invoice" USING btree ("org_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "mydata_credentials_org_id_idx" ON "mydata_credentials" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mydata_transmission_org_id_idx" ON "mydata_transmission" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mydata_transmission_org_invoice_idx" ON "mydata_transmission" USING btree ("org_id","invoice_id");--> statement-breakpoint
CREATE INDEX "mydata_transmission_status_retry_idx" ON "mydata_transmission" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "mydata_transmission_mark_idx" ON "mydata_transmission" USING btree ("invoice_mark");--> statement-breakpoint
CREATE INDEX "product_org_id_idx" ON "product" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "product_org_active_idx" ON "product" USING btree ("org_id","active");--> statement-breakpoint
CREATE INDEX "quote_item_quote_id_idx" ON "quote_item" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_org_id_idx" ON "quote" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "quote_org_status_idx" ON "quote" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_org_number_idx" ON "quote" USING btree ("org_id","quote_number");--> statement-breakpoint
CREATE INDEX "recurring_expense_item_parent_idx" ON "recurring_expense_item" USING btree ("recurring_expense_id");--> statement-breakpoint
CREATE INDEX "recurring_expense_org_id_idx" ON "recurring_expense" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recurring_expense_org_status_idx" ON "recurring_expense" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "recurring_expense_next_run_idx" ON "recurring_expense" USING btree ("next_run_date","status");--> statement-breakpoint
CREATE INDEX "recurring_item_recurring_id_idx" ON "recurring_invoice_item" USING btree ("recurring_invoice_id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_org_id_idx" ON "recurring_invoice" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_org_status_idx" ON "recurring_invoice" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "recurring_invoice_next_send_idx" ON "recurring_invoice" USING btree ("next_send_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");