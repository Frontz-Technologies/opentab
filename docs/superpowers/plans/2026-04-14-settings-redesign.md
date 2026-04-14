# Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 disconnected settings pages with a unified Settings section — vertical secondary nav, 5 organized tabs (Organisation, General, Account, Appearance, Integrations), mobile "More" menu, and full responsive support.

**Architecture:** New `settings/layout.tsx` renders a two-column shell (secondary nav + content). User preferences stored in a new `user_preferences` table. Existing forms (CompanyForm, MyDataSettingsForm, AiSettingsForm) relocate into the new route structure. Mobile nav gains a "More" bottom sheet using the existing Sheet component. Old routes redirect via `next.config.ts`.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, @base-ui/react (Sheet), next-intl, Tailwind CSS v4, Vitest + PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-14-settings-redesign-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/db/src/schema/user-preferences.ts` | Drizzle schema for `user_preferences` table |
| `packages/db/src/__tests__/user-preferences.test.ts` | Schema integration tests |
| `apps/web/app/(app)/settings/layout.tsx` | Settings shell: secondary nav + content area |
| `apps/web/app/(app)/settings/page.tsx` | Redirect to `/settings/organisation` |
| `apps/web/app/(app)/settings/organisation/page.tsx` | Organisation settings (relocated CompanyForm) |
| `apps/web/app/(app)/settings/general/page.tsx` | User preferences form |
| `apps/web/app/(app)/settings/general/actions.ts` | Server actions for user preferences |
| `apps/web/app/(app)/settings/general/general-form.tsx` | General preferences form component |
| `apps/web/app/(app)/settings/account/page.tsx` | Account settings (profile + password) |
| `apps/web/app/(app)/settings/account/actions.ts` | Server actions for profile + password |
| `apps/web/app/(app)/settings/account/account-form.tsx` | Account form component |
| `apps/web/app/(app)/settings/appearance/page.tsx` | Appearance settings (theme + density) |
| `apps/web/app/(app)/settings/appearance/actions.ts` | Server actions for appearance prefs |
| `apps/web/app/(app)/settings/appearance/appearance-form.tsx` | Appearance form component |
| `apps/web/app/(app)/settings/integrations/page.tsx` | Integration cards list |
| `apps/web/app/(app)/settings/integrations/mydata/page.tsx` | myDATA sub-view (relocated) |
| `apps/web/app/(app)/settings/integrations/ai/page.tsx` | AI sub-view (relocated) |
| `apps/web/components/settings/settings-nav.tsx` | Secondary nav component (desktop vertical + mobile horizontal) |
| `apps/web/components/settings/integration-card.tsx` | Reusable integration card component |
| `apps/web/components/settings/settings-section.tsx` | Reusable form section wrapper |
| `apps/web/components/layout/mobile-more-sheet.tsx` | "More" bottom sheet for mobile nav |
| `apps/web/lib/actions/user-preferences.ts` | Shared user preferences query helpers |

### Modified Files

| File | Changes |
|------|---------|
| `packages/db/src/schema/index.ts` | Export `userPreferences` schema |
| `apps/web/components/layout/app-sidebar.tsx` | Add Settings to main nav, remove 3 footer links |
| `apps/web/components/layout/mobile-nav.tsx` | Replace Reports with "More" trigger |
| `apps/web/next.config.ts` | Add redirects for old routes |
| `apps/web/messages/en.json` | Add new translation keys |
| `apps/web/lib/session.ts` | Add user preferences to session context |
| `e2e/09-settings.spec.ts` | Update for new routes and structure |

### Deleted Files

| File | Reason |
|------|--------|
| `apps/web/app/(app)/settings/company/page.tsx` | Replaced by `/settings/organisation/page.tsx` |
| `apps/web/app/(app)/settings/company/company-form.tsx` | Moved to `/settings/organisation/` |
| `apps/web/app/(app)/settings/company/actions.ts` | Moved to `/settings/organisation/` |
| `apps/web/app/(app)/settings/ai/page.tsx` | Replaced by `/settings/integrations/ai/page.tsx` |
| `apps/web/app/(app)/settings/mydata/page.tsx` | Replaced by `/settings/integrations/mydata/page.tsx` |
| `apps/web/app/(app)/settings/mydata/mydata-settings-form.tsx` | Moved to `/settings/integrations/mydata/` |
| `apps/web/app/(app)/settings/mydata/actions.ts` | Moved to `/settings/integrations/mydata/` |

---

## Task 1: User Preferences Schema

**Files:**
- Create: `packages/db/src/schema/user-preferences.ts`
- Modify: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/user-preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/__tests__/user-preferences.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, teardownTestDb, type TestDb } from "../test-utils";
import { userPreferences } from "../schema/user-preferences";
import { users } from "../schema/users";

describe("user_preferences", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("creates preferences for a user with defaults", async () => {
    // Create a user first
    const [user] = await db.client
      .insert(users)
      .values({
        id: "test-user-prefs-1",
        email: "prefs@test.com",
        name: "Test User",
      })
      .returning();

    const [prefs] = await db.client
      .insert(userPreferences)
      .values({ userId: user.id })
      .returning();

    expect(prefs.locale).toBe("en");
    expect(prefs.dateFormat).toBe("DD/MM/YYYY");
    expect(prefs.numberFormat).toBe("eu");
    expect(prefs.theme).toBe("dark");
    expect(prefs.density).toBe("comfortable");
    expect(prefs.notifyInvoicePaid).toBe(true);
    expect(prefs.notifyExpenseApproved).toBe(true);
  });

  it("enforces unique user_id constraint", async () => {
    const [user] = await db.client
      .insert(users)
      .values({
        id: "test-user-prefs-2",
        email: "prefs2@test.com",
        name: "Test User 2",
      })
      .returning();

    await db.client.insert(userPreferences).values({ userId: user.id });

    await expect(
      db.client.insert(userPreferences).values({ userId: user.id }),
    ).rejects.toThrow();
  });

  it("cascades delete when user is deleted", async () => {
    const [user] = await db.client
      .insert(users)
      .values({
        id: "test-user-prefs-3",
        email: "prefs3@test.com",
        name: "Test User 3",
      })
      .returning();

    await db.client.insert(userPreferences).values({ userId: user.id });
    await db.client.delete(users).where(eq(users.id, user.id));

    const remaining = await db.client
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id));

    expect(remaining).toHaveLength(0);
  });

  it("updates preferences", async () => {
    const [user] = await db.client
      .insert(users)
      .values({
        id: "test-user-prefs-4",
        email: "prefs4@test.com",
        name: "Test User 4",
      })
      .returning();

    await db.client.insert(userPreferences).values({ userId: user.id });

    const [updated] = await db.client
      .update(userPreferences)
      .set({ locale: "el", theme: "dark", density: "compact" })
      .where(eq(userPreferences.userId, user.id))
      .returning();

    expect(updated.locale).toBe("el");
    expect(updated.density).toBe("compact");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/claude/repos/opentab && pnpm test --filter=db -- --run user-preferences`
