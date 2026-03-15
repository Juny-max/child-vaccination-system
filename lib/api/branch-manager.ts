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

// ============================================================
// Staff management types
// ============================================================

export type StaffRole = 'facility-nurse' | 'chw';
export type StaffStatus = 'active' | 'suspended' | 'inactive';

export interface RegisterStaffPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  nationalId?: string;
  role: StaffRole;
  catchmentAreaId?: string; // CHWs only
  specialization?: string;  // Nurses only
}

export interface UpdateStaffPayload {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  nationalId?: string;
  catchmentAreaId?: string;
  specialization?: string;
}

export interface RegisterStaffResponse {
  userId: string;
  email: string;
  temporaryPassword: string;
}

export interface StaffListItem {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: StaffRole;
  status: StaffStatus;
  last_login_at: string | null;
  created_at: string;
}

export interface StaffListFilters {
  role?: StaffRole;
  status?: StaffStatus;
  search?: string;
}

// ============================================================
// Staff management API functions
// ============================================================

/**
 * Register a new staff member (nurse or CHW) at the branch.
 * Returns temporary password that must be sent to the staff member.
 */
export async function registerStaff(
  payload: RegisterStaffPayload,
): Promise<RegisterStaffResponse> {
  return apiRequest<RegisterStaffResponse>('/branch-manager/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get list of staff at the branch with optional filters.
 */
export async function getStaffList(
  filters?: StaffListFilters,
): Promise<StaffListItem[]> {
  const params = new URLSearchParams();
  if (filters?.role) params.append('role', filters.role);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = `/branch-manager/staff${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<StaffListItem[]>(url);
}

/**
 * Update staff details (partial update).
 */
export async function updateStaff(
  staffId: string,
  payload: UpdateStaffPayload,
): Promise<void> {
  return apiRequest<void>(`/branch-manager/staff/${staffId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Update staff status (activate, suspend, deactivate).
 */
export async function updateStaffStatus(
  staffId: string,
  status: StaffStatus,
): Promise<void> {
  return apiRequest<void>(`/branch-manager/staff/${staffId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

