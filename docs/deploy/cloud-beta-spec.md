# OpenTab Cloud Beta Deploy — Design Spec

**Author:** John Frontzos + AI dev agent
**Date:** 2026-04-26
**Status:** Approved (pending file review)

## Goal

Get a closed-beta cloud deployment of OpenTab live at `app.opentab.tech` for ~10 manually-provisioned friend users at the lowest sustainable cost (~€8/mo), architected so we can swap to managed services (Tier 1) without code changes when paying customers arrive.

## Constraints (hard)

- **EU-only data residency.** Greek invoicing/accounting app with myDATA integration; GDPR-strict.
- **Self-hostable.** OSS users must be able to run the same docker-compose locally.
- **Env-driven service swap.** Every external service (DB, Redis, storage, SMTP, error monitoring) behind env vars — Tier 1 migration is config-only.
- **BullMQ Redis requirement.** Full Redis with `--maxmemory-policy noeviction` (NOT Upstash PAYG — Lua quirks + idle-poll billing).
- **Owner is non-DevOps.** Web UIs over CLI tools where possible. Step-by-step click instructions in the implementation plan.

## Architecture

### Single Hetzner CX32 box (Nuremberg, nbg1) running Coolify
- 4 vCPU, 8 GB RAM, 80 GB SSD, 20 TB egress, ~€7/mo
- Ubuntu 24.04 LTS
- Coolify installed via official one-liner (manages all containers below)

### 5 containers via docker-compose
| Container | Image | Purpose |
|---|---|---|
| `opentab-web` | `ghcr.io/frontz-technologies/opentab:<sha>` | Next.js 15 app, port 3000, healthcheck `/healthz` |
| `opentab-worker` | same image, `command: [tsx, workers/index.ts]` | BullMQ workers, no public port, `DISABLE_DB_MIGRATIONS=true` |
| `postgres` | `postgres:16` | Schema: opentab + glitchtip (separate DBs) |
| `redis` | `redis:7-alpine` | Args: `--maxmemory-policy noeviction` (BullMQ requirement) |
| `glitchtip` | `glitchtip/glitchtip` | Sentry-protocol-compatible error monitoring, port 8000 |

Coolify itself is the 6th process (manages the others, exposes UI at `coolify.opentab.tech`).

### External services (all behind env vars, swappable)
| Service | Provider (beta) | Provider (V1) | Beta cost |
|---|---|---|---|
| Object storage (PDFs) | Hetzner Object Storage nbg1 | same | €1/mo (50GB) |
| Backups | Hetzner Object Storage hel1 | same | €0.30/mo |
| SMTP | Brevo Free (300/day) | Brevo Business 20k/mo | €0 → €25 |
| Error monitoring | GlitchTip self-hosted (this box) | Self-hosted Sentry on dedicated box | €0 → €7/mo |
| Logs | BetterStack Logs Free (1GB/3d, EU-HQ Czech) | BetterStack paid | €0 → €23 |
| Uptime | BetterStack Uptime Free | same | €0 |
| AI (extraction only for beta) | OpenRouter | same | usage-based |
| GDPR docs | Hand-written `/legal` page | iubenda Ultimate (€99/yr) | €0 → €8 |

### Domains
- **opentab.tech** (primary) → root: redirect to `app.opentab.tech` for now (later: marketing site)
- **app.opentab.tech** → the Next.js app (Coolify routes 80/443 to opentab-web:3000 via Caddy)
- **coolify.opentab.tech** → Coolify admin UI (only owner has login)
- **glitchtip.opentab.tech** → GlitchTip web UI (owner + me invited as team)
- **opentab.gr** → 301 redirect to `opentab.tech` for now (later: GR-localized marketing landing)
- **opentab.cloud, opentab.one, publictab.com, publictab.net** → 301 to opentab.tech in Coolify

## Code changes (in scope for this deploy)