Expected: FAIL — module `../schema/user-preferences` not found

- [ ] **Step 3: Create the schema**

Create `packages/db/src/schema/user-preferences.ts`:

```typescript
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 5 }).notNull().default("en"),
    dateFormat: varchar("date_format", { length: 20 })
      .notNull()
      .default("DD/MM/YYYY"),
    numberFormat: varchar("number_format", { length: 10 })
      .notNull()
      .default("eu"),
    notifyInvoicePaid: boolean("notify_invoice_paid").notNull().default(true),
    notifyExpenseApproved: boolean("notify_expense_approved")
      .notNull()
      .default(true),
    theme: varchar("theme", { length: 20 }).notNull().default("dark"),
    density: varchar("density", { length: 20 }).notNull().default("comfortable"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_preferences_user_id_idx").on(table.userId)],
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
```

- [ ] **Step 4: Export from schema index**

Add to the end of `packages/db/src/schema/index.ts`:

```typescript
export {
  userPreferences,
  type UserPreferences,
  type NewUserPreferences,
} from "./user-preferences";
```

- [ ] **Step 5: Generate migration**

Run: `cd /home/claude/repos/opentab && pnpm db:generate`
Expected: New migration file created in `packages/db/drizzle/`

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /home/claude/repos/opentab && pnpm test --filter=db -- --run user-preferences`
Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/user-preferences.ts packages/db/src/schema/index.ts packages/db/src/__tests__/user-preferences.test.ts packages/db/drizzle/
git commit -m "feat: add user_preferences schema with migration"
```

---

## Task 2: Translation Keys

**Files:**
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add new translation keys**

Add the following keys to `apps/web/messages/en.json`. Insert after the existing `"settingsAi"` block:

```json
"settingsNav": {
  "organisation": "Organisation",
  "general": "General",
  "account": "Account",
  "appearance": "Appearance",
  "integrations": "Integrations",
  "sectionOrganisation": "Organisation",
  "sectionUser": "User",
  "sectionIntegrations": "Integrations"
},
"settingsGeneral": {
  "title": "General",
  "description": "Language, date formatting, and notification preferences.",
  "language": "Language",
  "languageEn": "English",
  "languageEl": "Greek",
  "dateFormat": "Date format",
  "numberFormat": "Number format",
  "numberFormatEu": "1.234,56 (European)",
  "numberFormatUs": "1,234.56 (US)",
  "notifications": "Notifications",
  "notifyInvoicePaid": "Email when an invoice is paid",
  "notifyExpenseApproved": "Email when an expense is approved",
  "saved": "Preferences saved"
},
"settingsAccount": {
  "title": "Account",
  "description": "Your profile and security settings.",
  "profile": "Profile",
  "name": "Full name",
  "email": "Email address",
  "emailHint": "Changing your email requires verification",
  "avatar": "Avatar",
  "avatarPlaceholder": "Avatar upload coming soon",
  "security": "Security",
  "currentPassword": "Current password",
  "newPassword": "New password",
  "confirmPassword": "Confirm new password",
  "changePassword": "Change password",
  "passwordChanged": "Password changed successfully",
  "passwordMismatch": "Passwords do not match",
  "wrongPassword": "Current password is incorrect",
  "profileSaved": "Profile updated"
},
"settingsAppearance": {
  "title": "Appearance",
  "description": "Customise how OpenTab looks.",
  "theme": "Theme",
  "themeDark": "Dark",
  "themeLight": "Light",
  "themeSystem": "System",
  "density": "Display Density",
  "densityComfortable": "Comfortable",
  "densityComfortableDesc": "Default spacing with generous padding",
  "densityCompact": "Compact",
  "densityCompactDesc": "Tighter spacing for more content on screen",
  "saved": "Appearance saved"
},
"settingsIntegrations": {
  "title": "Integrations",
  "description": "Connect external services to your organisation.",
  "backToIntegrations": "Integrations",
  "mydataName": "myDATA (AADE)",
  "mydataDescription": "Greek e-invoicing — transmit invoices to AADE automatically",
  "aiName": "AI Assistant",
  "aiDescription": "AI-powered financial insights and chat assistant",
  "connected": "Connected",
  "notConfigured": "Not configured"
},
"mobileNav": {
  "more": "More"
}
```

