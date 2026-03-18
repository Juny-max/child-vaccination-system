/**
 * Data Officer DTOs
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsIn,
  IsNumber,
  IsInt,
  IsObject,
  ArrayNotEmpty,
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
  @IsNotEmpty()
  survivor_id: string;

  @IsString()
  @IsNotEmpty()
  merge_reason: string;

  @IsString()
  @IsOptional()
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

  @IsUUID()
  @IsOptional()
  related_child_id?: string;

  @IsString()
  @IsOptional()
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
  @IsIn(['all', 'sent', 'delivered', 'failed', 'pending'])
  @IsOptional()
  status?: 'all' | 'sent' | 'delivered' | 'failed' | 'pending';

  @IsIn(['sms', 'email', 'all'])
  @IsOptional()
  channel?: 'sms' | 'email' | 'all';

  @IsString()
  @IsOptional()
  date_from?: string;

  @IsString()
  @IsOptional()
  date_to?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}

export class BulkRetryDto {
  @IsArray()
  @ArrayNotEmpty()
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

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  data_source: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  columns: string[];

  @IsObject()
  filters: Record<string, any>;
}

export class ExportReportDto {
  @IsUUID()
  @IsNotEmpty()
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
