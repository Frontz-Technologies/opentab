# OpenTab Architecture

> Living document — update when structural decisions change.

---

## Monorepo Structure

OpenTab is a Turborepo monorepo managed with pnpm workspaces.

```
opentab/
├── apps/
│   └── web/                  # Next.js 15 App Router application
│       ├── app/              # Routes, layouts, pages
│       ├── components/       # Shared UI components
│       ├── hooks/            # Custom React hooks
│       ├── i18n/             # next-intl configuration
│       ├── lib/              # Auth, utilities, server actions
│       └── messages/         # i18n translation files
├── packages/
│   └── db/                   # Drizzle ORM schema + client
│       └── src/
│           ├── schema/       # Table definitions
│           ├── client.ts     # Drizzle client factory
│           ├── index.ts      # Public exports
│           └── test-utils.ts # PGlite test helpers
├── docker/                   # Docker Compose for self-hosting
├── docs/                     # Architecture, design, conventions
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # Workspace package paths
└── package.json              # Root scripts + devDependencies
```

**Key principle:** `packages/db` is the single source of truth for the database schema. `apps/web` imports it via `@opentab/db` and never defines its own schema or raw SQL.

---

## Tech Stack

| Layer                | Technology          | Version      |
| -------------------- | ------------------- | ------------ |
| Framework            | Next.js App Router  | 15.x         |
| Runtime              | Node.js             | >=22         |
| Language             | TypeScript          | 5.8 (strict) |
| Auth                 | Better Auth         | 1.x          |
| ORM                  | Drizzle ORM         | latest       |
| Database (prod)      | PostgreSQL          | 16           |
| Database (test)      | PGlite              | in-process   |
| Styling              | Tailwind CSS        | v4           |
| Components           | shadcn/ui + Base UI | latest       |
| State                | Zustand             | 5.x          |
| Data fetching        | TanStack Query      | 5.x          |
| Internationalisation | next-intl           | 4.x          |
| Build orchestration  | Turborepo           | 2.x          |
| Package manager      | pnpm                | 10.x         |
| Test runner          | Vitest              | 3.x          |

---

## Request Flow

```
Browser
  └─▶ Next.js Middleware (auth check)
        ├─ Unauthenticated → redirect to /sign-in
        └─ Authenticated
              └─▶ Server Component
                    └─▶ getSession()
                          └─▶ Returns: user + organisation + role
                                └─▶ Renders page with org context
```

1. Every request passes through Next.js middleware first.
2. Middleware calls `auth.api.getSession()` from the request cookies.
3. Protected routes redirect unauthenticated users to `/sign-in`.
4. Authenticated server components receive the session and use it to scope all DB queries to the user's organisation.
5. No organisation slug appears in the URL — org context is derived entirely from the session.

---

## Auth Architecture

Better Auth is used **as a library**, not a hosted service. The auth logic runs inside the Next.js app process.

**Key characteristics:**

- Session stored in an `httpOnly` cookie (no localStorage, no JWTs in JS-accessible storage)
- Email/password as the primary credential method
- On first sign-up, Better Auth automatically creates an organisation for the user
- The organisation is linked via `org_memberships` — the user is always an `owner` of their auto-created org
- Session expiry and rotation are handled by Better Auth internally

**Auth files:**

- `apps/web/lib/auth.ts` — server-side Better Auth configuration
- `apps/web/lib/auth-client.ts` — client-side Better Auth hooks/methods

**Getting the session in a server component:**

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/sign-in");
const { user, session: sessionData } = session;
```

---

## Database Layer

### Schema (packages/db)

| Table                      | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `users`                    | Authentication identity, profile data                    |
| `organisations`            | One per user — the financial entity                      |
| `org_memberships`          | Links users to orgs with a role (owner/member)           |
| `contacts`                 | Clients and suppliers with VAT, address, defaults        |
| `products`                 | Product/service catalogue with tax categories            |
| `invoices`                 | Sales invoices with status flow and denormalized contact |
| `invoice_items`            | Line items per invoice (separate table, not JSON)        |
| `quotes`                   | Estimates with conversion to invoice                     |
| `quote_items`              | Line items per quote                                     |
| `recurring_invoices`       | Recurring invoice templates with frequency               |
| `recurring_invoice_items`  | Line items per recurring template                        |
| `invoice_number_sequences` | Auto-numbering configuration per org                     |
| `expense_groups`           | 16 universal expense groups (string PK)                  |
| `expense_categories`       | Per-org categories linked to groups                      |
| `expenses`                 | Expense records with status flow and category            |
| `expense_items`            | Line items per expense                                   |
| `expense_attachments`      | File attachments with AI extraction status               |
| `recurring_expenses`       | Recurring expense templates with frequency               |
| `recurring_expense_items`  | Line items per recurring expense template                |
| `mydata_credentials`       | Encrypted ΑΑΔΕ API credentials per org                   |
| `mydata_transmissions`     | myDATA submission queue with retry tracking              |
| `ai_settings`              | Encrypted AI API keys and model preferences per org      |

Better Auth manages its own session/account/verification tables alongside these. Drizzle schema types are exported and used throughout `apps/web` for type-safe queries.

### One-Org-Per-User Model

```
user (users table)
  └─▶ org_membership (org_memberships table)
        └─▶ organisation (organisations table)
