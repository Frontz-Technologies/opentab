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

---

# Phase C — `contacts` + `products`

> Phase C scope: `contacts`, `products`. Both tables carry a NOT NULL
> `orgId` FK to `organisation`. Cascade on delete. ~30 call sites
> total (contacts ~22 in app code, products ~8) — every read and
> write passes through `eq(<table>.orgId, session.org.id)`.

## contacts

`contact` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                               | Status | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/contacts/page.tsx:33`               | ✅     | List query — `where(eq(orgId, session.org.id))` (L34)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/app/(app)/contacts/page.tsx:40`               | ✅     | Count query — `where(eq(orgId, session.org.id))` (L41)                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web/app/(app)/contacts/[id]/page.tsx:24`          | ✅     | `from(contacts).where(and(eq(id, …), eq(orgId, session.org.id)))` (L25)                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/app/(app)/contacts/new/page.tsx:25`           | ✅     | Recent-contacts sidebar — `where(eq(orgId, session.org.id))` (L26)                                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/app/(app)/contacts/actions.ts:88`             | ✅     | `createContact` INSERT sets `orgId: session.org.id` (L90)                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/app/(app)/contacts/actions.ts:171`            | ✅     | `updateContact` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L195)                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/app/(app)/contacts/actions.ts:211`            | ✅     | `deleteContact` DELETE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L212)                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/app/(app)/expenses/new/page.tsx:22`           | ✅     | Supplier dropdown — `where(eq(orgId, session.org.id))` (L23)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/recurring-expenses/new/page.tsx:21` | ✅     | Supplier dropdown — `where(eq(orgId, session.org.id))` (L22)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/invoices/new/page.tsx:18`           | ✅     | Client dropdown — `where(and(eq(orgId, session.org.id), inArray(type, …)))` (L19-24)                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/quotes/new/page.tsx:18`             | ✅     | Client dropdown — `where(and(eq(orgId, session.org.id), inArray(type, …)))` (L19-24)                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/credit-notes/new/page.tsx:28`       | ✅     | Client dropdown — `where(and(eq(orgId, session.org.id), inArray(type, …)))` (L29-34)                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/app/(app)/credit-notes/actions.ts:83`         | ✅     | `createCreditNote` contact lookup — `where(and(eq(id, …), eq(orgId, orgId)))` (L84). Validates the FK belongs to the session org before INSERT.                                                                                                                                                                                                                                                                                                                  |
| `apps/web/app/(app)/recurring/new/page.tsx:18`          | ✅     | Client dropdown — `where(and(eq(orgId, session.org.id)))` (L19)                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/web/app/(app)/import/[entity]/actions.ts:378`     | ✅     | `resolveInvoiceContactIds` — `where(and(eq(orgId, orgId), inArray(displayName, …)))` (L380). `orgId` derived from `session.org.id` at L204.                                                                                                                                                                                                                                                                                                                      |
| `apps/web/app/(app)/import/[entity]/actions.ts:422`     | ✅     | Auto-create stub INSERT sets `orgId` from the same `orgId` parameter (L410).                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/app/(app)/import/[entity]/actions.ts:427`     | ✅     | Re-query after auto-create — same `eq(orgId, orgId)` scope (L429).                                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/lib/expenses/draft-expenses.ts:119`           | 🟡     | `createDraftExpense(orgId, …)` contact lookup — `where(and(eq(id, …), eq(orgId, orgId)))` (L120). Same caller chain as Phase A's expenses INSERT — `app/(app)/expenses/actions.ts:135` passes `session.org.id`; AI tool path derives `orgId` from `session.org.id` at `app/api/ai/chat/route.ts:74`.                                                                                                                                                             |
| `apps/web/lib/invoicing/draft-invoices.ts:81`           | 🟡     | `createDraftInvoice(orgId, …)` contact lookup — `where(and(eq(id, …), eq(orgId, orgId)))` (L82). Callers: `app/(app)/invoices/actions.ts:75` passes `session.org.id`; `lib/ai/tools/create-draft-invoice.ts:107` passes `orgId` from `createTools(orgId, …)` whose only runtime caller, `app/api/ai/chat/route.ts:74`, derives from session.                                                                                                                     |
| `apps/web/lib/expenses/supplier-matching.ts:20,43`      | 🟡     | `matchSupplier(orgId, …)` — both branches scope by `eq(contacts.orgId, orgId)`. Sole caller `app/(app)/expenses/actions.ts:325,331` passes `session.org.id`.                                                                                                                                                                                                                                                                                                     |
| `apps/web/lib/demo/populate.ts:214,232`                 | 🟡     | `seedContacts(db, orgId, _rng)` INSERTs set `orgId` from the parameter (via `clientRow(orgId, …)` / `supplierRow(orgId, …)`). Caller chain identical to Phase A's `populateOrgDemo` — `lib/demo/ensure.ts:79,97` derive `orgId` from `orgMemberships` for the just-authenticated demo user.                                                                                                                                                                      |
| `apps/web/lib/demo/populate.ts:830`                     | 🟡     | Postcondition guard inside the same helper — `count(*).where(eq(orgId, orgId))` against the just-passed parameter.                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/__tests__/...` (10+ sites)                    | ✅     | Test-only — runs against an isolated PGlite DB; no security surface. Covers `cross-org/{contacts,products,invoices,quotes,credit-notes}.test.ts`, `import/v1-1-polish.test.ts`, `demo-populate.test.ts`, `submit-invoice-preflight.test.ts`, `credit-note-numbering.test.ts`, `revenue-credit-note-subtraction.test.ts`, `submit-credit-note.test.ts`, `invoicing-assign-number.test.ts`, `import/commit-line-items.test.ts`, `reports-fx-aggregations.test.ts`. |

## products

`product` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                       | Status | Evidence / fix                                                                                                                         |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/products/page.tsx:33`       | ✅     | List query — `where(eq(orgId, session.org.id))` (L34)                                                                                  |
| `apps/web/app/(app)/products/page.tsx:40`       | ✅     | Count query — `where(eq(orgId, session.org.id))` (L41)                                                                                 |
| `apps/web/app/(app)/products/[id]/page.tsx:24`  | ✅     | `from(products).where(and(eq(id, …), eq(orgId, session.org.id)))` (L25)                                                                |
| `apps/web/app/(app)/products/actions.ts:34`     | ✅     | `createProduct` INSERT sets `orgId: session.org.id` (L36)                                                                              |
| `apps/web/app/(app)/products/actions.ts:72`     | ✅     | `updateProduct` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L83)                                                      |
| `apps/web/app/(app)/products/actions.ts:95`     | ✅     | `deleteProduct` DELETE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L96)                                                      |
| `apps/web/app/(app)/invoices/new/page.tsx:29`   | ✅     | Active-products dropdown — `where(and(eq(orgId, session.org.id), eq(active, true)))` (L30)                                             |
| `apps/web/app/(app)/quotes/new/page.tsx:29`     | ✅     | Active-products dropdown — `where(and(eq(orgId, session.org.id), eq(active, true)))` (L30)                                             |
| `apps/web/app/(app)/recurring/new/page.tsx:24`  | ✅     | Active-products dropdown — `where(and(eq(orgId, session.org.id), eq(active, true)))` (L25)                                             |
| `apps/web/lib/demo/populate.ts:293`             | 🟡     | `seedProducts(db, orgId)` INSERT sets `orgId` from the parameter (via `productRow(orgId, …)`). Same caller chain as Phase A demo seed. |
| `apps/web/lib/demo/populate.ts:834`             | 🟡     | Postcondition guard — `count(*).where(eq(orgId, orgId))` against the just-passed parameter.                                            |
| `apps/web/__tests__/demo-populate.test.ts:48`   | ✅     | Test-only — isolated PGlite DB.                                                                                                        |
| `apps/web/__tests__/cross-org/products.test.ts` | ✅     | New defence-in-depth tests for `updateProduct` / `deleteProduct` (Phase C).                                                            |

