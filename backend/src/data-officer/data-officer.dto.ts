/**
 * Data Officer DTOs
 */

import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// ============================================================================
// DASHBOARD DTOs
// ============================================================================

export interface KpiMetrics {
  pending_duplicates: number;
  sync_conflicts: number;
  missing_data_percentage: number;
  notification_failures_24h: number;
  security_alerts_24h: number;
  downtime_minutes_24h: number;
}

export interface DataOfficerDashboardDto {
  kpis: KpiMetrics;
  duplicate_preview: DuplicateCandidateDto[];
  sync_conflicts_feed: SyncConflictDto[];
  notification_status: {
    recent_failures: number;
    success_rate: number;
  };
}

// ============================================================================
// DUPLICATE CANDIDATES DTOs
// ============================================================================

export interface ChildSummaryDto {
  id: string;
  name: string;
  date_of_birth: string;
  mother_name: string | null;
  last_vaccination_date: string | null;
  vaccination_count: number;
}

export interface DuplicateCandidateDto {
  id: string;
  pair_id: string;
  child_a_id: string;
  child_b_id: string;
  similarity_score: number;
  matching_fields: string[];
  status: 'pending' | 'merged' | 'dismissed' | 'under-review';
  child_a: ChildSummaryDto;
  child_b: ChildSummaryDto;
  created_at: string;
}

export class MergeDuplicateDto {
  @IsUUID()
  survivor_id: string;

  @IsString()
  @IsNotEmpty()
  merge_reason: string;

  @IsOptional()
  @IsString()
  merge_note?: string;
}

// ============================================================================
// SYNC CONFLICTS DTOs
// ============================================================================

export interface SyncConflictDto {
  id: string;
  conflict_id: string;
  entity_type: string;
  entity_id: string | null;
  conflict_type: string;
  local_data: Record<string, any>;
  server_data: Record<string, any> | null;
  status: 'pending' | 'merged' | 'dismissed' | 'under-review';
  created_at: string;
  recommended_action: string | null;
}

export class ResolveSyncConflictDto {
  @IsIn(['relink', 'discard', 'hold-for-hq'])
  resolution_type: 'relink' | 'discard' | 'hold-for-hq';

  @IsOptional()
  @IsUUID()
  related_child_id?: string;

  @IsOptional()
  @IsString()
  follow_up_action?: string;

  @IsString()
  @IsNotEmpty()
  resolution_note: string;
}

// ============================================================================
// NOTIFICATIONS DTOs
// ============================================================================

export interface NotificationLogDto {
  id: string;
  template_id: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  recipient_contact: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export class FilterNotificationsDto {
  @IsOptional()
  @IsIn(['all', 'sent', 'delivered', 'failed', 'pending'])
  status?: 'all' | 'sent' | 'delivered' | 'failed' | 'pending';

  @IsOptional()
  @IsIn(['sms', 'email', 'all'])
  channel?: 'sms' | 'email' | 'all';

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class BulkRetryDto {
  @IsArray()
  @IsString({ each: true })
  notification_ids: string[];
}

// ============================================================================
// REPORTS DTOs
// ============================================================================

export interface ReportDto {
  id: string;
  name: string;
  description: string;
  data_source: string;
  columns: string[];
  filters: Record<string, any>;
  created_at: string;
  created_by_user_id: string;
}

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  data_source: string;

  @IsArray()
  @IsString({ each: true })
  columns: string[];

  @IsObject()
  filters: Record<string, any>;
}

export class ExportReportDto {
  @IsUUID()
  report_id: string;

  @IsIn(['csv', 'excel', 'pdf'])
  format: 'csv' | 'excel' | 'pdf';
}

// ============================================================================
// SECURITY & AUDIT DTOs
// ============================================================================

export interface SecurityAlertDto {
  id: string;
  alert_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  resolved_at: string | null;
}
