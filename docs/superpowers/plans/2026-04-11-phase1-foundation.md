# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the OpenTab monorepo with auth, org creation, app shell with full design system, and Quick Setup onboarding.

**Architecture:** Turborepo + pnpm monorepo with apps/web (Next.js 15 App Router) and packages/db (Drizzle + PostgreSQL). Better Auth for email/password auth with auto-org creation on signup. shadcn/ui customized with "Digital Ledger" design system. PGlite for test database.

**Tech Stack:** Next.js 15, Better Auth, Drizzle ORM, PostgreSQL 16, PGlite, Tailwind CSS v4, shadcn/ui, next-intl, Vitest, Playwright MCP

---

## File Map

### Root

- Create: `package.json` — root workspace config, shared scripts
- Create: `pnpm-workspace.yaml` — workspace definition
- Create: `turbo.json` — Turborepo pipeline config
- Create: `.env.example` — env var reference
- Create: `.gitignore` — project ignores
- Create: `CLAUDE.md` — AI agent build/test/format commands

### packages/db

- Create: `packages/db/package.json` — db package config
- Create: `packages/db/tsconfig.json` — TypeScript config
- Create: `packages/db/drizzle.config.ts` — Drizzle config
- Create: `packages/db/src/index.ts` — DB client export
- Create: `packages/db/src/client.ts` — Drizzle client factory
- Create: `packages/db/src/schema/users.ts` — User table schema
- Create: `packages/db/src/schema/organisations.ts` — Organisation table schema
- Create: `packages/db/src/schema/org-memberships.ts` — OrgMembership table schema
- Create: `packages/db/src/schema/index.ts` — Re-export all schemas
- Create: `packages/db/src/seed.ts` — Seed script
- Create: `packages/db/src/test-utils.ts` — PGlite test helper

### apps/web

- Create: `apps/web/package.json` — Next.js app dependencies
- Create: `apps/web/tsconfig.json` — TypeScript config
- Create: `apps/web/next.config.ts` — Next.js config with next-intl
- Create: `apps/web/postcss.config.ts` — PostCSS for Tailwind v4
- Create: `apps/web/tailwind.config.ts` — Design system tokens
- Create: `apps/web/app/globals.css` — Tailwind imports + custom styles
- Create: `apps/web/app/layout.tsx` — Root layout (fonts, providers)
- Create: `apps/web/app/page.tsx` — Root redirect
- Create: `apps/web/lib/auth-server.ts` — Better Auth server config
- Create: `apps/web/lib/auth-client.ts` — Better Auth client config
- Create: `apps/web/lib/utils.ts` — cn() helper + utilities
- Create: `apps/web/lib/session.ts` — getSession server helper
- Create: `apps/web/hooks/use-session.ts` — Client session hook
- Create: `apps/web/messages/en.json` — i18n English strings
- Create: `apps/web/i18n/request.ts` — next-intl request config
- Create: `apps/web/middleware.ts` — Auth middleware
- Create: `apps/web/app/api/auth/[...all]/route.ts` — Better Auth handler
- Create: Auth pages (login, register, forgot-password, reset-password)
- Create: App shell components (sidebar, top-bar, mobile-nav, user-menu)
- Create: Dashboard page + Quick Setup widget
- Create: Company settings page + server action

### docker

- Create: `docker/docker-compose.dev.yml` — Dev postgres + redis
- Create: `docker/docker-compose.yml` — Production compose
- Create: `docker/.env.sample` — All env vars with descriptions

### docs

- Create: `docs/DESIGN.md` — Living design system document
- Create: `docs/ARCHITECTURE.md` — System architecture
- Create: `docs/CONVENTIONS.md` — Code conventions

---

## Task 1: Monorepo Scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `CLAUDE.md`

- [ ] **Step 1: Initialize root package.json**

