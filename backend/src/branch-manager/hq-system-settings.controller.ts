import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BranchManagerService } from './branch-manager.service';
import {
  CreateHqSystemSettingDto,
  UpdateHqSystemSettingDto,
} from './hq-system-settings.dto';

@Controller('hq-admin/system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqSystemSettingsController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listSettings() {
    return this.branchManagerService.getHqSystemSettings();
  }

  @Put(':settingId')
  async updateSetting(
    @CurrentUser('id') actorUserId: string,
    @Param('settingId') settingId: string,
    @Body() dto: UpdateHqSystemSettingDto,
  ) {
    return this.branchManagerService.updateHqSystemSetting(settingId, dto, actorUserId);
  }

  @Post()
  async createSetting(
    @CurrentUser('id') actorUserId: string,
    @Body() dto: CreateHqSystemSettingDto,
  ) {
    return this.branchManagerService.createHqSystemSetting(dto, actorUserId);
  }
}
