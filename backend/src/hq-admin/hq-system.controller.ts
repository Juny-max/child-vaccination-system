import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HqSystemService } from './hq-system.service';

/**
 * HQ Admin System Controller
 * Endpoints for system health, database stats, and configuration
 */
@Controller('hq-admin/system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqSystemController {
  constructor(private readonly systemService: HqSystemService) {}

  /**
   * GET /hq-admin/system/metrics
   * Get real-time system health metrics (CPU, memory, disk, uptime, API latency)
   */
  @Get('metrics')
  async getSystemMetrics(@CurrentUser() user: any) {
    return this.systemService.getSystemMetrics();
  }

  /**
   * GET /hq-admin/system/database-stats
   * Get database performance and capacity statistics
   */
  @Get('database-stats')
  async getDatabaseStats(@CurrentUser() user: any) {
    return this.systemService.getDatabaseStats();
  }

  /**
   * GET /hq-admin/system/backup-history
   * Get recent backup operations and their status
   */
  @Get('backup-history')
  async getBackupHistory(@CurrentUser() user: any) {
    return this.systemService.getBackupHistory();
  }

  /**
   * GET /hq-admin/system/backup-config
   * Get current backup schedule and retention settings
   */
  @Get('backup-config')
  async getBackupConfig(@CurrentUser() user: any) {
    return this.systemService.getBackupConfig();
  }

  /**
   * POST /hq-admin/system/backup-config
   * Configure backup schedule and retention policy
   */
  @Post('backup-config')
  async configureBackup(
    @Body() config: { frequency: 'daily' | 'weekly' | 'monthly'; retentionDays: number },
    @CurrentUser() user: any,
  ) {
    return this.systemService.configureBackup(config, user);
  }

  /**
   * GET /hq-admin/system/audit-activity
   * Get user activity logs for the system
   */
  @Get('audit-activity')
  async getAuditActivity(
    @CurrentUser() user: any,
  ) {
    return this.systemService.getAuditActivity();
  }
}
