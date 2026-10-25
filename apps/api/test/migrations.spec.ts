import fs from 'node:fs';
import path from 'node:path';
import { seedDevelopmentData } from '../prisma/seed';
import { createPrismaMock } from './test-setup';

describe('Database Migrations and Seed Configuration (Issue #51)', () => {
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const initialMigrationSql = path.resolve(migrationsDir, '20260815000000_init/migration.sql');
  const migrationLock = path.resolve(migrationsDir, 'migration_lock.toml');
  const apiPackageJsonPath = path.resolve(__dirname, '../package.json');
  const rootPackageJsonPath = path.resolve(__dirname, '../../../package.json');

  it('contains initial migration SQL with all required core tables and constraints', () => {
    expect(fs.existsSync(initialMigrationSql)).toBe(true);
    const sql = fs.readFileSync(initialMigrationSql, 'utf-8');

    // Required tables
    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('CREATE TABLE "sessions"');
    expect(sql).toContain('CREATE TABLE "projects"');
    expect(sql).toContain('CREATE TABLE "contracts"');
    expect(sql).toContain('CREATE TABLE "scans"');
    expect(sql).toContain('CREATE TABLE "reports"');
    expect(sql).toContain('CREATE TABLE "audit_records"');
    expect(sql).toContain('CREATE TABLE "notifications"');

    // Required foreign keys & indexes
    expect(sql).toContain('ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey"');
    expect(sql).toContain('ALTER TABLE "contracts" ADD CONSTRAINT "contracts_projectId_fkey"');
    expect(sql).toContain('ALTER TABLE "scans" ADD CONSTRAINT "scans_contractId_fkey"');
    expect(sql).toContain('CREATE UNIQUE INDEX "users_email_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "contracts_projectId_address_key"');
  });

  it('contains migration_lock.toml configured for postgresql provider', () => {
    expect(fs.existsSync(migrationLock)).toBe(true);
    const content = fs.readFileSync(migrationLock, 'utf-8');
    expect(content).toContain('provider = "postgresql"');
  });

  it('configures database migration and seed commands across package.json files', () => {
    const apiPkg = JSON.parse(fs.readFileSync(apiPackageJsonPath, 'utf-8'));
    expect(apiPkg.scripts['db:migrate:dev']).toBe('prisma migrate dev');
    expect(apiPkg.scripts['db:migrate:deploy']).toBe('prisma migrate deploy');
    expect(apiPkg.scripts['db:migrate:status']).toBe('prisma migrate status');
    expect(apiPkg.scripts['db:seed']).toBeDefined();

    const rootPkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
    expect(rootPkg.scripts['db:migrate:dev']).toBeDefined();
    expect(rootPkg.scripts['db:migrate:deploy']).toBeDefined();
    expect(rootPkg.scripts['db:seed']).toBeDefined();
  });

  it('executes seedDevelopmentData successfully using mock Prisma client', async () => {
    const prismaMock = createPrismaMock();

    // Mock upsert
    prismaMock.user.upsert.mockResolvedValue({
      id: 'mock-user-1',
      email: 'test@valorasec.com',
      name: 'Mock User',
      role: 'user',
    });

    // Mock findMany and create
    prismaMock.project.findMany.mockResolvedValue([]);
    prismaMock.project.create.mockResolvedValue({
      id: 'proj-1',
      name: 'Soroban DeFi Vault',
      userId: 'mock-user-1',
    });

    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.contract.create.mockResolvedValue({
      id: 'ctr-1',
      name: 'VaultCore',
      address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      projectId: 'proj-1',
    });

    prismaMock.scan.findMany.mockResolvedValue([]);
    prismaMock.scan.create.mockResolvedValue({
      id: 'scan-1',
      contractId: 'ctr-1',
      projectId: 'proj-1',
      findings: [],
      summary: {},
    });

    prismaMock.report.findMany.mockResolvedValue([]);
    prismaMock.report.create.mockResolvedValue({
      id: 'rep-1',
      scanId: 'scan-1',
      projectId: 'proj-1',
      contractId: 'ctr-1',
      transactionHash: '0x123',
    });

    prismaMock.auditRecord.findUnique.mockResolvedValue(null);
    prismaMock.auditRecord.create.mockResolvedValue({
      id: 'audit-1',
      reportId: 'rep-1',
    });

    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
    });

    await expect(seedDevelopmentData(prismaMock as any)).resolves.not.toThrow();

    expect(prismaMock.user.upsert).toHaveBeenCalledTimes(3); // admin, auditor, developer
    expect(prismaMock.project.create).toHaveBeenCalled();
    expect(prismaMock.contract.create).toHaveBeenCalled();
    expect(prismaMock.scan.create).toHaveBeenCalled();
    expect(prismaMock.report.create).toHaveBeenCalled();
    expect(prismaMock.auditRecord.create).toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });
});
