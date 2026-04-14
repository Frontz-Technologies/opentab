# Phase 8: Polish — Multi-User/Roles, API, MCP, i18n, Mobile, Tests — Design Spec

**Goal:** Complete the platform with multi-user role-based access, a public REST API with OpenAPI docs, an MCP server for AI tool integration, full i18n (EN/ES/EL), responsive mobile polish, and comprehensive E2E test coverage.

**Scope:** Role system redesign + invitation flow, API key management + REST endpoints, MCP server package, Spanish and Greek translations, mobile responsive improvements, camera expense capture, E2E test expansion.

**Dependencies:** All previous phases (1-7). Contacts schema (`default_language` field exists). Users schema (`locale` field exists). Org memberships schema (`orgRoleEnum` exists with owner/admin/member/accountant).

---

## 1. Role System Redesign

### Current State

The `orgRoleEnum` in `packages/db/src/schema/org-memberships.ts` defines four roles: `owner`, `admin`, `member`, `accountant`.

### Target Mapping

The product spec (UC-15, UC-16) defines three named roles. We keep the existing enum values in the database but map them to user-facing names:

| DB enum value | User-facing name   | Description |
|---------------|--------------------|-------------|
| `owner`       | Admin              | Full access. Manages users, org settings, billing. Auto-assigned on org creation. |
| `admin`       | Manager            | Everything except user management and org deletion. Can create/edit/delete all financial data. |
| `member`      | Member             | Standard access. Can create/edit own data, view shared data. Cannot manage users or org settings. |
| `accountant`  | Financial Advisor  | Read-only. Can view all financial data and export reports. Cannot create, edit, or delete anything. |

**Design decision:** We do NOT rename the enum values in the database. The enum stays `owner/admin/member/accountant`. The user-facing labels are resolved via i18n keys. This avoids a database migration that renames enum values (which is destructive in PostgreSQL).

### Permission Matrix

| Action | owner | admin | member | accountant |
|--------|-------|-------|--------|------------|
| View dashboard, reports | Y | Y | Y | Y |
| Export reports (PDF/CSV) | Y | Y | Y | Y |
| View contacts, invoices, expenses | Y | Y | Y | Y |
| Create/edit contacts | Y | Y | Y | N |
| Create/edit invoices | Y | Y | Y | N |
| Create/edit expenses | Y | Y | Y | N |
| Delete contacts/invoices/expenses | Y | Y | N | N |
| Manage products | Y | Y | Y | N |
| Use AI chat (read queries) | Y | Y | Y | Y |
| Use AI chat (write actions) | Y | Y | Y | N |
| Manage org settings | Y | Y | N | N |
| Invite users | Y | N | N | N |
| Manage user roles | Y | N | N | N |
| Remove users | Y | N | N | N |
| Delete organisation | Y | N | N | N |
| Manage API keys | Y | Y | N | N |

### Implementation: Permission Guard

Create a shared permission helper at `apps/web/lib/permissions.ts`:

```typescript
export type Permission =
  | "view:financial"
  | "create:contact" | "edit:contact" | "delete:contact"
  | "create:invoice" | "edit:invoice" | "delete:invoice"
  | "create:expense" | "edit:expense" | "delete:expense"
  | "manage:products"
  | "export:reports"
  | "ai:read" | "ai:write"
  | "manage:settings"
  | "manage:users"
  | "manage:api_keys"
  | "delete:org";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [/* all permissions */],
  admin: [/* all except manage:users, delete:org */],
  member: [/* create/edit, view, ai:read, manage:products */],
  accountant: ["view:financial", "export:reports", "ai:read"],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error("Forbidden");
  }
}
```

Every server action must call `requirePermission(session.role, "...")` after `getSession()`. Every page component checks permissions to conditionally render action buttons (create, edit, delete).

### UI: Team Management Page

New route: `apps/web/app/(app)/settings/team/page.tsx`

Layout (following the design system):
- **Header:** "Team" with "Invite User" gradient CTA button (owner only)
- **User limit bar:** Progress bar showing `{current}/{max}` users (max from org plan, default 5 for free tier)
- **User list:** Table with columns: Name, Email, Role (badge), Joined date, Actions (kebab menu)
- Role badges use the existing uppercase Space Grotesk pill pattern: ADMIN (emerald), MANAGER (blue), MEMBER (grey), FINANCIAL ADVISOR (amber)
- Actions dropdown (owner only): Change role, Remove user
- Role change uses a select dropdown with the four role options

---

## 2. Invitation Flow

