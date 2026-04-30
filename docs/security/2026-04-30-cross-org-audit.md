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

---

# Cross-org audit — Phase B (2026-04-30)

> Phase B scope: `invoices`, `invoice_item`, `quotes`, `quote_item`,
> `credit_notes`, `credit_note_item`. Same legend as Phase A.

## invoices

`invoice` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                                        | Status  | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/invoicing/draft-invoices.ts:135`                   | 🟡      | `createDraftInvoice(orgId, …)` helper. Callers: `app/(app)/invoices/actions.ts:75` passes `session.org.id`. Verifies `contactId` is same-org at L82 before INSERT; INSERT row sets `orgId` from the parameter.                                                                                                                                                                        |
| `apps/web/lib/invoicing/assign-invoice-number.ts:54`             | 🟡      | `assignInvoiceNumberIfMissing(invoiceId, orgId, tx)` helper. SELECT FOR UPDATE filters `eq(invoices.id, …)` AND `eq(invoices.orgId, …)`. Callers: `invoices/actions.ts:90,337,424` (sendInvoice / publishInvoice / createInvoice transaction) pass `session.org.id`. Throws if invoice not in org.                                                                                    |
| `apps/web/lib/invoicing/assign-invoice-number.ts:94`             | ❌ → ✅ | Sequence-allocation UPDATE inside the same transaction previously ran `where(eq(invoices.id, invoiceId))` only. The pre-check at L55 already gated, but defence-in-depth (mirror Phase A's `toggleCategory`): every mutation now carries `eq(orgId, …)` so the WHERE is the authority, not just the pre-fetch. Fixed in commit `5370f68`.                                             |
| `apps/web/lib/demo/populate.ts:462`                              | 🟡      | INSERT inside `populateOrgDemo(db, orgId)`; caller chain audited in Phase A.                                                                                                                                                                                                                                                                                                          |
| `apps/web/lib/demo/populate.ts:605`                              | ✅      | SELECT inside `seedCreditNotes(db, orgId, rng)` — `where(eq(invoices.orgId, orgId))`.                                                                                                                                                                                                                                                                                                 |
| `apps/web/lib/demo/populate.ts:838`                              | ✅      | Postcondition guard — `count(*).where(eq(orgId, orgId))`.                                                                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/import/[entity]/actions.ts:478`              | ✅      | `linkParentInvoiceIds` — `where(and(eq(invoices.orgId, orgId), inArray(invoiceNumber, …)))`. Resolved id is therefore guaranteed in-org before being stored on the credit-note row.                                                                                                                                                                                                   |
| `apps/web/app/(app)/import/[entity]/actions.ts:562`              | ✅      | Header-row lookup for line-item insertion — `where(and(eq(invoices.orgId, orgId), inArray(importIdempotencyKey, …)))`.                                                                                                                                                                                                                                                                |
| `apps/web/lib/country/submit-credit-note.ts:117`                 | ❌ → ✅ | Parent-invoice number lookup previously ran `where(eq(invoices.id, cn.invoiceId))` with NO orgId scope. `cn.invoiceId` is a foreign-key field; `createCreditNoteSchema` validates only `z.string().uuid()`. An attacker who set `cn.invoiceId` to another org's invoice would leak that invoice's number through the country-plugin payload (myDATA, etc). Fixed in commit `78ac824`. |
| `apps/web/app/(app)/recurring/[id]/page.tsx:56`                  | ✅      | Generated-invoice list — `where(and(eq(recurringInvoiceId, id), eq(orgId, session.org.id)))` (L57-61).                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/invoices/page.tsx:38`                        | ✅      | List query — `where(eq(invoices.orgId, session.org.id))` (L39).                                                                                                                                                                                                                                                                                                                       |
| `apps/web/app/(app)/invoices/page.tsx:45`                        | ✅      | Count query — `where(eq(invoices.orgId, session.org.id))` (L46).                                                                                                                                                                                                                                                                                                                      |
| `apps/web/app/(app)/credit-notes/new/page.tsx:44`                | ✅      | Pre-fill invoice fetch — `where(and(eq(invoices.id, params.invoiceId), eq(invoices.orgId, session.org.id)))` (L46-49).                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/quotes/actions.ts:409`                       | ✅      | `convertToInvoice` INSERT — `orgId: session.org.id` (L411). Source quote was orgId-checked at L391-394.                                                                                                                                                                                                                                                                               |
| `apps/web/app/api/invoices/[id]/pdf/route.ts:37`                 | ✅      | PDF route invoice fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L38).                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/invoices/actions.ts:87`                      | ❌ → ✅ | createInvoice publish-flag transaction UPDATE previously ran `where(eq(invoices.id, invoice.id))` only. Pre-check at L75 (createDraftInvoice returned the just-created row) gated, but the WHERE itself didn't carry orgId. Defence-in-depth fix: added `eq(invoices.orgId, orgId)` to the UPDATE WHERE. Fixed in commit `5370f68`.                                                   |
| `apps/web/app/(app)/invoices/actions.ts:143`                     | ✅      | `updateInvoice` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L144).                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/invoices/actions.ts:222`                     | ✅      | `updateInvoice` UPDATE — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L243).                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/invoices/actions.ts:301`                     | ✅      | `sendInvoice` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L302).                                                                                                                                                                                                                                                                               |
| `apps/web/app/(app)/invoices/actions.ts:330`                     | ❌ → ✅ | `sendInvoice` UPDATE inside transaction previously ran `where(eq(invoices.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                                                                                                                                                         |
| `apps/web/app/(app)/invoices/actions.ts:396`                     | ✅      | `publishInvoice` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L397).                                                                                                                                                                                                                                                                            |
| `apps/web/app/(app)/invoices/actions.ts:418`                     | ❌ → ✅ | `publishInvoice` UPDATE inside transaction previously ran `where(eq(invoices.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                                                                                                                                                      |
| `apps/web/app/(app)/invoices/actions.ts:451`                     | ✅      | `markAsPaid` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L452).                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/invoices/actions.ts:474`                     | ❌ → ✅ | `markAsPaid` UPDATE previously ran `where(eq(invoices.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/invoices/actions.ts:513`                     | ✅      | `cancelInvoice` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L514).                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/invoices/actions.ts:526`                     | ❌ → ✅ | `cancelInvoice` UPDATE previously ran `where(eq(invoices.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                                                                                                                                                                          |
| `apps/web/app/(app)/invoices/actions.ts:573`                     | ✅      | `deleteInvoice` pre-fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L574).                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/invoices/actions.ts:606`                     | ✅      | `deleteInvoice` DELETE — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L607).                                                                                                                                                                                                                                                                                |
| `apps/web/app/api/invoices/[id]/activity.csv/route.ts:27`        | ✅      | Activity CSV route invoice fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L28).                                                                                                                                                                                                                                                                       |
| `apps/web/app/(app)/invoices/[id]/page.tsx:48`                   | ✅      | Detail-page invoice fetch — `where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)))` (L49).                                                                                                                                                                                                                                                                              |
| `apps/web/app/(app)/credit-notes/[id]/page.tsx:55`               | ❌ → ✅ | Linked-invoice number lookup previously ran `where(eq(invoices.id, cn.invoiceId))` with NO orgId scope. Same vector as `submit-credit-note.ts` above — Org B's invoice number rendered as a link in Org A's UI. Fixed in commit `78ac824` by adding `eq(invoices.orgId, session.org.id)`.                                                                                             |
| `apps/web/app/api/credit-notes/[id]/pdf/route.ts:63`             | ❌ → ✅ | PDF-route linked-invoice number lookup previously ran `where(eq(invoices.id, creditNote.invoiceId))` with NO orgId scope. Same vector — Org B's invoice number embedded in Org A's PDF. Fixed in commit `78ac824` by adding `eq(invoices.orgId, session.org.id)`.                                                                                                                     |
| `apps/web/lib/country/submit-invoice.ts:103`                     | ✅      | Plugin-submission pre-fetch — `where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgCtx.id)))` (L104). `orgCtx.id` is `session.org.id` from `sendInvoice`.                                                                                                                                                                                                                     |
| `apps/web/__tests__/submit-invoice-preflight.test.ts:40`         | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/revenue-credit-note-subtraction.test.ts:44`  | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/reports-fx-aggregations.test.ts:73,79,119,…` | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/import/commit-line-items.test.ts:166`        | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/import/v1-1-polish.test.ts:156,243`          | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/demo-populate.test.ts:52`                    | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/__tests__/invoicing-assign-number.test.ts:43,64,105`   | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                                                                       |

## invoice_item

`invoice_item` has NO `orgId` column. Authorisation is enforced via FK
to `invoice.id` (`onDelete: cascade`); `orgId` scope must flow through
the parent (Phase A's `expense_attachment` pattern).

| File:line                                                   | Status | Evidence / fix                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/quotes/actions.ts:433`                  | ✅     | `convertToInvoice` INSERT — copies items from a SELECT on `quoteItems` whose `quoteId` was orgId-checked at L391-394; `invoiceId` was just inserted with `orgId: session.org.id` at L411.                                                                                                                                       |
| `apps/web/app/(app)/import/[entity]/actions.ts:608`         | ✅     | Bulk INSERT — `invoiceId` resolved from `keyToId` whose source SELECT (L562) filters by `eq(invoices.orgId, orgId)`.                                                                                                                                                                                                            |
| `apps/web/lib/country/submit-invoice.ts:112`                | ✅     | SELECT — `where(eq(invoiceItems.invoiceId, invoiceId))` runs AFTER the parent invoice was orgId-checked at L101-104; `invoiceId` is session-verified.                                                                                                                                                                           |
| `apps/web/lib/invoicing/draft-invoices.ts:167`              | 🟡     | INSERT inside `createDraftInvoice(orgId, …)`; `invoiceId` is the just-inserted invoice whose orgId came from the verified parameter.                                                                                                                                                                                            |
| `apps/web/lib/demo/populate.ts:488`                         | 🟡     | INSERT inside `populateOrgDemo(db, orgId)`; caller chain audited in Phase A.                                                                                                                                                                                                                                                    |
| `apps/web/lib/demo/populate.ts:636`                         | 🟡     | SELECT inside `seedCreditNotes` — `where(eq(invoiceItems.invoiceId, inv.id))` where `inv` came from the L605 query already filtered by `orgId`.                                                                                                                                                                                 |
| `apps/web/app/(app)/invoices/actions.ts:246`                | ✅     | `updateInvoice` line-item DELETE — runs AFTER the parent was orgId-checked at L141-149; `invoiceId` is session-verified.                                                                                                                                                                                                        |
| `apps/web/app/(app)/invoices/actions.ts:256`                | ✅     | `updateInvoice` line-item INSERT — same gate as above.                                                                                                                                                                                                                                                                          |
| `apps/web/app/(app)/invoices/[id]/page.tsx:55`              | ✅     | Detail-page items SELECT — `where(eq(invoiceItems.invoiceId, id))` runs AFTER the parent was orgId-checked at L46-49; `id` is session-verified.                                                                                                                                                                                 |
| `apps/web/app/api/invoices/[id]/pdf/route.ts:41`            | ✅     | PDF-route items SELECT — `where(eq(invoiceItems.invoiceId, id))` runs in `Promise.all` alongside the parent fetch. The result is only consumed AFTER the parent guard at L50-57 returns 404 if the parent isn't in the session's org. Items fetched for a foreign-org parent are dropped before any output, so no leak surface. |
| `apps/web/__tests__/reports-fx-aggregations.test.ts:71,316` | ✅     | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                 |
| `apps/web/__tests__/import/commit-line-items.test.ts:173`   | ✅     | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                                                                                 |