Also update the `"nav"` object — add `"more": "More"` and `"organisation": "Organisation"`:

```json
"nav": {
  "dashboard": "Dashboard",
  "invoices": "Invoices",
  "expenses": "Expenses",
  "contacts": "Contacts",
  "products": "Products",
  "reports": "Reports",
  "settings": "Settings",
  "ai": "AI",
  "support": "Support",
  "createNew": "Create New",
  "more": "More",
  "organisation": "Organisation"
}
```

- [ ] **Step 2: Verify translations compile**

Run: `cd /home/claude/repos/opentab && pnpm build --filter=web 2>&1 | head -20`
Expected: Build starts without i18n errors (can cancel after confirming no parse errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/en.json
git commit -m "feat: add translation keys for settings redesign"
```

---

## Task 3: Settings Nav Component

**Files:**
- Create: `apps/web/components/settings/settings-nav.tsx`

- [ ] **Step 1: Create the SettingsNav component**

Create `apps/web/components/settings/settings-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
  icon: string;
  labelKey: string;
  href: string;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    titleKey: "sectionOrganisation",
    items: [
      { icon: "business", labelKey: "organisation", href: "/settings/organisation" },
    ],
  },
  {
    titleKey: "sectionUser",
    items: [
      { icon: "tune", labelKey: "general", href: "/settings/general" },
      { icon: "person", labelKey: "account", href: "/settings/account" },
      { icon: "palette", labelKey: "appearance", href: "/settings/appearance" },
    ],
  },
  {
    titleKey: "sectionIntegrations",
    items: [
      { icon: "extension", labelKey: "integrations", href: "/settings/integrations" },
    ],
  },
];

