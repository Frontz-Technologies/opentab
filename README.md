# OpenTab

**The open-source financial platform for freelancers and startups.**

Invoice clients, track expenses, file taxes, and understand your finances — without calling your accountant for every question.

Self-hosted, privacy-first, and built for the EU.

## Key Features

### Invoicing & Quotes

Create professional invoices in seconds. Convert quotes to invoices with one click, set up recurring billing for retainer clients, and let AI draft the email for you. Auto-numbering, PDF generation, and full status tracking from draft to paid.

### Smart Expense Tracking

Snap a photo of a receipt and AI extracts the supplier, amounts, and tax details automatically. Expenses are matched to suppliers via VAT number, duplicates are caught by file hash, and recurring costs are tracked on autopilot. Forward receipts by email and they appear in your dashboard.

### Financial Reports & Insights

See how your business is doing at a glance — revenue trends, expense breakdowns, profit & loss, and VAT summaries. A Greek tax projection tool shows exactly what you'll owe with an interactive bracket slider. AI-generated insights surface trends you might miss.

### Greek E-Invoicing (myDATA)

Submit invoices directly to ΑΑΔΕ with automatic document type resolution, retry logic, and MARK number tracking. QR codes are embedded in your PDFs. Credentials are encrypted with AES-256-GCM.

### AI Assistant

Ask questions about your finances in plain language. The chat panel uses function calling to query your real data — revenue summaries, outstanding invoices, expense breakdowns — and responds with accurate, contextual answers.

### Contacts & Products

Manage your clients and suppliers with automatic VAT validation (Greek ΑΑΔΕ + EU VIES). Maintain a product catalogue with tax categories, default prices, and units. Country-aware features activate based on your tax ID.

### Built for You

- Dark + light themes with a full design system (glass effects, emerald accents)
- Shipped in English, Greek, and Spanish
- Responsive layout — sidebar on desktop, bottom nav on mobile
- One-command Docker setup for self-hosting
- CI/CD pipeline with automated formatting, linting, testing, and builds

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

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+
- [PostgreSQL](https://www.postgresql.org/) 16+

### Building from Source

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
   | `NEXT_PUBLIC_APP_URL` | Public URL of the app             | `http://localhost:3000`                                       |

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

### Try the demo

If you'd rather explore the app before adding your own data, turn on demo mode:

```bash
export DEMO_SAMPLE_DATA_ENABLED=true
export NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED=true
pnpm dev
```

The login page will show a **"Try the demo"** card. One click provisions a demo user (`demo@opentab.dev`) with a realistic fictional business — contacts, products, ~48 invoices across 8 months, ~50 expenses — and signs you in. A persistent banner labels the org as sample data; Settings → Account exposes a **Reset demo** button to wipe + re-populate.

Leave these flags unset for any real-customer production deployment.

### Docker

#### Development

One command to start everything — PostgreSQL, Redis, schema migration, and the dev server:

```bash
docker compose -f docker/docker-compose.dev.yml up
```

Source code is mounted as a volume so changes are reflected immediately. Open [http://localhost:3000](http://localhost:3000).

#### Production

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

| Phase | Description                                                | Status |
| ----- | ---------------------------------------------------------- | ------ |
| 1     | Foundation — Auth, dashboard, settings, design system      | Done   |
| 2     | Contacts & Products — CRUD, VAT lookup, country support    | Done   |
| 3     | Invoicing — Creation, PDF, AI emails, quotes, recurring    | Done   |
| 4     | myDATA — Greek e-invoicing, transmission, MARK/QR          | Done   |
| 5     | Expenses — AI extraction, categories, recurring, email     | Done   |
| 6     | Reports — KPIs, charts, P&L, VAT, tax projection           | Done   |
| 7     | AI Assistant — Chat panel, function calling, financial Q&A | Done   |
| 8     | Country plugin API — pluggable per-country tax & filings   | Done   |

## Documentation

- [Design System](docs/DESIGN.md) — colours, typography, components
- [Architecture](docs/ARCHITECTURE.md) — system design, data flow, key decisions
- [Conventions](docs/CONVENTIONS.md) — code style, testing, git workflow

## License

AGPLv3 — see [LICENSE](LICENSE) for details.
