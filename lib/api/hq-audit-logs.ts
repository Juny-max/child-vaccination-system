import { apiRequest } from './config';

export interface HqAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  category: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface HqAuditLogFilters {
  action?: string;
  entityType?: string;
  category?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface HqAuditLogResponse {
  data: HqAuditLog[];
  pagination: { limit: number; offset: number; returned: number };
}

export async function getHqAuditLogs(filters?: HqAuditLogFilters): Promise<HqAuditLogResponse> {
  const params = new URLSearchParams();

  if (filters?.action) params.append('action', filters.action);
  if (filters?.entityType) params.append('entityType', filters.entityType);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  const url = `/hq-admin/audit-logs${queryString ? `?${queryString}` : ''}`;

  return apiRequest<HqAuditLogResponse>(url);
}