```json
{
  "name": "opentab",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:push": "turbo db:push"
  },
  "devDependencies": {
    "prettier": "^3.5.0",
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  },
  "packageManager": "pnpm@10.33.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "db:generate": { "cache": false },
    "db:migrate": { "cache": false },
    "db:push": { "cache": false }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.next/
dist/
.turbo/
.env
.env.local
*.log
.DS_Store
coverage/
.vercel/
```

- [ ] **Step 5: Create .env.example**

```env
# See docker/.env.sample for full documentation of all variables
DATABASE_URL=postgresql://opentab:opentab_dev@localhost:5432/opentab_dev
BETTER_AUTH_SECRET=change-me-to-a-random-64-char-string
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Create CLAUDE.md**

```markdown
# OpenTab

AI-native financial platform for freelancers & startups.

## Commands

- `pnpm dev` — Start Next.js dev server
- `pnpm build` — Build all packages
- `pnpm test` — Run all Vitest tests
- `pnpm format` — Format all files with Prettier
- `pnpm lint` — Lint all packages
- `pnpm db:generate` — Generate Drizzle migrations
- `pnpm db:push` — Push schema to database
- Verification: invoke visual-verification skill (Playwright MCP)

## Architecture

- Monorepo: Turborepo + pnpm workspaces
- apps/web: Next.js 15 App Router
- packages/db: Drizzle ORM + PostgreSQL schema
- Auth: Better Auth (email/password)
- UI: shadcn/ui + Tailwind CSS v4
- Test DB: PGlite (in-process PostgreSQL)

## Conventions

- See docs/CONVENTIONS.md for full details
- Conventional commits: feat:, fix:, refactor:, test:, docs:, chore:
- One org per user (org context from session, no slug in URL)
- TDD: write tests first, implement second
- Dark-only UI theme — see docs/DESIGN.md
```

- [ ] **Step 7: Install root dependencies and commit**

```bash
cd /home/claude/repos/opentab
pnpm install
git add -A
git commit -m "chore: scaffold monorepo with Turborepo + pnpm workspaces"
```

---

## Task 2: Database Package (packages/db)

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/test-utils.ts`
- Create: `packages/db/vitest.config.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@opentab/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./test-utils": "./src/test-utils.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.2.0",
    "drizzle-kit": "^0.30.0",
    "vitest": "^3.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create packages/db/drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create packages/db/src/client.ts**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

- [ ] **Step 5: Create packages/db/src/index.ts**

```typescript
export { createDb, type Database } from "./client.js";
export * from "./schema/index.js";
```

- [ ] **Step 6: Create packages/db/src/test-utils.ts**

This file creates an in-memory PGlite database for tests with the full schema pushed via raw SQL.

```typescript
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index.js";

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
  await pglite.query(`
    DO $$ BEGIN
      CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'accountant');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "user" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar(255) NOT NULL UNIQUE,
      "name" varchar(255) NOT NULL,
      "password_hash" text NOT NULL DEFAULT '',
      "email_verified" boolean NOT NULL DEFAULT false,
      "locale" varchar(5) NOT NULL DEFAULT 'en',
      "timezone" varchar(50) NOT NULL DEFAULT 'UTC',
      "image" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "organisation" (
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
    );

    CREATE TABLE IF NOT EXISTS "org_membership" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "org_id" uuid NOT NULL REFERENCES "organisation"("id") ON DELETE CASCADE,
      "role" org_role NOT NULL DEFAULT 'owner',
      "invited_at" timestamp,
      "accepted_at" timestamp,
      CONSTRAINT "org_membership_user_id_unique" UNIQUE ("user_id")
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "expires_at" timestamp NOT NULL,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
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
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    );
  `);
}
```

- [ ] **Step 7: Create packages/db/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 8: Install dependencies and commit**

```bash
cd /home/claude/repos/opentab
pnpm install
git add packages/db/
git commit -m "feat: add database package with Drizzle schema and PGlite test utils"
```

---

## Task 3: Database Schema + Tests

**Files:**

- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/organisations.ts`
- Create: `packages/db/src/schema/org-memberships.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `packages/db/src/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDatabase } from "../test-utils.js";
import { users, organisations, orgMemberships } from "../schema/index.js";