### Database: `invitation` Table

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | no | gen_random_uuid() | PK |
| `org_id` | uuid | no | -- | FK -> organisation.id, ON DELETE CASCADE |
| `email` | varchar(255) | no | -- | Invitee email address |
| `role` | org_role (enum) | no | 'member' | Role to assign on acceptance |
| `token` | varchar(64) | no | -- | Unique invitation token (crypto.randomBytes(32).toString('hex')) |
| `invited_by` | text | no | -- | FK -> user.id |
| `status` | varchar(20) | no | 'pending' | `pending`, `accepted`, `expired`, `revoked` |
| `expires_at` | timestamp | no | -- | 7 days from creation |
| `accepted_at` | timestamp | yes | -- | When the invitee accepted |
| `created_at` | timestamp | no | now() | |

**Constraints:**
- `(org_id, email)` unique where `status = 'pending'` -- prevent duplicate pending invitations to same email.
- Index on `(token)` for fast lookup.
- Index on `(org_id, status)` for listing pending invitations.

### Drizzle Schema

File: `packages/db/src/schema/invitations.ts`

```typescript
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending", "accepted", "expired", "revoked",
]);

export const invitations = pgTable("invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: orgRoleEnum("role").notNull().default("member"),
  token: varchar("token", { length: 64 }).notNull().unique(),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  status: invitationStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("invitation_token_idx").on(table.token),
  index("invitation_org_status_idx").on(table.orgId, table.status),
]);
```

### Invitation Flow

1. **Owner clicks "Invite User"** -> modal with email input + role selector
2. **Server action `inviteUser`:**
   - Validates owner role via `requirePermission(session.role, "manage:users")`
   - Generates a 32-byte random token
   - Inserts into `invitation` table with 7-day expiry
   - Sends email with link: `{APP_URL}/invite/{token}`
   - Returns success
3. **Invitee clicks email link** -> lands on `/invite/[token]` page:
   - If not logged in: show "Create account or sign in to accept this invitation"
   - If logged in and already in an org: show error "You already belong to an organisation" (one-org-per-user constraint)
   - If logged in and no org: accept invitation, create org_membership linking user to the inviting org
4. **Server action `acceptInvitation`:**
   - Looks up invitation by token
   - Validates: not expired, status is pending, user has no existing org_membership
   - Creates org_membership with the invitation's role
   - Updates invitation status to `accepted`, sets `accepted_at`
   - Redirects to `/dashboard`
5. **Pending invitations list** shown on the Team page below the user list. Owner can revoke pending invitations.

### Accept Page

New route: `apps/web/app/(auth)/invite/[token]/page.tsx`

- Server component that fetches invitation by token
- Shows org name, inviter name, assigned role
- If invitation expired/revoked: shows error message with link to contact the org admin
- Accept button (if logged in and eligible) or sign-up/sign-in links

### One-Org-Per-User Constraint

The existing unique constraint on `org_memberships.user_id` means a user can only belong to one org. This is by design. The accept flow must check this and show a clear error if the user already has an org.

---

## 3. API Key Management

### Database: `api_key` Table

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | no | gen_random_uuid() | PK |
| `org_id` | uuid | no | -- | FK -> organisation.id, ON DELETE CASCADE |
| `name` | varchar(255) | no | -- | User-defined label, e.g. "Production API" |
| `key_hash` | varchar(64) | no | -- | SHA-256 hash of the API key |
| `key_prefix` | varchar(12) | no | -- | First 8 chars of the key for display: `ot_live_ab12...` |
| `permissions` | jsonb | no | '["read"]' | Array of permission strings: `read`, `write`, `admin` |
| `last_used_at` | timestamp | yes | -- | Updated on each API request |
| `expires_at` | timestamp | yes | -- | Optional expiry |
| `created_by` | text | no | -- | FK -> user.id |
| `revoked_at` | timestamp | yes | -- | Soft-revoke timestamp |
| `created_at` | timestamp | no | now() | |

**Constraints:**
- `(key_hash)` unique index.
- Index on `(org_id, revoked_at)` for listing active keys.

### Drizzle Schema

File: `packages/db/src/schema/api-keys.ts`

```typescript
export const apiKeys = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  permissions: jsonb("permissions").notNull().$type<string[]>().default(["read"]),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by").notNull().references(() => users.id),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("api_key_org_active_idx").on(table.orgId, table.revokedAt),
]);
```

### Key Generation

