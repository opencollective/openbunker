.PHONY: help build up down logs clean dev prod restart shell db-migrate db-studio

# Default target
help:
	@echo "OpenBunker Docker Management Commands:"
	@echo ""
	@echo "Development:"
	@echo "  dev          - Start development environment"
	@echo "  dev-build    - Build and start development environment"
	@echo "  dev-logs     - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  prod         - Start production environment"
	@echo "  prod-build   - Build and start production environment"
	@echo "  prod-logs    - View production logs"
	@echo ""
	@echo "General:"
	@echo "  build        - Build all Docker images"
	@echo "  up           - Start all services"
	@echo "  down         - Stop all services"
	@echo "  restart      - Restart all services"
	@echo "  logs         - View all service logs"
	@echo "  clean        - Remove all containers, images, and volumes"
	@echo ""
	@echo "Database:"
	@echo "  db-migrate   - Run database migrations"
	@echo "  db-studio    - Open Prisma Studio"
	@echo ""
	@echo "Utilities:"
	@echo "  shell        - Open shell in frontend container"
	@echo "  server-shell - Open shell in bunker-server container"
	@echo "  db-shell     - Open shell in database"

# Development environment
dev:
	docker-compose -f docker-compose.dev.yaml up -d

dev-build:
	docker-compose -f docker-compose.dev.yaml up -d --build

dev-logs:
	docker-compose -f docker-compose.dev.yaml logs -f

# Production environment
prod:
	docker-compose up -d

prod-build:
	docker-compose up -d --build

prod-logs:
	docker-compose logs -f

# General commands
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

# Clean up
clean:
	docker-compose down --rmi all --volumes --remove-orphans
	docker system prune -a -f

# Database operations
db-migrate:
	docker-compose exec frontend npx prisma migrate dev

db-studio:
	docker-compose exec frontend npx prisma studio

# Shell access
shell:
	docker-compose exec frontend sh

server-shell:
	docker-compose exec bunker-server sh

db-shell:
	docker-compose exec postgres psql -U openbunker -d openbunker_dev

# Status
status:
	docker-compose ps

# Health check
health:
	docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
