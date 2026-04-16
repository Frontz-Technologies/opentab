# OpenTab — Docker convenience commands

DEV_COMPOSE     = docker compose -f docker/docker-compose.dev.yml
PROD_COMPOSE    = docker compose -f docker/docker-compose.yml
COOLIFY_COMPOSE = docker compose -f docker/docker-compose.coolify.yml

# ── Development ──────────────────────────────────────────────────────────────

.PHONY: dev dev-down dev-build dev-logs dev-ps

dev:
	$(DEV_COMPOSE) up --build

dev-down:
	$(DEV_COMPOSE) down

dev-build:
	$(DEV_COMPOSE) build

dev-logs:
	$(DEV_COMPOSE) logs -f app

dev-ps:
	$(DEV_COMPOSE) ps

# ── Production ───────────────────────────────────────────────────────────────

.PHONY: prod prod-down prod-build prod-logs prod-ps

prod:
	$(PROD_COMPOSE) --env-file docker/.env up --build -d

prod-down:
	$(PROD_COMPOSE) --env-file docker/.env down

prod-build:
	$(PROD_COMPOSE) --env-file docker/.env build

prod-logs:
	$(PROD_COMPOSE) --env-file docker/.env logs -f app

prod-ps:
	$(PROD_COMPOSE) --env-file docker/.env ps

# ── Coolify / PaaS ──────────────────────────────────────────────────────────

.PHONY: coolify coolify-down coolify-build coolify-logs coolify-ps

coolify:
	$(COOLIFY_COMPOSE) --env-file docker/.env up --build -d

coolify-down:
	$(COOLIFY_COMPOSE) --env-file docker/.env down

coolify-build:
	$(COOLIFY_COMPOSE) --env-file docker/.env build

coolify-logs:
	$(COOLIFY_COMPOSE) --env-file docker/.env logs -f app

coolify-ps:
	$(COOLIFY_COMPOSE) --env-file docker/.env ps

# ── Database ─────────────────────────────────────────────────────────────────

.PHONY: db-push db-shell

db-push:
	$(DEV_COMPOSE) exec app pnpm --filter @opentab/db db:push

db-shell:
	$(DEV_COMPOSE) exec postgres psql -U $${POSTGRES_USER:-opentab} -d $${POSTGRES_DB:-opentab_dev}

# ── Cleanup ──────────────────────────────────────────────────────────────────

.PHONY: clean

clean:
	$(DEV_COMPOSE) down -v
	$(PROD_COMPOSE) down -v
	$(COOLIFY_COMPOSE) down -v
