#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER:-opentab}" -q 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
pnpm db:push

echo "Starting OpenTab..."
exec "$@"
