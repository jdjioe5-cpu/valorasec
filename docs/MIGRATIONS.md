# Database Migrations & Production Readiness Guide

This document describes the database migration and data seeding strategy for ValoraSec.

## Overview

ValoraSec uses **Prisma Migrate** to manage PostgreSQL schema evolutions across development, staging, and production environments. Previously, development relied on `prisma db push`, which creates database structures without tracking migration history. Prisma Migrate introduces version-controlled, reproducible SQL migration files in `apps/api/prisma/migrations`.

---

## Migration Workflow

### 1. Local Development (`db:migrate:dev`)

When modifying `apps/api/prisma/schema.prisma` in development:

```bash
# From workspace root:
pnpm db:migrate:dev

# Or inside apps/api:
cd apps/api
pnpm db:migrate:dev --name add_new_feature
```

**What this does**:

1. Compares `schema.prisma` against local migration history.
2. Prompts for a migration name (e.g. `add_column_x`).
3. Generates a new SQL migration file in `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`.
4. Executes the migration against the local development database.
5. Updates Prisma Client artifacts (`prisma generate`).

### 2. Production & CI Deployment (`db:migrate:deploy`)

In production containers, staging environments, and CI test pipelines:

```bash
# From workspace root:
pnpm db:migrate:deploy

# Or inside apps/api:
pnpm --filter @valorasec/api db:migrate:deploy
```

**What this does**:

1. Non-interactively applies all pending migrations that have not yet been recorded in `_prisma_migrations`.
2. Fails immediately with exit code 1 if a migration fails or database connection is unreachable.
3. Does **not** modify `schema.prisma` or generate new SQL files.

### 3. Migration Status Check

To inspect applied and pending migrations:

```bash
pnpm --filter @valorasec/api db:migrate:status
```

---

## Development Data Seeding

To populate initial accounts, test projects, mock contracts, security scans, and published reports:

```bash
# Seed development database:
pnpm db:seed

# Or directly in apps/api:
pnpm --filter @valorasec/api db:seed
```

### Pre-configured Seed Entities:

- **Admin**: `admin@valorasec.com` (password: `Password123!`)
- **Auditor**: `auditor@valorasec.com` (password: `Password123!`)
- **Developer**: `developer@valorasec.com` (password: `Password123!`)
- **Demo Project**: `Soroban DeFi Vault`
- **Demo Contract**: `VaultCore` (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`)
- **Completed Scan & On-chain Verified Audit Report**

---

## Production Rollback Strategy

Prisma Migrate does not natively support downward (`migrate down`) execution because schema rollbacks in relational databases often lead to destructive data loss. We adhere to the **Expand and Contract (Forward-Only)** pattern:

### 1. Preferred Method: Forward Migration (Revert)

If a recent migration introduced an issue:

1. Revert or alter the Prisma schema in Git:
   ```bash
   git revert <commit-hash>
   ```
2. Generate a corrective migration:
   ```bash
   pnpm db:migrate:dev --name revert_previous_change
   ```
3. Test thoroughly in staging and deploy forward via `pnpm db:migrate:deploy`.

### 2. Emergency Manual Rollback (Hotfix)

In catastrophic production incidents where immediate column or constraint removal is required:

1. Connect to production database via bastion or psql.
2. Manually execute the inverse SQL statements (e.g., `ALTER TABLE drop column ...;`).
3. Mark the failed migration as rolled back in Prisma's tracking table:
   ```bash
   pnpm --filter @valorasec/api prisma migrate resolve --rolled-back "<migration_name>"
   ```
4. Verify migration state with `pnpm --filter @valorasec/api db:migrate:status`.

### 3. Backup and Disaster Recovery

- Automated daily logical backups (`pg_dump`) prior to automated deployments.
- Pre-deployment snapshot during production releases.
