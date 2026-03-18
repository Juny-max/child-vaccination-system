import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BranchManagerService } from './branch-manager.service';

@Controller('hq-admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqAnalyticsController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async getAnalytics(
    @Query('region') region?: string,
    @Query('branch') branch?: string,
    @Query('window') window?: string,
  ) {
    return this.branchManagerService.getHqAnalytics({ region, branch, window });
  }

  @Get('overview')
  async getOverviewStats() {
    return this.branchManagerService.getHqOverviewStats();
  }
}
