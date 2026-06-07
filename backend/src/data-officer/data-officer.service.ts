import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  KpiMetrics,
  DataOfficerDashboardDto,
  DuplicateCandidateDto,
  SyncConflictDto,
  NotificationLogDto,
  MergeDuplicateDto,
  ResolveSyncConflictDto,
  FilterNotificationsDto,
  BulkRetryDto,
  ChildSummaryDto,
} from './data-officer.dto';
import { EmailService } from '../common/email.service';

@Injectable()
export class DataOfficerService {
  private readonly logger = new Logger(DataOfficerService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================================
  // DASHBOARD ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/dashboard
   *
   * Returns all KPI metrics and overview data for the Data Officer dashboard
   */
  async getDashboard(): Promise<DataOfficerDashboardDto> {
    try {
      const [kpis, dupsPreview, conflictsPreview, notificationStatus] =
        await Promise.all([
          this.getKpiMetrics(),
          this.getDuplicatesCandidates({ limit: 3 }),
          this.getSyncConflicts({ limit: 2 }),
          this.getNotificationStatus(),
        ]);

      return {
        kpis,
        duplicate_preview: dupsPreview,
        sync_conflicts_feed: conflictsPreview,
        notification_status: notificationStatus,
      };
    } catch (error) {
      this.logger.error('Failed to fetch dashboard', error);
      throw new InternalServerErrorException('Failed to fetch dashboard data');
    }
  }

  /**
   * Get KPI metrics for dashboard
   */
  private async getKpiMetrics(): Promise<KpiMetrics> {
    const db = this.db.supabase;

    // Pending duplicates count
    const { count: duplicatesCount } = await db
      .from('duplicate_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Sync conflicts count
    const { count: conflictsCount } = await db
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Missing data percentage
    const { data: childrenData } = await db
      .from('children')
      .select('id, date_of_birth', { count: 'exact' })
      .or('date_of_birth.is.null,mother_name.is.null');

    const { count: totalChildren } = await db
      .from('children')
      .select('*', { count: 'exact', head: true });

    const missingDataPercentage =
      totalChildren && childrenData
        ? ((childrenData.length / totalChildren) * 100).toFixed(2)
        : 0;

    // Notification failures in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: failuresCount } = await db
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo);

    // Security alerts in last 24h (from audit logs with security-related actions)
    const { count: alertsCount } = await db
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'security')
      .gte('created_at', oneDayAgo);

    return {
      pending_duplicates: duplicatesCount ?? 0,
      sync_conflicts: conflictsCount ?? 0,
      missing_data_percentage: Number(missingDataPercentage),
      notification_failures_24h: failuresCount ?? 0,
      security_alerts_24h: alertsCount ?? 0,
      downtime_minutes_24h: 0, // Would require additional monitoring system
    };
  }

  /**
   * Get notification status metrics
   */
  private async getNotificationStatus(): Promise<{
    recent_failures: number;
    success_rate: number;
  }> {
    const db = this.db.supabase;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifications } = await db
      .from('notifications')
      .select('status')
      .gte('created_at', oneDayAgo);

    if (!notifications || notifications.length === 0) {
      return { recent_failures: 0, success_rate: 100 };
    }

    const failures = notifications.filter(
      (n) => n.status === 'failed' || n.status === 'bounced',
    ).length;
    const successRate =
      ((notifications.length - failures) / notifications.length) * 100;

