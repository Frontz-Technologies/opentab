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
  ];

  for (const sql of statements) {
    await pglite.query(sql);
  }
}