## quotes

`quote` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                    | Status  | Evidence / fix                                                                                                                                                                                                           |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/app/(app)/quotes/actions.ts:174`   | ✅      | `createQuote` INSERT — `orgId: session.org.id` (L176).                                                                                                                                                                   |
| `apps/web/app/(app)/quotes/actions.ts:229`   | ✅      | `updateQuote` pre-fetch — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L230).                                                                                                                      |
| `apps/web/app/(app)/quotes/actions.ts:295`   | ✅      | `updateQuote` UPDATE — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L314).                                                                                                                         |
| `apps/web/app/(app)/quotes/actions.ts:350`   | ✅      | `sendQuote` UPDATE — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L352).                                                                                                                           |
| `apps/web/app/(app)/quotes/actions.ts:364`   | ✅      | `acceptQuote` UPDATE — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L366).                                                                                                                         |
| `apps/web/app/(app)/quotes/actions.ts:378`   | ✅      | `rejectQuote` UPDATE — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L380).                                                                                                                         |
| `apps/web/app/(app)/quotes/actions.ts:393`   | ✅      | `convertToInvoice` pre-fetch — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L394).                                                                                                                 |
| `apps/web/app/(app)/quotes/actions.ts:450`   | ❌ → ✅ | `convertToInvoice` post-conversion UPDATE previously ran `where(eq(quotes.id, id))` only. Pre-check at L391-394 gated, but the file's other quote mutations all pair id+orgId. Defence-in-depth fix in commit `5370f68`. |
| `apps/web/app/(app)/quotes/actions.ts:469`   | ✅      | `deleteQuote` pre-fetch — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L470).                                                                                                                      |
| `apps/web/app/(app)/quotes/actions.ts:478`   | ✅      | `deleteQuote` DELETE — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L479).                                                                                                                         |
| `apps/web/app/(app)/quotes/[id]/page.tsx:37` | ✅      | Detail-page quote fetch — `where(and(eq(quotes.id, id), eq(quotes.orgId, session.org.id)))` (L38).                                                                                                                       |
| `apps/web/app/(app)/quotes/page.tsx:33`      | ✅      | List query — `where(eq(quotes.orgId, session.org.id))` (L34).                                                                                                                                                            |
| `apps/web/app/(app)/quotes/page.tsx:40`      | ✅      | Count query — `where(eq(quotes.orgId, session.org.id))` (L41).                                                                                                                                                           |

## quote_item

`quote_item` has NO `orgId` column. Authorisation flows through
`quote.id` (FK, cascade).

| File:line                                    | Status | Evidence / fix                                                                                       |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/quotes/actions.ts:203`   | ✅     | `createQuote` line-item INSERT — `quoteId` is the just-inserted quote whose `orgId: session.org.id`. |
| `apps/web/app/(app)/quotes/actions.ts:316`   | ✅     | `updateQuote` line-item DELETE — `quoteId` was orgId-verified at L227-230 pre-check.                 |
| `apps/web/app/(app)/quotes/actions.ts:324`   | ✅     | `updateQuote` line-item INSERT — same gate as above.                                                 |
| `apps/web/app/(app)/quotes/actions.ts:403`   | ✅     | `convertToInvoice` items SELECT — `quoteId` was orgId-verified at L391-394.                          |
| `apps/web/app/(app)/quotes/[id]/page.tsx:44` | ✅     | Detail-page items SELECT — `quoteId` was orgId-verified at L35-38 parent fetch.                      |

