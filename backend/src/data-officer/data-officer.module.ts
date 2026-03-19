import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../common/email.service';
import { DataOfficerController } from './data-officer.controller';
import { DataOfficerService } from './data-officer.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DataOfficerController],
  providers: [DataOfficerService, EmailService],
})
export class DataOfficerModule {}
