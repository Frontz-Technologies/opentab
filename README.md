# OpenTab

**AI-native financial platform for freelancers & startups.**

Invoice clients, track expenses, and understand your finances — without calling your accountant for every question.

## Features

### Contacts & Products

- Contact management (clients/suppliers) with VAT lookup (Greek ΑΑΔΕ + EU VIES)
- Product/service catalogue with tax categories
- Country provider architecture — capability-based feature gating (Greece first)

### Invoicing

- Invoice CRUD with line items and status flow (Draft → Sent → Paid → Cancelled)
- Quotes/estimates with one-click conversion to invoices
- Recurring invoices with configurable frequency
- Auto-numbering with configurable prefix, digits, and year
- PDF generation via Gotenberg
- AI-generated email content via OpenRouter

### Expenses

- Expense CRUD with line items and status flow (Draft → Confirmed → Cancelled)
- Two-layer category system: 16 universal expense groups → per-org categories with country-specific tax code mapping (`mapGroupToTaxCode`)
- Country-aware category seeding (Greece, Germany, international)
- AI receipt extraction with PDF-to-image conversion
- Supplier auto-matching from extracted VAT numbers
- Duplicate detection via SHA-256 file hash
- Recurring expenses with configurable frequency
- Email inbox webhook endpoint for receipt forwarding
- Authenticated file serving API route

### Reports & Dashboard

- KPI cards: revenue, expenses, net income, outstanding invoices
- Recharts-powered charts: revenue trend, expense breakdown, income vs expenses
- Profit & Loss statement with date-range filtering
- VAT report with input/output breakdown
- Greek tax projection with bracket visualisation and slider
- AI-powered financial insights (OpenRouter)
- Period selector with month/quarter/year presets
- Optional Redis cache layer for aggregated queries

### myDATA (Greek E-Invoicing)

- ΑΑΔΕ SendInvoices / CancelInvoice API client
- Transmission queue with retry logic and exponential backoff
- ΜΑΡΚ number storage and QR code generation
- Encrypted credentials management (AES-256-GCM)
- 15 document types with auto-resolution logic

### Foundation

- Email/password authentication with auto-organisation creation
- Dashboard with Quick Setup onboarding widget
- Company settings with VAT/tax ID country detection
- Design system: "The Digital Ledger" — dark theme, glassmorphism, emerald accents
- Responsive layout: sidebar (desktop) + bottom nav (mobile)
- i18n infrastructure (English, ready for Spanish & Greek)
- CI/CD with GitHub Actions (format, lint, test, build)
- E2E test suite with Playwright

## Tech Stack

| Layer     | Technology                                |
| --------- | ----------------------------------------- |
| Framework | Next.js 15 (App Router)                   |
| Auth      | Better Auth (email/password, self-hosted) |
| Database  | PostgreSQL 16 + Drizzle ORM               |
| UI        | shadcn/ui + Tailwind CSS v4               |
| PDF       | Gotenberg (Chromium-based)                |
| AI        | OpenRouter SDK (model-agnostic)           |
| Charts    | Recharts                                  |
| i18n      | next-intl                                 |
| Testing   | Vitest + PGlite + Playwright              |
| Monorepo  | Turborepo + pnpm workspaces               |

## Project Structure

```
opentab/
├── apps/web/              # Next.js application
│   ├── app/(app)/         # Authenticated pages (invoices, contacts, products, etc.)
│   ├── app/(auth)/        # Public auth pages (login, register)
│   ├── components/        # UI components (invoicing, layout, onboarding)
│   ├── lib/               # Business logic (country, invoicing, mydata)
│   └── messages/          # i18n translation files
├── packages/db/           # Drizzle ORM schema + migrations
├── e2e/                   # Playwright end-to-end tests
├── docker/                # Docker Compose (dev + production)
└── docs/                  # Design system, architecture, conventions
```

## Getting Started

