import { apiRequest } from './config';

export interface SystemMetric {
  id: string;
  name: string;
  value: number | string;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  detail?: string;
  timestamp?: string;
}

export interface DatabaseStat {
  id: string;
  name: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  threshold?: number;
}

export interface BackupConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
}

export interface AuditActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  status: 'success' | 'failed';
}

/**
 * Get real-time system health metrics
 */
export async function getSystemMetrics(): Promise<SystemMetric[]> {
  return apiRequest<SystemMetric[]>('/hq-admin/system/metrics');
}

/**
 * Get database performance and capacity statistics
 */
export async function getDatabaseStats(): Promise<DatabaseStat[]> {
  return apiRequest<DatabaseStat[]>('/hq-admin/system/database-stats');
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  size: string;
  status: 'success' | 'failed' | 'pending';
  downloadUrl?: string;
}

/**
 * Get recent backup history
 */
export async function getBackupHistory(): Promise<BackupRecord[]> {
  return apiRequest<BackupRecord[]>('/hq-admin/system/backup-history');
}

/**
 * Configure backup schedule and retention policy
 */
export async function configureBackup(config: BackupConfig) {
  return apiRequest('/hq-admin/system/backup-config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Get user activity audit logs
 */
export async function getAuditActivity(): Promise<AuditActivity[]> {
  return apiRequest<AuditActivity[]>('/hq-admin/system/audit-activity');
}
