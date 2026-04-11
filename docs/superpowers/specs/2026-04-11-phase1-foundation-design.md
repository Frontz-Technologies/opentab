# OpenTab — Phase 1: Foundation Design Spec

**Date:** 2026-04-11
**Phase:** 1 of 8
**Scope:** Scaffold, auth, org creation, app shell, Quick Setup, design system

---

## 1. Overview

Phase 1 establishes the foundation for OpenTab: project scaffold, authentication, organisation creation, the app shell (sidebar + top bar + responsive layout), the design system, and the Quick Setup onboarding flow.

After Phase 1, a user can register, log in, see the dashboard empty state, configure their company info and VAT number, and experience the full design system across desktop and mobile.

---

## 2. Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | apps/web + packages/db, expand later | Avoids empty package overhead |
| Framework | Next.js 15 App Router | RSC, AI streaming, largest ecosystem |
| Auth | Better Auth (email/password only) | MIT, self-hosted, built-in org/RBAC for later |
| DB ORM | Drizzle ORM | SQL-first, auditable migrations, lighter than Prisma |
| UI | shadcn/ui + Tailwind CSS v4 | Copy-paste ownership, Radix primitives |
| State | Zustand + TanStack Query v5 | Minimal client state + server cache |
| i18n | next-intl (English only, infrastructure wired) | Translation-ready from day one |
| Charts | Recharts | Lightweight, React-native |
| Test DB | PGlite (in-process PostgreSQL via WASM) | Zero infrastructure, full PG compat |
| Unit tests | Vitest + Testing Library | Fast, ESM-native |
| E2E tests | Playwright | Multi-viewport, real browser |
| Org model | One org per user, org context from session | Simplifies routing and data scoping |
| Routing | Clean URLs (/dashboard, /settings) — no slug | Single-org-per-user removes need for org in URL |
| App URL | app.opentab.tech (marketing site is separate project) | Standard SaaS pattern |
| Dev environment | Docker Compose for full stack, pnpm dev for fast iteration | Docker is source of truth |

---

## 3. Project Structure

```
opentab/
├── apps/
│   └── web/                          # Next.js 15 App Router
│       ├── app/
│       │   ├── (auth)/               # Public auth routes — no sidebar
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   ├── register/
│       │   │   │   └── page.tsx
│       │   │   ├── forgot-password/
│       │   │   │   └── page.tsx
│       │   │   ├── reset-password/
│       │   │   │   └── page.tsx
│       │   │   └── layout.tsx        # Auth layout (no sidebar, centered)
│       │   ├── (app)/                # Authenticated routes — sidebar layout
│       │   │   ├── layout.tsx        # App shell (SidebarProvider + TopBar)
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx      # Empty state + Quick Setup
│       │   │   └── settings/
│       │   │       ├── company/
│       │   │       │   └── page.tsx  # Company info + VAT form
│       │   │       └── layout.tsx    # Settings sub-layout
│       │   ├── api/
│       │   │   └── auth/
│       │   │       └── [...all]/
│       │   │           └── route.ts  # Better Auth API handler
│       │   ├── layout.tsx            # Root layout (fonts, providers, next-intl)
│       │   └── page.tsx              # Redirect: auth'd → /dashboard, else → /login
│       ├── components/
│       │   ├── ui/                   # shadcn components (installed via MCP)
│       │   ├── layout/
│       │   │   ├── app-sidebar.tsx   # Main sidebar (shadcn Sidebar + custom styling)
│       │   │   ├── top-bar.tsx       # Glassmorphic top bar with breadcrumb
│       │   │   ├── mobile-nav.tsx    # Bottom nav for mobile (<768px)
│       │   │   └── user-menu.tsx     # Avatar dropdown (logout, settings)
│       │   └── onboarding/
│       │       └── quick-setup.tsx   # Quick Setup progress widget
│       ├── lib/
│       │   ├── auth.ts              # Better Auth client config
│       │   ├── auth-server.ts       # Better Auth server config + hooks
│       │   └── utils.ts             # cn() helper, etc.
│       ├── hooks/
│       │   └── use-session.ts       # Session context hook (user + org)
│       ├── messages/
│       │   └── en.json              # next-intl English strings
│       ├── middleware.ts             # Auth check → redirect to /login if no session
│       ├── next.config.ts
│       ├── tailwind.config.ts       # Design system tokens
│       ├── postcss.config.ts
│       └── package.json
├── packages/
│   └── db/
│       ├── schema/
│       │   ├── users.ts             # User table
│       │   ├── organisations.ts     # Organisation table
│       │   ├── org-memberships.ts   # OrgMembership table
│       │   └── index.ts             # Re-export all schemas
│       ├── migrations/              # Drizzle SQL migrations
│       ├── seed.ts                  # Seed script for dev/test data
│       ├── drizzle.config.ts
│       ├── index.ts                 # DB client + query helpers export
│       └── package.json
├── docker/
│   ├── docker-compose.dev.yml       # Dev: postgres + redis, hot reload
│   ├── docker-compose.yml           # Production compose
│   └── .env.sample                  # All env vars with descriptions
├── docs/
│   ├── DESIGN.md                    # Living design system document
│   ├── ARCHITECTURE.md              # System architecture, data flow
│   └── CONVENTIONS.md               # Code conventions, naming rules
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                     # Root: scripts, devDependencies
├── .env.example                     # Root env reference
├── .gitignore
├── CLAUDE.md                        # Project build/test/format commands
└── README.md
```

