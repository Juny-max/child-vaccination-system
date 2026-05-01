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
  vaccineId: string;
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
  createdAt?: string;
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Nurse' | 'CHW';
  status: 'active' | 'suspended' | 'inactive';
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

export interface RecentVisitLog {
  id: string;
  visitDate: string;
  chwName: string;
  childName: string;
  status: string;
  vaccinesAdministered: number;
  notes: string;
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
  recentVisitLogs: RecentVisitLog[];
  catchmentCoverage: CatchmentCoverage[];
  dropoutData: DropoutData[];
}

export interface BranchChildLookupResult {
  id: string;
  childId: string;
  childName: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  facilityName: string;
  vaccinationStatus: 'Complete' | 'In Progress' | 'Overdue';
  completedVaccines: number;
  upcomingVaccines: number;
  overdueVaccines: number;
  nextVaccine: string | null;
  nextDueDate: string | null;
  lastVisit: string | null;
}

export type BranchChildQueueType =
  | 'overdue'
  | 'zero-dose'
  | 'missed'
  | 'failed-reminder';

export type BranchChildQueuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface BranchChildQueueItem {
  id: string;
  queueType: BranchChildQueueType;
  childId: string;
  childCvccId: string;
  childName: string;
  guardianName: string;
  guardianPhone: string;
  reason: string;
  priority: BranchChildQueuePriority;
  referenceDate: string | null;
  daysOpen: number;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedAt?: string | null;
}

export interface BranchChildManagementQueues {
  overdue: BranchChildQueueItem[];
  zeroDose: BranchChildQueueItem[];
  missed: BranchChildQueueItem[];
  failedReminders: BranchChildQueueItem[];
}

export interface AssignBranchChildFollowUpPayload {
  childId: string;
  assigneeUserId: string;
  queueType: BranchChildQueueType;
  reason?: string;
  notes?: string;
}

export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties?: Record<string, unknown>;
}

export interface BranchCatchmentArea {
  id: string;
  branchId: string;
  name: string;
  code: string;
  boundaries: GeoJsonFeature | null;
  assignedChwId: string | null;
  assignedChwName: string | null;
  status: 'assigned' | 'unassigned';
  stats?: {
    activeChildren: number;
    transferredIn: number;
    transferredOut: number;
  };
  createdAt: string;
  updatedAt: string;
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

export interface ResetExpiringStockPayload {
  vaccineId: string;
  expiryWindowDays?: number;
}

export interface ResetExpiringStockResponse {
  resetRows: number;
  resetDoses: number;
  message: string;
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
 * Search child records scoped to the logged-in branch manager's branch.
 */
export async function searchBranchChildren(
  query: string,
): Promise<BranchChildLookupResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const params = new URLSearchParams({ query: trimmed });
  return apiRequest<BranchChildLookupResult[]>(
    `/branch-manager/children/search?${params.toString()}`,
  );
}

/**
 * Get queue-first child management lists for branch managers.
 */
export async function getBranchChildManagementQueues(): Promise<BranchChildManagementQueues> {
  return apiRequest<BranchChildManagementQueues>('/branch-manager/children/queues');
}

/**
 * Assign branch child follow-up to an active nurse/CHW in the branch.
 */
export async function assignBranchChildFollowUp(
  payload: AssignBranchChildFollowUpPayload,
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    '/branch-manager/children/follow-ups/assign',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
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

/**
 * Reset expiring/expired stock quantities for a vaccine before restocking.
 */
export async function resetExpiringStock(
  payload: ResetExpiringStockPayload,
): Promise<ResetExpiringStockResponse> {
  return apiRequest<ResetExpiringStockResponse>('/branch-manager/stock/reset-expiring', {
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
  id: string;
  email: string;
  emailSent: boolean;
  message: string;
  reason?: string | null;
  temporaryPassword?: string;
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

export interface CreateCatchmentAreaPayload {
  name: string;
  boundaries: GeoJsonFeature | GeoJsonGeometry;
}

export interface UpdateCatchmentAreaPayload {
  name?: string;
  boundaries?: GeoJsonFeature | GeoJsonGeometry;
}

// ============================================================
// Staff management API functions
// ============================================================

/**
 * Register a new staff member (nurse or CHW) at the branch.
 * Returns email delivery status and a temporary password only if email delivery fails.
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

/**
 * Save a newly drawn catchment polygon for the current manager branch.
 */
export async function createBranchCatchmentArea(
  payload: CreateCatchmentAreaPayload,
): Promise<BranchCatchmentArea> {
  return apiRequest<BranchCatchmentArea>('/branch-manager/catchment-areas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch catchment zones for the manager's branch map.
 */
export async function getBranchCatchmentAreas(
  branchId?: string,
): Promise<BranchCatchmentArea[]> {
  const query = branchId
    ? `?${new URLSearchParams({ branchId }).toString()}`
    : '';

  return apiRequest<BranchCatchmentArea[]>(`/branch-manager/catchment-areas${query}`);
}

/**
 * Update an existing catchment area name and/or polygon boundaries.
 */
export async function updateBranchCatchmentArea(
  catchmentAreaId: string,
  payload: UpdateCatchmentAreaPayload,
): Promise<BranchCatchmentArea> {
  return apiRequest<BranchCatchmentArea>(
    `/branch-manager/catchment-areas/${catchmentAreaId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Delete an existing catchment area.
 */
export async function deleteBranchCatchmentArea(
  catchmentAreaId: string,
): Promise<{ success: boolean; id: string; name: string }> {
  return apiRequest<{ success: boolean; id: string; name: string }>(
    `/branch-manager/catchment-areas/${catchmentAreaId}`,
    {
      method: 'DELETE',
    },
  );
}

/**
 * Assign a CHW to a catchment area.
 */
export async function assignCatchmentAreaChw(
  catchmentAreaId: string,
  chwId: string,
): Promise<BranchCatchmentArea> {
  return apiRequest<BranchCatchmentArea>(
    `/branch-manager/catchment-areas/${catchmentAreaId}/assign`,
    {
      method: 'PATCH',
      body: JSON.stringify({ chwId }),
    },
  );
}

