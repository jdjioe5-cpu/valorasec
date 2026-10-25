import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailTransport } from './transports/mock-email.transport';
import { EMAIL_TRANSPORT } from './email.types';

describe('EmailService', () => {
  let service: EmailService;
  let transport: MockEmailTransport;

  beforeEach(async () => {
    transport = new MockEmailTransport();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EMAIL_TRANSPORT,
          useValue: transport,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'FRONTEND_URL') return 'https://app.valorasec.dev';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<EmailService>(EmailService);
  });

  afterEach(() => {
    transport.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send generic email via transport', async () => {
    const result = await service.sendEmail({
      to: 'dev@valorasec.dev',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('mock-');

    const sent = transport.getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('dev@valorasec.dev');
    expect(sent[0].subject).toBe('Test Subject');
  });

  it('should send verification email with link and 24h notice', async () => {
    const result = await service.sendVerificationEmail(
      'alice@valorasec.dev',
      'Alice',
      'sample-verify-token-xyz',
    );

    expect(result.success).toBe(true);

    const sent = transport.getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('alice@valorasec.dev');
    expect(sent[0].subject).toBe('Verify your email address - ValoraSec');
    expect(sent[0].html).toContain(
      'https://app.valorasec.dev/verify?token=sample-verify-token-xyz',
    );
    expect(sent[0].html).toContain('24 hours');
    expect(sent[0].text).toContain(
      'https://app.valorasec.dev/verify?token=sample-verify-token-xyz',
    );
  });
});