## Summary (Phase C)

**Read-side leaks**: 0. Every `from(contacts)` and `from(products)`
call site already pairs `eq(<table>.orgId, session.org.id)` (or
verified `orgId` parameter) on its WHERE. Both tables carry direct
`orgId` columns, so no JOIN-through-parent pattern was needed.

**Write-side mutations**: every `insert/update/delete` against
`contact` and `product` already includes the orgId clause. No
defence-in-depth additions were necessary in this phase — the
existing actions are uniformly scoped (unlike Phase A's
`toggleCategory` and Phase B's invoice/credit-note/quote mutations).

**New tests**: `apps/web/__tests__/cross-org/contacts.test.ts` and
`apps/web/__tests__/cross-org/products.test.ts` freeze the
`updateContact` / `deleteContact` / `updateProduct` / `deleteProduct`
contracts so any future regression that drops the orgId WHERE clause
surfaces here, not in production. Both verified red→green by
stashing the orgId clause locally.

## Out-of-scope follow-ups (Phase C carry-overs)

These are write-side foreign-key validation gaps — not read-side
leaks against `contacts` / `products`, but related cross-org
data-integrity issues uncovered while reviewing the call graph.
Same shape as Phase A's `expenses.categoryId` and Phase B's
`creditNotes.invoiceId` carry-overs.

- **`invoices.contactId`** — `createInvoice` validates the contact
  via `createDraftInvoice`'s `eq(orgId, orgId)` lookup (good), but
  `updateInvoice` (`apps/web/app/(app)/invoices/actions.ts:224`)
  writes `contactId: data.contactId` from the form without
  re-validating same-org. A user editing an Org A draft could
  point its `contactId` at an Org B contact via crafted form
  data. Read paths already filter by Org A's `invoices.orgId`, so
  the only impact today is a stored FK pointing at an unowned
  contact — but downstream renderers that JOIN `contacts` (e.g.
  invoice detail pages, PDF rendering) would surface Org B's
  contact details on Org A's invoice. Recommend adding the same
  `eq(contacts.orgId, orgId)` pre-check on the update path.

- **`quotes.contactId`** — same shape, both `createQuote`
  (`quotes/actions.ts:177`) and `updateQuote`
  (`quotes/actions.ts:297`) write `data.contactId` without
  validating same-org. `createQuote` notably has no contact lookup
  at all (unlike `createInvoice` / `createCreditNote`), so this is
  the lowest-effort fix in the carry-over list.

- **`creditNotes.contactId`** — `createCreditNote` does validate
  (`credit-notes/actions.ts:83-87`), but `updateCreditNote`
  (`credit-notes/actions.ts:270`) does not. Same pattern as
  `updateInvoice`.

- **`expenses.contactId`** — `createDraftExpense` validates the
  contact via `eq(contacts.orgId, orgId)` lookup
  (`draft-expenses.ts:119-122`); `updateExpense`
  (`expenses/actions.ts:433`) writes `contactId: data.contactId`
  from the form without re-validating same-org. Same shape as the
  others. The expense detail page already scopes its display to
  `expense.contactName` (snapshotted at create), so the read-side
  leak is bounded — but the FK can still point at another org's
  contact after an edit.

- **`invoice_item.productId`, `credit_note_item.productId`,
  `quote_item.productId`** — already noted in Phase B's carry-over
  list. Phase C confirms: no `from(products)` read site joins
  through `productId` to surface another org's product, so no
  read-side leak. But the FK itself can be set to a foreign-org
  product on insert/update (line items take `productId` from form
  data without same-org validation). Out of scope here; folded
  into the same write-side FK validation pass that the contactId
  carry-overs need.

These all share the same fix shape: pre-check the FK is in the
session's org before INSERT/UPDATE, returning a validation error
otherwise. Recommended as a single follow-up issue
(write-side FK same-org validation across contactId / productId /
categoryId / invoiceId).

# Phase D — recurring + integrations + ai + user prefs

> Phase D scope: `recurring_invoice`, `recurring_invoice_item`,
> `recurring_expense`, `recurring_expense_item`,
> `country_integration_credential`,
> `country_integration_submission`, `user_preferences`,
> `ai_settings`, `inbound_document`. AI chat tables and
> `imports` were named in the spec but DO NOT exist in the
> schema (`packages/db/src/schema/index.ts`); both noted as
> `(no schema)` and skipped.

## recurring_invoice

`recurring_invoice` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                        | Status | Evidence / fix                                                                                                                                                                         |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/recurring/[id]/page.tsx:38`  | ✅     | `from(recurringInvoices).where(and(eq(id, …), eq(orgId, session.org.id)))` (L40)                                                                                                       |
| `apps/web/app/(app)/recurring/page.tsx:33`       | ✅     | List query — `where(eq(orgId, session.org.id))` (L34)                                                                                                                                  |
| `apps/web/app/(app)/recurring/page.tsx:40`       | ✅     | Count query — `where(eq(orgId, session.org.id))` (L41)                                                                                                                                 |
| `apps/web/app/(app)/recurring/actions.ts:78`     | ✅     | `createRecurring` INSERT sets `orgId: session.org.id` (L80)                                                                                                                            |
| `apps/web/app/(app)/recurring/actions.ts:154`    | ✅     | `updateRecurring` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L171). Pre-check at L133 (added in commit `bc4942b`) gates the action before any line-item DELETE runs. |
| `apps/web/app/(app)/recurring/actions.ts:212`    | ✅     | `pauseRecurring` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L216)                                                                                                    |
| `apps/web/app/(app)/recurring/actions.ts:231`    | ✅     | `resumeRecurring` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L235)                                                                                                   |
| `apps/web/app/(app)/recurring/actions.ts:250`    | ✅     | `deleteRecurring` DELETE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L254)                                                                                                   |
| `apps/web/__tests__/cross-org/recurring.test.ts` | ✅     | New defence-in-depth test for `updateRecurring` line-item leak (Phase D commit `bc4942b`).                                                                                             |

## recurring_invoice_item

`recurring_invoice_item` has NO `orgId` column. Authorization flows
through the FK to `recurring_invoice.id` (`onDelete: cascade`); the
parent must be orgId-verified before any item-table mutation.

| File:line                                       | Status  | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/recurring/[id]/page.tsx:50` | ✅      | Reads after the parent recurring invoice was fetched by `eq(orgId, session.org.id)` (L40); `recurringInvoiceId` is session-verified.                                                                                                                                                                                                                                                                                                                                    |
| `apps/web/app/(app)/recurring/actions.ts:102`   | ✅      | INSERT runs after `createRecurring` inserted the parent with `orgId: session.org.id`; `recurringInvoiceId` carries authorisation via FK.                                                                                                                                                                                                                                                                                                                                |
| `apps/web/app/(app)/recurring/actions.ts:177`   | ❌ → ✅ | DELETE used `eq(recurringInvoiceItems.recurringInvoiceId, id)` only. The preceding parent UPDATE was scoped (`and(eq(id, X), eq(orgId, session.org.id))`) and silently no-ops on a cross-org id, but the DELETE then wiped another org's items and the subsequent INSERT inserted the attacker's lines into the victim's recurring. Real cross-org leak — fixed in commit `bc4942b` by adding a pre-check that returns early when the parent is not in the session org. |
| `apps/web/app/(app)/recurring/actions.ts:186`   | ✅      | Re-INSERT into the parent that the new pre-check just verified is same-org.                                                                                                                                                                                                                                                                                                                                                                                             |

## recurring_expense

`recurring_expense` carries `orgId` (NOT NULL, FK organisation, cascade).

| File:line                                                 | Status | Evidence / fix                                                                                                                                                                      |
| --------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/recurring-expenses/page.tsx:33`       | ✅     | List query — `where(eq(orgId, session.org.id))` (L34)                                                                                                                               |
| `apps/web/app/(app)/recurring-expenses/page.tsx:40`       | ✅     | Count query — `where(eq(orgId, session.org.id))` (L41)                                                                                                                              |
| `apps/web/app/(app)/recurring-expenses/[id]/page.tsx:47`  | ✅     | `from(recurringExpenses).where(and(eq(id, …), eq(orgId, session.org.id)))` (L49)                                                                                                    |
| `apps/web/app/(app)/recurring-expenses/actions.ts:78`     | ✅     | `createRecurringExpense` INSERT sets `orgId: session.org.id` (L80)                                                                                                                  |
| `apps/web/app/(app)/recurring-expenses/actions.ts:154`    | ✅     | `updateRecurringExpense` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L172). Pre-check at L133 (added in commit `bc4942b`) gates the action before any item DELETE. |
| `apps/web/app/(app)/recurring-expenses/actions.ts:211`    | ✅     | `pauseRecurringExpense` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L218)                                                                                          |
| `apps/web/app/(app)/recurring-expenses/actions.ts:233`    | ✅     | `resumeRecurringExpense` UPDATE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L240)                                                                                         |
| `apps/web/app/(app)/recurring-expenses/actions.ts:255`    | ✅     | `deleteRecurringExpense` DELETE — `where(and(eq(id, …), eq(orgId, session.org.id)))` (L259)                                                                                         |
| `apps/web/__tests__/cross-org/recurring-expenses.test.ts` | ✅     | New defence-in-depth test for `updateRecurringExpense` line-item leak (Phase D commit `bc4942b`).                                                                                   |

## recurring_expense_item

`recurring_expense_item` has NO `orgId` column. Same parent-FK
shape as `recurring_invoice_item`.

| File:line                                                | Status  | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/recurring-expenses/[id]/page.tsx:59` | ✅      | Reads after the parent was fetched by `eq(orgId, session.org.id)` (L49); `recurringExpenseId` is session-verified.                                                                                                                                                                                                                                                                                            |
| `apps/web/app/(app)/recurring-expenses/actions.ts:103`   | ✅      | INSERT runs after `createRecurringExpense` inserted the parent with `orgId: session.org.id`; FK carries authorisation.                                                                                                                                                                                                                                                                                        |
| `apps/web/app/(app)/recurring-expenses/actions.ts:178`   | ❌ → ✅ | DELETE used `eq(recurringExpenseItems.recurringExpenseId, id)` only — same shape as the recurring-invoice leak above. Cross-org id no-ops the parent UPDATE but the DELETE wipes another org's line items and the subsequent INSERT inserts the attacker's into the victim's recurring expense. Fixed in commit `bc4942b` by adding a pre-check that returns early when the parent is not in the session org. |
| `apps/web/app/(app)/recurring-expenses/actions.ts:188`   | ✅      | Re-INSERT into the parent that the pre-check just verified.                                                                                                                                                                                                                                                                                                                                                   |

## country_integration_credential

`country_integration_credential` carries `orgId` (NOT NULL, FK
organisation, cascade) plus a `(orgId, countryCode, kind)` unique
index — a row is unique per org per integration.

| File:line                                                        | Status  | Evidence / fix                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:62`  | ✅      | `grMydataFilter(session.org.id)` selects with `eq(orgId, …)` (L33).                                                                                                                                                                                                  |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:73`  | ❌ → ✅ | UPDATE used `eq(id, existing.id)` only. SELECT was scoped (L62) so the row is session-safe by construction, but the mutation now also includes `eq(orgId, session.org.id)` as defence-in-depth (every mutation carries orgId). Fixed in commit `8cba508`.            |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:85`  | ✅      | INSERT sets `orgId: session.org.id` (L86).                                                                                                                                                                                                                           |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:112` | ✅      | `grMydataFilter(session.org.id)` selects with `eq(orgId, …)`.                                                                                                                                                                                                        |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:139` | ❌ → ✅ | UPDATE used `eq(id, cred.id)` only. Same DI shape as L73 — fixed in commit `8cba508`.                                                                                                                                                                                |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:160` | ✅      | DELETE — `grMydataFilter(session.org.id)` includes `eq(orgId, …)`.                                                                                                                                                                                                   |
| `apps/web/app/(app)/settings/integrations/mydata/actions.ts:175` | ✅      | `grMydataFilter(session.org.id)` selects with `eq(orgId, …)`.                                                                                                                                                                                                        |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:79`  | ✅      | `where(and(eq(orgId, session.org.id), eq(countryCode, …), eq(kind, …)))` (L82)                                                                                                                                                                                       |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:90`  | ❌ → ✅ | UPDATE used `eq(id, existing.id)` only. Same DI shape as the mydata file — fixed in commit `8cba508`.                                                                                                                                                                |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:104` | ✅      | INSERT sets `orgId: session.org.id`.                                                                                                                                                                                                                                 |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:137` | ✅      | `where(and(eq(orgId, session.org.id), eq(countryCode, …), eq(kind, …)))` (L139)                                                                                                                                                                                      |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:183` | ❌ → ✅ | UPDATE used `eq(id, cred.id)` only. Same DI shape — fixed in commit `8cba508`.                                                                                                                                                                                       |
| `apps/web/app/(app)/settings/integrations/[slug]/actions.ts:205` | ✅      | DELETE — `where(and(eq(orgId, session.org.id), eq(countryCode, …), eq(kind, …)))` (L207)                                                                                                                                                                             |
| `apps/web/app/(app)/settings/integrations/page.tsx:34`           | ✅      | `where(and(eq(orgId, session.org.id), eq(countryCode, provider.code)))` (L36)                                                                                                                                                                                        |
| `apps/web/app/(app)/settings/integrations/[slug]/page.tsx:33`    | ✅      | `where(and(eq(orgId, session.org.id), eq(countryCode, …), eq(kind, …)))` (L35)                                                                                                                                                                                       |
| `apps/web/app/(app)/invoices/page.tsx:61`                        | ✅      | `where(and(eq(orgId, session.org.id), eq(countryCode, …), eq(kind, "mydata"), eq(isActive, true)))` (L63)                                                                                                                                                            |
| `apps/web/lib/country/submit-invoice.ts:39`                      | 🟡      | `loadCredentials(orgId, countryCode, kind)` — helper. Callers: `submitInvoiceThroughPlugins` (L93) and `cancelInvoiceOnPlugins` (L368) both pass `orgCtx.id`. `orgCtx` originates from `app/(app)/invoices/actions.ts` callers that derive id from `session.org.id`. |
| `apps/web/lib/country/submit-invoice.ts:283`                     | 🟡      | UPDATE on `cred.id` returned by the scoped `loadCredentials` helper above. Inside an internal lib called only with verified `orgCtx`. Same shape as a Phase B helper — DI not added because the surrounding code is already trusted-path internal.                   |
| `apps/web/lib/country/submit-credit-note.ts:40`                  | 🟡      | `loadCredentials(orgId, countryCode, kind)` — same caller chain as the invoice variant.                                                                                                                                                                              |
| `apps/web/__tests__/cross-org/country-integrations.test.ts`      | ✅      | New defence-in-depth test for the credential UPDATE WHERE shape (Phase D commit `8cba508`).                                                                                                                                                                          |

## country_integration_submission

`country_integration_submission` carries `orgId` (NOT NULL, FK
organisation, cascade) plus optional FKs to invoice / expense /
credit_note. Submissions are inserted by trusted internal lib code
(`submit-invoice.ts`, `submit-credit-note.ts`) with `orgId` from the
caller's `orgCtx`; subsequent UPDATEs reference rows just inserted in
the same function call.

| File:line                                                           | Status | Evidence / fix                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/country/submit-invoice.ts:189`                        | ✅     | INSERT sets `orgId: orgCtx.id` (L191).                                                                                                                                                                                                                              |
| `apps/web/lib/country/submit-invoice.ts:228`                        | ✅     | UPDATE on `submission.id` returned by the scoped INSERT seven lines above. Internal lib, trusted path. Phase B notes: orgId-on-mutation policy is satisfied for INSERT-then-UPDATE on the same row in the same function with no untrusted call boundary in between. |
| `apps/web/lib/country/submit-invoice.ts:269`                        | ✅     | Same shape — UPDATE on the just-inserted submission.                                                                                                                                                                                                                |
| `apps/web/lib/country/submit-invoice.ts:303`                        | ✅     | Same shape — UPDATE on the just-inserted submission.                                                                                                                                                                                                                |
| `apps/web/lib/country/submit-invoice.ts:354`                        | ✅     | `persistPreflightFailure` INSERT sets `orgId: input.orgId` from caller-supplied trusted ctx.                                                                                                                                                                        |
| `apps/web/lib/country/submit-invoice.ts:380`                        | ✅     | `where(and(eq(orgId, orgCtx.id), eq(countryCode, …), eq(kind, …), eq(invoiceId, …), eq(status, CONFIRMED)))` (L382-L391)                                                                                                                                            |
| `apps/web/lib/country/submit-invoice.ts:438`                        | ✅     | UPDATE on `latest.id` from the L378 scoped SELECT.                                                                                                                                                                                                                  |
| `apps/web/lib/country/submit-credit-note.ts:166`                    | ✅     | INSERT sets `orgId: orgCtx.id` (L168).                                                                                                                                                                                                                              |
| `apps/web/lib/country/submit-credit-note.ts:197`                    | ✅     | UPDATE on the just-inserted submission. Same trusted-path argument as `submit-invoice.ts:228`.                                                                                                                                                                      |
| `apps/web/lib/country/submit-credit-note.ts:230`                    | ✅     | Same — UPDATE on just-inserted submission.                                                                                                                                                                                                                          |
| `apps/web/lib/country/submit-credit-note.ts:258`                    | ✅     | Same — UPDATE on just-inserted submission.                                                                                                                                                                                                                          |
| `apps/web/lib/country/providers/gr/integrations/mydata/index.ts:48` | ✅     | `findParentMark(orgId, parentInvoiceId)` — `where(and(eq(orgId, orgId), eq(invoiceId, …), eq(kind, "mydata"), eq(status, CONFIRMED)))` (L50). Caller (`submitCreditNoteThroughPlugins`) passes `input.orgId` from `orgCtx`.                                         |
| `apps/web/app/(app)/invoices/[id]/page.tsx:69`                      | ✅     | Submission lookup runs after the parent invoice was fetched by `eq(orgId, session.org.id)` (L49); `invoiceId` is session-verified.                                                                                                                                  |
| `apps/web/app/(app)/invoices/page.tsx:81`                           | ✅     | `where(and(eq(orgId, session.org.id), eq(countryCode, provider.code), eq(kind, "mydata"), inArray(invoiceId, …)))` (L83)                                                                                                                                            |
| `apps/web/app/api/invoices/[id]/pdf/route.ts:66`                    | ✅     | Submission lookup runs after the parent invoice was fetched by `eq(orgId, session.org.id)` (L38); `invoiceId` is session-verified.                                                                                                                                  |
| `apps/web/__tests__/submit-invoice-preflight.test.ts:77,114`        | ✅     | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                     |
| `apps/web/__tests__/submit-credit-note.test.ts:126,176`             | ✅     | Test-only — isolated PGlite DB.                                                                                                                                                                                                                                     |

## user_preferences

`user_preferences` is a per-user table — NO `orgId` column. The
schema's unique index is `(userId)` only, so per-user rows are
shared across every org the user is a member of (and every row's
fields — locale, theme, density, notification toggles — are
user-level UI preferences, not org data). Scoping requirement:
`eq(userId, session.user.id)`.

| File:line                                     | Status | Evidence / fix                                                                                                                                                                                                                      |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/actions/user-preferences.ts:14` | ✅     | `getUserPreferences` — `where(eq(userId, session.user.id))` (L15)                                                                                                                                                                   |
| `apps/web/lib/actions/user-preferences.ts:36` | ✅     | `upsertUserPreferences` SELECT — `where(eq(userId, session.user.id))` (L37)                                                                                                                                                         |
| `apps/web/lib/actions/user-preferences.ts:41` | ✅     | `upsertUserPreferences` UPDATE — `where(eq(userId, session.user.id))` (L43)                                                                                                                                                         |
| `apps/web/lib/actions/user-preferences.ts:49` | ✅     | `upsertUserPreferences` INSERT sets `userId: session.user.id` (L50)                                                                                                                                                                 |
| `apps/web/i18n/request.ts:32`                 | ✅     | i18n locale resolver — `where(eq(userId, session.user.id))` (L33). Read-only locale lookup with a hard-coded validation set ("en"/"el"/"es"); no cross-user surface even if the row leaked, but the WHERE is correctly user-scoped. |

## ai_settings

`ai_settings` carries `orgId` (NOT NULL, FK organisation, cascade)
with a unique index on `orgId` — at most one row per org.

| File:line                                          | Status  | Evidence / fix                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/actions/ai-settings.ts:60`           | ✅      | `getAiSettingsRow(orgId)` — `where(eq(orgId, orgId))` (L61). Helper takes `orgId` parameter.                                                                                                                                                                                                                                              |
| `apps/web/lib/actions/ai-settings.ts:177`          | ❌ → ✅ | `updateAiSettings` UPDATE used `eq(id, existing.id)` only (`existing` was scoped, but the mutation should carry orgId). Fixed in commit `8cba508` to `where(and(eq(id, existing.id), eq(orgId, orgId)))` — same DI shape as the country-credential fixes.                                                                                 |
| `apps/web/lib/actions/ai-settings.ts:190`          | ✅      | INSERT sets `orgId` from `session.org.id` (via the local `orgId` const, L123).                                                                                                                                                                                                                                                            |
| `apps/web/lib/actions/ai-settings.ts:221`          | ❌ → ✅ | `deleteApiKey` previously used the opaque double-eq self-canceling WHERE `and(eq(orgId, caller.orgId), eq(orgId, session.org.id))` — technically safe but semantically obscure. Fixed in commit `8cba508` to throw `Forbidden` up front when `caller.orgId !== session.org.id` and run a single clear `eq(orgId, session.org.id)` UPDATE. |
| `apps/web/__tests__/cross-org/ai-settings.test.ts` | ✅      | New cross-org test for `deleteApiKey` (Phase D commit `8cba508`).                                                                                                                                                                                                                                                                         |

The `getAiSettingsRow` helper is called from `getAiSettings`,
`getAiSettingsSecret`, `updateAiSettings`, `isReceiptExtractionEnabled`,
and `isAiChatEnabled`. All callers pass either `session.org.id` directly
or an `orgId` parameter that itself originates from the calling
session — `app/(app)/settings/integrations/page.tsx:47` and the
AI chat / extraction routes both authenticate through `getSession()`
and pass the session-verified org id.

## ai*chat*\*

**No schema.** A grep for `aiChat` in `packages/db/src/schema/*.ts`
returns no exports, and `packages/db/src/schema/index.ts` declares
no chat-related tables. AI chat in this codebase is currently a
streaming-only API (`apps/web/app/api/ai/chat/route.ts`) that does
not persist conversation state — every request fetches the org's
data live (via tools that scope by `session.org.id`) and streams
the response without storing messages. No call sites; no surface.

## imports

**No schema.** A grep for `imports`-as-a-table returns nothing —
the only `imports` mentions in `packages/db/src/schema/*.ts` are
comments on per-org dedup-key columns added in #215 (CSV-import
idempotency lives on the destination tables: `invoices.importHash`,
`expenses.importHash`, `contacts.importHash`,
`creditNotes.importHash`). The CSV-import flow lands rows directly
into the destination tables — there is no separate `imports`
staging table. No call sites; no surface.

