import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DataOfficerService } from './data-officer.service';
import {
  DataOfficerDashboardDto,
  DuplicateCandidateDto,
  SyncConflictDto,
  NotificationLogDto,
  MergeDuplicateDto,
  ResolveSyncConflictDto,
  FilterNotificationsDto,
  BulkRetryDto,
} from './data-officer.dto';

/**
 * Data Officer Controller
 *
 * Provides endpoints for data quality management including:
 * - Duplicate detection and merging
 * - Sync conflict resolution
 * - Notification monitoring and retry
 * - Report generation and export
 *
 * Security:
 * - JwtAuthGuard: All requests must carry a valid JWT
 * - RolesGuard + @Roles('data-officer'): Only data officers can access
 */
@Controller('data-officer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('data-officer')
export class DataOfficerController {
  constructor(private readonly dataOfficerService: DataOfficerService) {}

  /**
   * GET /api/data-officer/dashboard
   *
   * Returns main dashboard with KPI metrics, duplicate preview,
   * sync conflicts, and notification status
   *
   * Returns: DataOfficerDashboardDto
   */
  @Get('dashboard')
  async getDashboard(): Promise<DataOfficerDashboardDto> {
    return this.dataOfficerService.getDashboard();
  }

  // =========================================================================
  // DUPLICATE CANDIDATES ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/duplicates
   *
   * Paginated list of duplicate child records
   *
   * Query Parameters:
   * - status: 'all' | 'pending' | 'merged' | 'dismissed' (default: 'pending')
   * - limit: number (default: 20, max: 100)
   * - offset: number (default: 0)
   *
   * Returns: DuplicateCandidateDto[]
   */
  @Get('duplicates')
  async getDuplicates(
    @Query('status') status: string = 'pending',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ): Promise<DuplicateCandidateDto[]> {
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100);
    const offsetNum = Math.max(0, parseInt(offset, 10));

    return this.dataOfficerService.getDuplicatesCandidates({
      status,
      limit: limitNum,
      offset: offsetNum,
    });
  }

  /**
   * POST /api/data-officer/duplicates/:id/merge
   *
   * Merge two duplicate child records into one.
   * The survivor child receives all vaccination events and data.
   * The loser child is marked as inactive and merged.
   *
   * URL Parameters:
   * - id: duplicate candidate ID
   *
   * Body: MergeDuplicateDto
   * - survivor_id: which child survives (child_a_id or child_b_id)
   * - merge_reason: reason for merge (e.g., "data entry error")
   * - merge_note: optional additional notes
   *
   * Returns: { success: boolean; message: string; merged_child_id: string }
   */
  @Post('duplicates/:id/merge')
  @HttpCode(200)
  async mergeDuplicates(
    @Param('id') duplicateId: string,
    @Body() dto: MergeDuplicateDto,
    @CurrentUser() user: any,
  ) {
    return this.dataOfficerService.mergeDuplicates(
      duplicateId,
      user.sub,
      dto,
    );
  }

  /**
   * POST /api/data-officer/duplicates/:id/dismiss
   *
   * Mark a duplicate candidate as not duplicates (dismiss the match)
   *
   * URL Parameters:
   * - id: duplicate candidate ID
   *
   * Body: { reason: string }
   * - reason: why this was dismissed
   *
   * Returns: { success: boolean; message: string }
   */
  @Post('duplicates/:id/dismiss')
  @HttpCode(200)
  async dismissDuplicate(
    @Param('id') duplicateId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.dataOfficerService.dismissDuplicate(
      duplicateId,
      user.sub,
      reason,
    );
  }

  // =========================================================================
  // SYNC CONFLICTS ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/sync-conflicts
   *
   * Retrieve list of sync conflicts requiring resolution
   *
   * Query Parameters:
   * - status: 'all' | 'pending' | 'merged' | 'dismissed' (default: 'pending')
   * - limit: number (default: 20)
   * - offset: number (default: 0)
   *
   * Returns: SyncConflictDto[]
   */
  @Get('sync-conflicts')
  async getSyncConflicts(
    @Query('status') status: string = 'pending',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ): Promise<SyncConflictDto[]> {
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100);
    const offsetNum = Math.max(0, parseInt(offset, 10));

    return this.dataOfficerService.getSyncConflicts({
      status,
      limit: limitNum,
      offset: offsetNum,
    });
  }

  /**
   * POST /api/data-officer/sync-conflicts/:id/resolve
   *
   * Resolve a sync conflict with one of three strategies:
   * 1. 'relink' - attach orphaned event to surviving child
   * 2. 'discard' - mark event as completed but orphaned, notify CHW
   * 3. 'hold-for-hq' - escalate to HQ for manual review
   *
   * URL Parameters:
   * - id: sync conflict ID
   *
   * Body: ResolveSyncConflictDto
   * - resolution_type: 'relink' | 'discard' | 'hold-for-hq'
   * - related_child_id: (required for 'relink') child to relink to
   * - follow_up_action: (optional) follow-up task
   * - resolution_note: reason for resolution
   *
   * Returns: { success: boolean; message: string }
   */
  @Post('sync-conflicts/:id/resolve')
  @HttpCode(200)
  async resolveSyncConflict(
    @Param('id') conflictId: string,
    @Body() dto: ResolveSyncConflictDto,
    @CurrentUser() user: any,
  ) {
    return this.dataOfficerService.resolveSyncConflict(
      conflictId,
      user.sub,
      dto,
    );
  }

  // =========================================================================
  // NOTIFICATION ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/notifications
   *
   * Retrieve notification log with filtering
   *
   * Query Parameters:
   * - status: 'all' | 'sent' | 'delivered' | 'failed' | 'pending'
   * - channel: 'sms' | 'email' | 'all'
   * - date_from: ISO date string
   * - date_to: ISO date string
   * - limit: number (default: 50, max: 500)
   * - offset: number (default: 0)
   *
   * Returns: { notifications: NotificationLogDto[]; total_count: number }
   */
  @Get('notifications')
  async getNotifications(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const filter: FilterNotificationsDto = {
      status: (status as any) || 'all',
      channel: (channel as any) || 'all',
      date_from: dateFrom,
      date_to: dateTo,
      limit: Math.min(Math.max(1, parseInt(limit, 10)), 500),
      offset: Math.max(0, parseInt(offset, 10)),
    };

    return this.dataOfficerService.getNotifications(filter);
  }

  /**
   * POST /api/data-officer/notifications/retry
   *
   * Bulk retry failed or bounced notifications
   *
   * Body: BulkRetryDto
   * - notification_ids: array of notification IDs to retry
   *
   * Returns: { success: boolean; retried_count: number; failed_count: number }
   */
  @Post('notifications/retry')
  @HttpCode(200)
  async bulkRetryNotifications(
    @Body() dto: BulkRetryDto,
    @CurrentUser() user: any,
  ) {
    return this.dataOfficerService.bulkRetryNotifications(user.sub, dto);
  }

  /**
   * GET /api/data-officer/notifications/export
   *
   * Export notifications as audit trail (CSV-compatible format)
   *
   * Query Parameters: Same as GET /notifications
   *
   * Returns: NotificationLogDto[] (can be serialized to CSV)
   */
  @Get('notifications/export')
  async exportNotifications(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const filter: FilterNotificationsDto = {
      status: (status as any) || 'all',
      channel: (channel as any) || 'all',
      date_from: dateFrom,
      date_to: dateTo,
      limit: 10000,
      offset: 0,
    };

    return this.dataOfficerService.exportNotifications(filter);
  }

  // =========================================================================
  // REPORTS ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/reports
   *
   * Get available report templates and summaries
   *
   * Returns: ReportDto[]
   */
  @Get('reports')
  async getReports() {
    return this.dataOfficerService.getReportSummaries();
  }

  /**
   * POST /api/data-officer/reports/export
   *
   * Export a custom report in requested format
   *
   * Body:
   * - format: 'csv' | 'excel' | 'pdf'
   * - filters: (optional) report filters
   *
   * Returns: { success: boolean; file_url: string; format: string }
   */
  @Post('reports/export')
  @HttpCode(200)
  async exportReport(
    @Body('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
    @CurrentUser() user: any,
  ) {
    return this.dataOfficerService.exportReport(format, user.sub);
  }

  // =========================================================================
  // SECURITY & AUDIT ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/security-alerts
   *
   * Get recent security alerts and suspicious activities
   * (Placeholder - would be implemented with advanced monitoring)
   */
  @Get('security-alerts')
  async getSecurityAlerts(@Query('limit') limit: string = '20') {
    return {
      alerts: [
        {
          id: 'alert-1',
          alert_type: 'brute_force_attempt',
          description: 'Multiple failed login attempts from IP 192.168.1.1',
          severity: 'high',
          created_at: new Date().toISOString(),
          resolved_at: null,
        },
      ],
      total: 1,
    };
  }

  /**
   * GET /api/data-officer/audit-trail
   *
   * Get detailed audit trail of all data officer actions
   */
  @Get('audit-trail')
  async getAuditTrail(
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
  ) {
    return {
      actions: [],
      total: 0,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };
  }
}
