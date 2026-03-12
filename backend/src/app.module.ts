import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { ParentModule } from './parent/parent.module';
import { FacilityModule } from './facility/facility.module';
import { ChwModule } from './chw/chw.module';
import { PhaModule } from './pha/pha.module';
import { BranchManagerModule } from './branch-manager/branch-manager.module';
import { ChatbotController } from './common/chatbot.controller';
import { ChatbotService } from './common/chatbot.service';
import { HealthController } from './common/health.controller';
import { SmsService } from './common/sms.service';
import { VaccinationSchedulerService } from './common/vaccination-scheduler.service';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Enable scheduled tasks (cron jobs)
    ScheduleModule.forRoot(),

    // Database (Supabase)
    DatabaseModule,

    // Authentication
    AuthModule,

    // Juny's Modules
    ParentModule,
    FacilityModule,
    ChwModule,
    PhaModule,

    // Julius's Modules (Juny taking over Branch Manager)
    BranchManagerModule,
    // HqAdminModule,       // Julius will implement
    // DataOfficerModule,   // Julius will implement
  ],
  controllers: [ChatbotController, HealthController],
  providers: [ChatbotService, SmsService, VaccinationSchedulerService],
})
export class AppModule {}
