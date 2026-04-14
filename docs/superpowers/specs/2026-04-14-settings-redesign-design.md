# Settings Redesign — Design Spec

**Goal:** Replace the disconnected settings pages (3 separate sidebar links) with a unified Settings section featuring a vertical secondary nav, organized tabs for Organisation/User/Integrations, and full mobile support.

**Scope:** Settings layout, navigation restructure, new User settings tabs (General, Account, Appearance), Integrations sub-view pattern, sidebar + mobile nav updates.

---

## 1. Navigation Changes

### Sidebar (`app-sidebar.tsx`)

- Add "Settings" as a regular nav item in the main `navItems` array (after Reports), using icon `settings`
- Links to `/settings/organisation`
- Remove all 3 footer links (Settings, myDATA, AI)
- Footer keeps only the "New Invoice" CTA button

### Mobile Nav (`mobile-nav.tsx`)

Current mobile bottom bar has 6 items and no access to Settings. With Settings as item 7, the bar is too crowded.

**Solution:** Replace the last slot (Reports) with a "More" menu that contains both Reports and Settings. The "More" menu opens a glassmorphic bottom sheet overlay with the remaining nav items.

**"More" bottom sheet visual treatment:**
- Background: `bg-surface-container/70 backdrop-blur-[24px]` (matching main sidebar glass effect)
- Ghost border: `border-t border-outline-variant/15`
- Entrance animation: slide-up with `transition-transform duration-300 ease-out`
- Backdrop: semi-transparent overlay `bg-black/40` that dismisses on tap
- Items inside use the same icon + label styling as the bottom bar items

Mobile nav items become:
1. Dashboard
2. Invoices
3. Expenses
4. Contacts
5. Products
6. More → { Reports, Settings }

---

## 2. Settings Layout

### Route Structure

```
app/(app)/settings/
├── layout.tsx              # Settings shell: secondary sidebar + content area
├── page.tsx                # Redirects to /settings/organisation
├── organisation/
│   └── page.tsx            # Existing company form (renamed from "company")
├── general/
│   └── page.tsx            # Language, date format, notification prefs
├── account/
│   └── page.tsx            # Name, email, avatar, password
├── appearance/
│   └── page.tsx            # Theme toggle, density, sidebar prefs
└── integrations/
    ├── page.tsx            # Integration cards list
    ├── mydata/
    │   └── page.tsx        # myDATA config (existing form, relocated)
    └── ai/
        └── page.tsx        # AI config (existing form, relocated)
```

### Settings Layout Component (`settings/layout.tsx`)

**Desktop (md+):** Two-column layout
- Left: 220px secondary nav panel on `surface-container` background — one step above the page floor (`surface-dim`), visually distinct from the main glassmorphic sidebar without needing a border
- Right: Scrollable content area
- The secondary nav is NOT the main app sidebar — it's an inner nav within the settings content area

**Mobile (<md):** Secondary nav collapses to a horizontal scrollable tab bar pinned to the top of the settings content area. Each tab is a pill-shaped link. A subtle gradient fade on the right edge (from `surface-dim` to transparent, ~32px wide) serves as a scroll affordance to signal more tabs off-screen.

### Secondary Nav Items

Grouped visually with small uppercase section headers (`font-label text-xs uppercase tracking-widest text-on-surface-variant`):

**Organisation**
- Organisation (icon: `business`)

**User**
- General (icon: `tune`)
- Account (icon: `person`)
- Appearance (icon: `palette`)

**Integrations**
- Integrations (icon: `extension`)

Active state: `bg-surface-container-high text-primary` with a 2px left border in `primary` (matching the main sidebar convention from DESIGN.md). Hover state: `bg-surface-container-high/50 text-on-surface` — one-step tonal lift with smooth `transition-colors duration-200`.

---

## 3. Tab: Organisation

Rename from "Company" to "Organisation" for consistency with the codebase terminology (`organisations` table, `org` in session).

**Content:** Existing `CompanyForm` component — no functional changes needed, just relocated from `/settings/company` to `/settings/organisation`.

**Access:** All authenticated users.

---

## 4. Tab: General (User Preferences)

New page for user-level preferences.

### Fields

