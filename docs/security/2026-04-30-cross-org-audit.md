# Cross-org audit — 2026-04-30

> Generated for issue #274 (Phase A). One row per call site against an
> org-owned table. Phase A scope: `expenses`, `expense_attachment`,
> `expense_category`, `expense_group`.
>
> Status: ✅ scoped, ❌ leak (fixed in this PR), 🟡 helper (verified safe).

## Legend

- ✅ — query / mutation includes `eq(<table>.orgId, <verified-orgId>)`
  (or, for system tables / FK-cascaded tables, the row is reachable only
  via a parent that was orgId-verified).
- ❌ — missing scope; fix landed in commit `<sha>`.
- 🟡 — helper takes `orgId` as a parameter; every caller passes a
  session-verified `orgId`.

## expenses

`expenses` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                                               | Status | Evidence / fix                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/expenses/[id]/page.tsx:32`                          | ✅     | `from(expenses).where(and(eq(id, …), eq(orgId, session.org.id)))` (L33)                                                                                                                                                                                                                                                                   |
| `apps/web/lib/expenses/draft-expenses.ts:163`                           | 🟡     | `createDraftExpense(orgId, …)`. Callers: `app/(app)/expenses/actions.ts:135` passes `session.org.id`; `lib/ai/tools/create-draft-expense.ts:107` passes `orgId` from `createTools(orgId, …)` whose only runtime caller, `app/api/ai/chat/route.ts:74`, derives `orgId` from `session.org.id`. INSERT row sets `orgId` from the parameter. |
| `apps/web/app/(app)/expenses/actions.ts:370`                            | ✅     | `updateExpense` pre-fetch — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L371)                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/expenses/actions.ts:433`                            | ✅     | `update(expenses).where(and(eq(id, …), eq(orgId, session.org.id)))` (L452)                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/expenses/actions.ts:488`                            | ✅     | `deleteExpense` pre-fetch — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L489)                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/expenses/actions.ts:503`                            | ✅     | `delete(expenses).where(and(eq(id, …), eq(orgId, session.org.id)))` (L504)                                                                                                                                                                                                                                                                |
| `apps/web/lib/demo/populate.ts:767`                                     | 🟡     | `populateOrgDemo(db, orgId)`. Callers: `lib/demo/ensure.ts:79,97` derive `orgId` from `orgMemberships` for the just-authenticated demo user. INSERT row sets `orgId` from the parameter.                                                                                                                                                  |
| `apps/web/lib/demo/populate.ts:846`                                     | 🟡     | Postcondition guard inside the same helper — `count(*).where(eq(orgId, orgId))` against the just-passed parameter.                                                                                                                                                                                                                        |
| `apps/web/app/(app)/expenses/page.tsx:33`                               | ✅     | List query — `where(eq(orgId, session.org.id))` (L34)                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/expenses/page.tsx:40`                               | ✅     | Count query — `where(eq(orgId, session.org.id))` (L41)                                                                                                                                                                                                                                                                                    |
| `apps/web/__tests__/fx-prune-cache.test.ts:52,54`                       | ✅     | Test-only — runs against an isolated PGlite DB; no security surface.                                                                                                                                                                                                                                                                      |
| `apps/web/__tests__/reports-fx-aggregations.test.ts:75,220,252,339,375` | ✅     | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                           |
| `apps/web/__tests__/demo-populate.test.ts:56`                           | ✅     | Test-only — isolated PGlite DB; query already filters `eq(orgId, org.id)`.                                                                                                                                                                                                                                                                |

## expense_attachment

`expense_attachment` has NO `orgId` column. Authorization is enforced
via FK to `expense.id` (`onDelete: cascade`); `orgId` scope must be
applied either by joining through `expense` or by ensuring the
`expenseId` was verified by a previous orgId-scoped query.

| File:line                                      | Status  | Evidence / fix                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/expenses/actions.ts:147`   | ✅      | INSERT runs after `createDraftExpense(session.org.id, …)` returns the new `expense.id`; `expenseId` carries authorisation via FK.                                                                                                                                     |
| `apps/web/app/(app)/expenses/actions.ts:218`   | ❌ → ✅ | Duplicate-receipt guard previously matched `eq(fileHash, hash)` with NO scope — Org B's hash blocked Org A's upload (and confirmed existence). Fixed in commit `b3c319b` by `innerJoin(expenses).where(and(eq(fileHash, hash), eq(expenses.orgId, session.org.id)))`. |
| `apps/web/app/(app)/expenses/actions.ts:499`   | ✅      | `deleteExpense` collects file paths AFTER the parent expense was fetched by `eq(expenses.orgId, session.org.id)` (L489); `expenseId` is session-verified.                                                                                                             |
| `apps/web/app/(app)/expenses/[id]/page.tsx:45` | ✅      | Detail-page attachment list runs AFTER the parent expense was fetched by `eq(expenses.orgId, session.org.id)` (L33); `expenseId` is session-verified.                                                                                                                 |

## expense_category