### Building from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+
- [PostgreSQL](https://www.postgresql.org/) 16+

#### Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Frontz-Technologies/opentab.git
   cd opentab
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Create a PostgreSQL database**:

   ```bash
   createdb opentab_dev
   ```

   Or via `psql`:

   ```sql
   CREATE USER opentab WITH PASSWORD 'opentab_dev';
   CREATE DATABASE opentab_dev OWNER opentab;
   ```

4. **Configure environment**:

   ```bash
   cp docker/.env.sample apps/web/.env
   ```

   Edit `apps/web/.env` with your values:

   | Variable              | Description                       | Example                                                       |
   | --------------------- | --------------------------------- | ------------------------------------------------------------- |
   | `DATABASE_URL`        | PostgreSQL connection string      | `postgresql://opentab:opentab_dev@localhost:5432/opentab_dev` |
   | `BETTER_AUTH_SECRET`  | Random string for session signing | Generate with `openssl rand -base64 48`                       |
   | `BETTER_AUTH_URL`     | Public URL of the app             | `http://localhost:3000`                                       |
   | `NEXT_PUBLIC_APP_URL` | Same as above, exposed to client  | `http://localhost:3000`                                       |

   See `docker/.env.sample` for all available options including email (Resend / SMTP) and Redis.

5. **Push the database schema**:

   ```bash
   pnpm db:push
   ```

6. **Start the dev server**:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

### Docker

You can either pull a pre-built Docker image or build it yourself locally.

<!-- TODO: Publish Docker image to a container registry (e.g. Docker Hub or GHCR) -->

#### Using a Pre-built Image

> **Note:** A pre-built image is not yet available. For now, build from source or use the Docker Compose setup below.

#### Building the Image

Build the Docker image directly from source:

```bash
docker build -t opentab -f docker/Dockerfile .
```

The build process:

1. Installs dependencies (`pnpm install --frozen-lockfile`)
2. Builds the Next.js application (`pnpm build`)
3. Creates a minimal Alpine-based image with only the runtime artifacts

#### Running with Docker Compose (Development)

One command to start everything — PostgreSQL, Redis, schema migration, and the dev server:

```bash
docker compose -f docker/docker-compose.dev.yml up
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

The app container automatically waits for PostgreSQL, pushes the database schema, and starts the Next.js dev server. Source code is mounted as a volume so changes are reflected immediately.

To stop everything:

```bash
docker compose -f docker/docker-compose.dev.yml down
```

#### Running with Docker Compose (Production)

A production compose file is included with Caddy for automatic HTTPS:

```bash
cd docker
cp .env.sample .env
# Edit .env with production values (strong passwords, your domain, etc.)
docker compose up -d --build
```

Services:

- **app** — Next.js production server (auto-migrates DB on start)
- **postgres** — PostgreSQL 16 with persistent volume
- **redis** — Redis 7 with persistent volume
- **caddy** — Reverse proxy with automatic HTTPS (ports 80/443)

### Testing

```bash
# Run all unit tests (uses PGlite — no external database needed)
pnpm test

# Run tests for a specific package
pnpm --filter @opentab/db test
pnpm --filter @opentab/web test

# Run end-to-end tests (requires PostgreSQL + Redis running)
pnpm e2e
```

## Roadmap

| Phase | Description                                                       | Status      |
| ----- | ----------------------------------------------------------------- | ----------- |
| 1     | Foundation — Auth, dashboard, company settings, design system     | Done        |
| 2     | Contacts + Products — CRUD, VAT lookup, country abstraction       | Done        |
| 3     | Invoicing — Creation, PDF, AI emails, estimates, recurring        | Done        |
| 4     | myDATA — API client, transmission, ΜΑΡΚ/QR on PDFs                | Done        |
| 5     | Expenses — AI extraction, categories, recurring, email inbox      | Done        |
| 6     | Reports & Dashboard — KPIs, charts, P&L, VAT, tax projection      | Done        |
| 7     | AI Assistant — Chat panel, function calling, financial Q&A        | In progress |
| 8     | Polish — Multi-user/roles, API docs, MCP server, i18n, responsive | Specced     |

## Documentation

- [Design System](docs/DESIGN.md) — colours, typography, components
- [Architecture](docs/ARCHITECTURE.md) — system design, data flow
- [Conventions](docs/CONVENTIONS.md) — code style, patterns

## License

AGPLv3 — see [LICENSE](LICENSE) for details.
