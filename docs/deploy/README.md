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

| Type | Name        | Value                               | TTL |
| ---- | ----------- | ----------------------------------- | --- |
| A    | `@`         | (server IP — fill in after Phase 2) | 300 |
| A    | `app`       | (server IP)                         | 300 |
| A    | `coolify`   | (server IP)                         | 300 |
| A    | `glitchtip` | (server IP)                         | 300 |

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

Walk through this checklist (~30s each):

- [ ] `https://app.opentab.tech` resolves with valid SSL
- [ ] `https://app.opentab.tech/api/healthz` returns `{"status":"ok","db":"ok","redis":"ok"}`
- [ ] Logged-in user can create a contact, create an invoice, send the invoice — PDF email lands in inbox within 30s
- [ ] Receipt photo upload → AI extraction returns parsed expense in <10s (when `OPENROUTER_API_KEY` is set)
- [ ] AI chat FAB is hidden, `/api/ai/chat` returns 404
- [ ] `/register` returns 404 (public registration disabled)
- [ ] `/forgot-password` → email lands within 30s, reset link works
- [ ] `create-beta-user.ts` script via Coolify Terminal: new user gets set-password email
- [ ] Manually-triggered error appears in GlitchTip within 30s with full stack trace
- [ ] Pino log line in app appears in BetterStack web UI within 30s
- [ ] BetterStack Uptime monitor for `/healthz` is green
- [ ] First nightly backup runs (after 03:00 Athens), file appears in `opentab-backups/db/<date>.dump.age` in hel1 bucket
- [ ] `/legal` page accessible, GR/EN/ES toggle works, all 4 sections present
- [ ] This walkthrough reads end-to-end without surprises (file an issue if a step is unclear)

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

## Migration triggers — when to upgrade what

Tier 2 (this setup, ~€12/mo) → Tier 1 (V1 production, ~€87/mo):

| Trigger                    | Migrate from                      | Migrate to                    | Cost delta        |
| -------------------------- | --------------------------------- | ----------------------------- | ----------------- |
| First non-friend signup    | hand-written `/legal` page        | iubenda Ultimate              | +€8/mo            |
| Adding paid plan / billing | hand-written `/legal`             | iubenda + lawyer review       | +€8/mo + one-time |
| GlitchTip MCP friction     | self-hosted GlitchTip             | self-hosted Sentry on +1 CX32 | +€7/mo            |
| DB > 500 MB                | self-hosted Postgres in container | Neon Launch Frankfurt         | +€18/mo           |
| Daily emails > 9000        | Brevo Free                        | Brevo Business 20k            | +€25/mo           |
| 8GB RAM saturated          | CX32                              | CX42                          | +€8/mo            |
| Need separate worker box   | shared box                        | +1 CX22 worker box            | +€6/mo            |

All swaps are env-var changes — no code redeploy needed for DB/Redis/email/storage migrations.