const allItems = sections.flatMap((s) => s.items);

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("settingsNav");

  function isActive(href: string) {
    if (href === "/settings/integrations") {
      return pathname.startsWith("/settings/integrations");
    }
    return pathname === href;
  }

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:flex flex-col w-[220px] flex-shrink-0 bg-surface-container rounded-xl p-3 space-y-4 h-fit sticky top-8">
        {sections.map((section) => (
          <div key={section.titleKey}>
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant px-3 mb-1.5">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                        active
                          ? "bg-surface-container-high text-primary font-semibold border-l-2 border-primary"
                          : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px] leading-none">
                        {item.icon}
                      </span>
                      <span className="font-label">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile: horizontal scrollable pills */}
      <nav className="md:hidden relative">
        <div className="flex gap-2 overflow-x-auto pb-4 px-4 scrollbar-hide">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 ${
                  active
                    ? "bg-surface-container-high text-primary font-semibold"
                    : "bg-surface-container text-on-surface/60 hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">
                  {item.icon}
                </span>
                <span className="font-label">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
        {/* Right-edge gradient fade scroll affordance */}
        <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-surface-dim to-transparent pointer-events-none" />
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/settings/settings-nav.tsx
git commit -m "feat: add SettingsNav component with desktop/mobile variants"
```

---

## Task 4: Settings Section & Integration Card Components

**Files:**
- Create: `apps/web/components/settings/settings-section.tsx`
- Create: `apps/web/components/settings/integration-card.tsx`

- [ ] **Step 1: Create SettingsSection**

Create `apps/web/components/settings/settings-section.tsx`:

```tsx
interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="bg-surface-container-low rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="font-headline text-lg font-bold text-on-surface">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-on-surface-variant mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create IntegrationCard**

Create `apps/web/components/settings/integration-card.tsx`:

```tsx
import Link from "next/link";

interface IntegrationCardProps {
  icon: string;
  name: string;
  description: string;
  href: string;
  status: "connected" | "not_configured";
  statusLabels: { connected: string; notConfigured: string };
}

export function IntegrationCard({
  icon,
  name,
  description,
  href,
  status,
  statusLabels,
}: IntegrationCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors duration-200"
    >
      <div className="flex-shrink-0 size-10 rounded-lg bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-[22px] text-on-surface-variant">
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-label text-sm font-semibold text-on-surface">
          {name}
        </p>
        <p className="text-xs text-on-surface-variant truncate">{description}</p>
      </div>
      <span
        className={`flex-shrink-0 font-label text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
          status === "connected"
            ? "bg-primary-container/20 text-primary"
            : "bg-surface-container-highest text-on-surface-variant"
        }`}
      >
        {status === "connected"
          ? statusLabels.connected
          : statusLabels.notConfigured}
      </span>
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform duration-200">
        chevron_right
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/settings-section.tsx apps/web/components/settings/integration-card.tsx
git commit -m "feat: add SettingsSection and IntegrationCard components"
```

---

## Task 5: Settings Layout & Root Redirect

**Files:**
- Modify: `apps/web/app/(app)/settings/layout.tsx`
- Create: `apps/web/app/(app)/settings/page.tsx`

- [ ] **Step 1: Rewrite the settings layout**

Replace the contents of `apps/web/app/(app)/settings/layout.tsx`:

```tsx
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create root redirect page**

Create `apps/web/app/(app)/settings/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/organisation");
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/settings/layout.tsx apps/web/app/(app)/settings/page.tsx
git commit -m "feat: add settings layout with secondary nav and root redirect"
```

---

## Task 6: Organisation Tab (Relocate Company Settings)

**Files:**
- Create: `apps/web/app/(app)/settings/organisation/page.tsx`
- Move: `apps/web/app/(app)/settings/company/company-form.tsx` → `apps/web/app/(app)/settings/organisation/company-form.tsx`
- Move: `apps/web/app/(app)/settings/company/actions.ts` → `apps/web/app/(app)/settings/organisation/actions.ts`
- Delete: `apps/web/app/(app)/settings/company/page.tsx`

- [ ] **Step 1: Create the organisation directory and move files**

```bash
cd /home/claude/repos/opentab/apps/web/app/\(app\)/settings
mkdir -p organisation
cp company/company-form.tsx organisation/company-form.tsx
cp company/actions.ts organisation/actions.ts
```

- [ ] **Step 2: Create the organisation page**

Create `apps/web/app/(app)/settings/organisation/page.tsx`:

```tsx
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { CompanyForm } from "./company-form";

export default async function OrganisationSettingsPage() {
  const session = (await getSession())!;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Organisation" },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-8">
          Organisation Settings
        </h2>
        <CompanyForm
          initialData={{
            name: session.org.name,
            defaultCurrency: session.org.defaultCurrency,
            fiscalYearStart: session.org.fiscalYearStart,
            taxId: session.org.taxId ?? "",
            taxAuthority: session.org.taxAuthority ?? "",
            country: session.org.countryCode ?? "",
            addressLine1: session.org.addressLine1 ?? "",
            addressLine2: session.org.addressLine2 ?? "",
            city: session.org.city ?? "",
            postalCode: session.org.postalCode ?? "",
            region: session.org.region ?? "",
            phone: session.org.phone ?? "",
          }}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 3: Delete old company directory**

```bash
rm -rf apps/web/app/\(app\)/settings/company
```

- [ ] **Step 4: Verify the import path in company-form.tsx**

The `company-form.tsx` imports `./actions` which remains a sibling — no import changes needed. Verify:

Run: `cd /home/claude/repos/opentab && grep "from \"\./actions\"" apps/web/app/\(app\)/settings/organisation/company-form.tsx`
Expected: `import { updateCompanySettings } from "./actions";`

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/settings/organisation/ 
git rm -r apps/web/app/\(app\)/settings/company/
git commit -m "feat: relocate company settings to /settings/organisation"
```

---

## Task 7: Integrations Tab (Relocate myDATA & AI)

**Files:**
- Create: `apps/web/app/(app)/settings/integrations/page.tsx`
- Create: `apps/web/app/(app)/settings/integrations/mydata/page.tsx`
- Create: `apps/web/app/(app)/settings/integrations/ai/page.tsx`
- Move: existing mydata form + actions to new location
- Move: existing ai-settings-form to new location
- Delete: old `settings/mydata/` and `settings/ai/` directories

- [ ] **Step 1: Create integrations directory structure and move files**

```bash
cd /home/claude/repos/opentab/apps/web/app/\(app\)/settings
mkdir -p integrations/mydata integrations/ai
cp mydata/mydata-settings-form.tsx integrations/mydata/mydata-settings-form.tsx
cp mydata/actions.ts integrations/mydata/actions.ts
```

- [ ] **Step 2: Create integrations list page**

Create `apps/web/app/(app)/settings/integrations/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { IntegrationCard } from "@/components/settings/integration-card";
import { getMyDataCredentialsStatus } from "./mydata/actions";
import { getAiSettings } from "@/lib/actions/ai-settings";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsIntegrations");
  const isGreek = session.org.countryCode === "GR";
  const isOwnerOrAdmin =
    session.role === "owner" || session.role === "admin";

  // Fetch statuses in parallel
  const [mydataCredentials, aiSettings] = await Promise.all([
    isGreek ? getMyDataCredentialsStatus() : null,
    isOwnerOrAdmin ? getAiSettings(session.org.id) : null,
  ]);

  const statusLabels = {
    connected: t("connected"),
    notConfigured: t("notConfigured"),
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <div className="space-y-3">
          {isGreek && (
            <IntegrationCard
              icon="cloud_sync"
              name={t("mydataName")}
              description={t("mydataDescription")}
              href="/settings/integrations/mydata"
              status={mydataCredentials ? "connected" : "not_configured"}
              statusLabels={statusLabels}
            />
          )}
          {isOwnerOrAdmin && (
            <IntegrationCard
              icon="smart_toy"
              name={t("aiName")}
              description={t("aiDescription")}
              href="/settings/integrations/ai"
              status={
                aiSettings?.enabled ? "connected" : "not_configured"
              }
              statusLabels={statusLabels}
            />
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create myDATA sub-view page**

Create `apps/web/app/(app)/settings/integrations/mydata/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { MyDataSettingsForm } from "./mydata-settings-form";
import { getMyDataCredentialsStatus } from "./actions";
import Link from "next/link";

export default async function MyDataIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.org.countryCode !== "GR") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("mydata");
  const tInt = await getTranslations("settingsIntegrations");
  const credentials = await getMyDataCredentialsStatus();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: tInt("title"), href: "/settings/integrations" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          {tInt("backToIntegrations")}
        </Link>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-on-surface/60 text-sm mb-8">{t("description")}</p>
        <MyDataSettingsForm credentials={credentials} />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Create AI sub-view page**

Create `apps/web/app/(app)/settings/integrations/ai/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TopBar } from "@/components/layout/top-bar";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import { getAiSettings } from "@/lib/actions/ai-settings";
import Link from "next/link";

export default async function AiIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "admin") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("settingsAi");
  const tInt = await getTranslations("settingsIntegrations");
  const settings = await getAiSettings(session.org.id);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: tInt("title"), href: "/settings/integrations" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          {tInt("backToIntegrations")}
        </Link>
        <h2 className="mb-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          {t("title")}
        </h2>
        <p className="mb-8 text-sm text-on-surface/60">{t("description")}</p>
        <AiSettingsForm
          orgId={session.org.id}
          initialData={
            settings ?? {
              enabled: false,
              model: "anthropic/claude-sonnet-4",
              apiKeyLast4: null,
              hasApiKey: false,
            }
          }
        />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Delete old directories**

```bash
cd /home/claude/repos/opentab
rm -rf apps/web/app/\(app\)/settings/mydata
rm -rf apps/web/app/\(app\)/settings/ai
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/settings/integrations/
git rm -r apps/web/app/\(app\)/settings/mydata/ apps/web/app/\(app\)/settings/ai/
git commit -m "feat: relocate myDATA and AI settings to /settings/integrations"
```

---

## Task 8: User Preferences Helper & General Settings Tab

**Files:**
- Create: `apps/web/lib/actions/user-preferences.ts`
- Create: `apps/web/app/(app)/settings/general/page.tsx`
- Create: `apps/web/app/(app)/settings/general/general-form.tsx`
- Create: `apps/web/app/(app)/settings/general/actions.ts`

- [ ] **Step 1: Create user preferences query helper**

Create `apps/web/lib/actions/user-preferences.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@opentab/db";
import { getSession } from "@/lib/session";

export async function getUserPreferences() {
  const session = await getSession();
  if (!session) return null;

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id));

  return prefs ?? null;
}

export async function upsertUserPreferences(
  data: Partial<{
    locale: string;
    dateFormat: string;
    numberFormat: string;
    notifyInvoicePaid: boolean;
    notifyExpenseApproved: boolean;
    theme: string;
    density: string;
  }>,
) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id));

  if (existing) {
    const [updated] = await db
      .update(userPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPreferences.userId, session.user.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userPreferences)
    .values({ userId: session.user.id, ...data })
    .returning();
  return created;
}
```

- [ ] **Step 2: Create general settings server action**

Create `apps/web/app/(app)/settings/general/actions.ts`:

```typescript
"use server";

import { upsertUserPreferences } from "@/lib/actions/user-preferences";
import { revalidatePath } from "next/cache";

export async function updateGeneralSettings(formData: FormData) {
  await upsertUserPreferences({
    locale: formData.get("locale") as string,
    dateFormat: formData.get("dateFormat") as string,
    numberFormat: formData.get("numberFormat") as string,
    notifyInvoicePaid: formData.get("notifyInvoicePaid") === "on",
    notifyExpenseApproved: formData.get("notifyExpenseApproved") === "on",
  });

  revalidatePath("/settings/general");
}
```

- [ ] **Step 3: Create general form component**

Create `apps/web/app/(app)/settings/general/general-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateGeneralSettings } from "./actions";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

interface GeneralFormProps {
  initialData: {
    locale: string;
    dateFormat: string;
    numberFormat: string;
    notifyInvoicePaid: boolean;
    notifyExpenseApproved: boolean;
  };
}

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors appearance-none cursor-pointer";

export function GeneralForm({ initialData }: GeneralFormProps) {
  const t = useTranslations("settingsGeneral");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateGeneralSettings(formData);
      setToast(t("saved"));
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {toast && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium bg-primary/10 text-primary">
          {toast}
        </div>
      )}

      <SettingsSection title={t("language")}>
        <div className="relative">
          <select name="locale" className={inputClass} defaultValue={initialData.locale}>
            <option value="en">{t("languageEn")}</option>
            <option value="el">{t("languageEl")}</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("dateFormat")}>
        <div className="relative">
          <select name="dateFormat" className={inputClass} defaultValue={initialData.dateFormat}>
            {DATE_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("numberFormat")}>
        <div className="relative">
          <select name="numberFormat" className={inputClass} defaultValue={initialData.numberFormat}>
            <option value="eu">{t("numberFormatEu")}</option>
            <option value="us">{t("numberFormatUs")}</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
            expand_more
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={t("notifications")}>
        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer">
            <input
              name="notifyInvoicePaid"
              type="checkbox"
              defaultChecked={initialData.notifyInvoicePaid}
              className="accent-primary"
            />
            {t("notifyInvoicePaid")}
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface cursor-pointer">
            <input
              name="notifyExpenseApproved"
              type="checkbox"
              defaultChecked={initialData.notifyExpenseApproved}
              className="accent-primary"
            />
            {t("notifyExpenseApproved")}
          </label>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : tCommon("save")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create general settings page**

Create `apps/web/app/(app)/settings/general/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { GeneralForm } from "./general-form";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function GeneralSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsGeneral");
  const prefs = await getUserPreferences();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <GeneralForm
          initialData={{
            locale: prefs?.locale ?? "en",
            dateFormat: prefs?.dateFormat ?? "DD/MM/YYYY",
            numberFormat: prefs?.numberFormat ?? "eu",
            notifyInvoicePaid: prefs?.notifyInvoicePaid ?? true,
            notifyExpenseApproved: prefs?.notifyExpenseApproved ?? true,
          }}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/actions/user-preferences.ts apps/web/app/\(app\)/settings/general/
git commit -m "feat: add General settings tab with user preferences"
```

---

## Task 9: Account Settings Tab

**Files:**
- Create: `apps/web/app/(app)/settings/account/page.tsx`
- Create: `apps/web/app/(app)/settings/account/account-form.tsx`
- Create: `apps/web/app/(app)/settings/account/actions.ts`

- [ ] **Step 1: Create account server actions**

Create `apps/web/app/(app)/settings/account/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function updateProfile(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Name is required");

  await auth.api.updateUser({
    headers: await headers(),
    body: { name: name.trim() },
  });

  revalidatePath("/settings/account");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    return { success: false, error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "passwordMismatch" };
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: { currentPassword, newPassword },
    });
    revalidatePath("/settings/account");
    return { success: true };
  } catch {
    return { success: false, error: "wrongPassword" };
  }
}
```

- [ ] **Step 2: Create account form component**

Create `apps/web/app/(app)/settings/account/account-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateProfile, changePassword } from "./actions";

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors";

