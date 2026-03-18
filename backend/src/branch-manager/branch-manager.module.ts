import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../common/email.service';
import { BranchManagerController } from './branch-manager.controller';
import { BranchManagerService } from './branch-manager.service';
import { HqAnalyticsController } from './hq-analytics.controller';
import { HqAuditLogsController } from './hq-audit-logs.controller';
import { HqBranchesController } from './hq-branches.controller';
import { HqCatchmentAreasController } from './hq-catchment-areas.controller';
import { HqSystemSettingsController } from './hq-system-settings.controller';
import { HqUsersController } from './hq-users.controller';
import { HqVaccinesController } from './hq-vaccines.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    BranchManagerController,
    HqBranchesController,
    HqUsersController,
    HqAnalyticsController,
    HqVaccinesController,
    HqCatchmentAreasController,
    HqSystemSettingsController,
    HqAuditLogsController,
  ],
  providers: [BranchManagerService, EmailService],
})
export class BranchManagerModule {}
