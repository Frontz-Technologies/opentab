# Closed-Beta Cloud Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get OpenTab running on a Hetzner CX32 (Coolify-managed, EU-only) at `app.opentab.tech` for ~10 manually-provisioned beta users at ~€12/mo, with every external service swappable via env vars for a future Tier-1 migration.

**Architecture:** Single Hetzner CX32 box runs Coolify, which orchestrates 5 docker-compose services (web, worker, postgres, redis, glitchtip). Object storage (PDFs + backups) goes to Hetzner Object Storage; SMTP via Brevo Free; logs to BetterStack EU. All app behavior toggles through env vars — no per-tenant or per-environment code branches.

**Tech Stack:** Next.js 15 App Router · better-auth · Drizzle/Postgres · BullMQ/Redis · nodemailer · @aws-sdk/client-s3 · Coolify · Hetzner Cloud · GHCR · GitHub Actions.

**Spec:** `docs/deploy/cloud-beta-spec.md`
**Tracking issue:** #224
**Branch:** `feature/cloud-deploy-spec` (continue here; eventually rename / fast-forward into `feature/cloud-deploy-impl` if desired)

---

## File structure (at end of plan)

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/Dockerfile` | NEW | Multi-stage Next.js 15 production image |
| `docker-compose.yml` (repo root) | NEW | Local-dev + canonical self-host stack (web, worker, postgres, redis, glitchtip) |
| `.env.example` (apps/web) | MODIFIED | Documents every new env var |
| `.github/workflows/deploy.yml` | NEW | Build → push GHCR → trigger Coolify webhook |
| `apps/web/app/api/healthz/route.ts` | NEW | DB + Redis liveness check, 200 / 503 |
| `apps/web/lib/email/transport.ts` | NEW | nodemailer SMTP transport singleton |
| `apps/web/lib/email/transport.test.ts` | NEW | Tests for transport (mock SMTP) |
| `apps/web/lib/invoicing/email.ts` | MODIFIED | Drop AI fork; call transport |
| `apps/web/lib/auth-server.ts` | MODIFIED | Wire `sendResetPassword` through transport |
| `apps/web/lib/ai/features.ts` | NEW | Per-feature env-flag + model config |
| `apps/web/lib/ai/features.test.ts` | NEW | Tests for env-flag helper |
| `apps/web/lib/expenses/ai-extraction.ts` | MODIFIED | Read model + flag from features module |
| `apps/web/app/api/ai/chat/route.ts` | MODIFIED | 404 when feature off |
| `apps/web/components/ai-chat-fab.tsx` (or current chat FAB) | MODIFIED | Hide when flag off |
| `apps/web/app/(auth)/register/page.tsx` | MODIFIED | 404 when `PUBLIC_REGISTRATION=off` |
| `apps/web/scripts/create-beta-user.ts` | NEW | Admin script to provision a user via better-auth |
| `apps/web/instrumentation.ts` | NEW | Sentry SDK init pointing at GlitchTip |
| `apps/web/lib/jobs/processors/backup.ts` | NEW | pg_dump → age encrypt → upload to s3 |
| `apps/web/lib/jobs/types.ts` | MODIFIED | Add `QUEUE.BACKUP` constant |
| `apps/web/lib/jobs/queues.ts` | MODIFIED | Register backup queue |
| `apps/web/worker.ts` | MODIFIED | Wire backup processor + repeatable nightly job |
| `apps/web/app/(marketing)/legal/page.tsx` | NEW | Privacy + Terms + Cookies + DPA outline (en/el via next-intl) |
| `apps/web/messages/en.json` | MODIFIED | Add `legal.*` keys |
| `apps/web/messages/el.json` | MODIFIED | Add `legal.*` keys |
| `apps/web/messages/es.json` | MODIFIED | Add `legal.*` keys |
| `docs/deploy/README.md` | NEW | Owner-facing step-by-step deploy walkthrough |

---

## Task 1 — Add nodemailer dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install nodemailer + types**

```bash
cd /home/claude/repos/opentab && pnpm --filter @opentab/web add nodemailer && pnpm --filter @opentab/web add -D @types/nodemailer
```

Expected: package.json gets `nodemailer` in `dependencies` and `@types/nodemailer` in `devDependencies`. pnpm-lock.yaml updates.

- [ ] **Step 2: Verify install**

```bash
cd /home/claude/repos/opentab/apps/web && node -e "require('nodemailer')" && echo OK
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/package.json pnpm-lock.yaml && git commit -m "chore: add nodemailer for SMTP transport (#224)"
```

---

## Task 2 — Email transport (`lib/email/transport.ts`)

**Files:**
- Create: `apps/web/lib/email/transport.ts`
- Test: `apps/web/__tests__/email/transport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/email/transport.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "<test@local>" });
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

import { sendEmail, resetTransportForTests } from "../../lib/email/transport";

describe("email transport (#224)", () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    createTransportMock.mockClear();
    resetTransportForTests();
    process.env.EMAIL_DRIVER = "smtp";
    process.env.EMAIL_SMTP_HOST = "smtp.test";
    process.env.EMAIL_SMTP_PORT = "587";
    process.env.EMAIL_SMTP_USER = "u";
    process.env.EMAIL_SMTP_PASSWORD = "p";
    process.env.EMAIL_FROM_ADDRESS = "noreply@opentab.tech";
    process.env.EMAIL_FROM_NAME = "OpenTab";
  });

  it("sends an email through configured SMTP", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      text: "Hello",
    });
    expect(sendMailMock).toHaveBeenCalledOnce();
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toBe("Hi");
    expect(arg.text).toBe("Hello");
    expect(arg.from).toBe('"OpenTab" <noreply@opentab.tech>');
  });

  it("reuses the transport across calls", async () => {
    await sendEmail({ to: "a@x", subject: "1", text: "1" });
    await sendEmail({ to: "b@x", subject: "2", text: "2" });
    expect(createTransportMock).toHaveBeenCalledOnce();
  });

  it("throws a helpful error when SMTP envs are missing", async () => {
    delete process.env.EMAIL_SMTP_HOST;
    resetTransportForTests();
    await expect(
      sendEmail({ to: "a@x", subject: "x", text: "x" }),
    ).rejects.toThrow(/EMAIL_SMTP_HOST/);
  });

  it("supports html alongside text", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.html).toBe("<p>T</p>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/email/transport.test.ts
```

Expected: FAIL with `Cannot find module '../../lib/email/transport'`

- [ ] **Step 3: Implement the transport**

Create `apps/web/lib/email/transport.ts`:

```ts
import nodemailer, { type Transporter } from "nodemailer";
import { createLogger } from "../logging/logger";

const log = createLogger("email-transport");

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const password = process.env.EMAIL_SMTP_PASSWORD;

  if (!host) throw new Error("EMAIL_SMTP_HOST is not set");
  if (!port) throw new Error("EMAIL_SMTP_PORT is not set");
  if (!user) throw new Error("EMAIL_SMTP_USER is not set");
  if (!password) throw new Error("EMAIL_SMTP_PASSWORD is not set");

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass: password },
  });

  return cachedTransporter;
}

function getFromHeader(): string {
  const addr = process.env.EMAIL_FROM_ADDRESS;
  const name = process.env.EMAIL_FROM_NAME ?? "OpenTab";
  if (!addr) throw new Error("EMAIL_FROM_ADDRESS is not set");
  return `"${name}" <${addr}>`;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const transporter = getTransporter();
  const from = getFromHeader();
  const result = await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    attachments: args.attachments,
  });
  log.info("email sent", { to: args.to, subject: args.subject, messageId: result.messageId });
}

