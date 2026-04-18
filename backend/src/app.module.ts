import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'path';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { ParentModule } from './parent/parent.module';
import { FacilityModule } from './facility/facility.module';
import { ChwModule } from './chw/chw.module';
import { BranchManagerModule } from './branch-manager/branch-manager.module';
import { HqAdminModule } from './hq-admin/hq-admin.module';
import { HealthController } from './common/health.controller';
import { BackupController } from './common/backup.controller';
import { BackupService } from './common/backup.service';
import { EmailService } from './common/email.service';
import { SmsService } from './common/sms.service';
import { VaccinationSchedulerService } from './common/vaccination-scheduler.service';

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60,        // 60 seconds
        limit: 10,      // 10 requests per minute default
      },
      {
        ttl: 3600,      // 1 hour
        limit: 100,     // 100 requests per hour
      },
    ]),

    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), 'backend', '.env'),
      ],
    }),

    // Enable scheduled tasks (cron jobs)
    ScheduleModule.forRoot(),

    // Database (Supabase)
    DatabaseModule,

    // Authentication
    AuthModule,

    // Feature Modules
    ParentModule,
    FacilityModule,
    ChwModule,
    BranchManagerModule,
    HqAdminModule,
  ],
  controllers: [HealthController, BackupController],
  providers: [
    BackupService,
    EmailService,
    SmsService,
    VaccinationSchedulerService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