interface AccountFormProps {
  initialData: {
    name: string;
    email: string;
  };
}

export function AccountForm({ initialData }: AccountFormProps) {
  const t = useTranslations("settingsAccount");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile(formData);
        showToast("success", t("profileSaved"));
      } catch {
        showToast("error", "Failed to update profile");
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result.success) {
        showToast("success", t("passwordChanged"));
        e.currentTarget.reset();
      } else {
        showToast("error", t(result.error ?? "wrongPassword"));
      }
    });
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="space-y-8">
        <SettingsSection title={t("profile")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("name")}
              </label>
              <input
                type="text"
                name="name"
                className={inputClass}
                defaultValue={initialData.name}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("email")}
              </label>
              <input
                type="email"
                name="email"
                className={inputClass}
                defaultValue={initialData.email}
                disabled
              />
              <p className="text-xs text-on-surface-variant/70">
                {t("emailHint")}
              </p>
            </div>
          </div>
          {/* Avatar placeholder */}
          <div className="mt-4">
            <label className="block font-medium text-sm text-on-surface mb-1.5">
              {t("avatar")}
            </label>
            <div className="flex flex-col items-center justify-center min-h-[100px] rounded-xl border-2 border-dashed border-outline-variant/30 text-on-surface/30 gap-2">
              <span className="material-symbols-outlined text-3xl">
                account_circle
              </span>
              <p className="text-sm font-medium">{t("avatarPlaceholder")}</p>
            </div>
          </div>
        </SettingsSection>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : tCommon("save")}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="space-y-8">
        <SettingsSection title={t("security")}>
          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("currentPassword")}
              </label>
              <input
                type="password"
                name="currentPassword"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("newPassword")}
              </label>
              <input
                type="password"
                name="newPassword"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                name="confirmPassword"
                className={inputClass}
                required
              />
            </div>
          </div>
        </SettingsSection>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm hover:bg-surface-container-highest transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : t("changePassword")}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create account page**

