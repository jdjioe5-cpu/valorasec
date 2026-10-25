export const SEED_USER = {
  id: 'usr-e2e-001',
  email: 'e2e-developer@valorasec.com',
  name: 'E2E Developer',
  role: 'user',
  isVerified: true,
  avatarUrl: null,
};

export const SEED_PROJECT = {
  id: 'proj-e2e-001',
  userId: SEED_USER.id,
  name: 'Soroban Vault Protocol',
  description: 'Production yield aggregator contract suite',
  network: 'testnet',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  contracts: [
    {
      id: 'ctr-e2e-001',
      projectId: 'proj-e2e-001',
      name: 'VaultToken',
      address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      network: 'testnet',
      sourceHash: 'sha256-vault-source-hash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

export const SEED_FINDINGS = [
  {
    id: 'FND-001',
    ruleId: 'R001',
    title: 'Missing Authorization Check in `transfer`',
    description:
      'Contract function does not verify caller authorization before executing transfers.',
    severity: 'critical',
    location: { file: 'src/lib.rs', line: 42, column: 5 },
    recommendation: 'Add `from.require_auth()` before state modification.',
  },
  {
    id: 'FND-002',
    ruleId: 'R005',
    title: 'Unhandled Panic via `.unwrap()`',
    description: 'Code contains `.unwrap()` calls that may cause sudden transaction reverts.',
    severity: 'medium',
    location: { file: 'src/lib.rs', line: 88, column: 12 },
    recommendation: 'Use ? operator with explicit Error enum return.',
  },
];

export const SEED_SCAN = {
  id: 'scan-e2e-001',
  projectId: SEED_PROJECT.id,
  contractId: 'ctr-e2e-001',
  status: 'completed',
  findings: SEED_FINDINGS,
  summary: {
    totalFindings: 2,
    bySeverity: { critical: 1, high: 0, medium: 1, low: 0, info: 0 },
    score: 72,
    linesAnalyzed: 380,
    rulesExecuted: 8,
  },
  startedAt: new Date(Date.now() - 60000).toISOString(),
  completedAt: new Date().toISOString(),
  duration: 240,
};

export const SEED_REPORT = {
  id: 'rep-e2e-001',
  scanId: SEED_SCAN.id,
  projectId: SEED_PROJECT.id,
  contractId: 'ctr-e2e-001',
  userId: SEED_USER.id,
  title: 'Official Security Audit Report - VaultToken v1.0',
  status: 'published',
  findings: SEED_FINDINGS,
  summary: SEED_SCAN.summary,
  verifiedOnChain: true,
  transactionHash: '5a4b7f8c9d0e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