1. Generate 32 random bytes
2. Encode as hex with prefix: `ot_live_{hex}` (total ~70 chars)
3. Store SHA-256 hash of the full key in `key_hash`
4. Store first 12 chars in `key_prefix` for display
5. Show the full key to the user ONCE at creation time (modal with copy button and warning)
6. Never store or display the full key again

### API Key Management UI

New route: `apps/web/app/(app)/settings/api-keys/page.tsx`

Layout:
- **Header:** "API Keys" with "Create Key" gradient CTA button (owner/admin only)
- **Key list:** Table with columns: Name, Key prefix (`ot_live_ab12...`), Permissions (badge), Last used, Created, Actions
- Actions: Revoke (soft-delete, sets `revoked_at`)
- **Create modal:** Name input, permission checkboxes (Read, Write, Admin), optional expiry date
- **Post-creation modal:** Shows full key with copy button, warning that it won't be shown again

---

## 4. REST API Endpoints

### Base URL

All API routes live under `apps/web/app/api/v1/`. Next.js App Router route handlers.

### Authentication Middleware

File: `apps/web/lib/api-auth.ts`

```typescript
export async function authenticateApiRequest(request: Request): Promise<{
  orgId: string;
  permissions: string[];
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  const hash = sha256(token);
  const key = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!key.length) throw new ApiError(401, "Invalid API key");
  if (key[0].expiresAt && key[0].expiresAt < new Date()) {
    throw new ApiError(401, "API key expired");
  }
  // Update last_used_at (fire-and-forget)
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key[0].id));
  return { orgId: key[0].orgId, permissions: key[0].permissions };
}
```

Org context is derived from the API key -- no `X-Org-Id` header needed since each key is scoped to one org.

### Endpoint Structure

All endpoints follow standard REST patterns. Responses use JSON with consistent envelope:

```json
{
  "data": { ... },
  "meta": { "page": 1, "perPage": 50, "total": 123 }
}
```

Error responses:

```json
{
  "error": { "code": "NOT_FOUND", "message": "Contact not found" }
}
```

### Endpoints

#### Contacts

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/contacts` | read | List contacts (paginated, filterable by type) |
| GET | `/api/v1/contacts/:id` | read | Get single contact |
| POST | `/api/v1/contacts` | write | Create contact |
| PATCH | `/api/v1/contacts/:id` | write | Update contact |
| DELETE | `/api/v1/contacts/:id` | write | Delete contact |

#### Products

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/products` | read | List products |
| GET | `/api/v1/products/:id` | read | Get single product |
| POST | `/api/v1/products` | write | Create product |
| PATCH | `/api/v1/products/:id` | write | Update product |
| DELETE | `/api/v1/products/:id` | write | Delete product |

#### Invoices

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/invoices` | read | List invoices (filterable by status, date range) |
| GET | `/api/v1/invoices/:id` | read | Get single invoice with line items |
| POST | `/api/v1/invoices` | write | Create draft invoice |
| PATCH | `/api/v1/invoices/:id` | write | Update draft invoice |
| POST | `/api/v1/invoices/:id/send` | write | Send invoice (transition to sent status) |
| POST | `/api/v1/invoices/:id/mark-paid` | write | Mark invoice as paid |
| DELETE | `/api/v1/invoices/:id` | write | Delete draft invoice |
| GET | `/api/v1/invoices/:id/pdf` | read | Download invoice PDF |

#### Expenses

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/expenses` | read | List expenses (filterable by status, category, date range) |
| GET | `/api/v1/expenses/:id` | read | Get single expense with line items |
| POST | `/api/v1/expenses` | write | Create expense |
| PATCH | `/api/v1/expenses/:id` | write | Update expense |
| POST | `/api/v1/expenses/:id/confirm` | write | Confirm draft expense |
| DELETE | `/api/v1/expenses/:id` | write | Delete expense |

#### Reports

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/reports/summary` | read | Dashboard summary (revenue, expenses, profit) |
| GET | `/api/v1/reports/profit-loss` | read | P&L report (filterable by period) |
| GET | `/api/v1/reports/vat` | read | VAT report (output vs input by rate) |
| GET | `/api/v1/reports/tax-projection` | read | Tax projection (Greece only) |

#### AI Chat

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/chat` | read | Send message to AI assistant (streaming response) |

### Query Parameters (List Endpoints)

All list endpoints support:
- `page` (default: 1)
- `per_page` (default: 50, max: 100)
- `sort` (field name, prefix with `-` for desc, e.g. `sort=-created_at`)
- `q` (search query for text fields)

### Route Handler Pattern

Each endpoint is a Next.js route handler file:

```
apps/web/app/api/v1/
  contacts/
    route.ts          # GET (list), POST (create)
    [id]/
      route.ts        # GET (single), PATCH (update), DELETE
  invoices/
    route.ts
    [id]/
      route.ts
      send/route.ts
      mark-paid/route.ts
      pdf/route.ts
  expenses/
    route.ts
    [id]/
      route.ts
      confirm/route.ts
  products/
    route.ts
    [id]/
      route.ts
  reports/
    summary/route.ts
    profit-loss/route.ts
    vat/route.ts
    tax-projection/route.ts
  chat/
    route.ts
```

---

## 5. OpenAPI Documentation

### Approach

Use a build-time script to generate an OpenAPI 3.1 spec from Zod schemas that are already used for server action validation. This avoids runtime overhead and keeps the spec in sync with actual validation.

### Implementation

File: `apps/web/lib/openapi.ts` -- exports the OpenAPI spec object.

Each API route's Zod schemas (request body, query params, response) are annotated with `.openapi()` metadata using `zod-openapi` (a lightweight Zod extension).

Build script `scripts/generate-openapi.ts`:
1. Imports all route schemas
2. Builds OpenAPI 3.1 JSON spec
3. Writes to `public/api/openapi.json`

### Documentation UI

Route: `apps/web/app/api/docs/page.tsx`

Renders an interactive API documentation page using a lightweight OpenAPI renderer (Scalar or Stoplight Elements -- both are single-script embeds). The page loads `openapi.json` and renders it.

This page is public (no auth required) so potential API users can browse the docs.

---

## 6. MCP Server

### Architecture

The MCP server runs as a separate endpoint within the Next.js app, exposed at `/api/mcp`. It uses the `@modelcontextprotocol/sdk` package and communicates over SSE (Server-Sent Events) transport for web compatibility.

Alternative: a standalone package at `packages/mcp/` that can be run independently. For Phase 8, we start with the in-app endpoint for simplicity.

### Auth

The MCP server authenticates using the same API keys as the REST API. The key is passed as a query parameter or header during the SSE handshake.

### MCP Resources (Read-only data)

| Resource URI | Description |
|-------------|-------------|
| `opentab://contacts` | List of all contacts |
| `opentab://contacts/{id}` | Single contact details |
| `opentab://invoices` | List of invoices with status |
| `opentab://invoices/{id}` | Single invoice with line items |
| `opentab://expenses` | List of expenses |
| `opentab://expenses/{id}` | Single expense with line items |
| `opentab://products` | Product catalogue |
| `opentab://reports/summary` | Dashboard summary data |
| `opentab://reports/profit-loss?period={period}` | P&L report |
| `opentab://reports/vat?period={period}` | VAT report |

### MCP Tools (Actions)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `createInvoice` | contactId, lineItems[], dueDate | Create a draft invoice |
| `sendInvoice` | invoiceId | Send an invoice to the client |
| `createExpense` | contactId?, categoryId, amount, date, description | Create an expense |
| `createContact` | name, email, vatNumber?, type | Create a new contact |
| `lookupVat` | vatNumber | Look up company details from VAT number |
| `getOutstandingInvoices` | -- | List unpaid invoices with amounts and age |
| `getRevenueByPeriod` | startDate, endDate | Revenue summary for a date range |
| `askFinancialQuestion` | question | Route a natural language question through the AI assistant |

### Implementation

File: `apps/web/app/api/mcp/route.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";

// Register resources and tools
const server = new McpServer({ name: "opentab", version: "1.0.0" });

// Resources
server.resource("contacts", "opentab://contacts", async (uri) => { ... });
// ... more resources

// Tools
server.tool("createInvoice", { ... schema ... }, async (params) => { ... });
// ... more tools
```

### MCP Client Configuration

Users configure their AI tools to connect to:
```
URL: https://{domain}/api/mcp
Headers: Authorization: Bearer {api_key}
```

---

## 7. i18n — Spanish and Greek Translations

### Current State

Only `apps/web/messages/en.json` exists. The `next-intl` library (v4) is already configured. Users table has a `locale` field (default `en`). Contacts table has `default_language` for invoice language.

### New Files

- `apps/web/messages/es.json` -- Spanish translations
- `apps/web/messages/el.json` -- Greek translations

### Translation Structure

The existing `en.json` has top-level sections: `common`, `nav`, `auth`, `dashboard`, `quickSetup`, `settings`, `contacts`, `products`.

New sections to add (in all three files):