Create `apps/web/app/(app)/settings/account/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { AccountForm } from "./account-form";

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsAccount");

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <AccountForm
          initialData={{
            name: session.user.name,
            email: session.user.email,
          }}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/settings/account/
git commit -m "feat: add Account settings tab with profile and password"
```

---

## Task 10: Appearance Settings Tab

**Files:**
- Create: `apps/web/app/(app)/settings/appearance/page.tsx`
- Create: `apps/web/app/(app)/settings/appearance/appearance-form.tsx`
- Create: `apps/web/app/(app)/settings/appearance/actions.ts`

- [ ] **Step 1: Create appearance server action**

Create `apps/web/app/(app)/settings/appearance/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { upsertUserPreferences } from "@/lib/actions/user-preferences";

export async function updateAppearanceSettings(formData: FormData) {
  const theme = formData.get("theme") as string;
  const density = formData.get("density") as string;

  await upsertUserPreferences({
    theme: theme || "dark",
    density: density || "comfortable",
  });

  revalidatePath("/settings/appearance");
}
```

- [ ] **Step 2: Create appearance form component**

Create `apps/web/app/(app)/settings/appearance/appearance-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateAppearanceSettings } from "./actions";

interface AppearanceFormProps {
  initialData: {
    theme: string;
    density: string;
  };
}

function ThemeCard({
  name,
  label,
  selected,
  disabled,
  comingSoonLabel,
  onSelect,
}: {
  name: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  comingSoonLabel?: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(name)}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-2 p-5 rounded-xl transition-colors duration-200 ${
        selected
          ? "bg-surface-container-high ring-2 ring-primary"
          : disabled
            ? "bg-surface-container opacity-60 cursor-not-allowed"
            : "bg-surface-container hover:bg-surface-container-high cursor-pointer"
      }`}
    >
      {disabled && comingSoonLabel && (
        <span className="absolute top-2 right-2 font-label text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary-container text-secondary">
          {comingSoonLabel}
        </span>
      )}
      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
        {name === "dark"
          ? "dark_mode"
          : name === "light"
            ? "light_mode"
            : "contrast"}
      </span>
      <span className="font-label text-sm text-on-surface">{label}</span>
      {selected && (
        <span className="material-symbols-outlined text-[18px] text-primary">
          check_circle
        </span>
      )}
    </button>
  );
}