---

## 4. Data Model

### 4.1 User

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| email | varchar(255) | unique, not null |
| name | varchar(255) | not null |
| password_hash | text | not null (managed by Better Auth) |
| email_verified | boolean | default false |
| locale | varchar(5) | default 'en' |
| timezone | varchar(50) | default 'UTC' |
| image | text | nullable (avatar URL) |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

Note: Better Auth also creates `session`, `account`, and `verification` tables automatically. We define the `user` table ourselves to add our custom fields, and configure Better Auth to use it.

### 4.2 Organisation

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | varchar(255) | not null |
| slug | varchar(100) | unique, not null |
| tax_id | varchar(50) | nullable |
| tax_authority | varchar(255) | nullable |
| country_code | varchar(2) | nullable (auto-detected from tax_id) |
| default_currency | varchar(3) | default 'EUR' |
| fiscal_year_start | integer | default 1 (January) |
| address_line1 | varchar(255) | nullable |
| address_line2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| region | varchar(100) | nullable |
| phone | varchar(50) | nullable |
| logo_url | text | nullable |
| setup_completed_steps | jsonb | default '[]' |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

### 4.3 OrgMembership

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK → user.id, not null, **unique** (one org per user) |
| org_id | uuid | FK → organisation.id, not null |
| role | enum | 'owner', 'admin', 'member', 'accountant' — not null |
| invited_at | timestamp | nullable |
| accepted_at | timestamp | nullable |

The `unique(user_id)` constraint enforces the one-org-per-user rule. If a user needs access to multiple organisations, they create separate accounts.

---

## 5. Authentication

### 5.1 Better Auth Configuration

Better Auth runs as a library inside the Next.js app. Auth data lives in our Postgres alongside business data. No external auth service.

Server config (`lib/auth-server.ts`):
- Database adapter: Drizzle (points to packages/db)
- Email provider: configurable via env vars
  - Cloud: Resend (RESEND_API_KEY)
  - OSS: Nodemailer/SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS)
- Session: httpOnly cookie, 30-day expiry
- Custom hook on user creation: auto-create Organisation + OrgMembership

Client config (`lib/auth.ts`):
- Better Auth client for React hooks (useSession, signIn, signUp, signOut)

### 5.2 Registration Flow

1. User fills: name, email, password
2. Better Auth creates user record + session
3. Post-signup hook fires:
   - Create Organisation: name = "[User's name]'s Company", slug = slugify(name) with uniqueness check (append random 4-char suffix if collision, e.g. "johns-company" → "johns-company-a3x9")
   - Create OrgMembership: role = 'owner'
4. Redirect to /dashboard
5. Dashboard shows empty state + Quick Setup widget at 0%

### 5.3 Login Flow

1. User enters email + password
2. Better Auth validates credentials, creates session
3. Middleware on `(app)/*` routes: read session → load OrgMembership → inject into request context
4. Redirect to /dashboard

### 5.4 Session Context

Available in all server components and server actions:

```typescript
type SessionContext = {
  user: { id: string; name: string; email: string; locale: string }
  org: { id: string; name: string; slug: string; countryCode: string | null; defaultCurrency: string }
  role: 'owner' | 'admin' | 'member' | 'accountant'
}
```

