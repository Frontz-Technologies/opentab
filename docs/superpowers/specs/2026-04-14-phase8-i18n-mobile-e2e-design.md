# Phase 8 Remaining: i18n, Mobile Lists, AI Chat Sheet, E2E — Design Spec

**Goal:** Complete i18n with full Greek/Spanish translations and locale switching, add card-based mobile list views, make AI chat a bottom sheet on mobile, and update E2E tests.

**Scope:** Translation files (el.json, es.json), locale selector wiring in next-intl, mobile card variants for 6 list pages, AI chat bottom sheet on mobile, E2E test updates.

---

## 1. i18n — Full Greek and Spanish Translations

### Files

- Create: `apps/web/messages/el.json` — full Greek translation (644 lines)
- Create: `apps/web/messages/es.json` — full Spanish translation (644 lines)
- Modify: `apps/web/i18n/request.ts` — read locale from user session
- Modify: `apps/web/app/(app)/settings/general/general-form.tsx` — locale change triggers revalidation
- Modify: `apps/web/app/(app)/settings/general/actions.ts` — update locale in user record + preferences

### Locale Switching

Current `i18n/request.ts` hardcodes `locale = "en"`. Update to read from the user's session:

```typescript
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  // Read locale from cookie set by middleware, default to "en"
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

When the user changes locale in General settings:
1. Server action updates `user_preferences.locale`
2. Also updates `users.locale` (already exists in schema)
3. Sets a `locale` cookie for next-intl to read
4. Calls `revalidatePath("/")` to refresh all pages

### String Length Strategy

Greek and Spanish strings tend to be 20-40% longer than English. For tight UI spaces:

| UI Element | Max Chars | Strategy |
|-----------|-----------|----------|
| Sidebar labels (collapsed tooltip) | Unlimited | Tooltip handles any length |
| Sidebar labels (expanded) | ~14 chars | Use short words, abbreviate if needed |
| Filter pills | ~10 chars | Short labels: "Όλα", "Πληρ.", "Αποστ." |
| Status badges | ~8 chars | Uppercase abbreviations |
| Button text | ~15 chars | Use `truncate` class as fallback |
| Mobile card labels | ~20 chars | Space is generous enough |
| PageHeader heading | ~25 chars | `truncate` already applied |

### Translation Notes

**Greek (el.json):**
- Navigation: Πίνακας (Dashboard), Τιμολόγια (Invoices), Δαπάνες (Expenses), Επαφές (Contacts), Προϊόντα (Products), Αναφορές (Reports), Ρυθμίσεις (Settings)
- Tax terms: ΑΦΜ (VAT number), ΔΟΥ (tax office), myDATA (keep as-is)
- Number format: `1.234,56 €` (dot thousands, comma decimals)
- Date format: `12/04/2026` (DD/MM/YYYY)

**Spanish (es.json):**
- Navigation: Panel (Dashboard), Facturas (Invoices), Gastos (Expenses), Contactos (Contacts), Productos (Products), Informes (Reports), Configuración (Settings)
- Latin American Spanish for broader reach
- Number format: `1.234,56 €`
- Date format: `12/04/2026`

---

## 2. Card-Based Mobile Lists

### Pattern

Each list page renders separate mobile/desktop components:

```tsx
{/* Desktop: table */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile: card list */}
<div className="block md:hidden space-y-3">
  {items.map(item => <MobileCard key={item.id} item={item} />)}
</div>
```

### Card Design

```
┌─────────────────────────────────────┐
│ INV-0042              €1,234.56 EUR │  ← number (mono) + amount (right, bold)
│ Acme Corporation                    │  ← contact name
│ 12/04/2026        [PAID]            │  ← date + status badge
└─────────────────────────────────────┘
```

- Card: `bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors`
- Entire card is a `<Link>` to detail view
- Row 1: Invoice number (`font-mono text-sm`) + amount (`font-label text-lg font-bold`, right-aligned)
- Row 2: Contact name (`text-sm text-on-surface`)
- Row 3: Date (`text-xs text-on-surface-variant`) + status badge (right-aligned)

### Pages to Update

| Page | Card Content |
|------|-------------|
| Invoices | Number, client, date, total, status, myDATA icon |
| Expenses | Number, supplier, date, total, status |
| Contacts | Name, type badge, email, phone |
| Quotes | Number, client, date, total, status |
| Recurring Invoices | Client, frequency, next date, status |
| Recurring Expenses | Description, frequency, next date, status |

---

## 3. AI Chat Bottom Sheet on Mobile

### Current State

`AiChatPanel` uses `Sheet side="right"` with `sm:max-w-[420px]`. On mobile this becomes full-width which works but a bottom sheet is more natural.

### Change

Make the Sheet side responsive — bottom on mobile, right on desktop:

```tsx
const isMobile = useIsMobile();

<Sheet open={isOpen} onOpenChange={...}>
  <SheetContent
    side={isMobile ? "bottom" : "right"}
    className={cn(
      "border-on-surface/10 bg-surface-container/90 p-0 backdrop-blur-[24px]",
      isMobile
        ? "h-[80vh] rounded-t-2xl"
        : "w-full border-l sm:max-w-[420px]"
    )}
  >
    ...
  </SheetContent>
</Sheet>
```

The `useIsMobile()` hook already exists at `apps/web/hooks/use-mobile.ts`.

### AI Chat Button Position

Currently `bottom-20 right-4 md:bottom-6`. On mobile, it needs to clear the bottom nav (64px + gap). Current positioning already handles this with `bottom-20` (80px) on mobile.

No changes needed to the button.

---

## 4. E2E Test Updates

### Updates to `e2e/09-settings.spec.ts`

- Update assertions that check for breadcrumb elements (removed)
- Verify PageHeader heading text instead
- Test mobile settings card list at 375px viewport (if feasible)

### New Assertions

- Verify locale selector in General settings renders language options
- Verify mobile card rendering at narrow viewport
- Verify AI chat opens as bottom sheet on mobile viewport

---

## 5. Acceptance Criteria

1. `messages/el.json` contains full Greek translations for all 25 sections
2. `messages/es.json` contains full Spanish translations for all 25 sections
3. Changing language in General settings switches all UI text
4. Locale persists across page navigation (cookie-based)
5. Greek/Spanish strings fit in all UI elements at 375px mobile width
6. Invoice, expense, contact, quote, recurring, recurring-expense lists show card layout on mobile
7. Mobile cards are tappable links to detail views
8. AI chat opens as bottom sheet on mobile, side panel on desktop
9. E2E settings tests pass with new PageHeader structure
10. Build succeeds, all tests pass, format/lint clean