| Field | Type | Options | Default |
|-------|------|---------|---------|
| Language | Select | English, Greek (from existing i18n) | Browser locale |
| Date format | Select | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD | DD/MM/YYYY |
| Number format | Select | 1.234,56 (EU) / 1,234.56 (US) | EU |
| Notifications | Toggles | Email on invoice paid, Email on expense approved | All on |

### Storage

User preferences need a new `user_preferences` table in `packages/db`:

```typescript
export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  locale: text("locale").notNull().default("en"),
  dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
  numberFormat: text("number_format").notNull().default("eu"),
  notifyInvoicePaid: boolean("notify_invoice_paid").notNull().default(true),
  notifyExpenseApproved: boolean("notify_expense_approved").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Server Action

`apps/web/app/(app)/settings/general/actions.ts` — `updateUserPreferences(formData)` scoped to `session.user.id`.

---

## 5. Tab: Account

User profile and security settings.

### Sections

**Profile**
- Name (text input, pre-filled from session)
- Email (text input, pre-filled — changing email should require verification)
- Avatar (upload placeholder, like the branding logo placeholder)

**Security**
- Change password form: current password, new password, confirm new password
- Uses Better Auth's password change API

### Storage

Profile fields already exist on the `users` table (Better Auth manages `name`, `email`, `image`). No new tables needed — server actions call Better Auth's update APIs.

### Server Actions

`apps/web/app/(app)/settings/account/actions.ts`:
- `updateProfile(formData)` — updates name, email via Better Auth
- `changePassword(formData)` — current + new password via Better Auth

---

## 6. Tab: Appearance

Visual preferences for the user.

### Sections

**Theme**
- Three-option selector (card-style, not a dropdown): Dark, Light, System
- **Dark** is the only enabled option. Light and System cards are visually present but disabled with `opacity-60` and `cursor-not-allowed`
- Disabled cards show a "Coming soon" badge using the pending badge palette: `secondary-container` background with `secondary` text (not error styling — this reads as "planned, not broken")
- Dark card shows a checkmark icon and `primary` accent ring (`ring-2 ring-primary`)

**Display Density**
- Two-option selector: Comfortable (default), Compact
- Each option card contains a **mini schematic preview** — 3 small rectangles stacked vertically with the actual spacing values applied (wider gaps for Comfortable, tighter for Compact). This makes the choice self-explanatory without needing to try both.
- Comfortable: standard padding (`p-6` cards, `space-y-6` gaps)
- Compact: tighter padding (`p-4` cards, `space-y-4` gaps)
- Stored in `user_preferences` table (add `density` column: `text("density").notNull().default("comfortable")`)

### Storage

Add to `user_preferences` table:

```typescript
theme: text("theme").notNull().default("dark"),
density: text("density").notNull().default("comfortable"),
```

Theme is stored but only "dark" is functional. The column exists so the preference persists when light mode ships later.

---

## 7. Tab: Integrations

Card-based list with drill-down sub-views.

### Integration Cards List (`/settings/integrations`)

Each integration renders as a card on `surface-container` with:
- Icon (left)
- Name + one-line description (center)
- Status badge (right): "Connected" (green) or "Not configured" (muted)
- Chevron icon indicating it's clickable

**Hover interaction:** Card background lifts to `surface-container-high` with `transition-colors duration-200`. The chevron icon shifts right by 2px on hover (`translate-x-0.5 transition-transform`) for a subtle directional cue.

Cards are `Link` components to `/settings/integrations/[slug]`.

### Visible Cards

| Card | Slug | Visibility | Access |
|------|------|------------|--------|
| myDATA (AADE) | `mydata` | `org.countryCode === "GR"` only | owner/admin |
| AI Assistant | `ai` | All orgs | owner/admin |

### Sub-View Pattern (`/settings/integrations/mydata`, `/settings/integrations/ai`)

Each sub-view page:
- Shows a back link ("← Integrations") at the top, linking to `/settings/integrations`
- Renders the existing form component (`MyDataSettingsForm`, `AiSettingsForm`)
- The secondary settings nav still highlights "Integrations" as active

### Conditional Rendering

The myDATA card and route are gated server-side. If a non-GR org navigates to `/settings/integrations/mydata`, redirect to `/settings/integrations`.

The AI route is gated to owner/admin. If a non-owner navigates to `/settings/integrations/ai`, redirect to `/settings/integrations`.

---

## 8. Redirects & Backward Compatibility

| Old Route | New Route | Method |
|-----------|-----------|--------|
| `/settings` | `/settings/organisation` | Root `page.tsx` does `redirect()` |
| `/settings/company` | `/settings/organisation` | Next.js `redirects` in `next.config` |
| `/settings/mydata` | `/settings/integrations/mydata` | Next.js `redirects` in `next.config` |
| `/settings/ai` | `/settings/integrations/ai` | Next.js `redirects` in `next.config` |

---

## 9. UI Components

### `SettingsNav` (new)

Client component using `usePathname()` to highlight the active tab.

**Desktop:** Renders as a vertical list in the left panel of the settings layout. Section headers group the items.

**Mobile:** Renders as a horizontal scrollable row of pill-shaped links. Section headers are omitted for space — all items are flat.

### `IntegrationCard` (new)

Reusable card for the integrations list. Props:

```typescript
interface IntegrationCardProps {
  icon: string;           // Material Symbols icon name
  name: string;
  description: string;
  href: string;
  status: "connected" | "not_configured";
}
```

### `SettingsSection` (new)

Wrapper for form sections within a settings tab. Consistent card styling:

```typescript
interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}
```

Renders: `surface-container-low` background, `rounded-2xl`, `p-6`, section heading in `font-headline`.

---

## 10. Design System Compliance

All new UI follows DESIGN.md rules:

- No opaque borders — tonal surface shifts for separation
- Secondary nav uses `surface-container` with `surface-container-high` for active/hover — distinct from both the glassmorphic main sidebar and the page floor
- Cards use `surface-container` with `rounded-xl` and `p-6`, hover lifts to `surface-container-high`
- Active nav indicator: 2px left border in `primary`
- Theme selector cards: disabled cards use `opacity-60` + `cursor-not-allowed` + "Coming soon" badge in `secondary-container`/`secondary` (pending palette)
- Status badges follow the `.status-badge` pattern from DESIGN.md
- Mobile "More" bottom sheet uses glassmorphic treatment matching the main sidebar
- Typography: headings in `font-headline`, labels in `font-label`, body in `font-body`
- Gradient CTA reserved for the main sidebar "New Invoice" button — settings uses standard primary buttons

---

## 11. Mobile Behavior Summary

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Main nav | Sidebar with Settings item | Bottom bar with "More" menu |
| Settings nav | Vertical left panel (220px) | Horizontal scrollable pills |
| Integration cards | 2-column grid | Single column stack |
| Integration sub-view | Same content area | Full-width with back link |
| Forms | `max-w-3xl` centered | Full-width with `px-4` padding |

---

## 12. Database Migration

One new table and one column addition:

```sql
-- New table
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en',
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  number_format TEXT NOT NULL DEFAULT 'eu',
  notify_invoice_paid BOOLEAN NOT NULL DEFAULT true,
  notify_expense_approved BOOLEAN NOT NULL DEFAULT true,
  theme TEXT NOT NULL DEFAULT 'dark',
  density TEXT NOT NULL DEFAULT 'comfortable',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

No changes to existing tables.

---

## 13. Acceptance Criteria

1. Navigating to `/settings` redirects to `/settings/organisation`
2. Old routes (`/settings/company`, `/settings/mydata`, `/settings/ai`) redirect to new locations
3. Settings secondary nav highlights the active tab correctly
4. Mobile: Settings accessible via "More" menu in bottom nav
5. Mobile: Settings nav renders as horizontal scrollable pills
6. Organisation tab shows the existing company form, no regressions
7. General tab saves and loads user preferences (locale, date format, number format, notifications)
8. Account tab allows name/email edit and password change
9. Appearance tab shows theme selector with Light/System disabled + "Coming soon" badge
10. Appearance tab density toggle works and persists
11. Integrations tab shows integration cards with correct visibility gating (myDATA for GR only)
12. Clicking an integration card navigates to the sub-view with back link
13. Integration sub-views render existing forms without regressions
14. All pages pass responsive checks at 375px, 768px, and 1280px widths
15. E2E tests updated for new routes