export function resetTransportForTests(): void {
  cachedTransporter = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/email/transport.test.ts
```

Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/email/transport.ts apps/web/__tests__/email/transport.test.ts && git commit -m "feat: nodemailer SMTP transport singleton (#224)"
```

---

## Task 3 — Wire `lib/invoicing/email.ts` to transport, drop AI fork

**Files:**
- Modify: `apps/web/lib/invoicing/email.ts`
- Test: `apps/web/__tests__/invoicing/email-send.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/invoicing/email-send.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/email/transport", () => ({
  sendEmail: sendEmailMock,
}));

import { sendInvoiceEmail, generateInvoiceEmail } from "../../lib/invoicing/email";

describe("invoice email send (#224)", () => {
  beforeEach(() => sendEmailMock.mockClear());

  it("sendInvoiceEmail forwards to the transport", async () => {
    await sendInvoiceEmail("customer@example.com", { subject: "INV-1", body: "Hello" });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "customer@example.com",
      subject: "INV-1",
      text: "Hello",
    });
  });

  it("generateInvoiceEmail uses the static fallback (no AI call) regardless of OPENROUTER_API_KEY", async () => {
    process.env.OPENROUTER_API_KEY = "sk-fake";
    const invoice = {
      invoiceNumber: "INV-42",
      total: "100.00",
      currencyCode: "EUR",
      dueDate: "2026-05-15",
    } as never;
    const result = await generateInvoiceEmail(invoice, "Acme Corp");
    expect(result.subject).toContain("INV-42");
    expect(result.body).toContain("Acme Corp");
    expect(result.body).toContain("100.00");
  });

  it("attaches PDF when buffer provided", async () => {
    await sendInvoiceEmail(
      "customer@example.com",
      { subject: "S", body: "B" },
      Buffer.from("PDF"),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/\.pdf$/),
            content: Buffer.from("PDF"),
            contentType: "application/pdf",
          }),
        ],
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/invoicing/email-send.test.ts
```

Expected: FAIL — test 1 fails because the placeholder logs to console, test 2 fails because it tries the AI path when OPENROUTER_API_KEY is set.

- [ ] **Step 3: Refactor `apps/web/lib/invoicing/email.ts`**

Replace the existing file content with:

```ts
import type { Invoice } from "@opentab/db/schema";
import { sendEmail } from "../email/transport";

interface EmailContent {
  subject: string;
  body: string;
}

/**
 * Generate the invoice email body. Beta uses a static template only.
 * The full editable-template feature lives in issue #223.
 */
export async function generateInvoiceEmail(
  invoice: Invoice,
  orgName: string,
): Promise<EmailContent> {
  return generateFallbackEmail(invoice, orgName);
}

function generateFallbackEmail(invoice: Invoice, orgName: string): EmailContent {
  const total = `${invoice.total} ${invoice.currencyCode ?? "EUR"}`;
  const dueText = invoice.dueDate
    ? `Payment is due by ${invoice.dueDate}.`
    : "";
  return {
    subject: `Invoice ${invoice.invoiceNumber ?? ""} from ${orgName}`,
    body: `Hello,

Please find attached invoice ${invoice.invoiceNumber ?? ""} for ${total}.

${dueText}

If you have any questions, please don't hesitate to reach out.

Best regards,
${orgName}`,
  };
}

export async function sendInvoiceEmail(
  to: string,
  content: EmailContent,
  pdfBuffer?: Buffer,
): Promise<void> {
  const filename = content.subject.replace(/[^a-z0-9-]/gi, "_") + ".pdf";
  await sendEmail({
    to,
    subject: content.subject,
    text: content.body,
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        }
      : {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/invoicing/email-send.test.ts
```

Expected: PASS (3/3)

- [ ] **Step 5: Run full test suite — make sure nothing else broke**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run
```

Expected: all tests still pass (the previous behavior `console.log`-based callers won't break because callers ignored the boolean return).

- [ ] **Step 6: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/invoicing/email.ts apps/web/__tests__/invoicing/email-send.test.ts && git commit -m "refactor: invoice email uses SMTP transport, drop per-send AI (#224)"
```

---

## Task 4 — Wire better-auth password reset to transport

**Files:**
- Modify: `apps/web/lib/auth-server.ts`

- [ ] **Step 1: Read current auth-server.ts to find right place to add the hook**

```bash
cd /home/claude/repos/opentab && cat apps/web/lib/auth-server.ts | head -40
```

Identify the `betterAuth({ ... })` call and the `emailAndPassword: { enabled: true }` section.

- [ ] **Step 2: Add `sendResetPassword` to the auth config**

In `apps/web/lib/auth-server.ts`, change:

```ts
emailAndPassword: {
  enabled: true,
},
```

to:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    const { sendEmail } = await import("./email/transport");
    await sendEmail({
      to: user.email,
      subject: "Reset your OpenTab password",
      text: `Hello ${user.name ?? ""},

You requested a password reset for your OpenTab account.

Click the link below to set a new password (valid for 1 hour):

${url}

If you didn't request this, you can safely ignore this email.

— OpenTab`,
    });
  },
},
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/claude/repos/opentab/apps/web && npx tsc --noEmit 2>&1 | grep -E "auth-server" | head -10
```

Expected: no new errors in auth-server.ts.

- [ ] **Step 4: Manual smoke test (deferred to deploy)** — note in commit message that real verification happens after the box is up.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/auth-server.ts && git commit -m "feat: wire better-auth password reset emails through SMTP transport (#224)"
```

---

## Task 5 — AI features module (`lib/ai/features.ts`)

**Files:**
- Create: `apps/web/lib/ai/features.ts`
- Test: `apps/web/__tests__/ai/features.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/ai/features.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  isFeatureEnabled,
  getFeatureModel,
  type AiFeature,
} from "../../lib/ai/features";

describe("AI feature flags (#224)", () => {
  beforeEach(() => {
    delete process.env.FEATURE_AI_CHAT;
    delete process.env.FEATURE_AI_EXTRACTION;
    delete process.env.AI_MODEL_CHAT;
    delete process.env.AI_MODEL_EXTRACTION;
  });

  it("isFeatureEnabled returns false when env unset (closed by default)", () => {
    expect(isFeatureEnabled("chat")).toBe(false);
    expect(isFeatureEnabled("extraction")).toBe(false);
  });

  it("isFeatureEnabled returns true when env=on", () => {
    process.env.FEATURE_AI_CHAT = "on";
    process.env.FEATURE_AI_EXTRACTION = "on";
    expect(isFeatureEnabled("chat")).toBe(true);
    expect(isFeatureEnabled("extraction")).toBe(true);
  });

  it("isFeatureEnabled returns false when env=off", () => {
    process.env.FEATURE_AI_CHAT = "off";
    expect(isFeatureEnabled("chat")).toBe(false);
  });

  it("getFeatureModel returns env value when set", () => {
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
    expect(getFeatureModel("extraction")).toBe("openai/gpt-4o");
  });

  it("getFeatureModel returns documented default when unset", () => {
    expect(getFeatureModel("chat")).toBe("openai/gpt-4o-mini");
    expect(getFeatureModel("extraction")).toBe("openai/gpt-4o");
  });

  it("typed feature names cover known features", () => {
    const features: AiFeature[] = ["chat", "extraction"];
    for (const f of features) {
      expect(typeof getFeatureModel(f)).toBe("string");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/ai/features.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the features module**

Create `apps/web/lib/ai/features.ts`:

```ts
export type AiFeature = "chat" | "extraction";

const ENV_FLAG: Record<AiFeature, string> = {
  chat: "FEATURE_AI_CHAT",
  extraction: "FEATURE_AI_EXTRACTION",
};

const ENV_MODEL: Record<AiFeature, string> = {
  chat: "AI_MODEL_CHAT",
  extraction: "AI_MODEL_EXTRACTION",
};

const DEFAULT_MODEL: Record<AiFeature, string> = {
  chat: "openai/gpt-4o-mini",
  extraction: "openai/gpt-4o",
};

export function isFeatureEnabled(feature: AiFeature): boolean {
  return process.env[ENV_FLAG[feature]] === "on";
}

