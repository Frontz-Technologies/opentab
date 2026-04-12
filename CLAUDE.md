# OpenTab

AI-native financial platform for freelancers & startups.

## Commands

- `docker compose -f docker/docker-compose.dev.yml up` — Start everything (DB + Redis + app with auto-migration)
- `pnpm dev` — Start Next.js dev server only (requires DB running separately)
- `pnpm build` — Build all packages
- `pnpm test` — Run all Vitest tests
- `pnpm format` — Format all files with Prettier
- `pnpm lint` — Lint all packages
- `pnpm db:generate` — Generate Drizzle migrations
- `pnpm db:push` — Push schema to database

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
