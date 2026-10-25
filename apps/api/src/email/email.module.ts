import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from './email.service';
import { MockEmailTransport } from './transports/mock-email.transport';
import { EMAIL_TRANSPORT } from './email.types';

@Global()
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    EmailService,
    MockEmailTransport,
    {
      provide: EMAIL_TRANSPORT,
      useExisting: MockEmailTransport,
    },
  ],
  exports: [EmailService, EMAIL_TRANSPORT, MockEmailTransport],
})
export class EmailModule {}
