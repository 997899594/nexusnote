.PHONY: install dev build start stop logs clean db-init db-backup help

# Default target
help:
	@echo "NexusNote - Available commands:"
	@echo ""
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Start development environment"
	@echo "  make build       - Build Docker images"
	@echo "  make start       - Start production services"
	@echo "  make stop        - Stop all services"
	@echo "  make logs        - View service logs"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make db-init     - Initialize database"
	@echo "  make db-backup   - Backup database"
	@echo ""

# Development
install:
	pnpm install

dev:
	docker compose up -d
	@sleep 3
	@make db-init || true
	@echo ""
	@echo "Database services running. Start app with: pnpm dev"

# Production
build:
	docker compose -f docker-compose.prod.yml build

start:
	docker compose -f docker-compose.prod.yml up -d
	@sleep 5
	@make db-init || true

stop:
	docker compose down
	docker compose -f docker-compose.prod.yml down

logs:
	docker compose logs -f

logs-web:
	docker compose logs -f web

logs-server:
	docker compose logs -f server

# Database
db-init:
	docker exec -i nexusnote-db psql -U postgres -d nexusnote < packages/db/migrations/001_init.sql 2>/dev/null || true

db-backup:
	./scripts/backup.sh

db-shell:
	docker exec -it nexusnote-db psql -U postgres -d nexusnote

redis-shell:
	docker exec -it nexusnote-redis redis-cli

# Cleanup
clean:
	docker compose down -v
	docker compose -f docker-compose.prod.yml down -v
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/.next apps/server/dist

# Health check
health:
	@curl -s http://localhost:3001/health | jq . || echo "Server not running"
