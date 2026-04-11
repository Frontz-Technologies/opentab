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

### Development

```bash
# Clone and install
git clone https://github.com/user/opentab.git
cd opentab
pnpm install

# Start PostgreSQL (option A: Docker)
docker compose -f docker/docker-compose.dev.yml up -d

# Set up environment
cp docker/.env.sample apps/web/.env

# Push schema to database
pnpm db:push

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Testing

```bash
# Run all unit tests (uses PGlite — no database needed)
pnpm test
```

## Self-Hosting

OpenTab is designed to be self-hosted from day one. The entire stack runs via Docker Compose:

```bash
cp docker/.env.sample docker/.env
# Edit docker/.env with your settings
docker compose -f docker/docker-compose.yml up -d
```

See `docker/.env.sample` for all configuration options.

## Documentation

- [Design System](docs/DESIGN.md) — colours, typography, components
- [Architecture](docs/ARCHITECTURE.md) — system design, data flow
- [Conventions](docs/CONVENTIONS.md) — code style, patterns

## License

MIT
