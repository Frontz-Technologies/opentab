#!/bin/sh
set -e

DB_HOST="postgres"
DB_USER="${POSTGRES_USER:-opentab}"
DB_NAME="${POSTGRES_DB:-opentab}"

echo "Waiting for PostgreSQL..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

# Ensure the target database exists (handles stale volumes)
echo "Checking database '$DB_NAME' exists..."
if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
  echo "Database '$DB_NAME' not found. Creating..."
  PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
  echo "Database '$DB_NAME' created."
else
  echo "Database '$DB_NAME' exists."
fi

echo "Running database migrations..."
pnpm --filter @opentab/db db:push

echo "Starting OpenTab..."
exec "$@"
