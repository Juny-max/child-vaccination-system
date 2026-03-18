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
