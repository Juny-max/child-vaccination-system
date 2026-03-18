import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BranchManagerService } from './branch-manager.service';

@Controller('hq-admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqAuditLogsController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listAuditLogs(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.branchManagerService.getHqAuditLogs({
      action,
      entityType,
      category,
      userId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
