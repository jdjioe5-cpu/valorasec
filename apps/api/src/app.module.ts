import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ScansModule } from './scans/scans.module';
import { ReportsModule } from './reports/reports.module';
import { AuditRegistryModule } from './audit-registry/audit-registry.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ScansModule,
    ReportsModule,
    AuditRegistryModule,
    NotificationsModule,
    HealthModule,
    CleanupModule,
    EmailModule,
  ],
})
export class AppModule {}