### 5.5 Middleware

File: `apps/web/middleware.ts`

- Matches all `(app)/*` routes
- Checks for valid Better Auth session
- If no session → redirect to /login
- If session → allow request (org context loaded in layout)

### 5.6 Password Reset

Better Auth built-in:
1. /forgot-password: enter email → sends reset link
2. /reset-password?token=xxx: new password form → updates password
3. Email sent via configured provider (Resend or SMTP)

---

## 6. App Shell & Design System

### 6.1 Design Philosophy: "The Digital Ledger"

An editorial-inspired dark environment combining developer-tool rigor with high-end stationery warmth. Dark-only theme — no light mode. The warm dark palette IS the brand identity.

### 6.2 Design Tokens

**Typography:**
| Role | Font | Usage |
|---|---|---|
| Headlines | Manrope (400, 600, 700, 800) | Page titles, section headers, display text |
| Body | Inter (400, 500, 600) | Body text, descriptions, form labels |
| Financial data | Space Grotesk (400, 500, 700) | Amounts, dates, labels, status badges, monospace-leaning |
| Code/IDs | JetBrains Mono | Invoice numbers, API keys, true monospace |

**Colour Palette:**
| Token | Hex | Usage |
|---|---|---|
| surface-dim (base) | #131313 | Canvas background |
| surface-container-lowest | #0E0E0E | Input field fills |
| surface-container-low | #1C1B1B | Secondary panels, cards |
| surface-container | #201F1F | Intermediate surfaces |
| surface-container-high | #2A2A2A | Elevated surfaces, hover states |
| surface-container-highest | #353534 | Most interactive elements |
| primary | #4EDEA3 | Emerald accent, links, active states |
| primary-container | #10B981 | Gradient end, deeper emerald |
| tertiary-container (danger) | #FC7C78 | Error, overdue, destructive |
| on-surface | #E5E2E1 | Primary text |
| on-surface-variant | #BBCABF | Secondary text |
| outline-variant | #3C4A42 | Ghost borders (15% opacity only) |

**Rules:**
- No 1px borders for sectioning — use tonal surface colour shifts
- Glassmorphism for floating elements: 70% opacity + 24px backdrop blur
- Gradient CTA buttons: 135deg from #4EDEA3 to #10B981
- Icons: Material Symbols Outlined (nav/feature) + Lucide (small UI via shadcn)
- Status badges: uppercase Space Grotesk rounded pills
- Focus states: bg shift to surface-container-high (not border colour change)

### 6.3 shadcn/ui Integration

**Base components to install:**
sidebar, breadcrumb, avatar, button, card, input, label, dropdown-menu, tooltip, separator, badge, skeleton, toast, form, dialog

**Customizations over shadcn defaults:**
1. Dark-only theme (no light mode CSS variables)
2. Glassmorphism on sidebar (backdrop-blur-[24px] + bg-opacity-70)
3. No borders rule — override shadcn border defaults with tonal shifts
4. Gradient primary buttons (not flat)
5. Typography override: Manrope/Inter/Space Grotesk instead of Inter-only
6. Material Symbols Outlined for navigation icons alongside Lucide

### 6.4 Layout Architecture

**Desktop (>= 768px):**
- shadcn SidebarProvider + Sidebar + SidebarInset pattern
- Sidebar: fixed 240px width (--sidebar-width: 240px)
- Glassmorphic background with subtle right edge (outline-variant at 10% opacity)
- Top bar: fixed, glassmorphic blur, breadcrumb (left), search + notifications + avatar (right)
- Content area: centered, max-w-7xl, px-8, pt for top bar offset

**Sidebar contents:**
- Header: OpenTab logo + org name
- Nav items (with Material Symbols icons):
  - Dashboard (dashboard icon)
  - Invoices (receipt_long) — placeholder, no functionality
  - Expenses (account_balance_wallet) — placeholder
  - Contacts (contacts) — placeholder
  - Projects (account_tree) — placeholder
- Footer: gradient "Create New" CTA, Settings link, Support link
- Built-in: SidebarTrigger for collapse, Cmd+B keyboard shortcut, cookie-based state

