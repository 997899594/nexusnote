#!/bin/bash
set -e

# NexusNote Deployment Script
# Usage: ./scripts/deploy.sh [dev|prod]

ENV=${1:-dev}
PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")

echo "=========================================="
echo "NexusNote Deployment - $ENV"
echo "=========================================="

cd "$PROJECT_ROOT"

# Check required environment variables for production
if [ "$ENV" = "prod" ]; then
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "Error: OPENAI_API_KEY is required for production"
        exit 1
    fi
    if [ -z "$POSTGRES_PASSWORD" ]; then
        echo "Error: POSTGRES_PASSWORD is required for production"
        exit 1
    fi
    if [ -z "$JWT_SECRET" ]; then
        echo "Error: JWT_SECRET is required for production"
        exit 1
    fi
fi

# Development deployment
if [ "$ENV" = "dev" ]; then
    echo "[1/3] Starting database services..."
    docker compose up -d postgres redis

    echo "[2/3] Waiting for services to be healthy..."
    sleep 5

    echo "[3/3] Running database migrations..."
    docker exec -i nexusnote-db psql -U postgres -d nexusnote < packages/db/migrations/001_init.sql 2>/dev/null || true

    echo ""
    echo "=========================================="
    echo "Development environment ready!"
    echo "=========================================="
    echo ""
    echo "Run 'pnpm dev' to start the application"
    echo ""
    echo "Services:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis: localhost:6379"
    echo ""
fi

# Production deployment
if [ "$ENV" = "prod" ]; then
    echo "[1/4] Building Docker images..."
    docker compose -f docker-compose.prod.yml build

    echo "[2/4] Starting services..."
    docker compose -f docker-compose.prod.yml up -d

    echo "[3/4] Waiting for services to be healthy..."
    sleep 10

    echo "[4/4] Running database migrations..."
    docker exec -i nexusnote-db psql -U postgres -d nexusnote < packages/db/migrations/001_init.sql 2>/dev/null || true

    echo ""
    echo "=========================================="
    echo "Production deployment complete!"
    echo "=========================================="
    echo ""
    echo "Services:"
    echo "  - Web: http://localhost:3000"
    echo "  - API: http://localhost:3001"
    echo "  - Collab: ws://localhost:1234"
    echo ""
    echo "Health check: curl http://localhost:3001/health"
    echo ""
fi
