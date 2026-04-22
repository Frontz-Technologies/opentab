#!/bin/sh
set -e

DB_HOST="postgres"
DB_USER="${POSTGRES_USER:-opentab}"
DB_NAME="${POSTGRES_DB:-opentab_dev}"

echo "Waiting for PostgreSQL..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" -q; do
  sleep 1
done
echo "PostgreSQL is ready."

# Ensure the target database exists (handles stale volumes)
echo "Checking database '$DB_NAME' exists..."
if ! PGPASSWORD="${POSTGRES_PASSWORD:-opentab_dev}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
  echo "Database '$DB_NAME' not found. Creating..."
  PGPASSWORD="${POSTGRES_PASSWORD:-opentab_dev}" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
  echo "Database '$DB_NAME' created."
else
  echo "Database '$DB_NAME' exists."
fi

echo "Pushing database schema..."
pnpm --filter @opentab/db db:push

echo "Starting dev server..."
# Bypass turbo and spawn next dev directly. Turbo 2.9.6's env passthrough
# (`globalPassThroughEnv` / `tasks.dev.passThroughEnv` / `envMode: loose`)
# strips server-only env vars at the turbo→pnpm-run-dev process boundary
# for persistent tasks, breaking DEMO_SAMPLE_DATA_ENABLED in the docker
# dev stack. NEXT_PUBLIC_* still propagates via Next.js framework
# inference, so the "Try the demo" card renders but the server action
# short-circuits with "Demo mode is not enabled on this deployment".
# Running next dev directly via pnpm's workspace filter keeps the full
# container env available to next-server. Nothing else in the monorepo
# needs `turbo dev` — @opentab/web is the only package with a dev script.
exec pnpm --filter @opentab/web dev
