import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { ChwController } from './chw.controller';
import { ChwService } from './chw.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChwController],
  providers: [ChwService],
  exports: [ChwService],
})
export class ChwModule {}