**Mobile (< 768px):**
- Sidebar hidden (no slide-over sheet)
- Custom bottom nav bar: fixed bottom, glassmorphic blur bg
- 4 items: Dash, Invoices, Ledger, Projects (Space Grotesk labels, Material Symbols icons)
- Active item highlighted in emerald
- Content full-width, no horizontal padding reduction

### 6.5 Key Deviation from Reference Designs

The reference HTML (design-reference.html) is a starting point. We may deviate where:
- shadcn components provide better accessibility than hand-rolled HTML
- The reference uses static positioning where shadcn's SidebarProvider gives responsive behavior for free
- Mobile bottom nav is custom (shadcn doesn't have this pattern)

All deviations must still respect the design system tokens and rules defined above.

---

## 7. Pages

### 7.1 Auth Pages (no sidebar)

**Login (/login):**
- Split layout: left atmospheric panel (logo + tagline) + right form panel
- Form: email, password, "Forgot password?" link, gradient "Sign in" CTA
- Below: "Don't have an account? Register" link
- Typography: Manrope heading, Inter body

**Register (/register):**
- Same split layout
- Form: name, email, password, confirm password, gradient "Create account" CTA
- Below: "Already have an account? Sign in" link

**Forgot Password (/forgot-password):**
- Centered card on dark background
- Email input + "Send reset link" CTA
- Success state: "Check your email for a reset link"

**Reset Password (/reset-password):**
- Centered card
- New password + confirm password + "Reset password" CTA

### 7.2 Dashboard (/dashboard)

**Empty state (new user):**
- Page title: "Dashboard" (Manrope display-lg)
- Quick Setup widget (right side or top):
  - Card with progress bar (emerald gradient fill)
  - Step 1: "Set up your company" → links to /settings/company — functional
  - Step 2: "Add your VAT number" → same page — functional
  - Step 3: "Upload your logo" → "Coming soon" grey badge
  - Step 4: "Connect myDATA" → "Coming soon" grey badge
  - Step 5: "Invite your team" → "Coming soon" grey badge
- 3 KPI cards (skeleton/placeholder): Revenue €0.00, Outstanding €0.00, Expenses €0.00
- Empty chart area: "No data yet" message
- Empty transactions: "Create your first invoice to get started" CTA

### 7.3 Settings — Company (/settings/company)

**Company Information section:**
- Company name* (pre-filled with "[User's name]'s Company")
- Default currency (dropdown, default EUR)
- Fiscal year start (dropdown, default January)

**Tax Information section:**
- VAT / Tax ID number (text input)
  - On blur: detect country from format pattern
  - Greek AFM (9 digits): auto-set country_code to 'GR', show confirmation message
  - EU VAT (2-letter prefix): detect EU country
  - Other: no detection, manual country selection
- Tax authority (text input, optional)
- Country (auto-detected or manual dropdown)

**Address section:**
- Address line 1, line 2, city, postal code, region (all optional)

**Contact section:**
- Phone (optional)

**Branding section:**
- Logo upload zone (placeholder — "Coming soon", no file storage in Phase 1)

**Footer:** Gradient "Save changes" CTA

On save: update organisation record, mark Quick Setup steps as completed, show success toast.

---

## 8. Testing Strategy

### 8.1 Approach: TDD First, Playwright Verification

Every feature follows this cycle:
1. Write failing unit tests (Vitest)
2. Write failing E2E tests (Playwright)
3. Implement until all tests pass
4. Verify visually via Playwright screenshots

### 8.2 Test Database: PGlite

PGlite provides in-process PostgreSQL via WebAssembly:
- No Docker needed for tests
- Full PostgreSQL compatibility (not SQLite compromise)
- Each test suite gets a fresh database instance
- Millisecond startup time
- Works in CI without Docker services

### 8.3 Unit Tests (Vitest + Testing Library)

**Auth logic:**
- Registration creates user + organisation + membership
- Login returns session with org context
- Protected routes redirect to /login without session
- Password reset flow sends email (mocked)

**Data layer:**
- Organisation CRUD (create, update, read)
- OrgMembership enforces unique(user_id) constraint
- Quick Setup step completion tracking (jsonb array)
- VAT number country detection (pattern matching)

**Components:**
- Sidebar renders nav items, highlights active route
- Quick Setup widget shows correct progress percentage
- Company settings form validates required fields
- Mobile bottom nav renders at small viewports

### 8.4 E2E Tests (Playwright)

Run against `pnpm dev` with PGlite test database.

**Test suites:**
1. Registration: fill form → submit → lands on dashboard with Quick Setup at 0%
2. Login: existing user → email/password → dashboard loads
3. Login failure: wrong password → error message shown
4. Protected routes: visit /dashboard unauthenticated → redirect to /login
5. Company setup: settings → fill company name + VAT → save → Quick Setup updates
6. Logout: avatar menu → logout → redirect to /login
7. Mobile responsive: all flows at 375px viewport, bottom nav visible, sidebar hidden

**Playwright config:**
- Base URL: http://localhost:3000
- Projects: desktop (1280x720) + mobile (375x812)
- Setup: seed test user via direct DB insert
- Teardown: stop dev server, cleanup

### 8.5 Testing Skill

A custom skill will be created to codify the test verification workflow:
1. Run unit tests for changed code (`pnpm test`)
2. Start dev server (`pnpm dev` with PGlite)
3. Run relevant Playwright E2E tests (`pnpm test:e2e`)
4. Stop dev server after tests complete
5. Report pass/fail — never mark feature complete if tests fail

---

## 9. Infrastructure

### 9.1 Docker Compose (Development)

`docker/docker-compose.dev.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: opentab_dev
      POSTGRES_USER: opentab
      POSTGRES_PASSWORD: opentab_dev
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]

volumes:
  postgres_data:
  redis_data:
```

### 9.2 Environment Variables

`docker/.env.sample`:
```env
# Database
DATABASE_URL=postgresql://opentab:opentab_dev@localhost:5432/opentab_dev

# Auth
BETTER_AUTH_SECRET=generate-a-random-secret-here
BETTER_AUTH_URL=http://localhost:3000

# Email (choose one)
# Option A: Resend (cloud)
RESEND_API_KEY=
# Option B: SMTP (self-hosted)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@opentab.tech

# Redis (for future BullMQ)
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 9.3 CLAUDE.md

Project-specific commands for the AI agent:
```
BUILD_COMMAND: pnpm build
TEST_COMMAND: pnpm test
FORMAT_COMMAND: pnpm format
LINT_COMMAND: pnpm lint
DEV_COMMAND: pnpm dev
E2E_COMMAND: pnpm test:e2e
```

---

## 10. OSS vs Cloud Considerations

Phase 1 is 100% identical for OSS and cloud. No feature gating yet.

Architecture decisions that preserve future OSS/cloud split:
- Email provider via env var (Resend vs SMTP) — already handled
- Better Auth is a library, not a service — zero vendor lock-in
- Docker Compose is the deployment unit for both
- PGlite for tests means contributors don't need Docker to run tests
- Feature flags infrastructure NOT needed yet (no premium features in Phase 1)

When premium features arrive (later phases), we'll add a simple `plan` field to Organisation (free/pro/business) and a feature-flag utility that checks it.

---

## 11. Out of Scope for Phase 1

Explicitly deferred to later phases:
- Social login (Google, GitHub OAuth)
- 2FA, passkeys
- AADE VAT number auto-lookup
- Logo file upload (needs storage: R2/MinIO)
- myDATA integration
- Team invites / multi-user
- Contacts, Products, Invoices, Expenses (Phases 2-5)
- AI features (Phase 7)
- MCP server (Phase 8)
- Marketing website (separate project)
- Spanish and Greek translations (i18n infrastructure wired, translations later)

---

## 12. Acceptance Criteria

Phase 1 is complete when:

1. `pnpm dev` starts the app at localhost:3000
2. New user can register (name, email, password) and land on dashboard
3. Existing user can log in and see dashboard
4. Wrong credentials show error message
5. Unauthenticated access to /dashboard redirects to /login
6. Dashboard shows empty state with Quick Setup widget
7. User can navigate to /settings/company and update company info
8. VAT number entry detects Greek AFM and sets country_code
9. Quick Setup progress updates when steps are completed
10. Sidebar navigation works on desktop with correct design system
11. Mobile bottom nav appears at <768px viewport
12. All design tokens match spec (fonts, colours, glassmorphism, gradients)
13. All Vitest unit tests pass
14. All Playwright E2E tests pass (desktop + mobile viewports)
15. `docker compose up` runs the full stack
16. docs/DESIGN.md, ARCHITECTURE.md, CONVENTIONS.md are written
17. CLAUDE.md has correct build/test/format commands
