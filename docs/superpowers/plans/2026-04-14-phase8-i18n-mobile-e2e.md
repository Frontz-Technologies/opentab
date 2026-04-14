# Phase 8: i18n, Mobile Lists, AI Chat Sheet, E2E — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Greek/Spanish translations with locale switching, card-based mobile list views for all entity lists, mobile-responsive AI chat bottom sheet, and updated E2E tests.

**Architecture:** Translation files mirror `en.json` structure exactly. Locale switching via cookie read in `i18n/request.ts`. Mobile list cards use `hidden md:block` / `block md:hidden` pattern with separate components. AI chat uses responsive Sheet side prop.

**Tech Stack:** next-intl v4, Next.js 15 App Router, Tailwind CSS v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-14-phase8-i18n-mobile-e2e-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/messages/el.json` | Full Greek translations (644 lines) |
| `apps/web/messages/es.json` | Full Spanish translations (644 lines) |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/i18n/request.ts` | Read locale from cookie instead of hardcoded "en" |
| `apps/web/app/(app)/settings/general/actions.ts` | Set locale cookie on preference save |
| `apps/web/app/(app)/settings/general/general-form.tsx` | Add Spanish to language selector |
| `apps/web/messages/en.json` | Add "languageEs": "Spanish" key |
| `apps/web/app/(app)/invoices/invoice-list.tsx` | Add mobile card variant |
| `apps/web/app/(app)/expenses/expense-list.tsx` | Add mobile card variant |
| `apps/web/app/(app)/contacts/contact-list.tsx` | Add mobile card variant |
| `apps/web/app/(app)/quotes/quote-list.tsx` | Add mobile card variant |
| `apps/web/app/(app)/recurring/recurring-list.tsx` | Add mobile card variant |
| `apps/web/app/(app)/recurring-expenses/recurring-expense-list.tsx` | Add mobile card variant |
| `apps/web/components/ai/ai-chat-panel.tsx` | Responsive Sheet side (bottom on mobile, right on desktop) |
| `e2e/09-settings.spec.ts` | Update for PageHeader, add locale test |

---

## Task 1: Greek Translations (el.json)

**Files:**
- Create: `apps/web/messages/el.json`

- [ ] **Step 1: Create the Greek translation file**

Create `apps/web/messages/el.json` with the complete Greek translation of all 25 sections from `en.json`. The structure must be identical — same keys, translated values.

**String length rules for Greek:**
- Sidebar nav labels: keep under 14 chars (Πίνακας, Τιμολόγια, Δαπάνες, Επαφές, Προϊόντα, Αναφορές, Ρυθμίσεις — all fit)
- Filter pill labels: keep short (Όλα, Πρόχ., Αποστ., Πληρ., Εκπρόθ.)
- Status badges: short (ΠΡΟΧΕΙΡΟ, ΑΠΟΣΤ., ΠΛΗΡ., ΑΚΥΡ.)
- Button text: can be longer, `truncate` class handles overflow
- Keep "myDATA", "OpenTab", "AADE", "ΑΦΜ", "ΔΟΥ", "EFKA", "IKE", "EPE", "AE", "OpenRouter" as-is
- Keep format placeholders like `{last4}`, `{error}`, `{orgName}` unchanged

Key translations for navigation (these appear in the compact sidebar):
```
"dashboard": "Πίνακας"
"invoices": "Τιμολόγια"
"expenses": "Δαπάνες"
"contacts": "Επαφές"
"products": "Προϊόντα"
"reports": "Αναφορές"
"settings": "Ρυθμίσεις"
```

The full file must be valid JSON with identical key structure to `en.json`.

- [ ] **Step 2: Validate JSON**

Run: `cd /home/claude/repos/opentab && node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/el.json','utf8')); console.log('Valid')"`
Expected: `Valid`

- [ ] **Step 3: Verify key parity with en.json**

Run: `cd /home/claude/repos/opentab && node -e "const en=JSON.parse(require('fs').readFileSync('apps/web/messages/en.json','utf8')); const el=JSON.parse(require('fs').readFileSync('apps/web/messages/el.json','utf8')); const diff=(a,b,p='')=>{for(const k of Object.keys(a)){const path=p?p+'.'+k:k; if(!(k in b))console.log('MISSING:',path); else if(typeof a[k]==='object'&&typeof b[k]==='object')diff(a[k],b[k],path)}}; diff(en,el); console.log('Done')"`
Expected: `Done` with no MISSING lines

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/el.json
git commit -m "feat: add full Greek translations (el.json)"
```

---

## Task 2: Spanish Translations (es.json)

**Files:**
- Create: `apps/web/messages/es.json`

- [ ] **Step 1: Create the Spanish translation file**

Create `apps/web/messages/es.json` with the complete Spanish (Latin American) translation of all 25 sections. Same structure as `en.json`.

**String length rules for Spanish:**
- Sidebar nav: Panel, Facturas, Gastos, Contactos, Productos, Informes, Config. (all fit ~14 chars, "Configuración" → abbreviate to "Config." for sidebar)
- Filter pills: Todos, Borr., Env., Pagado, Vencido
- Keep technical terms: "myDATA", "OpenTab", "AADE", "OpenRouter"
- Keep format placeholders unchanged

Key navigation translations:
```
"dashboard": "Panel"
"invoices": "Facturas"
"expenses": "Gastos"
"contacts": "Contactos"
"products": "Productos"
"reports": "Informes"
"settings": "Config."
```

- [ ] **Step 2: Validate JSON**

Run: `cd /home/claude/repos/opentab && node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/es.json','utf8')); console.log('Valid')"`
Expected: `Valid`

