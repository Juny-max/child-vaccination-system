import { apiRequest } from './config';

// ============================================================
// Response types — mirrors what the backend returns
// ============================================================

export interface BranchMeta {
  name: string;
  region: string;
  district?: string;
}

export interface BranchKPIs {
  childrenRegistered: number;
  vaccinationsToday: number;
  chwsActiveToday: number;
  pendingSyncs: number;
  zeroDoseChildren: number;
}

export interface StockAlert {
  vaccine: string;
  remaining: number;
  status: string;
  daysToExpiry: number;
  expiryDate: string;
}

export interface AlertItem {
  id: string;
  child: string;
  detail: string;
  status?: string;
  daysOverdue?: number;
  timestamp: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Nurse' | 'CHW';
  lastActive: string;
}

export interface CHWProductivity {
  name: string;
  registrations: number;
  vaccinations: number;
}

export interface CatchmentCoverage {
  name: string;
  coverage: number;
  status: string;
}

export interface DropoutData {
  vaccine: string;
  series1: number;
  series3: number;
}

export interface CoverageTrendPoint {
  day: string;
  vaccinations: number;
}

export interface BranchDashboardData {
  branchMeta: BranchMeta;
  kpis: BranchKPIs;
  branchCoverage: number;
  coverageTrend: CoverageTrendPoint[];
  stockAlerts: StockAlert[];
  overdueVaccinations: AlertItem[];
  aefiEvents: AlertItem[];
  syncErrors: AlertItem[];
  notificationFailures: AlertItem[];
  staffRoster: StaffMember[];
  chwProductivity: CHWProductivity[];
  catchmentCoverage: CatchmentCoverage[];
  dropoutData: DropoutData[];
}

// ============================================================
// Stock management types
// ============================================================

export interface VaccineOption {
  id: string;
  name: string;
}

export interface LogStockPayload {
  vaccineId: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturer?: string;
  expiryDate: string;
  quantityReceived: number;
  receivedDate: string;
}

// ============================================================
// API functions
// ============================================================

/**
 * Fetch the complete Branch Manager dashboard data.
 * The backend scopes data to the logged-in manager's branch automatically via JWT.
 */
export async function getBranchDashboard(): Promise<BranchDashboardData> {
  return apiRequest<BranchDashboardData>('/branch-manager/dashboard');
}

/**
 * Fetch active vaccines for the stock delivery form dropdown.
 */
export async function getVaccineOptions(): Promise<VaccineOption[]> {
  return apiRequest<VaccineOption[]>('/branch-manager/vaccines');
}

/**
 * Log a new vaccine shipment delivery into stock_inventory.
 */
export async function recordStockDelivery(payload: LogStockPayload): Promise<void> {
  return apiRequest<void>('/branch-manager/stock', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