function DensityCard({
  name,
  label,
  description,
  selected,
  gapClass,
  paddingClass,
  onSelect,
}: {
  name: string;
  label: string;
  description: string;
  selected: boolean;
  gapClass: string;
  paddingClass: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      className={`flex flex-col gap-3 p-5 rounded-xl transition-colors duration-200 text-left ${
        selected
          ? "bg-surface-container-high ring-2 ring-primary"
          : "bg-surface-container hover:bg-surface-container-high cursor-pointer"
      }`}
    >
      <div>
        <p className="font-label text-sm font-semibold text-on-surface">
          {label}
        </p>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      {/* Mini schematic preview */}
      <div className={`flex flex-col ${gapClass} w-full max-w-[120px]`}>
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3`}
        />
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3 w-4/5`}
        />
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3 w-3/5`}
        />
      </div>
    </button>
  );
}

export function AppearanceForm({ initialData }: AppearanceFormProps) {
  const t = useTranslations("settingsAppearance");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState(initialData.theme);
  const [density, setDensity] = useState(initialData.density);
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateAppearanceSettings(formData);
      setToast(t("saved"));
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="density" value={density} />

      {toast && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium bg-primary/10 text-primary">
          {toast}
        </div>
      )}

      <SettingsSection title={t("theme")}>
        <div className="grid grid-cols-3 gap-3">
          <ThemeCard
            name="dark"
            label={t("themeDark")}
            selected={theme === "dark"}
            onSelect={setTheme}
          />
          <ThemeCard
            name="light"
            label={t("themeLight")}
            selected={theme === "light"}
            disabled
            comingSoonLabel={tCommon("comingSoon")}
            onSelect={setTheme}
          />
          <ThemeCard
            name="system"
            label={t("themeSystem")}
            selected={theme === "system"}
            disabled
            comingSoonLabel={tCommon("comingSoon")}
            onSelect={setTheme}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("density")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DensityCard
            name="comfortable"
            label={t("densityComfortable")}
            description={t("densityComfortableDesc")}
            selected={density === "comfortable"}
            gapClass="gap-2.5"
            paddingClass="px-3"
            onSelect={setDensity}
          />
          <DensityCard
            name="compact"
            label={t("densityCompact")}
            description={t("densityCompactDesc")}
            selected={density === "compact"}
            gapClass="gap-1"
            paddingClass="px-2"
            onSelect={setDensity}
          />
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : tCommon("save")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create appearance page**

Create `apps/web/app/(app)/settings/appearance/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { AppearanceForm } from "./appearance-form";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function AppearanceSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsAppearance");
  const prefs = await getUserPreferences();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <AppearanceForm
          initialData={{
            theme: prefs?.theme ?? "dark",
            density: prefs?.density ?? "comfortable",
          }}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/settings/appearance/
git commit -m "feat: add Appearance settings tab with theme and density"
```

---

## Task 11: Sidebar Navigation Update

**Files:**
- Modify: `apps/web/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Add Settings to main nav and remove footer links**

In `apps/web/components/layout/app-sidebar.tsx`, update the `navItems` array to include Settings:

```typescript
const navItems = [
  { icon: "dashboard", labelKey: "dashboard", href: "/dashboard" },
  { icon: "receipt_long", labelKey: "invoices", href: "/invoices" },
  { icon: "account_balance_wallet", labelKey: "expenses", href: "/expenses" },
  { icon: "contacts", labelKey: "contacts", href: "/contacts" },
  { icon: "inventory_2", labelKey: "products", href: "/products" },
  { icon: "bar_chart", labelKey: "reports", href: "/reports" },
  { icon: "settings", labelKey: "settings", href: "/settings" },
] as const;
```

Replace the `<SidebarFooter>` section — remove the 3 settings links, keep only the CTA:

```tsx
<SidebarFooter className="p-3">
  <Link
    href="/invoices/new"
    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-label font-semibold text-sm hover:from-emerald-400 hover:to-emerald-500 transition-all"
  >
    <span className="material-symbols-outlined text-[18px] leading-none">
      add
    </span>
    {t("createNew")}
  </Link>
</SidebarFooter>
```

Also update the `isActive` check for Settings to use `startsWith`:

The existing logic already handles this — `item.href !== "/dashboard" && pathname.startsWith(item.href)` will match `/settings/*` routes.

- [ ] **Step 2: Verify the sidebar renders correctly**

Run: `cd /home/claude/repos/opentab && pnpm build --filter=web 2>&1 | tail -5`
Expected: Build succeeds (or at least no sidebar-related errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/app-sidebar.tsx
git commit -m "feat: move Settings to main sidebar nav, simplify footer"
```

---

## Task 12: Mobile "More" Menu

**Files:**
- Create: `apps/web/components/layout/mobile-more-sheet.tsx`
- Modify: `apps/web/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Create the "More" bottom sheet component**

Create `apps/web/components/layout/mobile-more-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
} from "@/components/ui/sheet";

const moreItems = [
  { icon: "bar_chart", labelKey: "reports", href: "/reports" },
  { icon: "settings", labelKey: "settings", href: "/settings" },
] as const;

export function MobileMoreSheet() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  const isActive = moreItems.some(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(item.href + "/"),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
          isActive
            ? "text-primary"
            : "text-on-surface/40 hover:text-on-surface/70"
        }`}
      >
        <span className="material-symbols-outlined text-[22px] leading-none">
          more_horiz
        </span>
        <span
          className={`font-label text-[10px] uppercase tracking-widest leading-none ${
            isActive ? "font-bold" : ""
          }`}
        >
          {t("more")}
        </span>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="bg-surface-container/70 backdrop-blur-[24px] border-t border-outline-variant/15 rounded-t-2xl p-4 pb-8"
      >
        <div className="flex flex-col gap-1">
          {moreItems.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  active
                    ? "text-primary bg-surface-container-high/50"
                    : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/30"
                }`}
              >
                <span className="material-symbols-outlined text-[22px] leading-none">
                  {item.icon}
                </span>
                <span className="font-label text-sm">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Update mobile-nav.tsx**

Replace the contents of `apps/web/components/layout/mobile-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMoreSheet } from "./mobile-more-sheet";