```json
{
  "invoices": { ... },
  "expenses": { ... },
  "reports": { ... },
  "ai": { ... },
  "team": { ... },
  "api": { ... },
  "roles": {
    "owner": "Admin",
    "admin": "Manager",
    "member": "Member",
    "accountant": "Financial Advisor"
  },
  "permissions": {
    "forbidden": "You don't have permission to perform this action",
    "readOnly": "You have read-only access"
  },
  "invitation": {
    "title": "You've been invited",
    "accept": "Accept invitation",
    "expired": "This invitation has expired",
    "revoked": "This invitation has been revoked",
    "alreadyInOrg": "You already belong to an organisation",
    "success": "Welcome to {orgName}!"
  }
}
```

### Greek Translation Notes

- All UI labels in Greek: "Επαφές" (Contacts), "Τιμολόγια" (Invoices), "Δαπάνες" (Expenses), etc.
- Tax-specific terms: "ΑΦΜ" (VAT number), "ΔΟΥ" (tax office), "myDATA" (keep as-is)
- Number formatting: `1.234,56 €` (dot for thousands, comma for decimals)
- Date formatting: `12/04/2026` (DD/MM/YYYY)

### Spanish Translation Notes

- Standard Latin American Spanish for broader reach
- Number formatting: `1.234,56 €` (same as Greek)
- Date formatting: `12/04/2026` (DD/MM/YYYY)

### Per-User Language Preference

The `users.locale` field already exists with default `en`. Implementation:

1. **Settings page:** Add language selector to user profile settings (dropdown: English, Espanol, Ellhnika)
2. **Server action:** `updateUserLocale(locale: "en" | "es" | "el")`
3. **next-intl config:** Read locale from session user, pass to `NextIntlClientProvider`
4. **Middleware update:** Set `Accept-Language` or locale cookie based on user preference

### Per-Contact Invoice Language

The `contacts.default_language` field already exists. When generating an invoice PDF or email:
1. Use the contact's `default_language` for the invoice template strings
2. Fall back to the org owner's locale if not set
3. Fall back to `en` as final default

### Number/Date Formatting

Use `next-intl`'s `useFormatter()` hook which handles locale-aware formatting:

```typescript
const format = useFormatter();
format.number(1234.56, { style: "currency", currency: "EUR" });
// en: "€1,234.56"
// el: "1.234,56 €"
// es: "1.234,56 €"
```

---

## 8. Mobile Responsive Improvements

### Already Completed (UI Consistency Pass — PR #40)

The following mobile improvements have been implemented:

- **Collapsible sidebar** — icon-only minibar (64px) by default, expands to 240px on toggle. Uses shadcn sidebar `collapsible="icon"`.
- **Mobile "More" bottom sheet** — glassmorphic bottom sheet (`bg-surface-container/70 backdrop-blur-[24px]`) containing Reports and Settings links. Mobile nav: Dashboard, Invoices, Expenses, Contacts, Products, More.
- **PageHeader** — unified sticky header with `backdrop-blur-xl`, border-on-scroll animation, heading + actions slot. Replaces the old breadcrumb-based TopBar on all 19 pages.
- **AnimatedFilterBar** — spring-animated pill filter bar (Framer Motion `layoutId`) replacing Button-based filters on all 6 list pages.
- **Mobile settings card list** — iOS-style grouped cards with icon, title, subtitle, chevron replacing horizontal scrollable pills.
- **Status badge tokens** — all badge colors aligned with design system tokens (no raw blue/zinc/red).

### Deprecated (Superseded by Completed Work)

#### ~~8.1 Single-Column Dashboard on Mobile~~

**Status: Already done.** Dashboard grid uses `grid-cols-1 md:grid-cols-3` and `lg:grid-cols-4` — KPI cards already stack vertically on mobile.

#### ~~8.2 Bottom Navigation Bar Redesign~~

**Status: Deprecated.** The spec proposed Dashboard/Invoices/Quick Add/Expenses/More. Our implemented solution is better: Dashboard/Invoices/Expenses/Contacts/Products + glassmorphic "More" sheet (Reports + Settings). The "Quick Add" concept is handled by PageHeader action buttons.

#### ~~8.3 Floating Action Button (FAB)~~

**Status: Deferred.** PageHeader action buttons provide quick-create access on all pages. A FAB would conflict with the DESIGN.md rule: _"One gradient CTA per page region"_ (sidebar already has the gradient "New Invoice" button). If needed in the future, use `bg-surface-container-high` with a `primary` icon — not gradient.

### Remaining Work

#### 8.4 Card-Based Lists on Mobile

Invoice, expense, contact, and quote list tables should convert to card-based layouts on mobile. Tables with horizontal scrolling or truncation don't work well on narrow screens.

