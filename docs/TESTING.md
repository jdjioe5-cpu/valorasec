# Testing & Quality Assurance Guide

ValoraSec employs a multi-tiered testing strategy covering unit tests, integration tests, accessibility audits, and automated end-to-end (E2E) browser flows with Playwright.

---

## Testing Matrix

| Tier                     | Tooling       | Scope                                                | Command                                  |
| :----------------------- | :------------ | :--------------------------------------------------- | :--------------------------------------- |
| **Workspace Unit Tests** | Vitest / Jest | Shared types, SDK, Analyzer, API services            | `pnpm test`                              |
| **Accessibility (a11y)** | jest-axe      | WCAG 2.1 AA accessibility compliance                 | `pnpm --filter @valorasec/web test:a11y` |
| **End-to-End (E2E)**     | Playwright    | Full browser interactions across critical user flows | `pnpm test:e2e`                          |

---

## Playwright E2E Test Suite

Configuration file: `apps/web/playwright.config.ts`
Test directory: `apps/web/e2e/`

### 1. Running E2E Tests

To execute all E2E test scenarios across desktop and mobile viewports:

```bash
# Run all E2E tests:
pnpm test:e2e

# Or from apps/web:
cd apps/web
pnpm test:e2e
```

### 2. Interactive UI Mode

For visual debugging and step-by-step time-travel execution:

```bash
pnpm --filter @valorasec/web test:e2e:ui
```

### 3. Critical User Flow Scenarios

The test suite covers 6 foundational end-to-end scenarios:

1. **User Registration & Profile Verification (`01-auth-flows.spec.ts`)**:
   - `Register -> Login -> Dashboard`: Verifies new account creation, authentication state persistence, and initial dashboard hydration.
2. **Authentication Error Handling (`01-auth-flows.spec.ts`)**:
   - Invalid credentials input triggers accessible alerts without unhandled application crashes.
3. **Project & Smart Contract Management (`02-project-and-contracts.spec.ts`)**:
   - Creates new Soroban project, adds smart contracts by Stellar address, and renders contract status badges.
4. **Security Scan Execution & Findings Analysis (`03-scan-execution-and-findings.spec.ts`)**:
   - Dispatches a real static analysis scan, monitors completion, and validates the display of severity breakdowns and findings.
5. **Audit Report Inspection & On-Chain Verification (`04-report-generation-and-onchain.spec.ts`)**:
   - Inspects generated audit reports and verifies on-chain ledger registration records.
6. **Usability & Responsive Layout (`05-navigation-and-theme.spec.ts`)**:
   - Verifies mobile/desktop navigation links and landmark accessibility.

---

## Debugging and Artifacts

- **Screenshots on Failure**: Captured automatically under `apps/web/test-results/` whenever a test step fails.
- **Trace Viewer**: Traces are recorded on retry for inspecting DOM snapshots, network requests, and console messages:
  ```bash
  npx playwright show-trace test-results/<test-run>/trace.zip
  ```
