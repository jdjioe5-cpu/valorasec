# Development Guide

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker & Docker Compose
- Rust (optional, for contracts)

## Setup

```bash
# Clone the repository
git clone https://github.com/valorasec/valorasec.git
cd valorasec

# Install dependencies
pnpm install

# Start infrastructure
docker compose -f docker/docker-compose.yml up postgres redis -d

# Apply database migrations and seed initial development data
cd apps/api
cp .env.example .env  # Adjust DATABASE_URL if needed
pnpm db:migrate:dev   # Or pnpm db:migrate:deploy for existing migrations
pnpm db:seed          # Optional: populate test users, projects, and contracts

# Start development
cd ../..
pnpm dev
```

## Project Structure

```
apps/
├── web/          # Next.js frontend (port 3000)
├── api/          # NestJS backend (port 4000)
└── docs/         # Documentation (port 3001)

packages/
├── shared/       # Shared types
├── ui/           # UI components
├── sdk/           # API client
└── analyzer/     # Security analyzer

contracts/
├── audit-registry/
├── reputation/
└── bug-bounty/
```

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @valorasec/api test
pnpm --filter @valorasec/analyzer test

# Contracts
cd contracts/audit-registry && cargo test
```

## Code Quality

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck
```

## Adding a New Package

1. Create directory under `apps/` or `packages/`
2. Add `package.json` with `name: "@valorasec/your-package"`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Run `pnpm install`
