#!/bin/bash
set -e

echo "Running GIMS database initialization..."

# Run schema migration
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql

# Run seeds
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/seeds/001_categories.sql

echo "GIMS database initialization complete!"