**Pattern:** Render separate mobile/desktop components (not responsive CSS on one layout):

```html
<div class="hidden md:block">
  <!-- Desktop: table/row layout -->
</div>
<div class="block md:hidden space-y-3">
  <!-- Mobile: card list -->
</div>
```

**Card design (following DESIGN.md):**
- Card: `bg-surface-container rounded-xl p-4`
- Contact name: `font-label text-sm font-semibold text-on-surface`
- Amount: `font-label text-lg font-bold text-on-surface` (right-aligned)
- Date: `text-xs text-on-surface-variant`
- Status badge: design token badges (from UI consistency pass)
- Tap target: entire card links to detail view
- No swipe actions (keep simple)

**Files to modify:**
- `apps/web/app/(app)/invoices/invoice-list.tsx`
- `apps/web/app/(app)/expenses/expense-list.tsx`
- `apps/web/app/(app)/contacts/contact-list.tsx`
- `apps/web/app/(app)/quotes/quote-list.tsx`
- `apps/web/app/(app)/recurring/recurring-list.tsx`
- `apps/web/app/(app)/recurring-expenses/recurring-expense-list.tsx`

#### 8.5 AI Chat Bottom Sheet

On mobile, the AI chat panel should slide up from the bottom instead of the side panel:
- Uses the existing `Sheet` component with `side="bottom"`
- Takes 80% of viewport height when open (`h-[80vh]`)
- Glassmorphic treatment: `bg-surface-container/70 backdrop-blur-[24px]` (matching "More" sheet and sidebar)
- Chat input pinned to bottom with safe-area handling
- Chat button remains as-is (floating emerald circle)

**Files to modify:**
- `apps/web/components/ai/ai-chat-panel.tsx` — add responsive Sheet variant for mobile
- `apps/web/components/ai/ai-chat-button.tsx` — may need position adjustment for mobile nav clearance

---

## 9. Camera Expense Capture

### Implementation

On the expense creation page, add a camera trigger for mobile:

```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleReceiptCapture}
  className="hidden"
  id="camera-capture"
/>
<label htmlFor="camera-capture" className="...">
  <span class="material-symbols-outlined">photo_camera</span>
  Snap Receipt
</label>
```

**Flow:**
1. User taps "Snap Receipt" on mobile expense creation page
2. Device camera opens (rear camera via `capture="environment"`)
3. User takes photo
4. Photo uploads to the existing expense AI extraction pipeline
5. AI extracts data, pre-fills the expense form
6. User reviews and confirms

**Desktop fallback:** The same input works as a file picker on desktop (no camera, just file selection). The label text changes to "Upload Receipt" on desktop via responsive classes or JS detection.

---

## 10. E2E Test Expansion

### Current Tests

```
e2e/01-auth.spec.ts      -- Registration, login, auth redirects
e2e/02-contacts.spec.ts  -- Contact CRUD
e2e/03-products.spec.ts  -- Product CRUD
e2e/04-navigation.spec.ts -- Sidebar, mobile nav, routing
```

### New Test Files

Following the existing sequential pattern with shared helpers:

| File | Scope |
|------|-------|
| `e2e/05-invoices.spec.ts` | Create draft invoice, add line items, send, mark paid, PDF download |
| `e2e/06-expenses.spec.ts` | Create manual expense, confirm, category selection, file upload |
| `e2e/07-reports.spec.ts` | Dashboard KPIs render, P&L report loads, export button works |
| `e2e/08-ai-chat.spec.ts` | Open chat panel, send message, receive response, close panel |
| `e2e/09-settings.spec.ts` | Update company info, change locale, team page renders |
| `e2e/10-api.spec.ts` | Create API key, list keys, revoke key |
| `e2e/11-roles.spec.ts` | Invite user, accept invitation, verify permission restrictions |
| `e2e/12-mobile.spec.ts` | Mobile viewport: bottom nav, FAB, responsive layout |

### Test Helpers to Add

File: `e2e/helpers.ts` -- extend with:

```typescript
export const INVITED_USER = {
  name: "Invited User",
  email: "invited@opentab.dev",
  password: "InvitedPass123!",
};

export async function createTestInvoice(page: Page): Promise<void> { ... }
export async function createTestExpense(page: Page): Promise<void> { ... }
export async function createTestApiKey(page: Page): Promise<string> { ... }
```

### API Integration Tests

File: `packages/db/src/__tests__/api-keys.test.ts` -- Unit tests for API key hashing, validation, permission checking.

