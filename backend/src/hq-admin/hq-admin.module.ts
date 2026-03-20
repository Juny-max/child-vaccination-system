import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { HqSystemController } from './hq-system.controller';
import { HqSystemService } from './hq-system.service';
import { HqNotificationController } from './hq-notification.controller';
import { HqNotificationService } from './hq-notification.service';
import { HqRoleController } from './hq-role.controller';
import { HqRoleService } from './hq-role.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HqSystemController, HqNotificationController, HqRoleController],
  providers: [HqSystemService, HqNotificationService, HqRoleService],
})
export class HqAdminModule {}