    return {
      recent_failures: failures,
      success_rate: Math.round(successRate),
    };
  }

  // =========================================================================
  // DUPLICATE CANDIDATES ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/duplicates
   *
   * Retrieve list of duplicate candidates with pagination and filtering
   */
  async getDuplicatesCandidates(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<DuplicateCandidateDto[]> {
    const { status = 'pending', limit = 20, offset = 0 } = options;

    try {
      const db = this.db.supabase;

      let query = db
        .from('duplicate_candidates')
        .select(
          `
          id,
          pair_id,
          child_a_id,
          child_b_id,
          similarity_score,
          matching_fields,
          status,
          created_at,
          child_a:children!child_a_id (
            id,
            name,
            date_of_birth,
            mother_name,
            created_at
          ),
          child_b:children!child_b_id (
            id,
            name,
            date_of_birth,
            mother_name,
            created_at
          )
        `,
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to fetch duplicate candidates', error);
        throw new InternalServerErrorException(
          'Failed to fetch duplicate candidates',
        );
      }

      // Enrich with vaccination counts
      return await Promise.all(
        (data || []).map(async (dup) => {
          const childA = Array.isArray(dup.child_a) ? dup.child_a[0] : dup.child_a;
          const childB = Array.isArray(dup.child_b) ? dup.child_b[0] : dup.child_b;

          const [childAVaccCount, childBVaccCount] = await Promise.all([
            this.getVaccinationCount(dup.child_a_id),
            this.getVaccinationCount(dup.child_b_id),
          ]);

          return {
            id: dup.id,
            pair_id: dup.pair_id,
            child_a_id: dup.child_a_id,
            child_b_id: dup.child_b_id,
            similarity_score: dup.similarity_score,
            matching_fields: dup.matching_fields,
            status: dup.status,
            created_at: dup.created_at,
            child_a: {
              id: childA.id,
              name: childA.name,
              date_of_birth: childA.date_of_birth,
              mother_name: childA.mother_name,
              last_vaccination_date: null,
              vaccination_count: childAVaccCount,
            },
            child_b: {
              id: childB.id,
              name: childB.name,
              date_of_birth: childB.date_of_birth,
              mother_name: childB.mother_name,
              last_vaccination_date: null,
              vaccination_count: childBVaccCount,
            },
          };
        }),
      );
    } catch (error) {
      this.logger.error('Error fetching duplicates', error);
      throw error;
    }
  }

  /**
   * Get vaccination count for a child
   */
  private async getVaccinationCount(childId: string): Promise<number> {
    const db = this.db.supabase;
    const { count } = await db
      .from('vaccination_events')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed');

    return count ?? 0;
  }

  /**
   * POST /api/data-officer/duplicates/:id/merge
   *
   * Merge two duplicate children records
   */
  async mergeDuplicates(
    duplicateId: string,
    userId: string,
    dto: MergeDuplicateDto,
  ): Promise<{ success: boolean; message: string; merged_child_id: string }> {
    const db = this.db.supabase;

    try {
      // Get the duplicate candidate
      const { data: duplicate, error: fetchError } = await db
        .from('duplicate_candidates')
        .select('*')
        .eq('id', duplicateId)
        .single();

      if (fetchError || !duplicate) {
        throw new NotFoundException('Duplicate candidate not found');
      }

      if (duplicate.status !== 'pending') {
        throw new BadRequestException(
          `Cannot merge duplicate with status: ${duplicate.status}`,
        );
      }

      const survivorId = dto.survivor_id;

      if (
        survivorId !== duplicate.child_a_id &&
        survivorId !== duplicate.child_b_id
      ) {
        throw new BadRequestException(
          'survivor_id must be one of the two candidate child IDs for this duplicate',
        );
      }

      const loserChildId =
        survivorId === duplicate.child_a_id
          ? duplicate.child_b_id
          : duplicate.child_a_id;

      // Update the duplicate candidate status
      const { error: updateError } = await db
        .from('duplicate_candidates')
        .update({
          status: 'merged',
          survivor_id: survivorId,
          merged_by_user_id: userId,
          merge_reason: dto.merge_reason,
          merge_note: dto.merge_note || null,
          merged_at: new Date().toISOString(),
        })
        .eq('id', duplicateId);

      if (updateError) {
        throw new InternalServerErrorException('Failed to update duplicate record');
      }

      // Redirect all vaccination events from loser to survivor
      await db
        .from('vaccination_events')
        .update({
          child_id: survivorId,
          updated_at: new Date().toISOString(),
        })
        .eq('child_id', loserChildId);

      // Redirect all appointments from loser to survivor
      await db
        .from('appointments')
        .update({
          child_id: survivorId,
          updated_at: new Date().toISOString(),
        })
        .eq('child_id', loserChildId);

      // Mark the loser child as deleted/merged
      await db
        .from('children')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
          metadata: { merged_to: survivorId },
        })
        .eq('id', loserChildId);

      // Log merge action to audit
      await db.from('audit_logs').insert({
        user_id: userId,
        action: 'merge',
        entity_type: 'child',
        entity_id: survivorId,
        before_data: { duplicate_child_id: loserChildId },
        after_data: { survivor_child_id: survivorId },
        category: 'data-quality',
      });

      this.logger.log(
        `Successfully merged duplicate ${duplicateId}: ${loserChildId} -> ${survivorId}`,
      );

      return {
        success: true,
        message: `Duplicate records merged successfully. Child ${loserChildId} has been consolidated into ${survivorId}.`,
        merged_child_id: survivorId,
      };
    } catch (error) {
      this.logger.error('Failed to merge duplicates', error);
      throw error;
    }
  }

  /**
   * POST /api/data-officer/duplicates/:id/dismiss
   *
   * Dismiss a duplicate candidate (mark as not duplicates)
   */
  async dismissDuplicate(
    duplicateId: string,
    userId: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    const db = this.db.supabase;

    try {
      const { data: duplicate, error: fetchError } = await db
        .from('duplicate_candidates')
        .select('*')
        .eq('id', duplicateId)
        .single();

      if (fetchError || !duplicate) {
        throw new NotFoundException('Duplicate candidate not found');
      }

      // Update status
      await db
        .from('duplicate_candidates')
        .update({
          status: 'dismissed',
          merge_note: `Dismissed: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', duplicateId);

      // Log action
      await db.from('audit_logs').insert({
        user_id: userId,
        action: 'update',
        entity_type: 'duplicate_candidate',
        entity_id: duplicateId,
        after_data: { action: 'dismissed', reason },
        category: 'data-quality',
      });

      return {
        success: true,
        message: 'Duplicate candidate dismissed successfully.',
      };
    } catch (error) {
      this.logger.error('Failed to dismiss duplicate', error);
      throw error;
    }
  }

  // =========================================================================
  // SYNC CONFLICTS ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/sync-conflicts
   *
   * Retrieve list of sync conflicts with filtering
   */
  async getSyncConflicts(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<SyncConflictDto[]> {
    const { status = 'pending', limit = 20, offset = 0 } = options;

    try {
      const db = this.db.supabase;

      let query = db
        .from('sync_conflicts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to fetch sync conflicts', error);
        throw new InternalServerErrorException(
          'Failed to fetch sync conflicts',
        );
      }

      return (data || []).map((conflict) => ({
        id: conflict.id,
        conflict_id: conflict.conflict_id,
        entity_type: conflict.entity_type,
        entity_id: conflict.entity_id,
        conflict_type: conflict.conflict_type,
        local_data: conflict.local_data,
        server_data: conflict.server_data,
        status: conflict.status,
        created_at: conflict.created_at,
        recommended_action: conflict.recommended_action,
      }));
    } catch (error) {
      this.logger.error('Error fetching sync conflicts', error);
      throw error;
    }
  }

  /**
   * POST /api/data-officer/sync-conflicts/:id/resolve
   *
   * Resolve a sync conflict
   */
  async resolveSyncConflict(
    conflictId: string,
    userId: string,
    dto: ResolveSyncConflictDto,
  ): Promise<{ success: boolean; message: string }> {
    const db = this.db.supabase;

    try {
      const { data: conflict, error: fetchError } = await db
        .from('sync_conflicts')
        .select('*')
        .eq('id', conflictId)
        .single();

      if (fetchError || !conflict) {
        throw new NotFoundException('Sync conflict not found');
      }

      // Update conflict status
      await db
        .from('sync_conflicts')
        .update({
          status:
            dto.resolution_type === 'hold-for-hq' ? 'under-review' : 'merged',
          resolved_by_user_id: userId,
          resolution_note: dto.resolution_note,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', conflictId);

      // If relinking, update the vaccination event
      if (
        dto.resolution_type === 'relink' &&
        dto.related_child_id &&
        conflict.entity_type === 'vaccination_event'
      ) {
        await db
          .from('vaccination_events')
          .update({
            child_id: dto.related_child_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conflict.entity_id);
      }

      // If discarding, mark as completed but not linked
      if (
        dto.resolution_type === 'discard' &&
        conflict.entity_type === 'vaccination_event'
      ) {
        await db
          .from('vaccination_events')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', conflict.entity_id);
      }

      // Log action
      await db.from('audit_logs').insert({
        user_id: userId,
        action: 'update',
        entity_type: 'sync_conflict',
        entity_id: conflictId,
        after_data: {
          resolution_type: dto.resolution_type,
          related_child_id: dto.related_child_id,
        },
        category: 'sync-management',
      });

      return {
        success: true,
        message: `Sync conflict resolved successfully using ${dto.resolution_type} strategy.`,
      };
    } catch (error) {
      this.logger.error('Failed to resolve sync conflict', error);
      throw error;
    }
  }

  // =========================================================================
  // NOTIFICATION ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/notifications
   *
   * Retrieve notification log with filtering and pagination
   */
  async getNotifications(
    filter: FilterNotificationsDto,
  ): Promise<{ notifications: NotificationLogDto[]; total_count: number }> {
    const {
      status = 'all',
      channel = 'all',
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = filter;

    try {
      const db = this.db.supabase;

      let query = db
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (channel && channel !== 'all') {
        query = query.eq('channel', channel);
      }

      if (date_from) {
        query = query.gte('created_at', date_from);
      }

      if (date_to) {
        query = query.lte('created_at', date_to);
      }

      const { data, count, error } = await query;

      if (error) {
        this.logger.error('Failed to fetch notifications', error);
        throw new InternalServerErrorException(
          'Failed to fetch notifications',
        );
      }

      return {
        notifications: (data || []).map((n) => ({
          id: n.id,
          template_id: n.template_id,
          channel: n.channel,
          recipient_contact: n.recipient_contact,
          message: n.message,
          status: n.status,
          error_message: n.error_message,
          retry_count: n.retry_count,
          sent_at: n.sent_at,
          delivered_at: n.delivered_at,
          created_at: n.created_at,
        })),
        total_count: count ?? 0,
      };
    } catch (error) {
      this.logger.error('Error fetching notifications', error);
      throw error;
    }
  }

  /**
   * POST /api/data-officer/notifications/retry
   *
   * Bulk retry failed notifications
   */
  async bulkRetryNotifications(
    userId: string,
    dto: BulkRetryDto,
  ): Promise<{ success: boolean; retried_count: number; failed_count: number }> {
    const db = this.db.supabase;

    try {
      // Get all failed notifications for retry
      const { data: notifications, error } = await db
        .from('notifications')
        .select('*')
        .in('id', dto.notification_ids)
        .in('status', ['failed', 'bounced']);

      if (error) {
        throw new InternalServerErrorException('Failed to fetch notifications');
      }

      let retriedCount = 0;
      let failedCount = 0;

      // Retry each notification
      for (const notification of notifications || []) {
        try {
          // Increment retry count
          await db
            .from('notifications')
            .update({
              status: 'pending',
              retry_count: (notification.retry_count || 0) + 1,
              updated_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', notification.id);

          retriedCount++;

          // Log the retry action
          await db.from('audit_logs').insert({
            user_id: userId,
            action: 'update',
            entity_type: 'notification',
            entity_id: notification.id,
            after_data: { action: 'retry', channel: notification.channel },
            category: 'notification-management',
          });
        } catch (notifError) {
          this.logger.warn(
            `Failed to retry notification ${notification.id}`,
            notifError,
          );
          failedCount++;
        }
      }

      return {
        success: true,
        retried_count: retriedCount,
        failed_count: failedCount,
      };
    } catch (error) {
      this.logger.error('Failed to bulk retry notifications', error);
      throw error;
    }
  }

  /**
   * GET /api/data-officer/notifications/export
   *
   * Export notifications as audit trail
   */
  async exportNotifications(
    filter: FilterNotificationsDto,
  ): Promise<NotificationLogDto[]> {
    const result = await this.getNotifications({ ...filter, limit: 10000 });
    return result.notifications;
  }

  // =========================================================================
  // REPORTS ENDPOINTS
  // =========================================================================

  /**
   * GET /api/data-officer/reports/summary
   *
   * Get quick report summaries
   */
  async getReportSummaries(): Promise<any[]> {
    return [
      {
        id: 'report-1',
        name: 'Accra North · Measles 1 backlog · Last 14 days',
        description: 'Children overdue for Measles 1 vaccination',
        data_source: 'vaccination_events',
        created_at: new Date().toISOString(),
      },
      {
        id: 'report-2',
        name: 'Data Quality Report',
        description: 'Missing data and inconsistencies',
        data_source: 'children',
        created_at: new Date().toISOString(),
      },
      {
        id: 'report-3',
        name: 'Notification Performance',
        description: 'SMS/Email delivery rates',
        data_source: 'notifications',
        created_at: new Date().toISOString(),
      },
    ];
  }

  /**
   * POST /api/data-officer/reports/export
   *
   * Export custom report in requested format
   */
  async exportReport(
    format: 'csv' | 'excel' | 'pdf',
    userId: string,
  ): Promise<{ success: boolean; file_url: string; format: string }> {
    // This would integrate with a reporting library like pdfkit or exceljs
    // For now, return a placeholder
    this.logger.log(`Report export requested: ${format} by user ${userId}`);

    return {
      success: true,
      file_url: `/exports/report-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`,
      format,
    };
  }
}