## credit_notes

`credit_note` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                                       | Status  | Evidence / fix                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/invoicing/credit-note-numbering.ts:43`            | 🟡      | `assignCreditNoteNumberIfMissing(creditNoteId, orgId, tx)` helper. SELECT FOR UPDATE filters `eq(creditNotes.id, …)` AND `eq(creditNotes.orgId, …)` (L45). Callers: `credit-notes/actions.ts:348,397` (publish/send) pass `session.org.id`. Throws if not in org. |
| `apps/web/lib/invoicing/credit-note-numbering.ts:82`            | ❌ → ✅ | Sequence-allocation UPDATE inside the same transaction previously ran `where(eq(creditNotes.id, creditNoteId))` only. Defence-in-depth fix: added orgId scope (mirror of the invoice-numbering helper). Fixed in commit `5370f68`.                                |
| `apps/web/app/(app)/credit-notes/page.tsx:31`                   | ✅      | List query — `where(eq(creditNotes.orgId, session.org.id))` (L32).                                                                                                                                                                                                |
| `apps/web/lib/demo/populate.ts:661`                             | 🟡      | INSERT inside `populateOrgDemo(db, orgId)`; caller chain audited in Phase A.                                                                                                                                                                                      |
| `apps/web/lib/demo/populate.ts:842`                             | 🟡      | Postcondition guard — `count(*).where(eq(orgId, orgId))`.                                                                                                                                                                                                         |
| `apps/web/app/(app)/credit-notes/actions.ts:112`                | ✅      | `createCreditNote` INSERT — `orgId` (L114). `contactId` validated as same-org at L84 before INSERT. `invoiceId` is **NOT** validated as same-org (see carry-over). The downstream reads of `cn.invoiceId` are now scoped to mitigate.                             |
| `apps/web/app/(app)/credit-notes/actions.ts:194`                | ✅      | `updateCreditNote` pre-fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))` (L195).                                                                                                                                                         |
| `apps/web/app/(app)/credit-notes/actions.ts:268`                | ❌ → ✅ | `updateCreditNote` UPDATE inside transaction previously ran `where(eq(creditNotes.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                             |
| `apps/web/app/(app)/credit-notes/actions.ts:330`                | ✅      | `publishCreditNote` pre-fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))` (L331).                                                                                                                                                        |
| `apps/web/app/(app)/credit-notes/actions.ts:342`                | ❌ → ✅ | `publishCreditNote` UPDATE inside transaction previously ran `where(eq(creditNotes.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                            |
| `apps/web/app/(app)/credit-notes/actions.ts:375`                | ✅      | `sendCreditNote` pre-fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))` (L376).                                                                                                                                                           |
| `apps/web/app/(app)/credit-notes/actions.ts:390`                | ❌ → ✅ | `sendCreditNote` UPDATE inside transaction previously ran `where(eq(creditNotes.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                               |
| `apps/web/app/(app)/credit-notes/actions.ts:435`                | ✅      | `cancelCreditNote` pre-fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))` (L436).                                                                                                                                                         |
| `apps/web/app/(app)/credit-notes/actions.ts:443`                | ❌ → ✅ | `cancelCreditNote` UPDATE previously ran `where(eq(creditNotes.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                                                |
| `apps/web/app/(app)/credit-notes/actions.ts:468`                | ✅      | `deleteCreditNote` pre-fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, orgId)))` (L469).                                                                                                                                                         |
| `apps/web/app/(app)/credit-notes/actions.ts:489`                | ❌ → ✅ | `deleteCreditNote` DELETE inside transaction previously ran `where(eq(creditNotes.id, id))` only. Defence-in-depth fix: added orgId scope. Fixed in commit `5370f68`.                                                                                             |
| `apps/web/app/(app)/credit-notes/[id]/page.tsx:41`              | ✅      | Detail-page CN fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)))` (L42).                                                                                                                                                         |
| `apps/web/lib/country/submit-credit-note.ts:101`                | ✅      | Plugin pre-fetch — `where(and(eq(creditNotes.id, creditNoteId), eq(creditNotes.orgId, orgCtx.id)))` (L103).                                                                                                                                                       |
| `apps/web/app/(app)/import/[entity)/actions.ts:628`             | ✅      | Header-row lookup for line-item insertion — `where(and(eq(creditNotes.orgId, orgId), inArray(importIdempotencyKey, …)))`.                                                                                                                                         |
| `apps/web/app/api/credit-notes/[id]/pdf/route.ts:35`            | ✅      | PDF route CN fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)))` (L37).                                                                                                                                                           |
| `apps/web/app/api/credit-notes/[id]/activity.csv/route.ts:27`   | ✅      | Activity CSV route CN fetch — `where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)))` (L28).                                                                                                                                                  |
| `apps/web/__tests__/import/commit-line-items.test.ts:224`       | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |
| `apps/web/__tests__/revenue-credit-note-subtraction.test.ts:73` | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |
| `apps/web/__tests__/reports-fx-aggregations.test.ts:74,131`     | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |
| `apps/web/__tests__/credit-note-numbering.test.ts:44,66`        | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |
| `apps/web/__tests__/submit-credit-note.test.ts:78,138`          | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |
| `apps/web/__tests__/import/v1-1-polish.test.ts:333`             | ✅      | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                   |