export function getFeatureModel(feature: AiFeature): string {
  return process.env[ENV_MODEL[feature]] ?? DEFAULT_MODEL[feature];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/ai/features.test.ts
```

Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/ai/features.ts apps/web/__tests__/ai/features.test.ts && git commit -m "feat: per-feature AI flag + model helper (#224)"
```

---

## Task 6 — Env-gate AI extraction

**Files:**
- Modify: `apps/web/lib/expenses/ai-extraction.ts`

- [ ] **Step 1: Find the model literal**

```bash
cd /home/claude/repos/opentab && grep -n "model\s*[:=]" apps/web/lib/expenses/ai-extraction.ts | head -10
```

Find the line that hard-codes the model string passed to `createAiProvider`.

- [ ] **Step 2: Replace hard-coded model with `getFeatureModel("extraction")`**

At the top of `apps/web/lib/expenses/ai-extraction.ts`, add:

```ts
import { getFeatureModel, isFeatureEnabled } from "../ai/features";
```

Find the `extractReceiptData(...)` function. At its very top (after the params destructure), add:

```ts
if (!isFeatureEnabled("extraction")) {
  throw new Error("AI extraction is disabled. Set FEATURE_AI_EXTRACTION=on to enable.");
}
const model = getFeatureModel("extraction");
```

If the function already declares a `model` variable (e.g. `const model = "openai/gpt-4o"`), DELETE that line — it's now sourced from `getFeatureModel`.

- [ ] **Step 3: Run typecheck**

```bash
cd /home/claude/repos/opentab/apps/web && npx tsc --noEmit 2>&1 | grep ai-extraction | head -5
```

Expected: no errors.

- [ ] **Step 4: Run existing tests for extraction**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/expenses/ 2>&1 | tail -10
```

Expected: tests pass (or, if the test sets `FEATURE_AI_EXTRACTION=on` in setup, fail with a clear message — fix the test setup).

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/expenses/ai-extraction.ts apps/web/__tests__/expenses/ 2>/dev/null && git commit -m "feat: gate AI extraction behind FEATURE_AI_EXTRACTION (#224)"
```

---

## Task 7 — Env-gate AI chat (server route + client FAB)

**Files:**
- Modify: `apps/web/app/api/ai/chat/route.ts`
- Modify: the AI chat FAB component (find via grep)

- [ ] **Step 1: Find the chat FAB component**

```bash
cd /home/claude/repos/opentab && grep -rln "ai/chat\|AiChatFab\|chat-fab\|ChatFab" apps/web/components apps/web/app | head -5
```

Note the exact path returned — it's the file you'll modify in step 3.

- [ ] **Step 2: Server-side gate**

Edit `apps/web/app/api/ai/chat/route.ts`. At the very top of the exported handlers (POST/GET), add:

```ts
import { isFeatureEnabled } from "@/lib/ai/features";

export async function POST(req: Request) {
  if (!isFeatureEnabled("chat")) {
    return new Response("Not Found", { status: 404 });
  }
  // ... existing implementation
}
```

(If the handler already imports things or uses a different export shape, add the guard as the first executable line.)

- [ ] **Step 3: Client-side gate (hide the FAB)**

In the FAB component file from step 1, find the top-level component return. Wrap it:

```tsx
export function AiChatFab() {
  if (process.env.NEXT_PUBLIC_FEATURE_AI_CHAT !== "on") return null;
  // ... existing JSX
}
```

(If the component is a default export, apply the same guard inside.)

- [ ] **Step 4: Build to verify both env vars are picked up**

```bash
cd /home/claude/repos/opentab/apps/web && NEXT_PUBLIC_FEATURE_AI_CHAT=off npx tsc --noEmit 2>&1 | grep -E "ai-chat|api/ai/chat" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/app/api/ai/chat/route.ts apps/web/components apps/web/app && git commit -m "feat: gate AI chat (server + FAB) behind FEATURE_AI_CHAT (#224)"
```

---

## Task 8 — Env-gate `/register` page

**Files:**
- Modify: `apps/web/app/(auth)/register/page.tsx`

- [ ] **Step 1: Read the file to find the right export**

```bash
cd /home/claude/repos/opentab && head -20 "apps/web/app/(auth)/register/page.tsx"
```

- [ ] **Step 2: Add the env guard at the top of the default-exported component**

At the top of the function (before any hooks), add:

```tsx
import { notFound } from "next/navigation";

export default function RegisterPage() {
  if (process.env.PUBLIC_REGISTRATION === "off") notFound();
  // ... existing JSX
}
```

(If the page is a Client Component using `"use client"`, switch the file: keep the client part as a sub-component and make the parent a Server Component that does the env check + renders the client child. Cleanest pattern: introduce `RegisterClient` for the form, the page checks env then `<RegisterClient />`.)

- [ ] **Step 3: Manual smoke test plan (verified at deploy time)**

Note in the commit body: "After deploy, hitting `https://app.opentab.tech/register` should return 404 when `PUBLIC_REGISTRATION=off` is set."

- [ ] **Step 4: Commit**

```bash
cd /home/claude/repos/opentab && git add "apps/web/app/(auth)/register/page.tsx" && git commit -m "feat: gate /register behind PUBLIC_REGISTRATION env (#224)"
```

---

## Task 9 — Healthcheck route (`/api/healthz`)

**Files:**
- Create: `apps/web/app/api/healthz/route.ts`
- Test: `apps/web/__tests__/api/healthz.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/api/healthz.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const dbExecMock = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
const redisPingMock = vi.fn().mockResolvedValue("PONG");

vi.mock("@/lib/db", () => ({
  db: { execute: dbExecMock },
}));
vi.mock("@/lib/jobs/queues", () => ({
  getRedisConnection: () => ({ ping: redisPingMock }),
}));

import { GET } from "../../app/api/healthz/route";

describe("healthz route (#224)", () => {
  it("returns 200 with status: ok when db + redis are up", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
  });

  it("returns 503 when db is down", async () => {
    dbExecMock.mockRejectedValueOnce(new Error("db dead"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.db).toBe("fail");
  });

  it("returns 503 when redis is down", async () => {
    redisPingMock.mockRejectedValueOnce(new Error("redis dead"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.redis).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/api/healthz.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `apps/web/app/api/healthz/route.ts`:

```ts
import { db } from "@/lib/db";
import { getRedisConnection } from "@/lib/jobs/queues";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const checks = { db: "ok" as "ok" | "fail", redis: "ok" as "ok" | "fail" };

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.db = "fail";
  }

  try {
    const pong = await getRedisConnection().ping();
    if (pong !== "PONG") checks.redis = "fail";
  } catch {
    checks.redis = "fail";
  }

  const allOk = checks.db === "ok" && checks.redis === "ok";
  return Response.json(
    { status: allOk ? "ok" : "fail", ...checks },
    { status: allOk ? 200 : 503 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/api/healthz.test.ts
```

Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/app/api/healthz/route.ts apps/web/__tests__/api/healthz.test.ts && git commit -m "feat: /api/healthz returns DB+Redis status (#224)"
```

---

## Task 10 — Admin script: `create-beta-user.ts`

**Files:**
- Create: `apps/web/scripts/create-beta-user.ts`

This is an admin operation script (not a test target). Verification = manual run after deploy.

- [ ] **Step 1: Implement the script**

Create `apps/web/scripts/create-beta-user.ts`:

```ts
/**
 * Manually provision a closed-beta user.
 *
 * Usage (from a container with DATABASE_URL set, via Coolify Terminal):
 *   pnpm tsx apps/web/scripts/create-beta-user.ts <email> "<full name>" "<org name>"
 *
 * Behavior:
 *   1. Calls better-auth signUpEmail with a long random temp password (user can never log in with it)
 *   2. Auth-server's databaseHooks creates the org automatically
 *   3. Triggers a password-reset email so the user sets their real password
 *   4. Prints the magic-link URL to stdout (in case email transport is down)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env

import { auth } from "../lib/auth-server";
import { randomBytes } from "node:crypto";

async function main() {
  const [, , email, name, orgNameArg] = process.argv;
  if (!email || !name) {
    console.error(
      "Usage: pnpm tsx apps/web/scripts/create-beta-user.ts <email> '<name>' [orgName]",
    );
    process.exit(1);
  }

  const tempPassword = randomBytes(32).toString("base64url");

  console.log(`→ Creating user: ${email}`);
  await auth.api.signUpEmail({
    body: {
      email,
      name,
      password: tempPassword,
    },
  });
  console.log(`✅ User created`);

  // The auth.databaseHooks.user.create.after will have created an org
  // named "<name>'s Company" automatically. If a custom orgName was passed,
  // log that the user can rename the org from Settings.
  if (orgNameArg) {
    console.log(
      `   Note: org was auto-created from name. Rename to "${orgNameArg}" from Settings → Organisation after first login.`,
    );
  }

  console.log(`→ Triggering password reset email...`);
  // better-auth sendResetPassword hook will email the user.
  // We invoke the resetPassword endpoint directly so the user receives the link.
  // Using the public sign-in flow from a Node script is awkward;
  // instead we use better-auth's request-reset endpoint by calling the API.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/auth/forget-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, redirectTo: "/reset-password" }),
  });
  if (!res.ok) {
    console.warn(
      `⚠️  Password-reset request returned ${res.status}. The user can use /forgot-password manually.`,
    );
  } else {
    console.log(`✅ Password-reset email sent to ${email}`);
  }

  console.log(`\n🎉 Done. Tell ${name} to check their inbox or visit /forgot-password.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify script compiles**

```bash
cd /home/claude/repos/opentab/apps/web && npx tsc --noEmit scripts/create-beta-user.ts 2>&1 | head -10
```

Expected: no errors (or only project-wide errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/scripts/create-beta-user.ts && git commit -m "feat: admin script to provision closed-beta users (#224)"
```

---

## Task 11 — Sentry SDK init pointing at GlitchTip (`instrumentation.ts`)

**Files:**
- Create: `apps/web/instrumentation.ts`
- Modify: `apps/web/package.json` (add @sentry/nextjs)
- Modify: `apps/web/next.config.ts` (Sentry webpack plugin — defer if not strictly needed for beta)

- [ ] **Step 1: Add @sentry/nextjs**

```bash
cd /home/claude/repos/opentab && pnpm --filter @opentab/web add @sentry/nextjs
```

Expected: package added.

- [ ] **Step 2: Create `apps/web/instrumentation.ts`**

```ts
/**
 * Next.js instrumentation hook — runs once at server startup.
 * Initializes Sentry SDK pointing at our self-hosted GlitchTip instance.
 *
 * Set SENTRY_DSN to disable: leave it unset and Sentry init is skipped.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
}
```

- [ ] **Step 3: Verify build still works locally**

```bash
cd /home/claude/repos/opentab/apps/web && npx next build 2>&1 | tail -10
```

Expected: build completes (no Sentry errors because SENTRY_DSN is not set in dev).

- [ ] **Step 4: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/package.json pnpm-lock.yaml apps/web/instrumentation.ts && git commit -m "feat: instrumentation hook for GlitchTip via @sentry/nextjs (#224)"
```

---

## Task 12 — Backup processor + nightly schedule

**Files:**
- Create: `apps/web/lib/jobs/processors/backup.ts`
- Modify: `apps/web/lib/jobs/types.ts`
- Modify: `apps/web/lib/jobs/queues.ts`
- Modify: `apps/web/worker.ts`
- Test: `apps/web/__tests__/jobs/backup.test.ts`

- [ ] **Step 1: Add the queue constant**

In `apps/web/lib/jobs/types.ts`, find the `QUEUE` object and add:

```ts
export const QUEUE = {
  // ... existing
  BACKUP: "backup",
} as const;
```

- [ ] **Step 2: Register queue in queues.ts**

In `apps/web/lib/jobs/queues.ts`, add `BACKUP` to whatever registry exists (follow the existing pattern for cleanup/delete-expense queues — copy the lines and adapt the name).

- [ ] **Step 3: Write the failing test for the backup processor**

Create `apps/web/__tests__/jobs/backup.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const execMock = vi.fn();
const s3UploadMock = vi.fn().mockResolvedValue({});
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    stdout: { pipe: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (arg: number) => void) => {
      if (event === "close") cb(0);
    },
  })),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: s3UploadMock })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

import { processBackup } from "../../lib/jobs/processors/backup";

describe("backup job (#224)", () => {
  beforeEach(() => {
    s3UploadMock.mockClear();
    process.env.DATABASE_URL = "postgres://u:p@h:5432/d";
    process.env.BACKUP_S3_BUCKET = "opentab-backups";
    process.env.BACKUP_S3_REGION = "hel1";
    process.env.BACKUP_S3_ENDPOINT = "https://hel1.your-objectstorage.com";
    process.env.BACKUP_S3_ACCESS_KEY = "k";
    process.env.BACKUP_S3_SECRET_KEY = "s";
    process.env.BACKUP_AGE_PUBLIC_KEY = "age1xyz";
  });

  it("uploads a daily backup with date-stamped key", async () => {
    await processBackup({ data: {} } as never);
    expect(s3UploadMock).toHaveBeenCalledOnce();
    const cmd = s3UploadMock.mock.calls[0][0];
    expect(cmd.input.Bucket).toBe("opentab-backups");
    expect(cmd.input.Key).toMatch(/^db\/\d{4}-\d{2}-\d{2}\.dump\.age$/);
  });

  it("throws when BACKUP_AGE_PUBLIC_KEY is missing", async () => {
    delete process.env.BACKUP_AGE_PUBLIC_KEY;
    await expect(processBackup({ data: {} } as never)).rejects.toThrow(/AGE_PUBLIC_KEY/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/jobs/backup.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement the processor**

Create `apps/web/lib/jobs/processors/backup.ts`:

```ts
import { spawn } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Job } from "bullmq";
import { createLogger } from "../../logging/logger";

const log = createLogger("backup");

export async function processBackup(_job: Job): Promise<{ key: string }> {
  const dbUrl = process.env.DATABASE_URL;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const secretKey = process.env.BACKUP_S3_SECRET_KEY;
  const agePub = process.env.BACKUP_AGE_PUBLIC_KEY;

  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  if (!bucket) throw new Error("BACKUP_S3_BUCKET is not set");
  if (!region) throw new Error("BACKUP_S3_REGION is not set");
  if (!endpoint) throw new Error("BACKUP_S3_ENDPOINT is not set");
  if (!accessKey) throw new Error("BACKUP_S3_ACCESS_KEY is not set");
  if (!secretKey) throw new Error("BACKUP_S3_SECRET_KEY is not set");
  if (!agePub) throw new Error("BACKUP_AGE_PUBLIC_KEY is not set");

  const date = new Date().toISOString().slice(0, 10);
  const key = `db/${date}.dump.age`;

  log.info("starting backup", { date, key });

  // Pipe pg_dump → age → buffer (small DBs only; for >1GB, stream directly to s3 via multipart)
  const dump = spawn("pg_dump", ["-Fc", dbUrl]);
  const age = spawn("age", ["-r", agePub, "-o", "/dev/stdout"]);
  dump.stdout.pipe(age.stdin);

  const chunks: Buffer[] = [];
  age.stdout.on("data", (c: Buffer) => chunks.push(c));
  dump.stderr.on("data", (c: Buffer) => log.warn("pg_dump stderr", { msg: c.toString() }));
  age.stderr.on("data", (c: Buffer) => log.warn("age stderr", { msg: c.toString() }));

  await new Promise<void>((resolve, reject) => {
    age.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`age exited with ${code}`));
    });
  });

  const buffer = Buffer.concat(chunks);
  log.info("dump+encrypt complete", { bytes: buffer.length });

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/octet-stream",
    }),
  );

  log.info("backup uploaded", { bucket, key });
  return { key };
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/claude/repos/opentab/apps/web && npx vitest run __tests__/jobs/backup.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 7: Wire processor + nightly repeatable into worker.ts**

In `apps/web/worker.ts`, find where the existing repeatable jobs are registered (look for `Queue` and `repeat` or `every`). Add:

```ts
import { processBackup } from "./lib/jobs/processors/backup";

// Inside async registerRepeatables():
const backupQueue = new Queue(QUEUE.BACKUP, { connection: getRedisConnection() });
await backupQueue.add(
  "nightly",
  {},
  {
    repeat: { pattern: "0 0 * * *" }, // 00:00 UTC = 03:00 Athens
    jobId: "nightly-backup",
  },
);

// Add the worker:
new Worker(QUEUE.BACKUP, processBackup, { connection: getRedisConnection() });
```

- [ ] **Step 8: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/lib/jobs apps/web/worker.ts apps/web/__tests__/jobs/backup.test.ts && git commit -m "feat: nightly age-encrypted pg_dump → s3 backup job (#224)"
```

---

## Task 13 — `/legal` page (en/el/es)

**Files:**
- Create: `apps/web/app/(marketing)/legal/page.tsx`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/el.json`
- Modify: `apps/web/messages/es.json`

- [ ] **Step 1: Add `legal.*` keys to en.json**

In `apps/web/messages/en.json`, add a top-level `"legal"` section:

```json
"legal": {
  "pageTitle": "Legal",
  "lastUpdated": "Last updated: 26 April 2026",
  "privacy": {
    "title": "Privacy Policy",
    "intro": "OpenTab (\"we\", \"the Service\") is operated by Frontz Technologies. This page explains what personal data we collect, why, and how long we keep it.",
    "dataCollected": "Account data (name, email, password hash), business data you enter (invoices, contacts, expenses), generated PDFs, and operational logs.",
    "dataLocation": "All data is stored within the EU (Hetzner Online GmbH, Nuremberg, Germany; backups in Helsinki, Finland).",
    "retention": "We keep your data for as long as your account is active. After account closure, we retain data for 90 days then permanently delete.",
    "yourRights": "Under GDPR you have rights of access, rectification, erasure, portability, and to lodge a complaint with your supervisory authority. Email support@opentab.tech to exercise any of these.",
    "thirdParties": "We use the following sub-processors, all EU-located: Hetzner (hosting + storage), Brevo (email delivery, France). We do not use marketing cookies or analytics trackers."
  },
  "terms": {
    "title": "Terms of Service",
    "intro": "These terms govern your use of OpenTab.",
    "betaNotice": "OpenTab is currently in CLOSED BETA. The service is provided free of charge during beta. We make no service-level guarantees and may modify, suspend, or discontinue the service at any time. Your data is exportable at any time via the dashboard.",
    "yourContent": "You retain ownership of all data you upload. You grant us a limited license to process it solely to provide the service.",
    "acceptableUse": "You agree not to use the service for unlawful purposes, to attempt to compromise its security, or to send unsolicited bulk email through it.",
    "termination": "Either party may terminate at any time. Upon termination you may export your data; after 90 days of inactivity we may delete the account.",
    "jurisdiction": "These terms are governed by Greek law, with exclusive jurisdiction in the courts of Athens, subject to mandatory EU consumer-law protections."
  },
  "cookies": {
    "title": "Cookie Notice",
    "intro": "OpenTab uses only strictly-necessary cookies.",
    "list": "Session cookie (keeps you logged in, expires after 30 days), CSRF cookie (anti-forgery, expires with session). No marketing, analytics, or third-party tracking cookies are set."
  },
  "dpa": {
    "title": "Data Processing Agreement",
    "intro": "If you are a business customer processing personal data on behalf of your own customers via OpenTab, we act as your data processor under GDPR Art. 28.",
    "summary": "Our standard DPA covers: subject-matter and duration, scope and purpose, types of data and categories of data subjects, our obligations, sub-processor list, security measures, breach notification (within 72 hours), data return/deletion on termination.",
    "request": "Email support@opentab.tech for the full signed DPA template."
  },
  "contact": "Questions? support@opentab.tech"
}
```

- [ ] **Step 2: Add Greek translation to el.json**

In `apps/web/messages/el.json`, add the same `"legal"` section translated to Greek. Provide a complete Greek translation of every key — do NOT leave any English placeholders.

(Plan author's note: include the actual Greek text inline in the implementation, e.g. `"pageTitle": "Νομικά"`, `"privacy.title": "Πολιτική Απορρήτου"`, etc. Translate every line. If you don't have time to do a careful translation, mark the task BLOCKED and ask the owner for help — do NOT machine-translate without review.)

- [ ] **Step 3: Add Spanish translation to es.json**

Same pattern as Greek. Provide a complete Spanish translation. Same caveat about translation quality.

- [ ] **Step 4: Create the page**

Create `apps/web/app/(marketing)/legal/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function LegalPage() {
  const t = await getTranslations("legal");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>{t("pageTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>

      <section id="privacy">
        <h2>{t("privacy.title")}</h2>
        <p>{t("privacy.intro")}</p>
        <h3>What data we collect</h3>
        <p>{t("privacy.dataCollected")}</p>
        <h3>Where it's stored</h3>
        <p>{t("privacy.dataLocation")}</p>
        <h3>Retention</h3>
        <p>{t("privacy.retention")}</p>
        <h3>Your rights</h3>
        <p>{t("privacy.yourRights")}</p>
        <h3>Sub-processors</h3>
        <p>{t("privacy.thirdParties")}</p>
      </section>

      <section id="terms">
        <h2>{t("terms.title")}</h2>
        <p>{t("terms.intro")}</p>
        <h3>Beta notice</h3>
        <p>{t("terms.betaNotice")}</p>
        <h3>Your content</h3>
        <p>{t("terms.yourContent")}</p>
        <h3>Acceptable use</h3>
        <p>{t("terms.acceptableUse")}</p>
        <h3>Termination</h3>
        <p>{t("terms.termination")}</p>
        <h3>Jurisdiction</h3>
        <p>{t("terms.jurisdiction")}</p>
      </section>

      <section id="cookies">
        <h2>{t("cookies.title")}</h2>
        <p>{t("cookies.intro")}</p>
        <p>{t("cookies.list")}</p>
      </section>

      <section id="dpa">
        <h2>{t("dpa.title")}</h2>
        <p>{t("dpa.intro")}</p>
        <p>{t("dpa.summary")}</p>
        <p>{t("dpa.request")}</p>
      </section>

      <hr />
      <p>{t("contact")}</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify the page builds**

```bash
cd /home/claude/repos/opentab/apps/web && npx next build 2>&1 | tail -5
```

Expected: build completes; the route `(marketing)/legal/page` shows in the build output.

- [ ] **Step 6: Commit**

```bash
cd /home/claude/repos/opentab && git add "apps/web/app/(marketing)/legal/page.tsx" apps/web/messages && git commit -m "feat: /legal page with Privacy + Terms + Cookies + DPA outline (en/el/es) (#224)"
```

---

## Task 14 — Production Dockerfile

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/.dockerignore`

- [ ] **Step 1: Create `apps/web/.dockerignore`**

```
node_modules
.next
.turbo
.git
*.log
__tests__
e2e
.env
.env.*
!.env.example
README.md
```

- [ ] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache postgresql16-client age curl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# --- Deps stage ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages packages
RUN pnpm install --frozen-lockfile

# --- Builder stage ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @opentab/web build

# --- Runner stage ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Web entrypoint
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder /app/apps/web/worker.ts ./apps/web/worker.ts
COPY --from=builder /app/apps/web/lib ./apps/web/lib
COPY --from=builder /app/apps/web/instrumentation.ts ./apps/web/instrumentation.ts

WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl --fail http://localhost:3000/api/healthz || exit 1
CMD ["pnpm", "start"]
```

- [ ] **Step 3: Test the build locally**

```bash
cd /home/claude/repos/opentab && docker build -f apps/web/Dockerfile -t opentab-web:test . 2>&1 | tail -20
```

Expected: builds successfully (may take 3-5 min first time). If pnpm complains about missing workspaces, ensure the COPY of `packages/` happened correctly.

If the build fails due to missing workspace deps, refine the COPY order.

- [ ] **Step 4: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/Dockerfile apps/web/.dockerignore && git commit -m "build: multi-stage production Dockerfile for Next.js + worker (#224)"
```

---

## Task 15 — `docker-compose.yml` at repo root

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create the compose file**

Create `docker-compose.yml` in the REPO ROOT:

```yaml
name: opentab

services:
  web:
    image: ${OPENTAB_IMAGE:-ghcr.io/frontz-technologies/opentab:latest}
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER:-opentab}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-opentab}
      REDIS_URL: redis://redis:6379
      APP_URL: ${APP_URL}
      NEXT_PUBLIC_APP_URL: ${APP_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${APP_URL}
      PUBLIC_REGISTRATION: ${PUBLIC_REGISTRATION:-off}
      EMAIL_DRIVER: smtp
      EMAIL_SMTP_HOST: ${EMAIL_SMTP_HOST}
      EMAIL_SMTP_PORT: ${EMAIL_SMTP_PORT}
      EMAIL_SMTP_USER: ${EMAIL_SMTP_USER}
      EMAIL_SMTP_PASSWORD: ${EMAIL_SMTP_PASSWORD}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-OpenTab}
      STORAGE_TYPE: ${STORAGE_TYPE:-s3}
      STORAGE_S3_REGION: ${STORAGE_S3_REGION}
      STORAGE_S3_BUCKET: ${STORAGE_S3_BUCKET}
      STORAGE_S3_ENDPOINT: ${STORAGE_S3_ENDPOINT}
      STORAGE_S3_ACCESS_KEY: ${STORAGE_S3_ACCESS_KEY}
      STORAGE_S3_SECRET_KEY: ${STORAGE_S3_SECRET_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      FEATURE_AI_CHAT: ${FEATURE_AI_CHAT:-off}
      FEATURE_AI_EXTRACTION: ${FEATURE_AI_EXTRACTION:-on}
      AI_MODEL_EXTRACTION: ${AI_MODEL_EXTRACTION:-openai/gpt-4o}
      NEXT_PUBLIC_FEATURE_AI_CHAT: ${FEATURE_AI_CHAT:-off}
      SENTRY_DSN: ${SENTRY_DSN:-}
      SENTRY_ENVIRONMENT: ${SENTRY_ENVIRONMENT:-production}
      MYDATA_USER_ID: ${MYDATA_USER_ID:-}
      MYDATA_SUBSCRIPTION_KEY: ${MYDATA_SUBSCRIPTION_KEY:-}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:3000/api/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s

  worker:
    image: ${OPENTAB_IMAGE:-ghcr.io/frontz-technologies/opentab:latest}
    restart: always
    command: ["pnpm", "worker"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER:-opentab}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-opentab}
      REDIS_URL: redis://redis:6379
      APP_URL: ${APP_URL}
      NEXT_PUBLIC_APP_URL: ${APP_URL}
      EMAIL_DRIVER: smtp
      EMAIL_SMTP_HOST: ${EMAIL_SMTP_HOST}
      EMAIL_SMTP_PORT: ${EMAIL_SMTP_PORT}
      EMAIL_SMTP_USER: ${EMAIL_SMTP_USER}
      EMAIL_SMTP_PASSWORD: ${EMAIL_SMTP_PASSWORD}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-OpenTab}
      STORAGE_TYPE: ${STORAGE_TYPE:-s3}
      STORAGE_S3_REGION: ${STORAGE_S3_REGION}
      STORAGE_S3_BUCKET: ${STORAGE_S3_BUCKET}
      STORAGE_S3_ENDPOINT: ${STORAGE_S3_ENDPOINT}
      STORAGE_S3_ACCESS_KEY: ${STORAGE_S3_ACCESS_KEY}
      STORAGE_S3_SECRET_KEY: ${STORAGE_S3_SECRET_KEY}
      BACKUP_S3_BUCKET: ${BACKUP_S3_BUCKET}
      BACKUP_S3_REGION: ${BACKUP_S3_REGION}
      BACKUP_S3_ENDPOINT: ${BACKUP_S3_ENDPOINT}
      BACKUP_S3_ACCESS_KEY: ${BACKUP_S3_ACCESS_KEY}
      BACKUP_S3_SECRET_KEY: ${BACKUP_S3_SECRET_KEY}
      BACKUP_AGE_PUBLIC_KEY: ${BACKUP_AGE_PUBLIC_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      SENTRY_DSN: ${SENTRY_DSN:-}
      SENTRY_ENVIRONMENT: ${SENTRY_ENVIRONMENT:-production}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      web:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-opentab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-opentab}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  glitchtip:
    image: glitchtip/glitchtip:v4
    restart: always
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-opentab}:${POSTGRES_PASSWORD}@db:5432/glitchtip
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
      PORT: "8000"
      EMAIL_URL: smtp://${EMAIL_SMTP_USER}:${EMAIL_SMTP_PASSWORD}@${EMAIL_SMTP_HOST}:${EMAIL_SMTP_PORT}
      DEFAULT_FROM_EMAIL: ${EMAIL_FROM_ADDRESS}
      GLITCHTIP_DOMAIN: ${GLITCHTIP_URL:-https://glitchtip.opentab.tech}
      ENABLE_USER_REGISTRATION: "false"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db-data:
  redis-data:
```

- [ ] **Step 2: Create the GlitchTip database (one-time, document in deploy README)**

Add a note to the deploy README that after first compose-up, run:

```bash
docker exec -it opentab-db-1 createdb -U opentab glitchtip
```

(This will be in the Task 18 README.)

- [ ] **Step 3: Validate compose syntax**

```bash
cd /home/claude/repos/opentab && docker compose config 2>&1 | head -20
```

Expected: prints the resolved config without errors (will warn about missing env vars, that's fine).

- [ ] **Step 4: Commit**

```bash
cd /home/claude/repos/opentab && git add docker-compose.yml && git commit -m "build: docker-compose for self-host + cloud (web, worker, db, redis, glitchtip) (#224)"
```

---

## Task 16 — `.env.example` documentation

**Files:**
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Read the current `.env.example`**

```bash
cd /home/claude/repos/opentab && cat apps/web/.env.example 2>/dev/null || echo "(does not exist)"
```

- [ ] **Step 2: Append new env var sections**

Append to `apps/web/.env.example` (or create it if missing) the following block. Preserve any existing content above:

```bash
# === Cloud / production env vars (added in #224) ===

# --- Public registration gate ---
# Set to "off" in cloud beta to disable /register; manual provisioning only.
PUBLIC_REGISTRATION=off

# --- Email (SMTP transport) ---
EMAIL_DRIVER=smtp
EMAIL_SMTP_HOST=smtp-relay.brevo.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
EMAIL_FROM_ADDRESS=noreply@opentab.tech
EMAIL_FROM_NAME=OpenTab

# --- Object storage (S3-compatible — Hetzner Object Storage in prod) ---
STORAGE_TYPE=s3
STORAGE_S3_REGION=nbg1
STORAGE_S3_BUCKET=opentab-pdfs
STORAGE_S3_ENDPOINT=https://nbg1.your-objectstorage.com
STORAGE_S3_ACCESS_KEY=
STORAGE_S3_SECRET_KEY=

# --- AI feature flags ---
OPENROUTER_API_KEY=
FEATURE_AI_CHAT=off
FEATURE_AI_EXTRACTION=on
AI_MODEL_EXTRACTION=openai/gpt-4o
# Mirror for client-side gating (Next.js public env)
NEXT_PUBLIC_FEATURE_AI_CHAT=off

# --- Error monitoring (GlitchTip on this box, Sentry-protocol) ---
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# --- Backups ---
BACKUP_S3_BUCKET=opentab-backups
BACKUP_S3_REGION=hel1
BACKUP_S3_ENDPOINT=https://hel1.your-objectstorage.com
BACKUP_S3_ACCESS_KEY=
BACKUP_S3_SECRET_KEY=
# age public key. Private key MUST live offline (1Password / printed).
BACKUP_AGE_PUBLIC_KEY=

# --- GlitchTip own config ---
GLITCHTIP_SECRET_KEY=
GLITCHTIP_URL=https://glitchtip.opentab.tech

# --- Postgres + auth secrets ---
POSTGRES_USER=opentab
POSTGRES_PASSWORD=
POSTGRES_DB=opentab
BETTER_AUTH_SECRET=
APP_URL=https://app.opentab.tech
```

- [ ] **Step 3: Commit**

```bash
cd /home/claude/repos/opentab && git add apps/web/.env.example && git commit -m "docs: env var inventory for cloud beta deploy (#224)"
```

---

## Task 17 — GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Coolify

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: deploy-cloud
  cancel-in-progress: false

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build & push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Trigger Coolify deploy
        run: |
          curl -fsS -X GET \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            "${{ secrets.COOLIFY_WEBHOOK_URL }}"
```

- [ ] **Step 2: Document required GitHub secrets in the deploy README**

Add to the README (Task 18):

- `COOLIFY_TOKEN` — API token from Coolify Profile → API Tokens
- `COOLIFY_WEBHOOK_URL` — deployment webhook from the application's "Webhooks" tab in Coolify

- [ ] **Step 3: Commit**

```bash
cd /home/claude/repos/opentab && git add .github/workflows/deploy.yml && git commit -m "ci: build → push GHCR → trigger Coolify deploy (#224)"
```

---

## Task 18 — Owner-facing deploy walkthrough (`docs/deploy/README.md`)

**Files:**
- Create: `docs/deploy/README.md`

- [ ] **Step 1: Create the README**

Create `docs/deploy/README.md`:

````markdown
# OpenTab Cloud Beta — Deploy Walkthrough

This is the step-by-step guide for John (the owner) to bring up `app.opentab.tech` from zero. Total active time: ~80 minutes spread over ~24 hours (DNS waits).

## Prerequisites
- Hetzner Cloud account (project "OpenTab" already exists, owner = John)
- Domain control over `opentab.tech` (and `opentab.gr` after registering)
- GitHub repo `Frontz-Technologies/opentab` (you already own it)

## Phase 1 — Domain (Day 1, ~10 min + 24h DNS wait)

### 1.1 Register opentab.gr
1. Open https://papaki.gr (or domains.eu)
2. Search `opentab.gr`, register for ~€10/yr
3. Note: GR-NIC requires Greek tax-ID for `.gr` domains (you have one)

### 1.2 DNS records for opentab.tech
On your DNS provider (likely papaki.gr or wherever opentab.tech is registered), add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | (server IP — fill in after Phase 2) | 300 |
| A | `app` | (server IP) | 300 |
| A | `coolify` | (server IP) | 300 |
| A | `glitchtip` | (server IP) | 300 |

Leave the value blank for now; come back after Phase 2.

For opentab.gr / opentab.cloud / opentab.one / publictab.com / publictab.net: leave alone for now (we'll set up redirects in Coolify in Phase 5).

## Phase 2 — Provision Hetzner CX32 (Day 1, ~10 min)

1. Go to https://console.hetzner.com → project OpenTab → "Add Server"
2. Choose:
   - **Location**: Nuremberg (nbg1)
   - **Image**: Ubuntu 24.04
   - **Type**: CX32 (4 vCPU, 8GB RAM, 80GB SSD) — €7.05/mo
   - **Networking**: IPv4 + IPv6 enabled
   - **SSH key**: paste your public key (`cat ~/.ssh/id_ed25519.pub`)
   - **Name**: `opentab-prod-1`
   - **Backups**: enable (10% extra = €0.70/mo, automatic snapshots)
3. Click "Create & Buy now"
4. Wait ~30 sec for provisioning. Note the IPv4 address — paste into Phase 1.2 DNS table.

## Phase 3 — Install Coolify (Day 1, ~10 min)

1. SSH in: `ssh root@<ip>` (accept the key prompt)
2. Run the official installer:
   ```bash
   curl -fsSL https://cdn.coolify.io/coolify/install.sh | bash
   ```
   Wait ~5 min while it installs Docker, pulls Coolify images, starts services.
3. When it finishes, it prints a URL like `http://<ip>:8000`. Open it in your browser.
4. Create the admin account (use a strong password — Coolify is the keys to the kingdom).

## Phase 4 — Coolify HTTPS (Day 1, ~5 min after DNS propagates)

1. In Coolify: Settings → Instance Settings
2. Set "Instance FQDN" to `https://coolify.opentab.tech`
3. Coolify will auto-provision a Let's Encrypt cert via Caddy
4. Verify: `https://coolify.opentab.tech` loads with valid SSL

## Phase 5 — Object Storage Buckets (Day 1, ~10 min)

1. In Hetzner Cloud console → Object Storage tab
2. Create 2 buckets:
   - **opentab-pdfs** in Nuremberg (`nbg1`) — for invoice PDFs
   - **opentab-backups** in Helsinki (`hel1`) — for DB backups (off-region!)
3. For each bucket, generate API credentials:
   - Click bucket → "Manage API Keys" → Create
   - **Save** the `accessKeyId` + `secretAccessKey` somewhere safe (you'll paste them in Phase 8)
   - Use SEPARATE credentials per bucket (so a backups-bucket leak can't affect PDFs)

## Phase 6 — Brevo Email (Day 1, ~15 min + 24h DNS wait)

1. Sign up: https://www.brevo.com → free tier (300 emails/day)
2. Settings → Senders & IP → Domains → Add `opentab.tech`
3. Brevo gives you 4 DNS records (SPF, DKIM x2, DMARC). Add each on your DNS provider.
4. Wait 24h for DNS propagation, then verify in Brevo (one-click "Verify" button)
5. SMTP credentials: Settings → SMTP & API → SMTP. Save the username + SMTP key for Phase 8.
6. Sender address: `noreply@opentab.tech` (you'll set this up in Brevo).

## Phase 7 — Generate Secrets (Day 1, ~5 min, before Phase 8)

Run these on your laptop or any Linux box:

```bash
# BETTER_AUTH_SECRET (32 random bytes, base64)
openssl rand -base64 32

# POSTGRES_PASSWORD
openssl rand -base64 24

# GLITCHTIP_SECRET_KEY (Django secret key, 50+ random chars)
openssl rand -base64 50

# Backup encryption key (age — install: brew install age, or apt install age)
age-keygen
# This prints:
#   Public key: age1abc...   ← put this in BACKUP_AGE_PUBLIC_KEY env
#   AGE-SECRET-KEY-1...      ← put this in 1Password OR print on paper, NEVER on the server
```

⚠️ **CRITICAL**: store the age private key in 2 places (1Password + printed paper in safe). Without it, encrypted backups are useless.

## Phase 8 — Deploy app to Coolify (Day 2, after DNS propagates, ~30 min)

### 8.1 Connect GitHub
1. Coolify → Sources → Add GitHub App → follow the 2-click flow to connect your GitHub account
2. Authorize the `Frontz-Technologies/opentab` repo

### 8.2 Create the Resource
1. Coolify → Projects → "OpenTab" → "+ New Resource" → "Docker Compose"
2. Source: GitHub → repo `Frontz-Technologies/opentab`, branch `main`
3. Compose file path: `docker-compose.yml`
4. Domain (for the `web` service): `https://app.opentab.tech`
5. Domain (for the `glitchtip` service): `https://glitchtip.opentab.tech`

### 8.3 Paste env vars
Coolify → your app → "Environment" tab. Paste this block, filling in the blanks from Phases 5/6/7:

```env
APP_URL=https://app.opentab.tech
NEXT_PUBLIC_APP_URL=https://app.opentab.tech
PUBLIC_REGISTRATION=off
BETTER_AUTH_SECRET=<from Phase 7>
POSTGRES_USER=opentab
POSTGRES_PASSWORD=<from Phase 7>
POSTGRES_DB=opentab

EMAIL_DRIVER=smtp
EMAIL_SMTP_HOST=smtp-relay.brevo.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=<from Brevo>
EMAIL_SMTP_PASSWORD=<from Brevo>
EMAIL_FROM_ADDRESS=noreply@opentab.tech
EMAIL_FROM_NAME=OpenTab

STORAGE_TYPE=s3
STORAGE_S3_REGION=nbg1
STORAGE_S3_BUCKET=opentab-pdfs
STORAGE_S3_ENDPOINT=https://nbg1.your-objectstorage.com
STORAGE_S3_ACCESS_KEY=<from Hetzner pdfs bucket>
STORAGE_S3_SECRET_KEY=<from Hetzner pdfs bucket>

OPENROUTER_API_KEY=<your OpenRouter key — leave blank if you don't want extraction yet>
FEATURE_AI_CHAT=off
FEATURE_AI_EXTRACTION=on
AI_MODEL_EXTRACTION=openai/gpt-4o
NEXT_PUBLIC_FEATURE_AI_CHAT=off

SENTRY_DSN=<set after Phase 9 — leave blank for now>
SENTRY_ENVIRONMENT=production

BACKUP_S3_BUCKET=opentab-backups
BACKUP_S3_REGION=hel1
BACKUP_S3_ENDPOINT=https://hel1.your-objectstorage.com
BACKUP_S3_ACCESS_KEY=<from Hetzner backups bucket>
BACKUP_S3_SECRET_KEY=<from Hetzner backups bucket>
BACKUP_AGE_PUBLIC_KEY=<from Phase 7, the age1... line>

GLITCHTIP_SECRET_KEY=<from Phase 7>
GLITCHTIP_URL=https://glitchtip.opentab.tech

MYDATA_USER_ID=<your aade.gr myDATA dev creds, from existing setup>
MYDATA_SUBSCRIPTION_KEY=<same>
```

### 8.4 First deploy
1. Click "Deploy"
2. Watch the logs — Coolify pulls the latest image from GHCR (you must have triggered the GHA workflow first by pushing to `main`; if not yet, do `git push origin main` from your laptop)
3. First deploy: ~3 min (pull + start). Subsequent: ~30s.
4. Verify: `curl https://app.opentab.tech/api/healthz` → `{"status":"ok","db":"ok","redis":"ok"}`

### 8.5 Initialize the GlitchTip DB
After first compose-up, GlitchTip needs its own DB (separate from opentab):

In Coolify → web service → Terminal tab:
```bash
PGPASSWORD=$POSTGRES_PASSWORD createdb -h db -U $POSTGRES_USER glitchtip
# Then restart the glitchtip container:
exit
```
Then in Coolify, restart only the glitchtip service.

## Phase 9 — Wire GlitchTip (Day 2, ~10 min)

1. Visit `https://glitchtip.opentab.tech`
2. Create the admin account (the FIRST signup is auto-admin — do this BEFORE anyone else can register; we set `ENABLE_USER_REGISTRATION=false` after)
3. Settings → set `ENABLE_USER_REGISTRATION=False` permanently
4. Create a project named "opentab-web", language: JavaScript, platform: Next.js
5. Copy the DSN (looks like `https://abc@glitchtip.opentab.tech/1`)
6. Coolify → web service env vars → set `SENTRY_DSN=<that-dsn>` → restart
7. Test: in the app, navigate to a non-existent route or trigger an error — should appear in GlitchTip within 30s.

## Phase 10 — Wire BetterStack (Day 2, ~10 min)

1. Sign up: https://betterstack.com (Logs + Uptime are the same account)
2. Logs:
   - Sources → Connect a source → Select "Node.js"
   - Copy the source token → Coolify env `BETTERSTACK_LOGS_TOKEN=...` → restart web
3. Uptime:
   - Monitors → "+ Create monitor" → URL: `https://app.opentab.tech/api/healthz`, expected status 200, check every 3 min
   - Add monitor for `https://glitchtip.opentab.tech/`
   - Add monitor for `https://coolify.opentab.tech/`
   - Set notification destination: your email (defaults work)

## Phase 11 — Provision First Beta User (Day 2, ~3 min)

In Coolify → web service → Terminal tab:

```bash
pnpm tsx apps/web/scripts/create-beta-user.ts \
  friend@example.com \
  "Maria Papadaki" \
  "Maria's Bakery"
```

The script will:
- Create the user via better-auth
- Auto-create the org (named after the user — they can rename later)
- Send a password-reset email to that address
- Print the magic-link URL as fallback

## Phase 12 — Smoke Test (Day 2, ~10 min)

Run through the spec's acceptance-criteria checklist (in `docs/deploy/cloud-beta-spec.md` § Acceptance criteria) — 14 items, ~30s each.

## Routine maintenance

### Adding a beta user
See Phase 11. ~30 seconds per user.

### Deploying a code change
Just `git push origin main`. GitHub Actions builds the image, pushes to GHCR, triggers Coolify webhook. ~3 min later it's live.

### Checking logs
- Live tail: Coolify → web service → "Logs" tab
- Search/filter: BetterStack web UI → Logs → "opentab-web" source
- Errors: GlitchTip web UI → Issues

### Quarterly restore drill
On the same Hetzner box (or any Linux box):

```bash
# 1. Download the latest backup
aws s3 cp \
  --endpoint-url https://hel1.your-objectstorage.com \
  s3://opentab-backups/db/2026-04-26.dump.age \
  ./backup.age

# 2. Decrypt with the age private key (load from 1Password into a temp file)
age -d -i ./age-private-key ./backup.age > ./backup.dump

# 3. Restore into a throwaway database
createdb -h <test-host> -U opentab opentab_restore_test
pg_restore -h <test-host> -U opentab -d opentab_restore_test ./backup.dump

# 4. Smoke check
psql -h <test-host> -U opentab opentab_restore_test -c "SELECT count(*) FROM users"

# 5. Drop the throwaway DB
dropdb -h <test-host> -U opentab opentab_restore_test
```

If this fails, **fix it before you have a real incident**.

## Troubleshooting

### `healthz` returns 503 with `db: fail`
- Container's `DATABASE_URL` is wrong, OR DB container isn't healthy
- Check: Coolify → db service → Logs

### `healthz` returns 503 with `redis: fail`
- Redis container down or Redis URL wrong
- Check: `docker exec opentab-redis-1 redis-cli ping`

### Emails not arriving
- Check Brevo dashboard → Statistics → see if the email left
- If yes, check the destination spam folder
- If no, check `EMAIL_SMTP_*` env vars and Brevo sender domain DNS verification status

### Coolify deploy hangs
- Click "View Logs" on the deploy
- Most common: build OOM (CX32 has 8GB; if you go heavier, scale up to CX42)
- Workaround: build offline via `docker buildx build` on your laptop, push to GHCR manually

### GlitchTip "page not loading"
- It needs ~30s after first start. Check `docker logs opentab-glitchtip-1`

## Migration triggers

When to upgrade things — see `docs/deploy/cloud-beta-spec.md` § Migration triggers.
````

- [ ] **Step 2: Commit**

```bash
cd /home/claude/repos/opentab && git add docs/deploy/README.md && git commit -m "docs: owner-facing cloud beta deploy walkthrough (#224)"
```

---

## Task 19 — Open the deploy PR

**Files:**
- (none — pure git)

- [ ] **Step 1: Push the branch**

```bash
cd /home/claude/repos/opentab && git push
```

- [ ] **Step 2: Open the PR**

```bash
cd /home/claude/repos/opentab && gh pr create --title "epic: closed-beta cloud deploy infrastructure (#224)" --assignee JohnFrontzos --reviewer JohnFrontzos --base main --body "$(cat <<'EOF'
Closes #224

## Summary

Lands all the code + ops scaffolding required to deploy OpenTab to a Hetzner CX32 box managed by Coolify, EU-only, ~€12/mo. Owner follows \`docs/deploy/README.md\` to bring the cloud up.

## What's in this PR

- Multi-stage \`apps/web/Dockerfile\` (Node 22 alpine, postgres-client + age preinstalled)
- \`docker-compose.yml\` at repo root: web, worker, postgres, redis, glitchtip
- \`/api/healthz\` route (DB+Redis ping, used by Coolify + BetterStack Uptime)
- \`apps/web/scripts/create-beta-user.ts\` — admin script to provision a closed-beta user
- nodemailer SMTP transport (\`lib/email/transport.ts\`) — wired to better-auth password reset + invoice send
- AI feature flags (\`lib/ai/features.ts\`) — chat off / extraction on / per-feature model env
- \`/register\` env-gated 404 when \`PUBLIC_REGISTRATION=off\`
- Sentry SDK init for self-hosted GlitchTip (\`apps/web/instrumentation.ts\`)
- Nightly age-encrypted pg_dump → off-region S3 backup job
- \`/legal\` page with Privacy + Terms + Cookies + DPA outline (en/el/es)
- \`.github/workflows/deploy.yml\` — build → push GHCR → trigger Coolify webhook
- \`docs/deploy/README.md\` — 12-phase owner walkthrough
- \`docs/deploy/cloud-beta-spec.md\` — design rationale (already merged earlier)

## Test plan

- [x] Vitest: 6 new test files, all green
- [x] \`pnpm format:check\` from repo root
- [x] \`pnpm lint\`
- [x] \`pnpm tsc --noEmit\` no new errors in any file touched
- [x] \`docker build -f apps/web/Dockerfile .\` succeeds locally
- [x] \`docker compose config\` validates
- [ ] Smoke test on real cloud (Phase 12 of \`docs/deploy/README.md\`) — owner runs after deploy

## What's NOT in this PR (deferred to later issues)

- Public registration UI (#TBD)
- Demo subdomain
- Marketing landing page
- Lemon Squeezy billing
- Email templates feature (#223)
- AI chat fix (#154)
- iubenda subscription
- BetterStack MCP wrapper
- Loki+Grafana logs
EOF
)"
```

- [ ] **Step 3: Notify owner via Telegram** (handled by the agent in conversation, not in the plan)

---

## Self-review checklist (run after writing the plan)

### Spec coverage

| Spec section | Implemented in task |
|---|---|
| § Architecture: 5 containers | Task 15 |
| § Architecture: external services | Tasks 14, 15 |
| § Architecture: domains | Task 18 (DNS phase 1.2) |
| § Code changes: Dockerfile | Task 14 |
| § Code changes: docker-compose | Task 15 |
| § Code changes: /healthz | Task 9 |
| § Code changes: create-beta-user | Task 10 |
| § Code changes: email transport | Task 2 |
| § Code changes: AI features | Task 5, 6, 7 |
| § Code changes: instrumentation | Task 11 |
| § Code changes: /legal | Task 13 |
| § Code changes: backup worker | Task 12 |
| § Code changes: docs/deploy/README.md | Task 18 |
| § Code changes: lib/invoicing/email.ts refactor | Task 3 |
| § Code changes: better-auth password reset wire | Task 4 |
| § Code changes: /register guard | Task 8 |
| § Code changes: .env.example | Task 16 |
| § Env var inventory | Tasks 15, 16, 18 |
| § Deploy procedure 12 steps | Task 18 |
| § Backups | Tasks 12, 18 (Phase 7, restore drill) |
| § Monitoring (GlitchTip + BetterStack) | Tasks 11, 15, 18 (Phases 9, 10) |
| § Auth/signup flow | Tasks 4, 8, 10 |
| § AI features matrix | Tasks 5-7 |
| § /legal page | Task 13 |
| § Acceptance criteria | Task 19 (PR test plan) + Task 18 Phase 12 |
| § Files / branches | Task 19 |

All spec sections covered ✓.

### Placeholder scan
- "TODO" / "TBD" / "implement later": none in code blocks. The README mentions "TBD" for one GitHub-secrets follow-up — that's intentional since the secret name is fixed in the spec.
- "Add appropriate error handling": none. Each step has explicit error paths.
- "Similar to Task N": none. Code is repeated where needed.

### Type consistency
- `sendEmail({ to, subject, text, html?, attachments? })` — same signature across Tasks 2, 3, 4
- `isFeatureEnabled("chat" | "extraction")` — same enum across Tasks 5, 6, 7
- `getFeatureModel(...)` — same enum
- `processBackup` returns `{ key: string }` — used in Task 12 only
- `QUEUE.BACKUP` constant — added in Task 12 step 1, referenced in step 7
- `getRedisConnection` from `@/lib/jobs/queues` — used in Task 9 + Task 12 (matches existing import in `apps/web/worker.ts`)

All types consistent ✓.

---

**Plan complete.** Saved to `docs/deploy/cloud-beta-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

The owner is non-DevOps and waiting on Telegram. Recommendation: **Subagent-Driven** — each task is small enough to fit in a fresh agent's context, the plan is self-contained, and the owner can monitor PR diffs as they land instead of one giant final commit.
