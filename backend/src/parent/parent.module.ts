import { Module } from '@nestjs/common';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { SmsService } from '../common/sms.service';

@Module({
  controllers: [ParentController],
  providers: [ParentService, SmsService],
  exports: [ParentService],
})
export class ParentModule {}
