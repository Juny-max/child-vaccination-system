import { Module } from '@nestjs/common';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';
import { DatabaseModule } from '../common/database/database.module';
import { EmailService } from '../common/email.service';
import { SmsService } from '../common/sms.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FacilityController],
  providers: [FacilityService, EmailService, SmsService],
  exports: [FacilityService],
})
export class FacilityModule {}
