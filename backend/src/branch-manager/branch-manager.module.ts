import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../common/email.service';
import { BranchManagerController } from './branch-manager.controller';
import { BranchManagerService } from './branch-manager.service';
import { HqBranchesController } from './hq-branches.controller';
import { HqUsersController } from './hq-users.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BranchManagerController, HqBranchesController, HqUsersController],
  providers: [BranchManagerService, EmailService],
})
export class BranchManagerModule {}