## inbound_document

`inbound_document` carries `orgId` (NOT NULL, FK organisation,
cascade) — designed for AADE / similar inbound document feeds. **No
call sites in `apps/web` yet.** The `mydata/index.ts` `syncInbound`
hook is a stub returning `{ fetched: 0 }`; Phase 3 of the country
integrations work will populate this table. When it does, the
shape must match the rest of Phase D (every mutation carries
`orgId`, every read filters `eq(orgId, session.org.id)`).

## Summary (Phase D)

| Table                            | ✅     | ❌ (fixed) | 🟡    | Total  |
| -------------------------------- | ------ | ---------- | ----- | ------ |
| `recurring_invoice`              | 9      | 0          | 0     | 9      |
| `recurring_invoice_item`         | 3      | 1          | 0     | 4      |
| `recurring_expense`              | 9      | 0          | 0     | 9      |
| `recurring_expense_item`         | 3      | 1          | 0     | 4      |
| `country_integration_credential` | 12     | 4          | 3     | 19     |
| `country_integration_submission` | 16     | 0          | 0     | 16     |
| `user_preferences`               | 5      | 0          | 0     | 5      |
| `ai_settings`                    | 3      | 2          | 0     | 5      |
| `ai_chat_*`                      | —      | —          | —     | —      |
| `imports`                        | —      | —          | —     | —      |
| `inbound_document`               | —      | —          | —     | —      |
| **Total**                        | **60** | **8**      | **3** | **71** |