## credit_note_item

`credit_note_item` has NO `orgId` column. Authorisation flows through
`credit_note.id` (FK, cascade).

| File:line                                            | Status | Evidence / fix                                                                                                                                                                                     |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/country/submit-credit-note.ts:124`     | ✅     | SELECT — `creditNoteId` was orgId-verified at L99-104; items query runs AFTER the parent gate.                                                                                                     |
| `apps/web/app/(app)/import/[entity]/actions.ts:674`  | ✅     | Bulk INSERT — `creditNoteId` resolved from `keyToId` whose source SELECT (L628) filters by `eq(creditNotes.orgId, orgId)`.                                                                         |
| `apps/web/app/(app)/credit-notes/[id]/page.tsx:47`   | ✅     | Detail-page items SELECT — runs AFTER parent CN was orgId-checked at L39-42.                                                                                                                       |
| `apps/web/app/api/credit-notes/[id]/pdf/route.ts:41` | ✅     | PDF-route items SELECT — same `Promise.all` shape as the invoices PDF route. Result is consumed only after the parent guard at L50-57 returns 404 for foreign-org parents. No output leak surface. |
| `apps/web/app/(app)/credit-notes/actions.ts:142`     | 🟡     | `createCreditNote` line-item INSERT inside transaction — `creditNoteId` is the just-inserted CN whose `orgId` came from `session.org.id`.                                                          |
| `apps/web/app/(app)/credit-notes/actions.ts:292`     | ✅     | `updateCreditNote` line-item DELETE — `creditNoteId` was orgId-verified at L192-195 pre-check.                                                                                                     |
| `apps/web/app/(app)/credit-notes/actions.ts:301`     | ✅     | `updateCreditNote` line-item INSERT — same gate as above.                                                                                                                                          |
| `apps/web/lib/demo/populate.ts:682`                  | 🟡     | INSERT inside `populateOrgDemo`; caller chain audited in Phase A.                                                                                                                                  |

## Summary (Phase B)

| Table              | ✅     | ❌ (fixed) | 🟡     | Total   |
| ------------------ | ------ | ---------- | ------ | ------- |
| `invoices`         | 26     | 6          | 4      | 36      |
| `invoice_item`     | 9      | 0          | 3      | 12      |
| `quotes`           | 12     | 1          | 0      | 13      |
| `quote_item`       | 5      | 0          | 0      | 5       |
| `credit_notes`     | 19     | 6          | 3      | 28      |
| `credit_note_item` | 5      | 0          | 3      | 8       |
| **Total**          | **76** | **13**     | **13** | **102** |

## Real leaks vs defence-in-depth (Phase B)

**Real leaks (3 sites, single root cause)** — `creditNotes.invoiceId` is
a FK that `createCreditNoteSchema` validates only as a UUID (no
same-org check). Three downstream reads consumed it without scope:

1. `apps/web/app/(app)/credit-notes/[id]/page.tsx:55` — leaked Org B's
   invoice number into Org A's UI as a clickable link.
2. `apps/web/app/api/credit-notes/[id]/pdf/route.ts:63` — embedded
   Org B's invoice number into Org A's PDF output.
3. `apps/web/lib/country/submit-credit-note.ts:117` — sent Org B's
   invoice number through the country plugin payload (myDATA, etc).

**Defence-in-depth (10 sites)** — UPDATE / DELETE statements that
relied on a preceding orgId-scoped SELECT pre-check, but whose own
WHERE used `eq(<table>.id, id)` only:

- `invoices/actions.ts` × 6: createInvoice publish-tx, sendInvoice,
  publishInvoice, markAsPaid, cancelInvoice, and the
  `assign-invoice-number` helper UPDATE.
- `credit-notes/actions.ts` × 5: updateCreditNote, publishCreditNote,
  sendCreditNote, cancelCreditNote, deleteCreditNote, and the
  `credit-note-numbering` helper UPDATE.
- `quotes/actions.ts` × 1: convertToInvoice's post-conversion UPDATE.

Each fix mirrors the surrounding action shape (every other mutation in
each file already paired id+orgId on the WHERE).

## Out-of-scope follow-ups (Phase B carry-overs)

- `creditNotes.invoiceId` foreign-key on `createCreditNote` /
  `updateCreditNote` is not validated as same-org. The downstream
  reads are all now scoped, so the read-side leak is fully closed.
  But the underlying data-integrity issue (a credit note row pointing
  at another org's invoice) remains. Recommend adding a same-org
  check on `createCreditNote` / `updateCreditNote` when `invoiceId`
  is present, before the INSERT / UPDATE. Not in Phase B scope (the
  audit is on read/write org-scope, not on FK validation). Same shape
  as Phase A's `categoryId` carry-over for expenses.
- `invoice_item.productId` and `credit_note_item.productId` — no
  same-org validation on insert. Not exploitable from the read paths
  in this phase's call sites (no UI surface joins through `productId`
  to another table — sortOrder / name / quantity are all
  self-contained per row), but worth noting for a future products
  audit (Phase C if scoped).
- `creditNotes.invoiceId` — same shape, no validation. Already
  enumerated above as a carry-over.

## Defence-in-depth additions (Phase B)

Pattern alignment with Phase A's `toggleCategory` fix: every action
mutation now carries `eq(<table>.orgId, session.org.id)` on the WHERE,
not just on the pre-fetch. Removes TOCTOU dependence and aligns each
file with its own dominant style — every other mutation in the file
already had the orgId clause. The two helpers
(`assign-invoice-number` and `credit-note-numbering`) gained the
same hardening on their internal UPDATE inside the FOR UPDATE
transaction, for parity with the surrounding actions.