```

- `org_memberships.user_id` has a unique constraint — one user, one org
- No multi-tenancy in the traditional sense; each user _is_ their own financial entity
- Org context is loaded from the session and passed down through server components; it never comes from a URL segment

### Country Detection

Organisation country is inferred from VAT/tax ID format at creation time:

- 9 digits → Greek AFM (Greece)
- 2-letter EU prefix (e.g. `DE`, `FR`, `IT`) → corresponding EU country
- This drives VAT rate lookups and invoice compliance rules

### Drizzle Client

`packages/db/src/client.ts` exports a factory that accepts a connection string and returns a typed Drizzle client. This keeps the database connection logic in one place and makes it testable.

### PGlite for Testing

Tests use `@electric-sql/pglite` — an in-process WebAssembly PostgreSQL build. This means:

- No external database needed for tests
- Tests run in CI without Docker
- Schema is applied fresh per test suite via Drizzle migrations
- `packages/db/src/test-utils.ts` exports helpers for setting up and tearing down PGlite instances

---

## Testing Strategy

| Type        | Tool            | What it tests                           |
| ----------- | --------------- | --------------------------------------- |
| Unit        | Vitest          | Pure functions, utilities, schema types |
| Integration | Vitest + PGlite | DB queries, auth flows, server actions  |
| Visual      | Playwright MCP  | UI rendering, user journeys             |

**Philosophy:** TDD. Tests are written before implementation code. The test suite is the living specification of behaviour.

Run tests:

```bash
pnpm test            # all packages via Turborepo
pnpm test --filter=web  # web app only
```

---

## OSS vs Cloud

The codebase is identical between the open-source self-hosted version and any hosted cloud offering. Environment variables switch the external service providers:

| Concern      | OSS / Self-hosted         | Cloud              |
| ------------ | ------------------------- | ------------------ |
| Email        | SMTP (any provider)       | Resend             |
| File storage | MinIO                     | Cloudflare R2      |
| Database     | PostgreSQL (self-managed) | Managed PostgreSQL |

No feature flags, no separate branches. The same `apps/web` build runs both variants.

---

## Docker Compose

`docker/` contains the Docker Compose configuration. This is the **source of truth for production and self-hosting** topology:

- **PostgreSQL 16** — primary database with persistent volume
- **Redis 7** — optional cache layer for report aggregations
- **Caddy** — reverse proxy with automatic HTTPS (production only)
- **Next.js app** — built from the monorepo, auto-migrates DB on start

Two compose files are provided:

- `docker-compose.dev.yml` — development mode with source mounting and hot reload
- `docker-compose.yml` — production mode with Caddy, built image, and persistent volumes

Environment variables are passed through Turbo to the Next.js dev process. Server-side variables (e.g. `DATABASE_URL`, `BETTER_AUTH_SECRET`) are configured in `turbo.json`'s `globalPassThroughEnv` to ensure they reach the app at runtime.

Local development can also use `pnpm dev` directly against a local PostgreSQL instance without Docker.

---

## Key Design Decisions

**Why Better Auth over NextAuth?**
Better Auth runs as a library with full TypeScript types, no adapter abstraction, and direct Drizzle integration. It gives us type-safe session access without the indirection of NextAuth's callback-heavy API.

**Why one org per user?**
Freelancers and small startups are the primary users. They don't switch between organisations. Removing multi-tenancy from the URL and UX eliminates an entire class of routing complexity, permission bugs, and onboarding friction.

**Why Turborepo?**
`packages/db` is shared between the web app and future packages (e.g. a CLI, a mobile app). Turborepo caches builds and test runs across packages, and its pipeline config enforces that `db` is built before `web`.

**Why Tailwind CSS v4?**
v4's CSS-native approach (no `tailwind.config.js` for theming, CSS variables as the primary token system) aligns with the design system's need for dynamic surface tokens. The `@theme` directive replaces the old JS config for most token definitions.

---

## Country Provider

`apps/web/lib/country/` implements a capability-based country abstraction. Each country (Greece, Germany, international) registers a provider that declares its capabilities (VAT lookup, myDATA, category seeds, etc.).

### Two-Layer Expense Category System

Expense categories use a universal-then-local architecture:

1. **Expense groups** (`expense_groups` table) — 16 universal groups with string PKs (e.g. `office_supplies`, `travel`, `professional_services`). These are seeded once and shared across all organisations.
2. **Expense categories** (`expense_categories` table) — per-organisation categories linked to a group. Country-specific seed data creates localised category names and descriptions.

Each country provider implements `mapGroupToTaxCode(groupId)` to map universal groups to country-specific tax deduction codes (e.g. Greek E3 codes). This allows the reporting and myDATA layers to derive tax treatment from the category without country-specific branching.

---

## Reports & Data Aggregation

`apps/web/lib/reports/` contains the query and aggregation layer for financial reports.

### Query Layer

- `queries.ts` — core aggregation queries (revenue, expenses, net income, outstanding) scoped by org and date range
- `periods.ts` — period utilities (month/quarter/year boundaries, comparison periods)
- `types.ts` — shared TypeScript types for report data
- `tax/` — Greek tax bracket calculations and projection logic
- `insights/` — AI-powered financial insight generation via OpenRouter
- `export/` — report export utilities
- `cache.ts` — optional Redis cache layer for expensive aggregations

### Cache Strategy

Report queries can be expensive for organisations with large transaction volumes. An optional Redis cache (`lib/reports/cache.ts`) stores aggregated results keyed by `org:period:report-type`. Cache is invalidated when invoices or expenses are created/updated. When Redis is not configured, queries run directly against PostgreSQL.

### UI Components

`apps/web/components/reports/` contains the presentation layer:

- `kpi-card.tsx` — reusable KPI display card
- `insight-cards-row.tsx` — AI insight summary cards
- `period-selector.tsx` — month/quarter/year period picker
- `charts/` — Recharts-based chart components (revenue trend, expense breakdown, income comparison)
- `tax-bracket-table.tsx` — Greek tax bracket visualisation
- `tax-projection-slider.tsx` — interactive income slider for tax projection

### Report Pages

- `/reports` — overview with KPIs and charts
- `/reports/pnl` — Profit & Loss statement
- `/reports/vat` — VAT input/output report
- `/reports/tax-projection` — Greek tax projection with bracket breakdown

---

## AI Integration

The AI layer uses OpenRouter (model-agnostic) via the Vercel AI SDK. Each organisation configures their own API key and preferred model through encrypted settings (AES-256-GCM).

### Capabilities

| Feature            | Location                        | Description                                                      |
| ------------------ | ------------------------------- | ---------------------------------------------------------------- |
| Email generation   | `lib/invoicing/`                | AI-drafted invoice and quote emails                              |
| Receipt extraction | `lib/expenses/ai-extraction.ts` | OCR and structured data extraction from uploaded receipts        |
| Financial insights | `lib/reports/insights/`         | AI-generated summaries of financial trends                       |
| Chat assistant     | `lib/ai/`, `components/ai/`     | Conversational interface with function calling for financial Q&A |

### Chat Assistant Architecture

The AI assistant (`app/api/ai/chat/route.ts`) uses the Vercel AI SDK's `streamText` with function calling:

- **System prompt** (`lib/ai/system-prompt.ts`) — provides org context, user role, and available capabilities
- **Tools** (`lib/ai/tools.ts`) — read-only functions that query real financial data (revenue, expenses, invoices, contacts)
- **Rate limiting** (`lib/ai/rate-limiter.ts`) — per-org rate limits to control API usage
- **Confirmation flow** (`lib/ai/types.ts`) — write operations require explicit user approval before execution
- **Custom client** (`lib/ai/chat-client.ts`) — vanilla stream consumer (no `useChat` hook) for full control over message rendering

Tools are role-scoped: accountants see different capabilities than owners. All tool results render inline with the conversation via `DynamicToolUIPart` components.

### Security

- API keys are encrypted at rest (AES-256-GCM) and never exposed to the client
- The chat route validates the session and org membership before every request
- Tools are read-only by default; write operations go through a confirmation step
- Rate limiting prevents runaway API costs