## Real leaks vs defence-in-depth (Phase D)

**Real cross-org leaks (2):**

1. `recurring/actions.ts:177` — `updateRecurring` deleted line items by
   `recurringInvoiceId` only after a scoped-but-no-op parent UPDATE.
   Cross-org id wiped the victim org's items and re-inserted the
   attacker's. Fixed by pre-checking parent same-org before the
   DELETE/INSERT block.
2. `recurring-expenses/actions.ts:178` — same shape as #1 against
   `recurring_expense_item`. Fixed the same way.

**Defence-in-depth additions (6):**

3. `mydata/actions.ts:73` — UPDATE credential by id, after scoped SELECT.
4. `mydata/actions.ts:138` — UPDATE credential by id (lastValidatedAt).
5. `[slug]/actions.ts:90` — UPDATE credential by id, after scoped SELECT.
6. `[slug]/actions.ts:183` — UPDATE credential by id (lastValidatedAt).
7. `ai-settings.ts:177` — UPDATE settings by id, after scoped SELECT.
8. `ai-settings.ts:215` — `deleteApiKey` opaque self-canceling WHERE
   replaced with explicit Forbidden guard + single-eq UPDATE.

## Tables noted but not audited

- `ai_chat_*` — no schema, no persistence layer in current design.
- `imports` — no schema; CSV-import idempotency uses per-table
  `importHash` columns instead of a staging table.
