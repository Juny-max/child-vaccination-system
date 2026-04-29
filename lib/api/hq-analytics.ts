import { apiRequest } from './config';

export interface HqAnalyticsTrendPoint {
  period: string;
  measles: number;
  dpt3: number;
}

export interface HqAnalyticsResponse {
  filters: {
    region: string;
    branch: string;
    window: string;
  };
  trend: HqAnalyticsTrendPoint[];
}

export interface HqOverviewStats {
  totalBranches: number;
  totalUsers: number;
  childrenRegistered: number;
  chwsActiveToday: number;
  totalChws: number;
  chwSyncPercentage: number;
  nationalCoverageRate: number;
}

export interface GetHqAnalyticsParams {
  region?: string;
  branch?: string;
  window?: string;
}

export async function getHqAnalytics(params: GetHqAnalyticsParams = {}): Promise<HqAnalyticsResponse> {
  const query = new URLSearchParams();

  if (params.region) query.set('region', params.region);
  if (params.branch) query.set('branch', params.branch);
  if (params.window) query.set('window', params.window);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<HqAnalyticsResponse>(`/hq-admin/analytics${suffix}`);
}

export async function getHqOverviewStats(): Promise<HqOverviewStats> {
  return apiRequest<HqOverviewStats>('/hq-admin/analytics/overview');
}

export interface HqAefiReport {
  id: string;
  child: string;
  vaccine: string;
  branch: string;
  reportedAt: string;
  priority: 'High' | 'Medium' | 'Low';
}

export async function getHqAefiReports(limit?: number, priority?: string): Promise<HqAefiReport[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', limit.toString());
  if (priority && priority !== 'all') query.set('priority', priority);
  
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<HqAefiReport[]>(`/hq-admin/analytics/aefi${suffix}`);
}

export interface HqDeviceSyncStatus {
  id: string;
  name: string;
  branch: string;
  lastSync: string;
  lastSyncAt: string;
  pending: number;
  status: 'active' | 'stale';
}

export async function getHqDeviceSyncStatus(): Promise<HqDeviceSyncStatus[]> {
  return apiRequest<HqDeviceSyncStatus[]>('/hq-admin/analytics/device-sync-status');
}

export interface HqChwProductivity {
  label: string;
  registrations: number;
  vaccinations: number;
}

export async function getHqChwProductivity(limit = 10): Promise<HqChwProductivity[]> {
  return apiRequest<HqChwProductivity[]>(`/hq-admin/analytics/chw-productivity?limit=${limit}`);
}
