import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma/prisma.service';
import { MockEmailTransport } from './transports/mock-email.transport';
import { EMAIL_TRANSPORT } from './email.types';
import { renderScanCompletedEmail } from './templates/scan-completed.template';
import { renderReportPublishedEmail } from './templates/report-published.template';
import { renderVerificationCompletedEmail } from './templates/verification-completed.template';
import { createPrismaMock, mockUser } from '../../test/test-setup';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let mockTransport: MockEmailTransport;

  const user = mockUser({ id: 'user-1', email: 'developer@example.com', name: 'Alice' });

  beforeEach(async () => {
    prisma = createPrismaMock();
    mockTransport = new MockEmailTransport();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'APP_URL') return 'https://app.valorasec.com';
              return defaultValue;
            }),
          },
        },
        { provide: EMAIL_TRANSPORT, useValue: mockTransport },
      ],
    }).compile();

    service = moduleFixture.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockTransport.clear();
  });

  describe('getOrCreatePreferences', () => {
    it('returns existing preferences if found', async () => {
      const existing = {
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: true,
        reportPublished: true,
        verificationUpdates: true,
        unsubscribeToken: 'unsub-token-123',
      };
      prisma.notificationPreference.findUnique.mockResolvedValue(existing);

      const res = await service.getOrCreatePreferences('user-1');
      expect(res).toEqual(existing);
      expect(prisma.notificationPreference.create).not.toHaveBeenCalled();
    });

    it('creates default preferences if none exist', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      const created = {
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: true,
        reportPublished: true,
        verificationUpdates: true,
        unsubscribeToken: 'unsub-token-123',
      };
      prisma.notificationPreference.create.mockResolvedValue(created);

      const res = await service.getOrCreatePreferences('user-1');
      expect(res).toEqual(created);
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            scanCompleted: true,
            reportPublished: true,
            verificationUpdates: true,
          }),
        }),
      );
    });
  });

  describe('updatePreferences', () => {
    it('updates user notification preference', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: true,
      });
      prisma.notificationPreference.update.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: false,
      });

      const res = await service.updatePreferences('user-1', { scanCompleted: false });
      expect(res.scanCompleted).toBe(false);
      expect(prisma.notificationPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: { scanCompleted: false },
        }),
      );
    });
  });

  describe('unsubscribeByToken', () => {
    it('unsubscribes from all notifications when type not specified', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        unsubscribeToken: 'token-xyz',
      });
      prisma.notificationPreference.update.mockResolvedValue({
        id: 'pref-1',
        scanCompleted: false,
        reportPublished: false,
        verificationUpdates: false,
      });

      await service.unsubscribeByToken('token-xyz');

      expect(prisma.notificationPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref-1' },
          data: {
            scanCompleted: false,
            reportPublished: false,
            verificationUpdates: false,
          },
        }),
      );
    });

    it('unsubscribes only from specific type when specified', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        unsubscribeToken: 'token-xyz',
      });

      await service.unsubscribeByToken('token-xyz', 'scanCompleted');

      expect(prisma.notificationPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref-1' },
          data: { scanCompleted: false },
        }),
      );
    });

    it('returns null if token does not exist', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      const res = await service.unsubscribeByToken('invalid-token');
      expect(res).toBeNull();
    });
  });

  describe('sendScanCompletedEmail', () => {
    it('sends scan completed email when preference enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        scanCompleted: true,
        unsubscribeToken: 'token-123',
      });

      const success = await service.sendScanCompletedEmail(user.id, {
        projectName: 'Soroban Vault',
        contractName: 'vault.rs',
        score: 92,
        findingsCount: 1,
        scanUrl: '/projects/p-1',
      });

      expect(success).toBe(true);
      expect(mockTransport.getSentEmails()).toHaveLength(1);
      const sent = mockTransport.getLastEmail();
      expect(sent?.to).toBe(user.email);
      expect(sent?.subject).toContain('vault.rs');
      expect(sent?.subject).toContain('92/100');
      expect(sent?.html).toContain('Unsubscribe or manage preferences');
      expect(sent?.html).toContain('token-123');
    });

    it('does not send email when user opted out', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        scanCompleted: false,
        unsubscribeToken: 'token-123',
      });

      const success = await service.sendScanCompletedEmail(user.id, {
        projectName: 'Soroban Vault',
        contractName: 'vault.rs',
        score: 92,
        findingsCount: 1,
        scanUrl: '/projects/p-1',
      });

      expect(success).toBe(false);
      expect(mockTransport.getSentEmails()).toHaveLength(0);
    });
  });

  describe('sendReportPublishedEmail', () => {
    it('sends report published email when preference enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        reportPublished: true,
        unsubscribeToken: 'token-456',
      });

      const success = await service.sendReportPublishedEmail(user.id, {
        reportTitle: 'Security Audit Report - LiquidityPool',
        projectName: 'DEX Protocol',
        findingsCount: 3,
        reportUrl: '/reports/r-1',
      });

      expect(success).toBe(true);
      expect(mockTransport.getSentEmails()).toHaveLength(1);
      const sent = mockTransport.getLastEmail();
      expect(sent?.to).toBe(user.email);
      expect(sent?.subject).toContain('LiquidityPool');
      expect(sent?.html).toContain('DEX Protocol');
      expect(sent?.html).toContain('token-456');
    });

    it('does not send email when reportPublished is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        reportPublished: false,
      });

      const success = await service.sendReportPublishedEmail(user.id, {
        reportTitle: 'Security Audit',
        projectName: 'DEX Protocol',
        findingsCount: 0,
        reportUrl: '/reports/r-1',
      });

      expect(success).toBe(false);
      expect(mockTransport.getSentEmails()).toHaveLength(0);
    });
  });

  describe('sendVerificationCompletedEmail', () => {
    it('sends on-chain verification email when preference enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        verificationUpdates: true,
        unsubscribeToken: 'token-789',
      });

      const success = await service.sendVerificationCompletedEmail(user.id, {
        reportTitle: 'Security Audit - Token',
        transactionHash: '0x1234567890abcdef',
        network: 'testnet',
        auditRecordUrl: '/reports/r-1',
      });

      expect(success).toBe(true);
      expect(mockTransport.getSentEmails()).toHaveLength(1);
      const sent = mockTransport.getLastEmail();
      expect(sent?.to).toBe(user.email);
      expect(sent?.subject).toContain('Audit verified on Stellar testnet');
      expect(sent?.html).toContain('0x1234567890abcdef');
      expect(sent?.html).toContain('token-789');
    });

    it('does not send email when verificationUpdates is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.notificationPreference.findUnique.mockResolvedValue({
        userId: user.id,
        verificationUpdates: false,
      });

      const success = await service.sendVerificationCompletedEmail(user.id, {
        reportTitle: 'Security Audit',
        transactionHash: '0x123',
        network: 'testnet',
        auditRecordUrl: '/reports/r-1',
      });

      expect(success).toBe(false);
      expect(mockTransport.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Email Templates Direct Rendering', () => {
    it('renders scan completed email template with sample data and branding', () => {
      const rendered = renderScanCompletedEmail({
        userName: 'Bob',
        projectName: 'Payment Gateway',
        contractName: 'gateway.rs',
        score: 95,
        findingsCount: 2,
        scanUrl: 'https://app.valorasec.com/projects/1',
        unsubscribeUrl: 'https://app.valorasec.com/settings?unsubscribe=abc',
      });

      expect(rendered.subject).toBe('[ValoraSec] Security scan completed for gateway.rs (95/100)');
      expect(rendered.html).toContain('VALORA');
      expect(rendered.html).toContain('SEC');
      expect(rendered.html).toContain('Payment Gateway');
      expect(rendered.html).toContain('95');
      expect(rendered.html).toContain('https://app.valorasec.com/projects/1');
      expect(rendered.html).toContain('https://app.valorasec.com/settings?unsubscribe=abc');
      expect(rendered.text).toContain('Bob');
      expect(rendered.text).toContain('https://app.valorasec.com/settings?unsubscribe=abc');
    });

    it('renders report published template with sample data and unsubscribe link', () => {
      const rendered = renderReportPublishedEmail({
        userName: 'Charlie',
        reportTitle: 'Token Standard V2 Audit',
        projectName: 'Token Ecosystem',
        findingsCount: 0,
        reportUrl: 'https://app.valorasec.com/reports/123',
        unsubscribeUrl: 'https://app.valorasec.com/settings?unsubscribe=def',
      });

      expect(rendered.subject).toContain('Token Standard V2 Audit');
      expect(rendered.html).toContain('Token Ecosystem');
      expect(rendered.html).toContain('https://app.valorasec.com/reports/123');
      expect(rendered.html).toContain('https://app.valorasec.com/settings?unsubscribe=def');
      expect(rendered.text).toContain('Charlie');
    });

    it('renders verification completed template with tx hash and branding', () => {
      const rendered = renderVerificationCompletedEmail({
        userName: 'Dana',
        reportTitle: 'Bridge Contract Audit',
        transactionHash: '0xfeedbeefcafe1234',
        network: 'testnet',
        auditRecordUrl: 'https://app.valorasec.com/reports/456',
        unsubscribeUrl: 'https://app.valorasec.com/settings?unsubscribe=ghi',
      });

      expect(rendered.subject).toContain('Bridge Contract Audit');
      expect(rendered.html).toContain('0xfeedbeefcafe1234');
      expect(rendered.html).toContain('Stellar testnet');
      expect(rendered.html).toContain('https://app.valorasec.com/reports/456');
      expect(rendered.html).toContain('https://app.valorasec.com/settings?unsubscribe=ghi');
      expect(rendered.text).toContain('Dana');
    });
  });
});
