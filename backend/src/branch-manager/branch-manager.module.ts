import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { BranchManagerController } from './branch-manager.controller';
import { BranchManagerService } from './branch-manager.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BranchManagerController],
  providers: [BranchManagerService],
})
export class BranchManagerModule {}
