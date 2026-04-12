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
Run migration db:migrate before deploying.
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
- Remove all light mode CSS variables — we are dark-only
- Replace default buttons with gradient or surface variants
- Apply `backdrop-blur-[24px]` and opacity to Dialog/Sheet overlays for the glassmorphic effect
- Use `font-label` (Space Grotesk) for component labels, `font-body` (Inter) for content

**Do not** add a `<ThemeProvider>` that toggles between light and dark. The app runs in dark mode always.

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

**Only `en.json` is required for now.** Other locales are added by duplicating `en.json` and translating — the structure must match exactly.

---

## Git Workflow

- **Never force push.** If you need to rewrite history, discuss first.
- **Never push to `main` directly** (during initial development this may be relaxed, but feature work should use branches).
- **Feature branches:** `feature/<N>-<short-description>` where `N` is the issue number.
- **Branch off `main`**, rebase onto `main` before opening a PR.
- **Squash or clean up commits** before merging — the `main` history should read like a changelog of features, not a stream of WIP saves.
- **PR titles** follow the same Conventional Commits format as commit messages.

**Commit granularity:** commit at logical checkpoints, not at save points. A commit should represent a complete, coherent change that could be reverted independently without breaking the app.
