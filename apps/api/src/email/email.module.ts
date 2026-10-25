import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailTransport } from './transports/mock-email.transport';
import { EMAIL_TRANSPORT } from './email.types';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    MockEmailTransport,
    {
      provide: EMAIL_TRANSPORT,
      useExisting: MockEmailTransport,
    },
  ],
  exports: [EmailService, MockEmailTransport, EMAIL_TRANSPORT],
})
export class EmailModule {}