- [ ] **Step 3: Verify key parity**

Run same parity check as Task 1 but comparing en.json with es.json.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/es.json
git commit -m "feat: add full Spanish translations (es.json)"
```

---

## Task 3: Locale Switching Infrastructure

**Files:**
- Modify: `apps/web/i18n/request.ts`
- Modify: `apps/web/app/(app)/settings/general/actions.ts`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/app/(app)/settings/general/general-form.tsx`

- [ ] **Step 1: Update i18n/request.ts to read locale from cookie**

Replace `apps/web/i18n/request.ts`:

```typescript
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const validLocales = ["en", "el", "es"];
  const resolvedLocale = validLocales.includes(locale) ? locale : "en";

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  };
});
```

- [ ] **Step 2: Update general settings action to set locale cookie**

In `apps/web/app/(app)/settings/general/actions.ts`, add cookie setting:

```typescript
"use server";

import { cookies } from "next/headers";
import { upsertUserPreferences } from "@/lib/actions/user-preferences";
import { revalidatePath } from "next/cache";

export async function updateGeneralSettings(formData: FormData) {
  const locale = formData.get("locale") as string;

  await upsertUserPreferences({
    locale,
    dateFormat: formData.get("dateFormat") as string,
    numberFormat: formData.get("numberFormat") as string,
    notifyInvoicePaid: formData.get("notifyInvoicePaid") === "on",
    notifyExpenseApproved: formData.get("notifyExpenseApproved") === "on",
  });

  // Set locale cookie for next-intl to read
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  revalidatePath("/");
}
```

- [ ] **Step 3: Add Spanish option to en.json**

In `apps/web/messages/en.json`, add to `settingsGeneral`:

```json
"languageEs": "Spanish"
```

Also add corresponding keys in el.json and es.json:
- el.json: `"languageEs": "Ισπανικά"`
- es.json: `"languageEs": "Español"`

- [ ] **Step 4: Update general-form.tsx to include Spanish**

In `apps/web/app/(app)/settings/general/general-form.tsx`, add the Spanish option to the locale select:

```tsx
<select name="locale" className={selectClass} defaultValue={initialData.locale}>
  <option value="en">{t("languageEn")}</option>
  <option value="el">{t("languageEl")}</option>
  <option value="es">{t("languageEs")}</option>
</select>
```

- [ ] **Step 5: Verify build**

Run: `cd /home/claude/repos/opentab && pnpm build --filter=@opentab/web 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/i18n/request.ts apps/web/app/\(app\)/settings/general/actions.ts apps/web/app/\(app\)/settings/general/general-form.tsx apps/web/messages/en.json apps/web/messages/el.json apps/web/messages/es.json
git commit -m "feat: wire locale switching with cookie persistence"
```

---

## Task 4: Mobile Card Lists — Invoices

**Files:**
- Modify: `apps/web/app/(app)/invoices/invoice-list.tsx`

- [ ] **Step 1: Add mobile card variant to invoice list**

In `apps/web/app/(app)/invoices/invoice-list.tsx`, wrap the existing `<table>` with `hidden md:block` and add a mobile card list below it. The mobile cards should be `Link` components to the detail page.

After the search/filter bar and before the closing `</div>`, replace the table section:

```tsx
{filtered.length === 0 ? (
  // ... existing empty state (keep as-is)
) : (
  <>
    {/* Desktop: table */}
    <div className="hidden md:block bg-surface-container rounded-xl overflow-hidden">
      <table className="w-full">
        {/* ... existing table content unchanged ... */}
      </table>
    </div>

    {/* Mobile: card list */}
    <div className="block md:hidden space-y-3">
      {filtered.map((invoice) => (
        <Link
          key={invoice.id}
          href={`/invoices/${invoice.id}`}
          className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-start justify-between mb-1">
            <span className="font-mono text-sm text-on-surface">
              {invoice.invoiceNumber}
            </span>
            <span className="font-label text-lg font-bold text-on-surface">
              {invoice.currencyCode} {invoice.total}
            </span>
          </div>
          <p className="text-sm text-on-surface mb-2">
            {invoice.contactName}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              {invoice.issueDate}
            </span>
            <Badge className={getStatusColor(invoice)} variant="outline">
              {getStatusLabel(invoice, t)}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  </>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(app\)/invoices/invoice-list.tsx
git commit -m "feat: add mobile card layout for invoice list"
```