File: `apps/web/__tests__/api/` -- Integration tests for API route handlers using PGlite:
- Test each endpoint with valid/invalid API keys
- Test permission enforcement (read key cannot write)
- Test pagination, filtering, sorting
- Test error responses

---

## 11. Database Schema Changes Summary

### New Tables

| Table | File | Purpose |
|-------|------|---------|
| `invitation` | `packages/db/src/schema/invitations.ts` | Team invitation flow |
| `api_key` | `packages/db/src/schema/api-keys.ts` | API key management |

### New Enums

| Enum | Values | Purpose |
|------|--------|---------|
| `invitation_status` | pending, accepted, expired, revoked | Invitation lifecycle |

### Schema Modifications

**No changes to existing tables or enums.** The `orgRoleEnum` stays as-is. User-facing labels are handled via i18n.

### Exports

Update `packages/db/src/schema/index.ts` to export new tables:

```typescript
export { invitations, invitationStatusEnum, type Invitation, type NewInvitation } from "./invitations";
export { apiKeys, type ApiKey, type NewApiKey } from "./api-keys";
```

### PGlite Test Utils

Update `packages/db/src/test-utils.ts` `pushSchema()` to include raw SQL for `invitation` and `api_key` tables.

---

## 12. New Dependencies

| Package | Purpose | Where |
|---------|---------|-------|
| `@modelcontextprotocol/sdk` | MCP server implementation | `apps/web` |
| `zod-openapi` | OpenAPI spec generation from Zod schemas | `apps/web` |

**No other new dependencies.** The existing stack (next-intl, shadcn, Drizzle, Vitest, Playwright) covers everything else.

---

## 13. Testing Strategy

### Unit Tests (Vitest + PGlite)

- `packages/db/src/__tests__/invitations.test.ts` -- Invitation CRUD, token uniqueness, expiry
- `packages/db/src/__tests__/api-keys.test.ts` -- Key hashing, lookup, revocation
- `apps/web/lib/__tests__/permissions.test.ts` -- Permission matrix correctness
- `apps/web/lib/__tests__/api-auth.test.ts` -- API key authentication logic

### Integration Tests

- API route handlers: each endpoint tested with real DB (PGlite)
- Invitation flow: create invitation -> accept -> verify membership
- Permission guards: verify each role's access to each server action

### E2E Tests (Playwright)

- Full user journeys as described in section 10
- Mobile viewport tests for responsive layout
- Role-based access verification

### Test Execution

```bash
pnpm test          # Unit + integration (Vitest)
pnpm test:e2e      # E2E (Playwright)
```

---

## 14. Files to Create

| File | Purpose |
|------|---------|
| `packages/db/src/schema/invitations.ts` | Invitation table schema |
| `packages/db/src/schema/api-keys.ts` | API key table schema |
| `apps/web/lib/permissions.ts` | Role-based permission guard |
| `apps/web/lib/api-auth.ts` | API key authentication middleware |
| `apps/web/lib/openapi.ts` | OpenAPI spec builder |
| `apps/web/app/(app)/settings/team/page.tsx` | Team management page |
| `apps/web/app/(app)/settings/team/actions.ts` | Invite, change role, remove user actions |
| `apps/web/app/(app)/settings/api-keys/page.tsx` | API key management page |
| `apps/web/app/(app)/settings/api-keys/actions.ts` | Create, revoke API key actions |
| `apps/web/app/(auth)/invite/[token]/page.tsx` | Invitation accept page |
| `apps/web/app/(auth)/invite/[token]/actions.ts` | Accept invitation action |
| `apps/web/app/api/v1/contacts/route.ts` | Contacts API (list, create) |
| `apps/web/app/api/v1/contacts/[id]/route.ts` | Contacts API (get, update, delete) |
| `apps/web/app/api/v1/products/route.ts` | Products API |
| `apps/web/app/api/v1/products/[id]/route.ts` | Products API |
| `apps/web/app/api/v1/invoices/route.ts` | Invoices API |
| `apps/web/app/api/v1/invoices/[id]/route.ts` | Invoices API |
| `apps/web/app/api/v1/invoices/[id]/send/route.ts` | Send invoice action |
| `apps/web/app/api/v1/invoices/[id]/mark-paid/route.ts` | Mark paid action |
| `apps/web/app/api/v1/invoices/[id]/pdf/route.ts` | PDF download |
| `apps/web/app/api/v1/expenses/route.ts` | Expenses API |
| `apps/web/app/api/v1/expenses/[id]/route.ts` | Expenses API |
| `apps/web/app/api/v1/expenses/[id]/confirm/route.ts` | Confirm expense action |
| `apps/web/app/api/v1/reports/summary/route.ts` | Summary report |
| `apps/web/app/api/v1/reports/profit-loss/route.ts` | P&L report |
| `apps/web/app/api/v1/reports/vat/route.ts` | VAT report |
| `apps/web/app/api/v1/reports/tax-projection/route.ts` | Tax projection |
| `apps/web/app/api/v1/chat/route.ts` | AI chat API |
| `apps/web/app/api/mcp/route.ts` | MCP server endpoint |
| `apps/web/app/api/docs/page.tsx` | OpenAPI documentation page |
| `apps/web/messages/es.json` | Spanish translations |
| `apps/web/messages/el.json` | Greek translations |
| ~~`apps/web/components/layout/fab.tsx`~~ | ~~Floating action button~~ (deferred — PageHeader actions suffice) |
| `scripts/generate-openapi.ts` | OpenAPI spec generation script |
| `e2e/05-invoices.spec.ts` | Invoice E2E tests |
| `e2e/06-expenses.spec.ts` | Expense E2E tests |
| `e2e/07-reports.spec.ts` | Reports E2E tests |
| `e2e/08-ai-chat.spec.ts` | AI chat E2E tests |
| `e2e/09-settings.spec.ts` | Settings E2E tests |
| `e2e/10-api.spec.ts` | API key E2E tests |
| `e2e/11-roles.spec.ts` | Roles and invitation E2E tests |
| `e2e/12-mobile.spec.ts` | Mobile responsive E2E tests |

