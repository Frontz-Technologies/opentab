#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER:-opentab}" -q; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Pushing database schema..."
pnpm --filter @opentab/db db:push

echo "Starting dev server..."
exec pnpm dev
