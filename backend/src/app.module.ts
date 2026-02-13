import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { ParentModule } from './parent/parent.module';
import { FacilityModule } from './facility/facility.module';
import { ChatbotController } from './common/chatbot.controller';
import { ChatbotService } from './common/chatbot.service';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database (Supabase)
    DatabaseModule,

    // Authentication
    AuthModule,

    // Juny's Modules
    ParentModule,
    FacilityModule,
    // ChwModule,           // TODO: Add later
    // PhaModule,           // TODO: Add later

    // Julius's Modules (placeholders)
    // HqAdminModule,       // Julius will implement
    // BranchManagerModule, // Julius will implement
    // DataOfficerModule,   // Julius will implement
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class AppModule {}