## 15. Files to Modify

| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Export new tables (invitations, apiKeys) |
| `packages/db/src/test-utils.ts` | Add raw SQL for new tables in `pushSchema()` |
| `apps/web/messages/en.json` | Add new i18n sections (invoices, expenses, reports, ai, team, api, roles, permissions, invitation) |
| `apps/web/lib/session.ts` | No changes needed -- `role` is already returned |
| `apps/web/components/layout/mobile-nav.tsx` | Already updated (UI consistency pass) — add Team/API Keys to "More" sheet when implemented |
| `apps/web/components/layout/app-sidebar.tsx` | Already updated (collapsible minibar) — add Team and API Keys nav items under Settings when implemented |
| `apps/web/components/ai/ai-chat-panel.tsx` | Add responsive bottom Sheet for mobile |
| `apps/web/i18n/` | Update next-intl config to support es/el locales |
| `e2e/helpers.ts` | Add new test helpers for invoices, expenses, API keys |
| All existing server actions | Add `requirePermission()` calls after `getSession()` |

---

## 16. Out of Scope

- **Native mobile app** -- Product spec lists this as "Future: companion mobile app". Phase 8 is responsive web only.
- **Multi-org per user** -- The one-org-per-user constraint remains. Users cannot belong to multiple organisations.
- **Webhook notifications** -- API consumers cannot register webhooks for events. Polling or MCP subscriptions are the alternative.
- **Rate limiting** -- API rate limiting is deferred to infrastructure layer (reverse proxy / CDN). No application-level rate limiting in Phase 8.
- **API key rotation** -- Users revoke and create new keys. No automatic rotation mechanism.
- **Offline mode** -- Mobile PWA / offline support is not in scope.
- **Email inbox for expenses** -- Already covered in Phase 5. Not duplicated here.
- **Additional languages beyond EN/ES/EL** -- Three languages only. Community contributions can add more later.
- **OAuth2 / OIDC for API auth** -- Bearer token (API key) only. OAuth2 flows are deferred.
- **Partial payments on invoices** -- Product spec explicitly states "simple, no partial payments".

---

## 17. Implementation Order

Recommended sequence to minimize blocking dependencies:

1. **Database schemas** -- invitations + api_keys tables (unblocks everything else)
2. **Permission system** -- `permissions.ts` + retrofit all server actions (high impact, foundational)
3. **i18n translations** -- es.json + el.json + locale settings (can be done in parallel with 2)
4. **Team management** -- invite flow, accept page, team settings page
5. **API key management** -- create/revoke keys, settings page
6. **REST API endpoints** -- all route handlers (depends on 2 + 5)
7. **OpenAPI docs** -- spec generation + docs page (depends on 6)
8. **MCP server** -- endpoint + resources + tools (depends on 6)
9. **Mobile responsive** -- layout fixes, FAB, camera capture, bottom sheet chat
10. **E2E tests** -- all new test files (depends on everything above)

**Estimated effort:** ~1 week as per the product spec phase plan.
