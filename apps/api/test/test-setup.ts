/**
 * Re-exports test utilities from @valorasec/test-utils.
 *
 * This file exists for backward compatibility. New tests should import
 * directly from @valorasec/test-utils.
 */

import {
  createPrismaMock as _createPrismaMock,
  createMockUser as _createMockUser,
  createMockSession as _createMockSession,
  createMockProject as _createMockProject,
} from '@valorasec/test-utils';

export const createPrismaMock = _createPrismaMock;
export const mockUser = _createMockUser;
export const mockSession = _createMockSession;
export const mockProject = _createMockProject;

export {
  createMockContract,
  createMockScan,
  createMockReport,
  createMockNotification,
  createMockAuditRecord,
  createMockWebhook,
  createMockWebhookDelivery,
  type PrismaMock,
} from '@valorasec/test-utils';