---

## Task 5: Mobile Card Lists — Expenses, Contacts, Quotes

**Files:**
- Modify: `apps/web/app/(app)/expenses/expense-list.tsx`
- Modify: `apps/web/app/(app)/contacts/contact-list.tsx`
- Modify: `apps/web/app/(app)/quotes/quote-list.tsx`

- [ ] **Step 1: Add mobile cards to expense list**

Same pattern as Task 4. Wrap table in `hidden md:block`, add `block md:hidden` card list. Expense cards show: expense number, supplier/contact name, amount, date, status badge.

- [ ] **Step 2: Add mobile cards to contact list**

Contact cards show: display name, type badge (Client/Supplier/Both), email, phone. Tap links to `/contacts/{id}`.

- [ ] **Step 3: Add mobile cards to quote list**

Quote cards show: quote number, client, amount, valid until date, status badge. Tap links to `/quotes/{id}`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/expenses/expense-list.tsx apps/web/app/\(app\)/contacts/contact-list.tsx apps/web/app/\(app\)/quotes/quote-list.tsx
git commit -m "feat: add mobile card layouts for expense, contact, and quote lists"
```

---

## Task 6: Mobile Card Lists — Recurring

**Files:**
- Modify: `apps/web/app/(app)/recurring/recurring-list.tsx`
- Modify: `apps/web/app/(app)/recurring-expenses/recurring-expense-list.tsx`

- [ ] **Step 1: Add mobile cards to recurring invoice list**

Recurring cards show: client name, frequency, next send date, status badge.

- [ ] **Step 2: Add mobile cards to recurring expense list**

Recurring expense cards show: description, frequency, next run date, status badge.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/recurring/recurring-list.tsx apps/web/app/\(app\)/recurring-expenses/recurring-expense-list.tsx
git commit -m "feat: add mobile card layouts for recurring invoice and expense lists"
```

---

## Task 7: AI Chat Bottom Sheet on Mobile

**Files:**
- Modify: `apps/web/components/ai/ai-chat-panel.tsx`

- [ ] **Step 1: Make AI chat panel responsive**

Update `apps/web/components/ai/ai-chat-panel.tsx` to use bottom sheet on mobile:

```tsx
"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAiChatStore } from "@/hooks/use-ai-chat-store";
import { AiChatHeader } from "@/components/ai/ai-chat-header";
import { AiChatMessages } from "@/components/ai/ai-chat-messages";
import { AiChatInput } from "@/components/ai/ai-chat-input";
import { cn } from "@/lib/utils";

export function AiChatPanel() {
  const t = useTranslations("ai");
  const isOpen = useAiChatStore((state) => state.isOpen);
  const close = useAiChatStore((state) => state.close);
  const isMobile = useIsMobile();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? close() : undefined)}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "border-on-surface/10 bg-surface-container/90 p-0 backdrop-blur-[24px]",
          isMobile
            ? "h-[80vh] rounded-t-2xl border-t"
            : "w-full border-l sm:max-w-[420px]",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <AiChatHeader />
          <AiChatMessages />
          <AiChatInput />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ai/ai-chat-panel.tsx
git commit -m "feat: make AI chat a bottom sheet on mobile, side panel on desktop"
```

---

## Task 8: Update E2E Tests

**Files:**
- Modify: `e2e/09-settings.spec.ts`

- [ ] **Step 1: Update settings e2e tests**

Update `e2e/09-settings.spec.ts` to verify:
- PageHeader renders heading (not breadcrumbs)
- Language selector has 3 options (English, Greek, Spanish)
- Settings nav is accessible

Replace the breadcrumb-related tests:

```typescript
test("settings nav is visible in sidebar", async () => {
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
});

test("general settings has language selector with 3 options", async () => {
  await page.goto("/settings/general");
  const localeSelect = page.locator('select[name="locale"]');
  if (await localeSelect.isVisible()) {
    const options = await localeSelect.locator("option").allTextContents();
    expect(options.length).toBe(3);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/09-settings.spec.ts
git commit -m "test: update e2e tests for locale selector and PageHeader"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /home/claude/repos/opentab && pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `cd /home/claude/repos/opentab && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Run format and lint**

Run: `cd /home/claude/repos/opentab && pnpm format && pnpm lint`
Expected: Clean

- [ ] **Step 4: Verify translation file sizes**

Run: `cd /home/claude/repos/opentab && wc -l apps/web/messages/*.json`
Expected: All three files should be similar line counts (640-650 lines each)

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address verification issues"
```