describe("Database Schema", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;
  });

  afterAll(async () => {
    await teardown();
  });

  describe("User", () => {
    it("creates a user with required fields", async () => {
      const [user] = await db
        .insert(users)
        .values({ email: "test@example.com", name: "Test User" })
        .returning();

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.locale).toBe("en");
      expect(user.timezone).toBe("UTC");
      expect(user.emailVerified).toBe(false);
      expect(user.image).toBeNull();
    });

    it("enforces unique email", async () => {
      await db
        .insert(users)
        .values({ email: "unique@example.com", name: "User 1" });
      await expect(
        db
          .insert(users)
          .values({ email: "unique@example.com", name: "User 2" }),
      ).rejects.toThrow();
    });
  });

  describe("Organisation", () => {
    it("creates an organisation with defaults", async () => {
      const [org] = await db
        .insert(organisations)
        .values({ name: "Test Company", slug: "test-company" })
        .returning();

      expect(org.id).toBeDefined();
      expect(org.name).toBe("Test Company");
      expect(org.slug).toBe("test-company");
      expect(org.defaultCurrency).toBe("EUR");
      expect(org.fiscalYearStart).toBe(1);
      expect(org.setupCompletedSteps).toEqual([]);
    });

    it("enforces unique slug", async () => {
      await db
        .insert(organisations)
        .values({ name: "Org A", slug: "unique-slug" });
      await expect(
        db.insert(organisations).values({ name: "Org B", slug: "unique-slug" }),
      ).rejects.toThrow();
    });
  });

  describe("OrgMembership", () => {
    it("creates membership linking user to org", async () => {
      const [user] = await db
        .insert(users)
        .values({ email: "member@example.com", name: "Member" })
        .returning();
      const [org] = await db
        .insert(organisations)
        .values({ name: "Member Org", slug: "member-org" })
        .returning();

      const [membership] = await db
        .insert(orgMemberships)
        .values({ userId: user.id, orgId: org.id, role: "owner" })
        .returning();

      expect(membership.userId).toBe(user.id);
      expect(membership.orgId).toBe(org.id);
      expect(membership.role).toBe("owner");
    });

    it("enforces one org per user", async () => {
      const [user] = await db
        .insert(users)
        .values({ email: "oneorg@example.com", name: "One Org" })
        .returning();
      const [org1] = await db
        .insert(organisations)
        .values({ name: "Org 1", slug: "org-one" })
        .returning();
      const [org2] = await db
        .insert(organisations)
        .values({ name: "Org 2", slug: "org-two" })
        .returning();

      await db
        .insert(orgMemberships)
        .values({ userId: user.id, orgId: org1.id, role: "owner" });
      await expect(
        db
          .insert(orgMemberships)
          .values({ userId: user.id, orgId: org2.id, role: "member" }),
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @opentab/db test
```

Expected: FAIL — schema modules don't exist yet

- [ ] **Step 3: Create schema files**

Create `packages/db/src/schema/users.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
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
```

Create `packages/db/src/schema/organisations.ts`:

```typescript
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
```

Create `packages/db/src/schema/org-memberships.ts`:

```typescript
import { pgTable, uuid, pgEnum, timestamp, unique } from "drizzle-orm/pg-core";
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
    userId: uuid("user_id")
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
```

Create `packages/db/src/schema/index.ts`:

```typescript
export { users, type User, type NewUser } from "./users.js";
export {
  organisations,
  type Organisation,
  type NewOrganisation,
} from "./organisations.js";
export {
  orgMemberships,
  orgRoleEnum,
  type OrgMembership,
  type NewOrgMembership,
} from "./org-memberships.js";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @opentab/db test
```

Expected: ALL PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/
git commit -m "feat: add user, organisation, org_membership schemas with tests"
```

---

## Task 4: Docker Compose + Environment

**Files:**

- Create: `docker/docker-compose.dev.yml`
- Create: `docker/docker-compose.yml`
- Create: `docker/.env.sample`

- [ ] **Step 1: Create docker/docker-compose.dev.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-opentab_dev}
      POSTGRES_USER: ${POSTGRES_USER:-opentab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-opentab_dev}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-opentab}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Create docker/docker-compose.yml (production)**

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: node apps/web/server.js
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: node apps/web/worker.js
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-opentab}
      POSTGRES_USER: ${POSTGRES_USER:-opentab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-opentab}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: Create docker/.env.sample**

```env
# =============================================================================
# OpenTab Environment Variables
# =============================================================================
# Copy this file to .env and fill in the values.

# Database (PostgreSQL 16)
POSTGRES_DB=opentab_dev
POSTGRES_USER=opentab
POSTGRES_PASSWORD=opentab_dev
DATABASE_URL=postgresql://opentab:opentab_dev@localhost:5432/opentab_dev

# Auth (Better Auth)
# Generate with: openssl rand -base64 48
BETTER_AUTH_SECRET=change-me-to-a-random-64-char-string
BETTER_AUTH_URL=http://localhost:3000

# Email — Option A: Resend (cloud)
# RESEND_API_KEY=re_xxxxxxxxxxxx
# Email — Option B: SMTP (self-hosted)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your@email.com
# SMTP_PASS=your-app-password
EMAIL_FROM=noreply@opentab.tech

# Redis
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

- [ ] **Step 4: Commit**

```bash
git add docker/
git commit -m "chore: add Docker Compose configs for dev and production"
```

---

## Task 5: Next.js App Scaffold

**Files:** All core app files (package.json, configs, layout, globals.css, utils, i18n, vitest config)

See the full file list in the File Map section above. This task creates the foundational Next.js app with design system tokens, fonts, i18n infrastructure, and the root layout.

- [ ] **Step 1: Create apps/web/package.json with all dependencies**
- [ ] **Step 2: Create apps/web/tsconfig.json**
- [ ] **Step 3: Create apps/web/next.config.ts with next-intl plugin**
- [ ] **Step 4: Create apps/web/postcss.config.ts**
- [ ] **Step 5: Create apps/web/tailwind.config.ts with full design system tokens** (all colors, fonts, border-radius from the spec)
- [ ] **Step 6: Create apps/web/app/globals.css** (Tailwind imports, glass-effect, btn-gradient, status-badge classes)
- [ ] **Step 7: Create apps/web/lib/utils.ts** (cn helper, slugify, generateUniqueSlug, detectCountryFromTaxId)
- [ ] **Step 8: Create apps/web/messages/en.json** (all i18n strings for auth, nav, dashboard, quickSetup, settings)
- [ ] **Step 9: Create apps/web/i18n/request.ts**
- [ ] **Step 10: Create apps/web/app/layout.tsx** (root layout with Manrope, Inter, Space Grotesk, JetBrains Mono fonts, Material Symbols link, NextIntlClientProvider)
- [ ] **Step 11: Create apps/web/app/page.tsx** (redirect to /login initially)
- [ ] **Step 12: Create apps/web/vitest.config.ts**
- [ ] **Step 13: Run pnpm install and commit**

Each file's content is defined in the spec. The subagent implementing this task should reference the spec's Section 6 (App Shell & Design System) for exact token values.

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js app with design system tokens, i18n, and fonts"
```

---

## Task 6: Install shadcn/ui Components

- [ ] **Step 1: Initialize shadcn** (`pnpm dlx shadcn@latest init` in apps/web)
- [ ] **Step 2: Install components:** sidebar, breadcrumb, avatar, button, card, input, label, dropdown-menu, tooltip, separator, badge, skeleton, sonner, form, dialog, select
- [ ] **Step 3: Verify all component files exist in apps/web/components/ui/**
- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ apps/web/components.json
git commit -m "feat: install shadcn/ui components for app shell"
```

---

## Task 7: Better Auth + Middleware + Session

**Files:** auth-server.ts, auth-client.ts, session.ts, use-session.ts, API route, middleware, VAT detection tests

- [ ] **Step 1: Write VAT detection tests** (apps/web/**tests**/vat-detection.test.ts) — tests for detectCountryFromTaxId, slugify, generateUniqueSlug
- [ ] **Step 2: Run tests to verify they pass** (utils already implemented in Task 5)
- [ ] **Step 3: Create apps/web/lib/auth-server.ts** — Better Auth config with Drizzle adapter, email/password, session config, databaseHooks for auto-org creation on signup
- [ ] **Step 4: Create apps/web/lib/auth-client.ts** — Better Auth React client with signIn, signUp, signOut, useSession exports
- [ ] **Step 5: Create apps/web/lib/session.ts** — getSession helper that reads auth session + loads org membership + org data, returns SessionContext type
- [ ] **Step 6: Create apps/web/hooks/use-session.ts** — Client-side hook wrapping Better Auth's useSession
- [ ] **Step 7: Create apps/web/app/api/auth/[...all]/route.ts** — Better Auth Next.js handler
- [ ] **Step 8: Create apps/web/middleware.ts** — Check session cookie on protected routes, redirect to /login if missing
- [ ] **Step 9: Update apps/web/app/page.tsx** — Check auth, redirect to /dashboard or /login
- [ ] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat: add Better Auth with auto-org creation, session helper, and middleware"
```

---

## Task 8: Auth Pages

**Files:** (auth)/layout.tsx, login/page.tsx, register/page.tsx, forgot-password/page.tsx, reset-password/page.tsx

- [ ] **Step 1: Create (auth)/layout.tsx** — Split layout: left branding panel (logo, tagline, description) + right form panel. Glassmorphic blur effects on branding side.
- [ ] **Step 2: Create login/page.tsx** — Email + password form, error handling, forgot password link, register link. Uses signIn from auth-client. Gradient CTA button.
- [ ] **Step 3: Create register/page.tsx** — Name + email + password + confirm password form. Uses signUp from auth-client. Password mismatch validation.
- [ ] **Step 4: Create forgot-password/page.tsx** — Centered card, email input, sends reset link. Shows success state (prevents email enumeration).
- [ ] **Step 5: Create reset-password/page.tsx** — Centered card, new password + confirm, reads token from URL params.
- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/
git commit -m "feat: add login, register, forgot/reset password pages"
```

---

## Task 9: App Shell (Sidebar, Top Bar, Mobile Nav)

**Files:** app-sidebar.tsx, top-bar.tsx, mobile-nav.tsx, user-menu.tsx, (app)/layout.tsx

- [ ] **Step 1: Create app-sidebar.tsx** — shadcn Sidebar component with Material Symbols icons, glassmorphic bg, 240px width, nav items (Dashboard, Invoices, Expenses, Contacts, Projects), gradient "Create New" CTA, Settings link. Highlights active route.
- [ ] **Step 2: Create user-menu.tsx** — Avatar dropdown with initials fallback, logout action, settings link.
- [ ] **Step 3: Create top-bar.tsx** — Glassmorphic top bar with breadcrumbs, notification bell, user menu. Uses SidebarTrigger for mobile.
- [ ] **Step 4: Create mobile-nav.tsx** — Fixed bottom nav for <768px, 4 items (Dash, Invoices, Ledger, Projects), Space Grotesk labels, active highlight.
- [ ] **Step 5: Create (app)/layout.tsx** — SidebarProvider wrapping AppSidebar + SidebarInset + MobileNav. Loads session, redirects to /login if no session.
- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout/ apps/web/app/\(app\)/layout.tsx
git commit -m "feat: add app shell with sidebar, top bar, mobile nav, and user menu"
```

---

## Task 10: Dashboard + Quick Setup

**Files:** quick-setup.tsx, dashboard/page.tsx

- [ ] **Step 1: Create quick-setup.tsx** — Progress widget showing 5 steps (2 enabled, 3 "coming soon"), progress bar, completion tracking from org.setupCompletedSteps. Hides when all enabled steps complete.
- [ ] **Step 2: Create dashboard/page.tsx** — Page with TopBar, 3 KPI cards (Revenue/Outstanding/Expenses at €0.00), empty chart area, empty transactions area with "New Invoice" CTA, Quick Setup widget in right column.
- [ ] **Step 3: Update lib/session.ts** — Add setupCompletedSteps to SessionContext org type.
- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/ apps/web/app/\(app\)/dashboard/ apps/web/lib/session.ts
git commit -m "feat: add dashboard with empty state, KPI cards, and Quick Setup widget"
```

---

## Task 11: Company Settings Page

**Files:** settings/layout.tsx, settings/company/page.tsx, settings/company/actions.ts

- [ ] **Step 1: Create settings/layout.tsx** — Passthrough layout.
- [ ] **Step 2: Create settings/company/actions.ts** — Server action: validates session, reads form data, detects country from tax ID, determines completed setup steps, updates organisation record, revalidates paths.
- [ ] **Step 3: Create settings/company/page.tsx** — Form with sections: Company Info (name, currency, fiscal year), Tax Info (VAT with country detection on blur, tax authority, country), Address (line1, line2, city, postal, region), Contact (phone), Branding (logo placeholder). Gradient save button with success toast.
- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/settings/
git commit -m "feat: add company settings page with VAT detection and Quick Setup integration"
```

---

## Task 12: Documentation

**Files:** docs/DESIGN.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md

- [ ] **Step 1: Create docs/DESIGN.md** — Living design system: creative north star, color tokens, typography, elevation rules, component patterns, do's and don'ts. Based on .research/DESIGN.md + our implementation decisions.
- [ ] **Step 2: Create docs/ARCHITECTURE.md** — Monorepo structure, request flow (middleware → session → component), auth architecture, database layer, one-org-per-user model, country detection, testing strategy.
- [ ] **Step 3: Create docs/CONVENTIONS.md** — File naming, component patterns, commit format, import order, TypeScript strict mode, testing patterns, shadcn customization rules.
- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: add DESIGN.md, ARCHITECTURE.md, and CONVENTIONS.md"
```

---

## Task 13: Seed Script

**Files:** packages/db/src/seed.ts

- [ ] **Step 1: Create seed.ts** — Creates demo user + org + membership for development.
- [ ] **Step 2: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat: add database seed script for development"
```

---

## Task 14: Build Verification + Test Suite

- [ ] **Step 1: Run all unit tests** (`pnpm test`) — Expected: ALL PASS
- [ ] **Step 2: Verify build compiles** (`pnpm build`) — Expected: Build succeeds
- [ ] **Step 3: Fix any issues**
- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve build and test issues"
```

---

## Task 15: Visual Verification with Playwright MCP

- [ ] **Step 1: Start dev server** (`pnpm dev` in background, wait for ready)
- [ ] **Step 2: Verify each acceptance criterion using Playwright MCP:**
  1. Navigate to localhost:3000 → verify redirect to /login
  2. Navigate to /register → fill form → submit → verify redirect to /dashboard
  3. Verify dashboard shows Quick Setup at 0%
  4. Verify 3 KPI cards show €0.00
  5. Navigate to /settings/company → fill company name → enter Greek AFM → verify detection message → save
  6. Navigate back to /dashboard → verify Quick Setup updated
  7. Click avatar → logout → verify redirect to /login
  8. Resize to 375px width → verify mobile bottom nav, sidebar hidden
  9. Take screenshots of all key screens as evidence
- [ ] **Step 3: Stop dev server**
- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 Foundation complete — all acceptance criteria verified"
```
