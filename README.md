# OpenTab

**AI-native financial platform for freelancers & startups.**

Invoice clients, track expenses, and understand your finances — without calling your accountant for every question.

## Features (Phase 1 — Foundation)

- Email/password authentication with auto-organisation creation
- Dashboard with Quick Setup onboarding widget
- Company settings with VAT/tax ID country detection
- Full design system: "The Digital Ledger" — dark theme, glassmorphism, emerald accents
- Responsive layout: sidebar (desktop) + bottom nav (mobile)
- i18n infrastructure (English, ready for Spanish & Greek)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Better Auth (email/password, self-hosted) |
| Database | PostgreSQL 16 + Drizzle ORM |
| UI | shadcn/ui + Tailwind CSS v4 |
| Fonts | Manrope, Inter, Space Grotesk, JetBrains Mono |
| i18n | next-intl |
| Testing | Vitest + PGlite (in-process PostgreSQL) |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
opentab/
├── apps/web/          # Next.js application
├── packages/db/       # Drizzle ORM schema + migrations
├── docker/            # Docker Compose (dev + production)
└── docs/              # Design system, architecture, conventions
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16 (or use Docker)

### Environment Setup

```bash
# Clone the repository
git clone https://github.com/Frontz-Technologies/opentab.git
cd opentab
pnpm install

# Copy the sample env file and edit with your values
cp docker/.env.sample apps/web/.env
```

Edit `apps/web/.env` with the following required variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://opentab:opentab_dev@localhost:5432/opentab_dev` |
| `BETTER_AUTH_SECRET` | Random 64-char string for session signing | Generate with `openssl rand -base64 48` |
| `BETTER_AUTH_URL` | Public URL of the app | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Same as above, exposed to client | `http://localhost:3000` |

See `docker/.env.sample` for all available configuration options including email (Resend / SMTP) and Redis.

### Development with Docker Compose

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

#### Without Docker (app only)

If you prefer running the app natively and only use Docker for the database:

```bash
docker compose -f docker/docker-compose.dev.yml up -d postgres redis
pnpm dev
```

### Production with Docker Compose

The production compose file includes the app, worker, PostgreSQL, Redis, and a Caddy reverse proxy with automatic HTTPS:

```bash
cd docker

# Copy and configure environment
cp .env.sample .env
# Edit .env — POSTGRES_PASSWORD is required, set BETTER_AUTH_SECRET to a random value

# Build and start all services
docker compose up -d --build
```

Services started:
- **app** — Next.js production server on port 3000
- **worker** — Background job processor
- **postgres** — PostgreSQL 16 with persistent volume
- **redis** — Redis 7 with persistent volume
- **caddy** — Reverse proxy with automatic TLS (ports 80/443)

### Testing

```bash
# Run all unit tests (uses PGlite — no external database needed)
pnpm test

# Run tests for a specific package
pnpm --filter @opentab/db test
pnpm --filter @opentab/web test
```

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation — Auth, dashboard, company settings, design system | In progress |
| 2 | Invoicing — Create, send, and track invoices | Planned |
| 3 | Expenses — Receipt capture and categorisation | Planned |
| 4 | Contacts — Client and supplier management | Planned |
| 5 | Projects — Time tracking and project-based billing | Planned |
| 6 | Reporting — Revenue, expenses, tax summaries | Planned |
| 7 | Integrations — myDATA (AADE), bank feeds, Stripe | Planned |
| 8 | AI Assistant — Natural language queries on financial data | Planned |

## Documentation

- [Design System](docs/DESIGN.md) — colours, typography, components
- [Architecture](docs/ARCHITECTURE.md) — system design, data flow
- [Conventions](docs/CONVENTIONS.md) — code style, patterns

## License

AGPLv3 — see [LICENSE](LICENSE) for details.
