/**
 * Mock factory functions for creating test data objects.
 *
 * Each factory accepts optional overrides to customize the returned object.
 * All factories return plain objects that match the application's domain types.
 */

// ─── User ────────────────────────────────────────────────────────────────

export const mockUserDefaults = {
  id: 'user-1',
  email: 'test@valorasec.dev',
  passwordHash: '$2a$12$LJ3m4ys3GZrsODbCp8qGseKPz7YKICfqhEPm34ASRW6Q8qGPbGmPe',
  name: 'Test User',
  role: 'user' as const,
  avatarUrl: null as string | null,
  isVerified: false,
  verifyToken: 'verify-token-123',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export interface MockUserOverrides {
  id?: string;
  email?: string;
  passwordHash?: string;
  name?: string;
  role?: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  verifyToken?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createMockUser(overrides: MockUserOverrides = {}) {
  return { ...mockUserDefaults, ...overrides };
}

// ─── Session ─────────────────────────────────────────────────────────────

export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 604800000),
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Project ─────────────────────────────────────────────────────────────

export const mockProjectDefaults = {
  id: 'project-1',
  userId: 'user-1',
  name: 'Test Project',
  description: 'A test project',
  network: 'testnet' as const,
  status: 'active',
  archivedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    ...mockProjectDefaults,
    contracts: [],
    ...overrides,
  };
}

// ─── Contract ────────────────────────────────────────────────────────────

export function createMockContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    projectId: 'project-1',
    name: 'Test Contract',
    address: 'CABC1234567890ABC',
    network: 'testnet',
    sourceHash: 'abc123def456',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Scan ────────────────────────────────────────────────────────────────

export const mockScanDefaults = {
  id: 'scan-1',
  projectId: 'project-1',
  contractId: 'contract-1',
  status: 'completed',
  findings: [],
  summary: {
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    score: 100,
    linesAnalyzed: 200,
    rulesExecuted: 8,
  },
  startedAt: new Date('2025-01-01'),
  completedAt: new Date('2025-01-01'),
  duration: 1500,
};

export function createMockScan(overrides: Record<string, unknown> = {}) {
  return { ...mockScanDefaults, ...overrides };
}

// ─── Report ──────────────────────────────────────────────────────────────

export const mockReportDefaults = {
  id: 'report-1',
  scanId: 'scan-1',
  projectId: 'project-1',
  contractId: 'contract-1',
  userId: 'user-1',
  title: 'Security Audit Report - Test Contract',
  status: 'published',
  findings: [],
  summary: {
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    score: 100,
    linesAnalyzed: 200,
    rulesExecuted: 8,
  },
  verifiedOnChain: false,
  transactionHash: null as string | null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export function createMockReport(overrides: Record<string, unknown> = {}) {
  return { ...mockReportDefaults, ...overrides };
}

// ─── Notification ────────────────────────────────────────────────────────

export function createMockNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'scan_complete',
    title: 'Scan Complete',
    message: 'Your scan has completed successfully.',
    read: false,
    metadata: null as Record<string, unknown> | null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Audit Record ────────────────────────────────────────────────────────

export function createMockAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    reportId: 'report-1',
    projectId: 'project-1',
    reportHash: '0xabcdef1234567890',
    auditorAddress: 'G...MOCK...ADDRESS',
    contractAddress: 'C...MOCK...CONTRACT',
    transactionHash: '0x1234567890abcdef',
    metadata: null as Record<string, unknown> | null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}
