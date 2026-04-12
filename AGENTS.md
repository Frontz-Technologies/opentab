# AGENTS.md

AI agent guide for the OpenTab repository.

---

## Behavioral Guidelines

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple approaches exist, present them — don't pick silently.
- If a simpler approach exists, say so.

### 2. Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

### 3. Surgical Changes
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated issues, mention them — don't fix them.

### 4. Goal-Driven Execution
- Transform tasks into verifiable goals.
- For multi-step tasks, state a brief plan with verification steps.
- Unverified work is incomplete work.

### 5. Output Precision
- Lead with findings, not process descriptions.
- Include absolute file paths — never relative.
- Always stop dev servers after testing to free ports.

---

## Overview

- **Framework**: Next.js 15 App Router (`apps/web/`)
- **Database**: PostgreSQL 16 + Drizzle ORM (`packages/db/`)
- **Auth**: Better Auth (email/password, self-hosted)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Test DB**: PGlite (in-process PostgreSQL)
- **Monorepo**: Turborepo + pnpm workspaces

## Code Layout

```
apps/web/
├── app/
│   ├── (auth)/         # Public auth pages (login, register, forgot/reset)
│   ├── (app)/          # Authenticated pages (dashboard, settings)
│   └── api/auth/       # Better Auth API handler
├── components/
│   ├── ui/             # shadcn components
│   ├── layout/         # Sidebar, top bar, mobile nav, user menu
│   └── onboarding/     # Quick Setup widget
├── lib/                # Auth config, DB instance, utilities
├── hooks/              # Client-side hooks
└── messages/           # i18n translation files

packages/db/
├── src/schema/         # Drizzle table definitions
├── src/test-utils.ts   # PGlite test helpers
└── src/seed.ts         # Development seed data
```

## Commands

| Task | Command |
|------|---------|
| Start everything | `docker compose -f docker/docker-compose.dev.yml up` |
| Dev server only | `pnpm dev` (requires DB running separately) |
| Build | `pnpm build` |
| Tests | `pnpm test` |
| Format | `pnpm format` |
| Lint | `pnpm lint` |
| DB schema push | `pnpm db:push` |
| DB migrations | `pnpm db:generate` |

---

## Documentation References

| Topic | File |
|-------|------|
| Design system (colours, typography, components) | `docs/DESIGN.md` |
| System architecture and data flow | `docs/ARCHITECTURE.md` |
| Code conventions and patterns | `docs/CONVENTIONS.md` |
| Product specification | `.research/PRODUCT_SPEC.md` |
| Data model design | `.research/BRAINSTORM_DATA_MODEL.md` |
| Tech stack decisions | `.research/BRAINSTORM_TECH_STACK.md` |
| Hosting and auth strategy | `.research/BRAINSTORM_HOSTING_AUTH.md` |

---

## Agent Playbooks

### Adding a new page

1. Create route in `apps/web/app/(app)/<page>/page.tsx` (server component)
2. If client interactivity needed, extract into a client component in the same folder
3. Add i18n strings to `apps/web/messages/en.json`
4. Add nav item to `apps/web/components/layout/app-sidebar.tsx` and `mobile-nav.tsx`
5. Use `TopBar` component with breadcrumbs
6. Follow design system — see `docs/DESIGN.md`

### Adding a database table

1. Create schema in `packages/db/src/schema/<table>.ts` using Drizzle
2. Export from `packages/db/src/schema/index.ts`
3. Add raw SQL to `packages/db/src/test-utils.ts` `pushSchema()` function
4. Write tests in `packages/db/src/__tests__/schema.test.ts`
5. Run `pnpm db:push` to push to dev database

### Adding a server action

1. Create in `apps/web/app/(app)/<page>/actions.ts` with `"use server"`
2. Always validate input with Zod schema
3. Always check session via `getSession()` from `@/lib/session`
4. Always check role authorization
5. Use shared DB instance from `@/lib/db`
6. Call `revalidatePath()` for affected routes

### Adding a shadcn component

1. Install via CLI: `pnpm dlx shadcn@latest add <component>` (from `apps/web/`)
2. Component lands in `apps/web/components/ui/`
3. Customise to match design system (dark theme, no borders, emerald accents)
4. See `docs/DESIGN.md` for token values

### Testing

1. **Unit tests**: Vitest + PGlite — `pnpm test`
2. **Visual verification**: Playwright MCP — navigate app in real browser, take screenshots
3. PGlite tests use `pool: "forks"` with `singleFork: true` (WASM compatibility)
4. Always run tests before committing

---

## Key Architecture Decisions

- **One org per user** — org context from session, no slug in URLs
- **Better Auth as library** — runs inside the app, not an external service
- **Dark-only theme** — no light mode, see `docs/DESIGN.md`
- **Server components by default** — `"use client"` only when needed
- **Shared DB instance** — single connection pool via `apps/web/lib/db.ts`
- **EU-only cloud infrastructure** — Hetzner (Germany), no US services

## Conventions

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- File naming: kebab-case (`user-menu.tsx`), PascalCase components (`UserMenu`)
- All user-facing strings through next-intl
- Zod validation on all server action inputs
- See `docs/CONVENTIONS.md` for full details

---

## Validation Checklist

Before completing any task:

- [ ] `pnpm test` passes
- [ ] TypeScript compiles: `cd apps/web && npx tsc --noEmit`
- [ ] Changes are minimal and surgical
- [ ] Dev server stopped after testing
- [ ] No hardcoded English strings (use i18n)

---

When in doubt, follow the nearest existing pattern.
