.PHONY: help install dev build start lint typecheck db-migrate db-studio

help:
	@echo "NexusNote commands:"
	@echo ""
	@echo "  make install     - Install dependencies with bun"
	@echo "  make dev         - Start Next.js dev server"
	@echo "  make build       - Build production bundle"
	@echo "  make start       - Start production server"
	@echo "  make lint        - Run Biome"
	@echo "  make typecheck   - Run TypeScript"
	@echo "  make db-migrate  - Apply tracked Drizzle migrations"
	@echo "  make db-studio   - Open Drizzle Studio"

install:
	bun install

dev:
	bun dev

build:
	bun run build

start:
	bun run start

lint:
	bun run lint

typecheck:
	bun run typecheck

db-migrate:
	bun run db:migrate

db-studio:
	bun run db:studio
