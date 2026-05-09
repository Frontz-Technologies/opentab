# OpenTab Code Conventions

> Living document — update when the team adopts new patterns.

---

## File Naming

| What                | Convention                | Example                                 |
| ------------------- | ------------------------- | --------------------------------------- |
| Component files     | kebab-case                | `user-menu.tsx`, `invoice-card.tsx`     |
| Page files          | Next.js convention        | `page.tsx`, `layout.tsx`, `loading.tsx` |
| Hook files          | kebab-case, `use-` prefix | `use-session.ts`, `use-invoices.ts`     |
| Utility files       | kebab-case                | `format-currency.ts`, `cn.ts`           |
| Server action files | kebab-case                | `create-invoice.ts`                     |
| Test files          | same name + `.test`       | `invoice-card.test.tsx`                 |

## Component Naming

| What                 | Convention              | Example                   |
| -------------------- | ----------------------- | ------------------------- |
| React components     | PascalCase              | `UserMenu`, `InvoiceCard` |
| Component props type | `ComponentNameProps`    | `InvoiceCardProps`        |
| Context providers    | `ComponentNameProvider` | `OrganisationProvider`    |

---

## Component Patterns

### Server Components by Default

All components are Server Components unless they need interactivity. Do not add `"use client"` speculatively.

**When to add `"use client"`:**

- Uses React state (`useState`, `useReducer`)
- Uses effects (`useEffect`, `useLayoutEffect`)
- Handles browser events (`onClick`, `onChange`, `onSubmit`)
- Uses browser-only APIs (`window`, `document`, `localStorage`)
- Uses client-only hooks (TanStack Query, Zustand, `usePathname`, etc.)

**Pattern: push `"use client"` to the leaves.** Keep the data-fetching logic in a Server Component parent, pass data as props to a small `"use client"` interactive leaf.

```tsx
// app/invoices/page.tsx — Server Component (no directive)
import { InvoiceList } from "@/components/invoice-list";
import { getInvoices } from "@/lib/invoices";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  return <InvoiceList invoices={invoices} />;
}

// components/invoice-list.tsx — Client Component (needs onClick)
"use client";
export function InvoiceList({ invoices }: InvoiceListProps) { ... }
```

### Server Actions

Server actions live in `lib/actions/` and are imported directly into Server Components or passed as props to Client Components. Name them with a verb: `createInvoice`, `deleteClient`, `updateOrganisation`.

```typescript
// lib/actions/create-invoice.ts
"use server";
export async function createInvoice(data: CreateInvoiceInput) { ... }
```

---

## Cross-org safety

Every Drizzle query against an org-owned entity table MUST include
`eq(<table>.orgId, session.org.id)` (or a verified `orgId` parameter
from a session-checked caller). Helpers that take `orgId` MUST verify
the caller is operating on the same session's org. Inserts MUST set
`orgId` from a verified source. UPDATE / DELETE statements MUST scope
their WHERE clause by `orgId` even when a preceding SELECT was scoped
(defence-in-depth — closes the TOCTOU window).

**Org-owned tables** (non-exhaustive): `expenses`, `expense_attachment`,
`expense_category`, `invoices`, `invoice_item`, `quotes`, `quote_item`,
`credit_notes`, `credit_note_item`, `contacts`, `products`,
`recurring_invoice`, `recurring_invoice_item`, `recurring_expense`,
`recurring_expense_item`, `country_integration_credential`,
`country_integration_submission`, `ai_settings`. Per-user tables like
`user_preferences` filter by `userId`; the user belonging to the right
org is implied by `getSession()`.

**Org-agnostic tables** (safe without `orgId`): `fx_rate_cache`,
`organisation` (queries scope by `id`), `auth.*` (Better Auth managed),
`expense_group` (global system table keyed by `code`), `org_members`
(uses `orgId` as a key by design).