### New files
| File | Purpose | Approx LOC |
|---|---|---|
| `apps/web/Dockerfile` | Multi-stage Next.js 15 production build | 30 |
| `docker-compose.yml` (repo root) | 5-service compose for cloud + self-host | 100 |
| `apps/web/app/api/healthz/route.ts` | DB+Redis ping, 200 if both up | 25 |
| `apps/web/scripts/create-beta-user.ts` | Admin script to provision a user via better-auth API | 40 |
| `apps/web/lib/email/transport.ts` | nodemailer SMTP transport, used by all email sends | 50 |
| `apps/web/lib/ai/features.ts` | Per-feature config (FEATURE_AI_*, AI_MODEL_*) | 40 |
| `apps/web/instrumentation.ts` | Sentry SDK init pointing at GlitchTip | 20 |
| `apps/web/app/(marketing)/legal/page.tsx` | Privacy + Terms + Cookies + DPA outline (en/el) | 200 |
| `apps/web/workers/backup.ts` | Nightly pg_dump → age encrypt → s3 upload | 80 |
| `docs/deploy/README.md` | Owner-facing deploy walkthrough | 300 |

### Modified files
- `apps/web/lib/invoicing/email.ts:114` — replace placeholder `sendInvoiceEmail` with nodemailer transport call. Drop the AI generation path entirely (lib/invoicing/email.ts:13-23, the whole `generateInvoiceEmail` AI fork). Use the existing `generateFallbackEmail()` for v1 of beta. Email-templates feature (issue #223) replaces this later.
- `apps/web/app/(auth)/register/page.tsx` — add `if (process.env.PUBLIC_REGISTRATION === "off") notFound()` at top
- `apps/web/lib/auth.ts` (or wherever better-auth is configured) — wire `sendResetPassword` to use the new SMTP transport
- `apps/web/lib/expenses/ai-extraction.ts` — read `FEATURE_AI_EXTRACTION` env, use `AI_MODEL_EXTRACTION` instead of hard-coded model
- `apps/web/app/api/ai/chat/route.ts` — gate behind `FEATURE_AI_CHAT`, return 404 when off
- `apps/web/components/<chat-fab>.tsx` — hide the FAB when `process.env.NEXT_PUBLIC_FEATURE_AI_CHAT !== "on"`
- `.env.example` — document all new env vars

## Env var inventory

### App (~25 vars)
```
# --- Core ---
NODE_ENV=production
APP_URL=https://app.opentab.tech
APP_NAME=OpenTab

# --- Database ---
DATABASE_URL=postgres://opentab:<pwd>@postgres:5432/opentab

# --- Redis (BullMQ) ---
REDIS_URL=redis://redis:6379

# --- Object storage (S3-compatible) ---
STORAGE_TYPE=s3
STORAGE_S3_REGION=nbg1
STORAGE_S3_BUCKET=opentab-pdfs
STORAGE_S3_ENDPOINT=https://nbg1.your-objectstorage.com
STORAGE_S3_ACCESS_KEY=<from-hetzner>
STORAGE_S3_SECRET_KEY=<from-hetzner>

# --- Email (Brevo SMTP) ---
EMAIL_DRIVER=smtp
EMAIL_SMTP_HOST=smtp-relay.brevo.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=<brevo-account-email>
EMAIL_SMTP_PASSWORD=<brevo-smtp-key>
EMAIL_FROM_ADDRESS=noreply@opentab.tech
EMAIL_FROM_NAME=OpenTab

# --- Auth (better-auth) ---
BETTER_AUTH_SECRET=<random-32-bytes>
BETTER_AUTH_URL=https://app.opentab.tech
PUBLIC_REGISTRATION=off

# --- AI features ---
OPENROUTER_API_KEY=<from-openrouter>
FEATURE_AI_CHAT=off
FEATURE_AI_EXTRACTION=on
AI_MODEL_EXTRACTION=openai/gpt-4o
NEXT_PUBLIC_FEATURE_AI_CHAT=off

# --- Monitoring (GlitchTip) ---
SENTRY_DSN=https://<key>@glitchtip.opentab.tech/<project-id>
SENTRY_ENVIRONMENT=production

# --- Logs (BetterStack) ---
BETTERSTACK_LOGS_TOKEN=<source-token>

# --- Backups ---
BACKUP_S3_BUCKET=opentab-backups
BACKUP_S3_REGION=hel1
BACKUP_S3_ENDPOINT=https://hel1.your-objectstorage.com
BACKUP_S3_ACCESS_KEY=<separate-key-write-only>
BACKUP_S3_SECRET_KEY=<separate-key-write-only>
BACKUP_AGE_PUBLIC_KEY=age1...     # private key NEVER lives on the box
BACKUP_RETENTION_DAYS=30

# --- myDATA (existing) ---
MYDATA_USER_ID=...
MYDATA_SUBSCRIPTION_KEY=...
```

### Coolify-managed (separate from app)
- `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_URL` — for GitHub Actions CI/CD

## Deploy procedure (12 steps)

The implementation plan will expand each into bite-sized tasks. High level:

| # | Step | Owner does | Time |
|---|---|---|---|
| 1 | Register `opentab.gr` at papaki.gr or domains.eu | manual click-through | 5 min + €10/yr |
| 2 | Configure DNS for opentab.tech subdomains | A records → Hetzner box IP | 10 min + 24h propagation |
| 3 | Provision CX32 nbg1 (Ubuntu 24.04) in Hetzner Cloud console | click + SSH key upload | 5 min |
| 4 | SSH to box + install Coolify (one-liner from coolify.io) | run scripted command | 10 min (auto) |
| 5 | Open Coolify at coolify.opentab.tech, complete first-run setup | browser, set admin password | 5 min |
| 6 | Create Hetzner Object Storage buckets: `opentab-pdfs` (nbg1) + `opentab-backups` (hel1) | Hetzner console | 10 min |
| 7 | Create Brevo account, verify sender domain via 4 DNS records (SPF, DKIM x2, DMARC) | Brevo signup + DNS records | 15 min + 24h DNS |
| 8 | Push Dockerfile + docker-compose.yml + all code changes to opentab repo | done by AI in implementation plan | n/a |
| 9 | In Coolify: New Resource → Docker Compose → connect to GitHub repo → select branch | click-through | 10 min |
| 10 | Paste env vars into Coolify "Environment" tab (use the inventory above) | copy-paste | 10 min |
| 11 | Trigger first deploy (Coolify auto-builds from Dockerfile, pulls images, starts compose) | click "Deploy" | 5 min build + watch logs |
| 12 | Run `create-beta-user.ts` for first 2-3 friends via Coolify Terminal | one command per user | 1 min/user |

**Total active owner time:** ~80 minutes spread over ~24 hours (DNS propagation forces wait between steps 2/7 and 11).

## Backups

- **Schedule:** nightly at 03:00 Athens (00:00 UTC) via Coolify scheduled task
- **Process:** `pg_dump -Fc opentab | age -r $BACKUP_AGE_PUBLIC_KEY | aws s3 cp - s3://opentab-backups/db/<date>.dump.age --endpoint-url $BACKUP_S3_ENDPOINT`
- **Encryption:** age (modern, simple). Public key in env. **Private key lives offline** (owner stores in 1Password / paper / yubikey). Without the private key, even compromised backups are useless.
- **Retention:** 30-day daily; weekly retained 90 days; monthly retained 1 year. Lifecycle policy on the bucket handles deletion.
- **Off-region:** backups bucket is in Helsinki (hel1) while DB is in Nuremberg (nbg1) → real disaster-recovery isolation
- **Quarterly restore drill:** I'll script a one-command restore-into-throwaway-DB + smoke test that owner runs every 3 months. Without this, backups are theatre.

## Monitoring

### GlitchTip (errors)
- Self-hosted on the same box, accessible at `glitchtip.opentab.tech`
- Sentry SDK in `apps/web/instrumentation.ts` reports there
- Web UI: owner + AI dev agent invited as team members
- Email-on-new-error → uses our Brevo SMTP

### BetterStack Logs
- Pino in opentab-web/worker → BetterStack source token → web UI
- Free tier: 1GB/3-day retention (plenty for 10 users, low traffic)
- Search by service, level, time range
- Owner + AI invited

### BetterStack Uptime
- Monitors: `https://app.opentab.tech/healthz`, `https://glitchtip.opentab.tech/`, `https://coolify.opentab.tech/`
- Free tier: 10 endpoints, 3-min check interval
- Email + (later) SMS alerts
- Status page (public): `status.opentab.tech` (defer until launch)

### Coolify built-in
- Container logs visible in Coolify UI for live tailing
- Resource usage graphs (CPU, RAM, disk, network)

## Email

### Brevo Free (beta)
- 300 emails/day = ~9k/mo (more than sufficient for 10 users)
- SMTP relay: smtp-relay.brevo.com:587
- Sender domain `opentab.tech` verified via 4 DNS records (SPF, DKIM x2, DMARC)
- Sender address: `noreply@opentab.tech`

### Use cases (beta)
- Password reset emails (better-auth)
- Welcome / set-password emails (from create-beta-user script)
- Invoice send (uses static `generateFallbackEmail()` template — see issue #223 for full template feature)

### Out of scope for beta
- Marketing newsletters (Brevo Marketing UI)
- Email template editor (issue #223)
- Multi-language templates per org

## Auth / signup flow

### /register page
- Public registration disabled via `PUBLIC_REGISTRATION=off`
- Page returns 404 — beta users cannot self-signup

### Beta provisioning
- Owner runs `pnpm tsx scripts/create-beta-user.ts <email> "<name>" "<orgName>"` via Coolify Terminal
- Script calls better-auth's `auth.api.signUpEmail()` → creates user + organization + sends "set password" email via SMTP
- If SMTP not yet configured: script prints a magic-link URL for owner to send manually
- Script is throwaway code — delete the file when public registration opens

### Password reset
- Existing `/forgot-password` and `/reset-password` pages already implemented (better-auth)
- Email transport now wired through Brevo SMTP

## AI features matrix (beta)

| Feature | Status (beta) | Env flag | Model env |
|---|---|---|---|
| AI chat (#154) | ❌ Disabled (known bug, fix later) | `FEATURE_AI_CHAT=off` | n/a |
| AI receipt extraction | ✅ Enabled (vision needed) | `FEATURE_AI_EXTRACTION=on` | `AI_MODEL_EXTRACTION=openai/gpt-4o` |
| AI invoice email per-send | ❌ Removed (not wanted by owner) | (n/a, code path deleted) | n/a |
| AI email-template suggestion | ⚪ Not yet implemented | (covered by issue #223) | n/a |

## /legal page

Hand-written, ~30 minutes to draft, free. Located at `app.opentab.tech/legal`. Sections:

- **Privacy Policy** — what data we collect (account, invoices, contacts, PDFs, logs), why (operate the service), how long (retention policy), where (Hetzner Germany + Helsinki backups), user rights (access, export, delete via support email), DPO contact
- **Terms of Service** — beta status, no SLA promised, free-of-charge during beta, may be discontinued, data export available, jurisdiction (Greek courts / EU consumer law)
- **Cookie Notice** — what cookies (session, csrf), no marketing/tracking cookies in beta
- **DPA outline** — short data-processor obligations summary, full DPA template available on request via support email

Greek translation provided (en/el toggle on the page using next-intl, same as rest of app).

**Replace with iubenda Ultimate when:** first non-friend signs up, OR before adding billing, whichever first.

## Cost summary (beta, monthly)

| Item | EUR/mo |
|---|---|
| Hetzner CX32 (Nuremberg) | 7.05 |
| Hetzner Object Storage nbg1 (PDFs, ~50GB) | 0.30 |
| Hetzner Object Storage hel1 (backups, ~10GB) | 0.30 |
| Brevo Free | 0 |
| GlitchTip self-hosted | 0 |
| BetterStack Logs+Uptime Free | 0 |
| OpenRouter (extraction only, very low usage) | ~1 |
| iubenda | 0 (using free /legal) |
| Domain renewals (4 .com/.tech/.cloud/.one + .gr ÷ 12) | ~3 |
| **TOTAL** | **~€12/mo** |

## Migration triggers (beta → V1 production)

Document these in `docs/deploy/README.md` so owner knows when to upgrade what:

| Trigger | Migrate from | Migrate to | Cost delta |
|---|---|---|---|
| First non-friend signup | hand-written /legal | iubenda Ultimate | +€8/mo |
| First non-friend signup | (no DPA) | iubenda DPA | included above |
| Adding paid plan / billing | hand-written /legal | iubenda + lawyer review | +€8/mo + one-time fee |
| GlitchTip MCP friction | self-hosted GlitchTip | self-hosted Sentry on +1 CX32 | +€7/mo |
| DB > 500 MB | self-hosted Postgres | Neon Launch Frankfurt | +€18/mo |
| Daily emails > 9000 | Brevo Free | Brevo Business 20k | +€25/mo |
| 8GB RAM saturated | CX32 | CX42 | +€8/mo |
| Need separate worker box | shared box | +1 CX22 worker box | +€6/mo |

## Out of scope (deferred to follow-up issues)

- Public registration UI (keep code, env-gated for now)
- Demo subdomain with hourly reset
- Marketing landing page at opentab.tech root
- BetterStack MCP wrapper (~half day if we hit need)
- Loki+Grafana logs (BetterStack covers it)
- Lemon Squeezy billing integration
- Plan-table + entitlement system
- Email template feature (issue #223)
- AI chat fix (issue #154)
- Email transactional templates beyond fallback
- Multi-region failover
- Status page (status.opentab.tech)
- Customer support inbox routing

## Acceptance criteria

- [ ] `app.opentab.tech` resolves with valid SSL (Let's Encrypt via Coolify/Caddy)
- [ ] Healthcheck `https://app.opentab.tech/healthz` returns 200 with DB+Redis status
- [ ] Logged-in user can create a contact, create an invoice, send the invoice (PDF email lands in their personal inbox)
- [ ] Receipt photo upload → AI extraction returns parsed expense in <10s
- [ ] AI chat FAB is hidden, `/api/ai/chat` returns 404
- [ ] `/register` returns 404 (public registration disabled)
- [ ] `/forgot-password` → email lands within 30s, reset link works
- [ ] Owner can run `create-beta-user.ts` via Coolify Terminal, new user gets set-password email
- [ ] Manually-triggered error (e.g. throw in a debug page) appears in GlitchTip within 30s with full stack trace
- [ ] Pino log line in app appears in BetterStack web UI within 30s
- [ ] BetterStack Uptime monitor for `/healthz` is green
- [ ] Nightly backup runs, file appears in `opentab-backups/db/<date>.dump.age` in hel1 bucket
- [ ] `docs/deploy/README.md` reads end-to-end as a friendly walkthrough that a non-DevOps human can follow
- [ ] `/legal` page accessible, GR/EN toggle works, all 4 sections present

## Files / branches to be created

- Branch: `feature/cloud-deploy` (forked from `main`)
- Spec: `docs/deploy/cloud-beta-spec.md` (this document)
- Implementation plan: `docs/deploy/cloud-beta-plan.md` (next step, generated by writing-plans skill)
- Owner walkthrough: `docs/deploy/README.md` (owner-facing, generated as part of implementation)
- PR closes: #224 (epic: closed-beta cloud deploy)

## Open questions / risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| First Next.js production build OOMs on CX32 (Next builds are RAM-hungry) | Medium | Build off-server in GitHub Actions → push to GHCR → Coolify pulls. Documented in CI/CD section. |
| Brevo sender-domain DNS propagation slower than 24h | Low | Use Brevo's "verify with API key" fallback for first send if DNS not ready |
| Coolify update breaks something at a critical moment | Low | Pin Coolify version, only upgrade in maintenance windows |
| age public key gets lost → all backups become unrecoverable | Medium | Backup the private key in 2 places (1Password + printed paper in safe). Test restore quarterly. |
| Hetzner outage in nbg1 | Low | Backups in different region (hel1) → restore to fresh box if needed. Acceptable RTO for closed beta is hours, not minutes. |
| GlitchTip MCP coverage too thin → owner has to debug solo | Medium | Migration trigger documented (→ self-hosted Sentry). Estimated 4-hour migration if we hit it. |

## Implementation handoff

After owner approval of this spec → invoke `superpowers:writing-plans` skill → produce `docs/deploy/cloud-beta-plan.md` with bite-sized tasks (Dockerfile creation, docker-compose draft, healthz endpoint, create-beta-user script, email transport, AI features module, /register guard, instrumentation, /legal page, backup worker, owner walkthrough doc, CI/CD workflow, smoke-test checklist).
