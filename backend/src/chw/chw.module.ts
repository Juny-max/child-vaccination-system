import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { ChwController } from './chw.controller';
import { ChildrenSearchController } from './children-search.controller';
import { ChwService } from './chw.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChwController, ChildrenSearchController],
  providers: [ChwService],
  exports: [ChwService],
})
export class ChwModule {}