- `inbound_document` — schema exists but no call sites in
  `apps/web` yet (Phase 3 country-integration work).

## Out-of-scope follow-ups (Phase D carry-overs)

These follow the same write-side FK same-org validation pattern as
the Phase A / B / C carry-overs.

- **`recurringInvoices.contactId`** — `createRecurring`
  (`recurring/actions.ts:78`) and `updateRecurring`
  (`recurring/actions.ts:154`) write `contactId: data.contactId` from
  the form without same-org validation. Mirror of the
  `invoices.contactId` / `quotes.contactId` carry-overs from Phase
  C. Read-side leak is bounded today (the `[id]/page.tsx`
  detail-render snapshots fields off the recurring row, not the
  joined contact), but the FK can still point at another org's
  contact after an edit.

- **`recurringExpenses.contactId` / `recurringExpenses.categoryId`** —
  same shape. `createRecurringExpense` and `updateRecurringExpense`
  write both from the form without same-org pre-checks. The
  category carry-over mirrors Phase A's `expense.categoryId`.

- **`recurringInvoiceItems.productId`** — same as Phase B's
  `invoice_item.productId` / `quote_item.productId` /
  `credit_note_item.productId` carry-overs. Line items take
  `productId` from form data without validating same-org. No
  read-side leak today (no `from(products)` join surfaces another
  org's product through this FK), but the FK itself can be set
  cross-org on insert/update.

- **`countryIntegrationSubmissions.invoiceId` / `.expenseId` /
  `.creditNoteId`** — submissions are written by trusted internal
  lib code with `orgId: orgCtx.id`, so the row's `orgId` is
  correct, but the FKs themselves are not validated as same-org
  before the INSERT. Today the only callers of
  `submitInvoiceThroughPlugins` / `submitCreditNoteThroughPlugins`
  pass invoice/credit-note ids that were just fetched by
  `eq(orgId, …)` in the calling action, so this is a trusted-path
  invariant rather than an open hole — but the helper signature
  doesn't enforce it. Lower priority than the contactId / categoryId
  / productId carry-overs.

- **`inbound_document.matchedExpenseId` / `.matchedInvoiceId`** —
  same shape; will need same-org validation when Phase 3 of the
  country-integration work lands the population path.

All carry-overs share the same fix: a same-org pre-check before
INSERT/UPDATE writes the FK. Recommended as a single follow-up
issue covering Phase A/B/C/D carry-overs together.

## Carry-over fixes (landed)

The Phase A–D carry-overs in this section are now closed. A new
helper module `apps/web/lib/security/assert-same-org.ts` exposes
per-table guards (`assertContactInOrg`, `assertExpenseCategoryInOrg`,
`assertInvoiceInOrg`) plus a batch variant
(`assertProductsInOrg`) for line-item arrays. Each guard runs an
orgId-scoped SELECT and throws `Error("cross-org-access")` when the
referenced row does not belong to the session's org. Helper unit
tests at `apps/web/__tests__/cross-org/assert-row-in-org.test.ts`.

Convention: action layer wraps the guard in try/catch and maps
`cross-org-access` to a structured `{ success: false, error: …}`
result; library helpers (`createDraftExpense`, `createDraftInvoice`)
let it propagate.

| FK field                          | Action / helper                                          | Status                                                    |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `expenses.categoryId`             | `createDraftExpense` (`lib/expenses/draft-expenses.ts`)  | ✅ guarded                                                |
| `expenses.contactId`              | `createDraftExpense`                                     | ✅ already validated (existed pre-fix; SELECT-with-orgId) |
| `expenses.contactId`              | `updateExpense` (`app/(app)/expenses/actions.ts`)        | ✅ guarded                                                |
| `expenses.categoryId`             | `updateExpense`                                          | ✅ guarded                                                |
| `invoices.contactId`              | `createDraftInvoice` (`lib/invoicing/draft-invoices.ts`) | ✅ already validated (SELECT-with-orgId pre-fix)          |
| `invoice_item.productId`          | `createDraftInvoice`                                     | ✅ guarded (batch)                                        |
| `invoices.contactId`              | `updateInvoice`                                          | ✅ guarded                                                |
| `invoice_item.productId`          | `updateInvoice`                                          | ✅ guarded (batch)                                        |
| `quotes.contactId`                | `createQuote`                                            | ✅ guarded                                                |
| `quote_item.productId`            | `createQuote`                                            | ✅ guarded (batch)                                        |
| `quotes.contactId`                | `updateQuote`                                            | ✅ guarded                                                |
| `quote_item.productId`            | `updateQuote`                                            | ✅ guarded (batch)                                        |
| `creditNotes.contactId`           | `createCreditNote`                                       | ✅ already validated (SELECT-with-orgId pre-fix)          |
| `creditNotes.invoiceId`           | `createCreditNote`                                       | ✅ guarded                                                |
| `credit_note_item.productId`      | `createCreditNote`                                       | ✅ guarded (batch)                                        |
| `creditNotes.contactId`           | `updateCreditNote`                                       | ✅ guarded                                                |
| `creditNotes.invoiceId`           | `updateCreditNote`                                       | ✅ guarded                                                |
| `credit_note_item.productId`      | `updateCreditNote`                                       | ✅ guarded (batch)                                        |
| `recurringInvoices.contactId`     | `createRecurring` / `updateRecurring`                    | ✅ guarded                                                |
| `recurringInvoiceItems.productId` | `createRecurring` / `updateRecurring`                    | ✅ guarded (batch)                                        |
| `recurringExpenses.contactId`     | `createRecurringExpense` / `updateRecurringExpense`      | ✅ guarded                                                |
| `recurringExpenses.categoryId`    | `createRecurringExpense` / `updateRecurringExpense`      | ✅ guarded                                                |

### Out of scope for this carry-over

- **`countryIntegrationSubmissions.invoiceId` / `.expenseId` /
  `.creditNoteId`** — re-confirmed already validated. Both
  `submitInvoiceThroughPlugins` and `submitCreditNoteThroughPlugins`
  do an orgId-scoped SELECT on the parent invoice / credit note
  before inserting the submission row, so the FK on the
  submission write is same-org by construction. No new helper call
  needed.

- **`inbound_document.matchedExpenseId` / `.matchedInvoiceId`** —
  population path still not landed. Will adopt the helper when the
  country-integration phase 3 work lands.

### PR #276 unblocker — `uploadAndExtractReceipt` projects parent expenseId

The duplicate-receipt branch in `uploadAndExtractReceipt`
(`apps/web/app/(app)/expenses/actions.ts`) previously returned a
text-only error (`error: "This file has already been uploaded"`).
The SELECT now joins through `expenses` to enforce the same-org
filter (Phase A read-side fix), so projecting the parent
`expense_attachment.expense_id` is safe — the returned id is
guaranteed same-org.

Response shape on the duplicate branch is now:

```ts
{ success: false, error: "duplicate", duplicateExpenseId: string }
```

`UploadReceiptResult` is now a discriminated union; the success
branch carries `extractedData` / `supplierMatch` / `fileInfo`. PR
#276's Sonner "Open existing expense" toast can rebase on top of
this with no further changes — it consumes
`result.duplicateExpenseId` directly.

### Test coverage

New / extended tests freezing the contracts above:

- `apps/web/__tests__/cross-org/assert-row-in-org.test.ts` — helper
  unit tests (4 wrappers × happy + cross-org throw + batch with one
  bad id, 10 cases).
- `apps/web/__tests__/cross-org/expenses.test.ts` — new file;
  `createExpense` cross-org categoryId throws, same-org categoryId
  succeeds; `updateExpense` cross-org contactId / categoryId
  refused.
- `apps/web/__tests__/cross-org/invoices.test.ts` — extended;
  `updateInvoice` cross-org contactId + line-item productId refused.
- `apps/web/__tests__/cross-org/quotes.test.ts` — extended;
  `createQuote` cross-org contactId + productId refused, same-org
  succeeds.
- `apps/web/__tests__/cross-org/credit-notes.test.ts` — extended;
  `createCreditNote` cross-org invoiceId + productId refused.
- `apps/web/__tests__/cross-org/recurring.test.ts` — extended;
  `createRecurring` cross-org contactId + productId refused.
- `apps/web/__tests__/cross-org/recurring-expenses.test.ts` —
  extended; `createRecurringExpense` cross-org contactId +
  categoryId refused.
- `apps/web/__tests__/cross-org/expense-attachments.test.ts` —
  extended; duplicate branch returns
  `error: "duplicate", duplicateExpenseId` pointing at the
  in-org expense (proves the JOIN-through-`expenses` filter holds).

## Phase F — ESLint guardrail

Added the `cross-org-scope/no-unscoped-org-query` ESLint rule
(`apps/web/eslint-rules/no-unscoped-org-query.cjs`, wired in
`apps/web/eslint.config.mjs`). The rule fires on Drizzle
`select / update / delete(<org-owned table>)` chains whose
`.where(...)` contains `eq(<table>.id, …)` but no
`eq(<table>.orgId, …)` — the exact bug pattern Phases A–D
closed. `__tests__/**` is excluded since cross-org specs
intentionally exercise unscoped queries.

Closed N=13 additional defence-in-depth gaps surfaced by the
rule. All were `update()` mutations inside transactions whose
preceding SELECT was orgId-scoped, but whose UPDATE WHERE only
matched by id — same TOCTOU shape as Phase A's `toggleCategory`
hardening:

- `apps/web/lib/invoicing/assign-invoice-number.ts` —
  `invoiceSequences` UPDATE inside the FOR UPDATE transaction.
- `apps/web/lib/invoicing/credit-note-numbering.ts` — same
  pattern, credit-note sequence row.
- `apps/web/app/(app)/expenses/actions.ts` and
  `apps/web/app/(app)/quotes/actions.ts` and
  `apps/web/lib/expenses/draft-expenses.ts` — three
  `generateNumber` helpers, same shape.
- `apps/web/lib/country/submit-invoice.ts` (×6) and
  `apps/web/lib/country/submit-credit-note.ts` (×3) —
  `countryIntegrationSubmissions` / `countryIntegrationCredentials`
  status UPDATEs after the orgId-scoped SELECT-and-INSERT.

Every fix adds `eq(<table>.orgId, <orgId-from-scope>)` to the
WHERE so the mutation is the authority, not the pre-fetch.
Lint reports 0 cross-org-scope errors after the fixes. No
behavioural change for same-org callers.
