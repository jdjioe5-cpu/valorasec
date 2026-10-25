// ─── Severity ────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
  info: '#6B7280',
};

// ─── Finding ─────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  recommendation: string;
  references?: string[];
}

// ─── Scan ────────────────────────────────────────────────────────────────

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'deleted';

export interface IncrementalScanStats {
  isIncremental: boolean;
  cacheHit: boolean;
  totalFunctions: number;
  changedFunctions: string[];
  unchangedFunctions: string[];
  scannedFunctionCount: number;
  skippedFunctionCount: number;
  inheritedFindingsCount: number;
  newFindingsCount: number;
  timeSavedPercent?: number;
}

export interface ScanResult {
  id: string;
  projectId: string;
  contractId: string;
  status: ScanStatus;
  findings: Finding[];
  summary: ScanSummary;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  sourceHash?: string;
  incrementalStats?: IncrementalScanStats;
}

export interface ScanSummary {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  score: number; // 0-100
  linesAnalyzed: number;
  rulesExecuted: number;
}

// ─── Project ─────────────────────────────────────────────────────────────

export type NetworkType = 'testnet' | 'mainnet';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  network: NetworkType;
  contracts: Contract[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  name: string;
  address: string;
  network: NetworkType;
  sourceHash?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── User ────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin' | 'auditor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ─── Report ──────────────────────────────────────────────────────────────

export type ReportStatus = 'draft' | 'published' | 'verified';

export interface Report {
  id: string;
  scanId: string;
  projectId: string;
  contractId: string;
  userId: string;
  title: string;
  status: ReportStatus;
  findings: Finding[];
  summary: ScanSummary;
  verifiedOnChain: boolean;
  transactionHash?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit Record ────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  reportId: string;
  projectId: string;
  reportHash: string;
  auditorAddress: string;
  contractAddress: string;
  transactionHash: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

// ─── Notification ────────────────────────────────────────────────────────

export type NotificationType = 'scan_complete' | 'report_ready' | 'verification' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, string>;
  createdAt: string;
}

// ─── API ─────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

export const STELLAR_TESTNET = {
  name: 'Testnet' as const,
  url: 'https://soroban-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  networkPassphrase: 'Test SDF Network ; September 2015',
};

export const STELLAR_MAINNET = {
  name: 'Mainnet' as const,
  url: 'https://soroban.stellar.org',
  passphrase: 'Public Global Stellar Network ; September 2015',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
};

export const APP_CONFIG = {
  name: 'ValoraSec',
  version: '0.1.0',
  description: 'Open-source security platform for Soroban smart contracts',
  github: 'https://github.com/valorasec/valorasec',
} as const;

// ─── Analyzer Rules ──────────────────────────────────────────────────────

export type AnalyzerRuleCategory =
  | 'authorization'
  | 'storage'
  | 'input-validation'
  | 'code-quality'
  | 'gas-optimization'
  | 'randomness'
  | 'panic-safety';

export interface AnalyzerRule {
  id: string;
  name: string;
  category: AnalyzerRuleCategory;
  severity: Severity;
  description: string;
  recommendation: string;
  references: string[];
}

// ─── Reputation ──────────────────────────────────────────────────────────

export interface ReputationProfile {
  address: string;
  name: string;
  contributionScore: number;
  auditScore: number;
  badges: Badge[];
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// ─── Bug Bounty ──────────────────────────────────────────────────────────

export type BountyStatus = 'open' | 'in_review' | 'closed' | 'rewarded';

export type BountySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface BugBounty {
  id: string;
  projectId: string;
  contractAddress: string;
  title: string;
  description: string;
  severity: BountySeverity;
  reward: string; // in XLM
  status: BountyStatus;
  hunterAddress?: string;
  reportHash?: string;
  createdAt: string;
  updatedAt: string;
}
