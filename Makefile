.PHONY: install dev deploy backup help logs clean db-shell redis-shell

# Default target
help:
	@echo "NexusNote - 2026 Modern Commands:"
	@echo ""
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Start development environment (Docker)"
	@echo "  make deploy      - Deploy to production (using scripts/deploy.sh)"
	@echo "  make backup      - Backup database (using scripts/backup.sh)"
	@echo "  make logs        - View container logs"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make db-shell    - Enter PostgreSQL shell"
	@echo "  make redis-shell - Enter Redis shell"
	@echo ""

# Development
install:
	pnpm install

dev:
	docker compose up -d
	@echo "Database and Redis are running. Start app with: pnpm dev"

# Production & Deployment
deploy:
	./scripts/deploy.sh

backup:
	./scripts/backup.sh

# Monitoring
logs:
	docker compose logs -f app

# Database & Cache Shells
db-shell:
	docker exec -it nexusnote-db psql -U postgres -d nexusnote

redis-shell:
	docker exec -it nexusnote-redis redis-cli

# Cleanup
clean:
	docker compose down -v
	rm -rf node_modules