`expense_category` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                                | Status  | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/expenses/category-seed.ts:355`             | 🟡      | `seedExpenseCategories(orgId, …)`. Callers: every page/action that calls `ensureCategoriesSeeded` passes `session.org.id`; `lib/demo/populate.ts:139` passes the helper's `orgId` parameter (which itself originates from a session-verified caller).                                                                                                                                                                                   |
| `apps/web/lib/expenses/category-seed.ts:389`             | 🟡      | Same — INSERT row sets `orgId` from the parameter.                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/web/app/(app)/recurring-expenses/new/page.tsx:33`  | ✅      | `where(and(eq(orgId, session.org.id), eq(active, true)))` (L37)                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/lib/demo/populate.ts:149`                      | 🟡      | Helper-internal — fetches the categories that `seedExpenseCategories` just inserted for `orgId` parameter; caller chain audited above.                                                                                                                                                                                                                                                                                                  |
| `apps/web/app/(app)/expenses/new/page.tsx:34`            | ✅      | `where(and(eq(orgId, session.org.id), eq(active, true)))` (L37)                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/app/(app)/expenses/actions.ts:271`             | ✅      | `where(and(eq(orgId, session.org.id), eq(active, true)))` (L274)                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/app/(app)/expenses/[id]/page.tsx:52`           | ❌ → ✅ | Category-name lookup previously used `eq(expenseCategories.id, expense.categoryId)` with NO orgId scope. `categoryId` is a foreign-key field that the create/update flow does not validate as same-org; an attacker could store a foreign-org `categoryId` on their own expense and the detail page would render Org B's category name. Fixed in commit `b3c319b` by adding `eq(expenseCategories.orgId, session.org.id)` to the WHERE. |
| `apps/web/__tests__/demo-populate.test.ts:82`            | ✅      | Test-only — isolated PGlite DB; query filters `eq(orgId, org.id)`.                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/web/app/(app)/expenses/categories/actions.ts:38`   | ✅      | `getGroupedCategories` — `where(and(eq(orgId, session.org.id), eq(active, true)))` (L41)                                                                                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/expenses/categories/actions.ts:70`   | ✅      | `createCategory` INSERT — `orgId: session.org.id` (L72)                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/app/(app)/expenses/categories/actions.ts:106`  | ✅      | `updateCategory` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L119)                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/expenses/categories/actions.ts:139`  | ✅      | `deleteCategory` pre-fetch — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L143)                                                                                                                                                                                                                                                                                                                                                  |
| `apps/web/app/(app)/expenses/categories/actions.ts:158`  | ✅      | `deleteCategory` DELETE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L162)                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/expenses/categories/actions.ts:176`  | ✅      | `toggleCategory` pre-fetch — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L180)                                                                                                                                                                                                                                                                                                                                                  |
| `apps/web/app/(app)/expenses/categories/actions.ts:187`  | ✅      | `toggleCategory` UPDATE — guarded upstream by the L176 pre-check. Hardened in commit `b3c319b` to add `eq(orgId, session.org.id)` to the UPDATE WHERE as defence-in-depth (every mutation includes orgId, no reliance on TOCTOU-prone pre-check).                                                                                                                                                                                       |
| `apps/web/app/(app)/expenses/categories/page.tsx:28`     | ✅      | `where(eq(orgId, session.org.id))` (L29)                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/web/__tests__/reports-fx-aggregations.test.ts:56`  | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/__tests__/expense-category-seed.test.ts:40,81` | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                                                                         |

## expense_group

`expense_group` is a SYSTEM/global table (no `orgId` column — primary key is `code`,
seeded from `EXPENSE_GROUPS_SEED`). Org-agnostic by design; every read returns the
same global rows for every tenant. No cross-org isolation surface.

| File:line                                                           | Status | Evidence / fix                                                                |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `apps/web/lib/expenses/category-seed.ts:371`                        | ✅     | INSERT into system table with `onConflictDoUpdate(target: code, …)` — global. |
| `apps/web/app/(app)/expenses/new/page.tsx:28`                       | ✅     | System table — read of global seed rows.                                      |
| `apps/web/app/(app)/expenses/categories/actions.ts:32`              | ✅     | System table — read of global seed rows.                                      |
| `apps/web/app/(app)/recurring-expenses/new/page.tsx:27`             | ✅     | System table — read of global seed rows.                                      |
| `apps/web/app/(app)/expenses/categories/page.tsx:22`                | ✅     | System table — read of global seed rows.                                      |
| `apps/web/__tests__/expense-category-seed.test.ts:44,65,93,105,110` | ✅     | Test-only — isolated PGlite DB.                                               |

## Summary

| Table                | ✅     | ❌ (fixed) | 🟡    | Total  |
| -------------------- | ------ | ---------- | ----- | ------ |
| `expenses`           | 11     | 0          | 3     | 14     |
| `expense_attachment` | 3      | 1          | 0     | 4      |
| `expense_category`   | 14     | 1          | 3     | 18     |
| `expense_group`      | 6      | 0          | 0     | 6      |
| **Total**            | **34** | **2**      | **6** | **42** |

## Defence-in-depth additions

Beyond the two ❌ leaks above, this PR also hardens
`toggleCategory` (`expense_category` action) to include
`eq(orgId, session.org.id)` on the UPDATE WHERE. The pre-check
already gated authorisation; the addition removes the TOCTOU
dependency and aligns the action with the surrounding
`updateCategory` / `deleteCategory` / `getGroupedCategories`
shape (every mutation carries orgId).

## Out-of-scope follow-ups (Phase B candidates)

- `categoryId` foreign-key on `expense.create` / `expense.update`
  is not validated as same-org. The leaked `[id]/page.tsx` lookup
  is fixed by scoping the lookup, but the underlying data integrity
  issue (an expense row pointing at another org's category) remains.
  Recommend adding a same-org check on `createDraftExpense` /
  `updateExpense` when `categoryId` is present, before the INSERT
  / UPDATE. Not in Phase A scope (the audit is on read/write
  org-scope, not on FK validation).
- `contactId` foreign-key on `expense.create` / `expense.update`
  has the same shape but `createDraftExpense` does verify `contactId`
  belongs to `orgId` (L120) before using it — already safe.
