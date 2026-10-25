# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-25

### Added

- **Smart Contract Security Analyzer** (`@valorasec/analyzer`):
  - Extensible static analysis engine for Soroban smart contracts.
  - Native Rust AST parser and security rules (unhandled panics, authorization validation, arithmetic overflow checks).
  - Custom rule marketplace supporting CRUD operations and JSON import/export.
- **REST API Platform** (`@valorasec/api`):
  - NestJS modular backend with JWT authentication and RBAC guards.
  - Project management, contract registry, scan triggering, and audit reports.
  - Version-controlled PostgreSQL migrations and development data seeding via Prisma Migrate.
- **Web Application** (`@valorasec/web`):
  - Next.js 14 dashboard with dark/light themes and WCAG 2.1 accessibility compliance.
  - Real-time scan monitoring, vulnerability findings explorer, and security score badges.
  - Playwright end-to-end multi-browser automated test suite.
- **Developer SDK** (`@valorasec/sdk`):
  - Typed client for interacting with the ValoraSec security platform.
  - Full support for projects, contracts, scans, and audit report retrieval.
- **Release Automation**:
  - Conventional Commits enforcement via Commitlint and Husky git hooks.
  - Monorepo package versioning and changelog management via Changesets.