**Foreign-key same-org validation:** Cross-table FKs (`*.contactId`,
`*.categoryId`, `*.invoiceId`, `*.productId`) MUST be validated as
same-org on insert / update. The audit at #274 fixed read-path leaks
caused by this gap; the write-side validation tracks separately.

**Enforcement:** the `no-unscoped-org-query` ESLint rule (added in #274)
fails any new `db.select()` against an org-owned table that doesn't
include `eq(<table>.orgId, …)` in the same call. See issue #274 for
the audit history.

---

## Module Structure

The codebase follows the **deep module** pattern (Ousterhout, popularised by Pocock for AI-agent codebases). A module is a black box; outside code imports only from its `index.ts`.

### The rule

> A module under `apps/web/lib/<name>/` is a black box. Code outside the module imports it ONLY by `import { ... } from "@/lib/<name>"` — never by reaching into `@/lib/<name>/sub/file`.

This is enforced by `eslint-plugin-boundaries` for modules on the strict-list (errors) and the rest of `apps/web/lib/*` (warnings, until each is migrated). The strict-list lives in `apps/web/eslint.config.mjs`; per-module migration PRs flip the module from warn to strict in the same diff.

**Warning ceiling.** `pnpm lint` runs with `--max-warnings <N>` where `N` is the current count. CI fails if a PR adds new boundary warnings without removing existing ones. After each migration PR drops warnings, lower `N` in `apps/web/package.json` to match the new count — the new ceiling locks in the gain.

### Canonical layout

A domain module looks like:

```
apps/web/lib/<module>/
  index.ts               # public surface — re-exports only
  types.ts               # public types + tagged-error union
  orchestrator.ts        # the entry function (e.g. lookupCompany, getFxRate)
  registry.ts            # source / provider list + sync metadata helpers
  <internal>.ts          # implementation details (helpers, internal utilities)
  sources/ or providers/ # adapter pattern when multiple integrations exist
  cache/                 # internal sub-module if there is caching logic
  jobs/                  # business logic for scheduled/queued work (BullMQ adapter lives in lib/jobs/)
apps/web/__tests__/<module>-*.test.ts
```

### Public-surface rule

`index.ts` re-exports a **small, deliberate named set** — every entry should answer "what does an outside consumer need?" If a module legitimately has multiple concerns (e.g. an orchestrator + a sync helper + a job entry point), expose one named export per concern, but resist adding everything just because it exists internally. Group by concern in the file (separate `export` blocks with a blank line between groups), and add TSDoc on every public name. Examples:

```ts
// apps/web/lib/business-lookup/index.ts (target shape)
export { lookupCompany } from "./orchestrator";
export type { CompanyLookupResult, LookupError, LookupOutcome } from "./types";
export { isCountrySupportedByAnySource } from "./registry";
```

For modules with broader concerns (orchestrator + jobs + settings-UI helpers), still group by concern:

```ts
// apps/web/lib/fx/index.ts (target shape)
// Core lookup
export { getFxRate, getFxRateWithFallback } from "./orchestrator";
export type { FxRate, FxResult, FxError } from "./types";

// Sync metadata for renders that can't await
export { supportedCurrencies, isCurrencySupported } from "./registry";

// Settings-UI helpers
export { getActiveFxProvider } from "./registry";
export type { FxProvider } from "./provider";

// Job entry points (called from lib/jobs/processors/)
export { runPrewarmRates } from "./jobs/prewarm-rates";
export type { PrewarmResult } from "./jobs/prewarm-rates";
export { runPruneCache } from "./jobs/prune-cache";
export type { PruneResult } from "./jobs/prune-cache";
```

**Never `export *` from `index.ts`.** That defeats the whole pattern.

### Tagged errors over thrown exceptions

Source adapters never throw post-boundary. They return a discriminated outcome:

```ts
export type LookupOutcome<T> =
  | { kind: "Hit"; value: T }
  | { kind: "NotFound" }
  | { kind: "NetworkTimeout" }
  | { kind: "BadResponse"; detail: string }
  | { kind: "ProviderUnavailable"; detail: string };
```

The orchestrator switches on `outcome.kind` exhaustively. Consumers of the public surface get back either a typed-error variant they can handle OR a Promise-throwing convenience wrapper — see `getFxRate` (outcome) vs `getFxRateWithFallback` (throws on error) in `lib/fx/`.

### Wire-boundary decoding

Every external HTTP/JSON response goes through Zod `safeParse` exactly once, at the source adapter. **No `as Type` casts on wire data.** Decode failures map to `BadResponse` with a path-based detail string.

### Done checklist for a module migration

A module is ready to be flipped from warn to strict when:

- [ ] `pnpm check` passes (lint + typecheck + tests)
- [ ] Outside code imports only `@/lib/<module>` (run `grep -rn "@/lib/<module>/" apps/web/app apps/web/components apps/web/lib --include="*.ts" --include="*.tsx" | grep -v "@/lib/<module>\""` — should be empty for production code; tests are exempt)
- [ ] `index.ts` exports have TSDoc on every public name
- [ ] At least one happy-path + one error-path test exists
- [ ] Bundle-size and `tsc --noEmit` median (5 runs) before/after are recorded in the PR description

### Recipe for adding a new module

Copy `apps/web/lib/business-lookup/` (the canonical reference, post-migration). Rename. Fill in. Add the new module name to `STRICT_LIB_MODULES` in `apps/web/eslint.config.mjs` so it ships strict from day one. No scaffolding tool — the reference module is the scaffold.

### Breaking the rule

Tests under `apps/web/__tests__/` are exempt — they may import internals to stub source adapters. Production code is not. If a consumer legitimately needs deeper access (rare), promote what they need to the module's `index.ts` instead of widening the boundary rule.

---

## Import Order

Within any file, imports are ordered:

1. React and Next.js (`react`, `next/*`)
2. External packages (alphabetical)
3. Internal packages (`@opentab/*`)
4. Internal app aliases (`@/*`)
5. Relative imports (`./`, `../`)

Each group is separated by a blank line. Prettier does not enforce this — it is a manual convention.

```typescript
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { db } from "@opentab/db";

import { auth } from "@/lib/auth";
import { InvoiceCard } from "@/components/invoice-card";

import { formatCurrency } from "./format-currency";
```

---

## TypeScript

**Strict mode is always on.** `tsconfig.json` in every package sets `"strict": true`. Never disable strict mode or add `@ts-ignore` without a comment explaining why.

**Explicit return types on exported functions:**

```typescript
// Good
export async function getInvoices(): Promise<Invoice[]> { ... }
export function formatCurrency(amount: number, currency: string): string { ... }

// Bad — return type inferred, ok for internal/private functions
export async function getInvoices() { ... }
```

Unexported/private functions may rely on inference when the return type is obvious.

**Infer types from Drizzle schemas.** Do not manually re-declare types that Drizzle can infer:

```typescript
// packages/db/src/schema/users.ts
export const users = pgTable("users", { ... });
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// In app code — import the inferred type, don't redeclare
import type { User } from "@opentab/db";
```

**Avoid `any`.** Use `unknown` when the type is genuinely unknown, then narrow it. Use type guards or Zod for runtime validation at API/form boundaries.

---

## Commit Messages

OpenTab uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>: <short description> (#<issue>)

[optional body]
```

| Type        | When to use                                     |
| ----------- | ----------------------------------------------- |
| `feat:`     | New user-facing feature                         |
| `fix:`      | Bug fix                                         |
| `refactor:` | Code change that is neither a fix nor a feature |
| `test:`     | Adding or updating tests                        |
| `docs:`     | Documentation changes                           |
| `chore:`    | Tooling, config, dependency updates             |
| `style:`    | Formatting only, no logic change                |

**Examples:**

```
feat: add invoice creation form (#14)
fix: correct VAT calculation for EU companies (#18)
refactor: extract currency formatter to shared util
test: add PGlite integration tests for org membership
docs: update ARCHITECTURE.md with auth flow diagram
chore: upgrade Drizzle ORM to 0.41
```

Breaking changes: append `!` after the type and explain in the body:

```
feat!: change org membership to support multiple roles

BREAKING CHANGE: org_memberships.role is now an enum.
The compose db-sync service runs `pnpm db:push` automatically on
deploy — no manual migration step.
```

---

## Comment hygiene

Comments and test labels describe present-tense **behaviour**, not the historical PR or issue that introduced the code. The git history is the right home for "this is here because PR #N showed the race"; the code itself should explain what's load-bearing today.

**Rules:**

- No `(#NNN)`, `PR #NNN`, `tester PR #NNN`, `carry-over from #N`, or `post-#N` framing in comments or test names.
- Keep comments that capture non-obvious **why** — Postgres semantics, race-window guards, Drizzle index requirements, AI-extraction edge cases. Strip the issue references inside them.
- Delete comments whose only content was a GitHub-internal reference. The git blame keeps the trail.

**Verification snippet:**

```sh
# Should return only string-content references (CSS hex, HTML entities) — never inline comments or test labels.
git grep -nE '#[0-9]{2,4}' apps packages e2e -- '*.ts' '*.tsx'
```

---

## Testing

### TDD — Tests First

Write the test before the implementation. This is not optional. The test file is the specification; the implementation makes it pass.

```bash
# 1. Create the test file
# 2. Run — it fails
pnpm test --filter=web

# 3. Write the minimum implementation to make it pass
# 4. Run again — it passes
# 5. Refactor if needed, keep tests green
```

### PGlite for Database Tests

Never mock the database. Use PGlite for integration tests that touch the DB layer. It runs in-process with no external dependencies.

```typescript
import { createTestDb } from "@opentab/db/test-utils";

describe("getInvoices", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("returns invoices for the correct organisation", async () => {
    // arrange — seed data
    // act — call the function
    // assert — verify result
  });
});
```

### Playwright MCP for Visual Verification

Use Playwright MCP for visual verification of UI flows after implementation is complete. This is not a substitute for Vitest tests — it is a final verification layer.

### Happy-Path e2e Per Feature PR

Every user-visible feature ships with a Playwright spec that drives its primary flow in a real browser (`e2e/*.spec.ts`). Don't defer this to a follow-up or to the tester agent — "tester will add it" in a PR description almost always means it never lands, and features then ship untested end-to-end.

### Verify Through the Prod Entry Chain

Before opening a PR, run the feature through `docker compose -f docker/docker-compose.dev.yml up` or `pnpm dev` at the repo root — both route through turbo. The shortcut `pnpm --filter @opentab/web dev` bypasses turbo entirely. Turbo 2.x runs in strict env mode and only passes vars listed in `turbo.json`'s `globalPassThroughEnv` (plus the `NEXT_PUBLIC_*` variants Next.js framework inference auto-passes); a new server env var that isn't allowlisted will work under the shortcut and silently fail in docker/turbo.

### No Silent Empty-State Early Returns

In seeding, populate, or init code, never silently `return;` when a required dependency's data comes back empty. Throw with a message naming what's missing (e.g. `throw new Error("expense categories not seeded for org — call ensureCategoriesSeeded first")`). Silent skips turn dependency-ordering bugs into invisible data gaps that reach users. If empty is legitimately valid, leave a one-line comment saying so.

### What to Test

- **Always:** database queries, server actions, utility functions, auth flows
- **Always:** form validation logic, currency/VAT calculations
- **When complex:** component rendering with meaningful state variations
- **Skip:** simple presentational components with no logic

---

## Styling

### Tailwind Utility Classes

Use Tailwind classes directly on JSX elements. Do not write custom CSS unless you are adding a global utility class (like `.btn-gradient` or `.status-badge` in `globals.css`).

```tsx
// Good
<div className="bg-surface-container rounded-xl p-6 space-y-4">

// Bad
<div style={{ backgroundColor: "#201F1F", borderRadius: "0.75rem" }}>
```

### Design Tokens from tailwind.config.ts

Always use the named design tokens, never hardcoded hex values in JSX:

```tsx
// Good
<div className="bg-surface-container text-on-surface">

// Bad
<div className="bg-[#201F1F] text-[#E5E2E1]">
```

The only place hex values appear is `tailwind.config.ts` and `globals.css`.

### No Inline Styles

Inline `style={{}}` props are banned except for:

- Dynamically computed values that cannot be expressed as a Tailwind class (e.g. a CSS variable set from JS, a chart colour from data)
- Third-party components that require style props

### `cn()` for Conditional Classes

Use the `cn()` utility (re-exported from `@/lib/utils`) for conditional class merging:

```typescript
import { cn } from "@/lib/utils";

// Good
<button className={cn(
  "font-label text-sm rounded-lg px-4 py-2",
  isActive && "bg-primary text-on-primary",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>

// Bad — string concatenation
<button className={`font-label text-sm ${isActive ? "bg-primary" : ""}`}>
```

`cn()` uses `clsx` + `tailwind-merge` under the hood, so conflicting Tailwind classes are resolved correctly.

---

## shadcn Customisation

shadcn components are installed into `apps/web/components/ui/` and owned by this project. They are not upstream dependencies — edit them freely.

**Rules for customising shadcn components:**

- Override defaults to match the design system (surfaces, fonts, colours)
- Use the semantic tokens (`bg-surface-container`, `text-on-surface`, etc.) — they resolve per theme, so the component works in both dark and light mode without branching
- Replace default buttons with surface variants; the solid emerald primary is the CTA (`.btn-gradient` is reserved per `docs/DESIGN.md:197`, do not use in new code)
- Apply `backdrop-blur-[24px]` (dark) / `backdrop-blur-[16px]` (light) and theme-appropriate opacity to Dialog/Sheet overlays for the glassmorphic effect — see `docs/DESIGN.md` "Glass & Gradient Rule"
- Use `font-label` (Space Grotesk) for component labels, `font-body` (Inter) for content

The app is **dual-theme** (Dark default + Light companion). Theme state is handled by the dedicated provider wired in `apps/web/app/layout.tsx` — don't add a second `<ThemeProvider>`.

---

## Internationalisation

All user-facing strings go through `next-intl`. No hardcoded English strings in JSX.

**Adding a string:**

1. Add the key to `apps/web/messages/en.json` under the appropriate namespace:

```json
{
  "invoices": {
    "createButton": "New Invoice",
    "emptyState": "No invoices yet"
  }
}
```

2. Use in a Server Component:

```typescript
import { getTranslations } from "next-intl/server";

const t = await getTranslations("invoices");
return <button>{t("createButton")}</button>;
```

3. Use in a Client Component:

```typescript
"use client";
import { useTranslations } from "next-intl";

const t = useTranslations("invoices");
```

**Namespace convention:** use the feature/route name as the top-level namespace (`invoices`, `clients`, `settings`, `auth`). Shared strings go under `common`.

**Active locales:** `en`, `el`, `es`. Any new key must be added to **all three** locale files — missing keys render as raw `namespace.key` strings at runtime. `el.json` and `es.json` are maintained in lockstep with `en.json`; keep structures identical.

---

## Git Workflow

- **Never force push.** If you need to rewrite history, discuss first.
- **Never push to `main` directly** (during initial development this may be relaxed, but feature work should use branches).
- **Feature branches:** `feature/<N>-<short-description>` where `N` is the issue number.
- **Branch off `main`**, rebase onto `main` before opening a PR.
- **Squash or clean up commits** before merging — the `main` history should read like a changelog of features, not a stream of WIP saves.
- **PR titles** follow the same Conventional Commits format as commit messages.

**Commit granularity:** commit at logical checkpoints, not at save points. A commit should represent a complete, coherent change that could be reverted independently without breaking the app.
