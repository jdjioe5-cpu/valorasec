import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDevelopmentData(client: PrismaClient = prisma) {
  console.info('🌱 Starting database seeding for development data...');

  // 1. Seed Users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await client.user.upsert({
    where: { email: 'admin@valorasec.com' },
    update: {},
    create: {
      email: 'admin@valorasec.com',
      name: 'System Admin',
      passwordHash,
      role: 'admin',
      isVerified: true,
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    },
  });

  const auditor = await client.user.upsert({
    where: { email: 'auditor@valorasec.com' },
    update: {},
    create: {
      email: 'auditor@valorasec.com',
      name: 'Senior Auditor',
      passwordHash,
      role: 'auditor',
      isVerified: true,
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    },
  });

  const developer = await client.user.upsert({
    where: { email: 'developer@valorasec.com' },
    update: {},
    create: {
      email: 'developer@valorasec.com',
      name: 'Alex Rivera',
      passwordHash,
      role: 'user',
      isVerified: true,
      avatarUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
    },
  });

  console.info(
    `✓ Users seeded: Admin (${admin.id}), Auditor (${auditor.id}), Developer (${developer.id})`,
  );

  // 2. Seed Projects
  const projects = await client.project.findMany({ where: { userId: developer.id } });
  let project1 = projects.find((p) => p.name === 'Soroban DeFi Vault');
  if (!project1) {
    project1 = await client.project.create({
      data: {
        userId: developer.id,
        name: 'Soroban DeFi Vault',
        description: 'Multi-collateral yield aggregator smart contracts on Stellar Soroban',
        network: 'testnet',
        status: 'active',
      },
    });
  }

  // 3. Seed Contracts
  const contracts = await client.contract.findMany({ where: { projectId: project1.id } });
  let contract1 = contracts.find((c) => c.name === 'VaultCore');
  if (!contract1) {
    contract1 = await client.contract.create({
      data: {
        projectId: project1.id,
        name: 'VaultCore',
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        network: 'testnet',
        sourceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });
  }

  // 4. Seed Scan
  const scans = await client.scan.findMany({ where: { contractId: contract1.id } });
  let scan1 = scans[0];
  if (!scan1) {
    scan1 = await client.scan.create({
      data: {
        projectId: project1.id,
        contractId: contract1.id,
        status: 'completed',
        findings: [
          {
            id: 'FND-R001-01',
            ruleId: 'R001',
            title: 'Missing Authorization Check in `withdraw`',
            description:
              'Contract function does not verify caller authorization before executing transfers.',
            severity: 'critical',
            location: { file: 'src/vault.rs', line: 42, column: 5 },
            recommendation: 'Add `caller.require_auth()` before state modification.',
          },
          {
            id: 'FND-R005-01',
            ruleId: 'R005',
            title: 'Unhandled Panic via `.unwrap()` in `rebalance`',
            description: 'Calling .unwrap() on storage read can trigger sudden panic.',
            severity: 'medium',
            location: { file: 'src/vault.rs', line: 88, column: 18 },
            recommendation: 'Use ? operator with explicit Error enum return.',
          },
        ],
        summary: {
          totalFindings: 2,
          bySeverity: { critical: 1, high: 0, medium: 1, low: 0, info: 0 },
          score: 67,
          linesAnalyzed: 340,
          rulesExecuted: 8,
        },
        duration: 125,
      },
    });
  }

  // 5. Seed Report
  const reports = await client.report.findMany({ where: { scanId: scan1.id } });
  let report1 = reports[0];
  if (!report1) {
    report1 = await client.report.create({
      data: {
        scanId: scan1.id,
        projectId: project1.id,
        contractId: contract1.id,
        userId: developer.id,
        title: 'Security Audit Assessment - VaultCore v1.0',
        status: 'published',
        findings: scan1.findings as unknown as object,
        summary: scan1.summary as unknown as object,
        verifiedOnChain: true,
        transactionHash: '5a4b7f8c9d0e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
      },
    });
  }

  // 6. Seed Audit Record
  const existingAudit = await client.auditRecord.findUnique({ where: { reportId: report1.id } });
  if (!existingAudit) {
    await client.auditRecord.create({
      data: {
        reportId: report1.id,
        projectId: project1.id,
        reportHash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
        auditorAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        contractAddress: contract1.address,
        transactionHash: report1.transactionHash!,
        metadata: {
          network: 'testnet',
          platform: 'ValoraSec Security Registry',
          protocolVersion: '1.0.0',
        },
      },
    });
  }

  // 7. Seed Notification
  await client.notification.create({
    data: {
      userId: developer.id,
      type: 'scan_complete',
      title: 'Scan Finished: VaultCore',
      message: 'Automated scan detected 2 findings for contract VaultCore.',
      read: false,
    },
  });

  console.info('✅ Seeding completed successfully.');
}

if (require.main === module) {
  seedDevelopmentData()
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
