/**
 * Data Officer DTOs
 */

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
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
  survivor_id: string;
  merge_reason: string;
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

export enum ResolutionType {
  RELINK = 'relink',
  DISCARD = 'discard',
  HOLD_FOR_HQ = 'hold-for-hq',
}

export class ResolveSyncConflictDto {
  @IsNotEmpty()
  @IsEnum(ResolutionType)
  resolution_type: ResolutionType;

  /** Required when resolution_type is 'relink' */
  @ValidateIf((o) => o.resolution_type === ResolutionType.RELINK)
  @IsNotEmpty()
  @IsUUID()
  related_child_id?: string;

  @IsOptional()
  @IsString()
  follow_up_action?: string;

  @IsNotEmpty()
  @IsString()
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
  status?: 'all' | 'sent' | 'delivered' | 'failed' | 'pending';
  channel?: 'sms' | 'email' | 'all';
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class BulkRetryDto {
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
  name: string;
  description?: string;
  data_source: string;
  columns: string[];
  filters: Record<string, any>;
}

export class ExportReportDto {
  report_id: string;
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