const navItems = [
  { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { icon: "receipt_long", label: "Invoices", href: "/invoices" },
  { icon: "account_balance_wallet", label: "Expenses", href: "/expenses" },
  { icon: "contacts", label: "Contacts", href: "/contacts" },
  { icon: "inventory_2", label: "Products", href: "/products" },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-dim/90 glass-effect border-t border-on-surface/10">
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-on-surface/40 hover:text-on-surface/70"
              }`}
            >
              <span className="material-symbols-outlined text-[22px] leading-none">
                {item.icon}
              </span>
              <span
                className={`font-label text-[10px] uppercase tracking-widest leading-none ${
                  isActive ? "font-bold" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <MobileMoreSheet />
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/mobile-more-sheet.tsx apps/web/components/layout/mobile-nav.tsx
git commit -m "feat: add mobile More menu with bottom sheet for Reports and Settings"
```

---

## Task 13: Route Redirects

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add redirects to next.config.ts**

In `apps/web/next.config.ts`, add the `redirects` function to `nextConfig`:

```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  transpilePackages: ["@opentab/db"],
  async redirects() {
    return [
      {
        source: "/settings/company",
        destination: "/settings/organisation",
        permanent: true,
      },
      {
        source: "/settings/mydata",
        destination: "/settings/integrations/mydata",
        permanent: true,
      },
      {
        source: "/settings/ai",
        destination: "/settings/integrations/ai",
        permanent: true,
      },
    ];
  },
  webpack: (config) => {
    // ... existing webpack config
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat: add redirects for old settings routes"
```

---

## Task 14: Update E2E Tests

**Files:**
- Modify: `e2e/09-settings.spec.ts`

- [ ] **Step 1: Rewrite settings E2E tests for new routes**

Replace the contents of `e2e/09-settings.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";
import { registerTestUser, loginTestUser } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Settings", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    try {
      await registerTestUser(page);
    } catch {
      await loginTestUser(page);
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("settings root redirects to organisation", async () => {
    await page.goto("/settings");
    await page.waitForURL("**/settings/organisation");
    expect(page.url()).toContain("/settings/organisation");
  });

  test("old /settings/company redirects to /settings/organisation", async () => {
    await page.goto("/settings/company");
    await page.waitForURL("**/settings/organisation");
    expect(page.url()).toContain("/settings/organisation");
  });

  test("organisation settings page renders", async () => {
    await page.goto("/settings/organisation");
    await expect(
      page.getByRole("heading", { name: /Organisation Settings/i }),
    ).toBeVisible();
    await expect(
      page.locator('input[name="name"]').or(page.getByLabel(/name/i)).first(),
    ).toBeVisible();
  });

  test("general settings page renders", async () => {
    await page.goto("/settings/general");
    await expect(
      page.getByRole("heading", { name: /General/i }).first(),
    ).toBeVisible();
  });

  test("account settings page renders", async () => {
    await page.goto("/settings/account");
    await expect(
      page.getByRole("heading", { name: /Account/i }).first(),
    ).toBeVisible();
  });

  test("appearance settings page renders", async () => {
    await page.goto("/settings/appearance");
    await expect(
      page.getByRole("heading", { name: /Appearance/i }).first(),
    ).toBeVisible();
    // Dark theme card should be selected
    await expect(page.getByText("Dark")).toBeVisible();
  });

  test("integrations page renders", async () => {
    await page.goto("/settings/integrations");
    await expect(
      page.getByRole("heading", { name: /Integrations/i }).first(),
    ).toBeVisible();
  });

  test("myDATA integration redirects for non-GR orgs", async () => {
    await page.goto("/settings/integrations/mydata");
    const url = page.url();
    if (url.includes("/settings/integrations/mydata")) {
      // GR org — myDATA settings page renders
      await expect(page.locator("h2").first()).toBeVisible();
    } else {
      // Non-GR org — redirects to integrations list
      expect(url).toMatch(/\/settings\/integrations/);
    }
  });

  test("settings nav is visible in sidebar", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
  });

  test("settings secondary nav highlights active tab", async () => {
    await page.goto("/settings/general");
    // The General nav item should have the active styling
    const generalLink = page.locator('a[href="/settings/general"]').first();
    await expect(generalLink).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `cd /home/claude/repos/opentab && pnpm e2e -- --grep "Settings"`
Expected: All settings tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/09-settings.spec.ts
git commit -m "test: update e2e tests for settings redesign"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /home/claude/repos/opentab && pnpm test`
Expected: All unit/integration tests pass

- [ ] **Step 2: Run full E2E suite**

Run: `cd /home/claude/repos/opentab && pnpm e2e`
Expected: All E2E tests pass (including updated settings tests)

- [ ] **Step 3: Run build**

Run: `cd /home/claude/repos/opentab && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run format and lint**

Run: `cd /home/claude/repos/opentab && pnpm format && pnpm lint`
Expected: No formatting or lint errors

- [ ] **Step 5: Visual verification with Playwright**

Start dev server and verify each settings page visually at 375px, 768px, and 1280px widths:
- `/settings` → redirects to `/settings/organisation`
- `/settings/organisation` → company form renders
- `/settings/general` → preferences form renders
- `/settings/account` → profile + password forms render
- `/settings/appearance` → theme cards + density cards render, Light/System disabled
- `/settings/integrations` → integration cards render
- Mobile: "More" menu opens bottom sheet with Reports and Settings links
- Mobile: Settings pages show horizontal pill navigation

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification issues from settings redesign"
```
