import { Module } from '@nestjs/common';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { SmsService } from '../common/sms.service';
import { EmailService } from '../common/email.service';

@Module({
  controllers: [ParentController],
  providers: [ParentService, SmsService, EmailService],
  exports: [ParentService],
})
export class ParentModule {}
