/**
 * @valorasec/test-utils
 *
 * Shared test fixtures, factory functions, and test helpers for ValoraSec.
 * Provides mock factories, Prisma test helpers, API test utilities, and
 * frontend render-with-providers wrappers.
 */

// Factory functions
export {
  createMockUser,
  createMockSession,
  createMockProject,
  createMockContract,
  createMockScan,
  createMockReport,
  createMockNotification,
  createMockAuditRecord,
  createMockSecurityRule,
  mockUserDefaults,
  mockProjectDefaults,
  mockScanDefaults,
  mockReportDefaults,
} from './factories';

// Prisma test helper
export { createPrismaMock } from './prisma-helper';
export type { PrismaMock } from './prisma-helper';

// API test helper
export { createTestApp } from './api-helper';

// Frontend test helper
export { renderWithProviders, TestWrapper } from './frontend-helper';
