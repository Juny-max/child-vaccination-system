import { apiRequest, API_BASE_URL, handleResponse } from './config';

// ============================================================
// Response types — mirrors what the backend returns
// ============================================================

export interface PHAKPIs {
  totalChildrenRegistered: number;
  totalDosesAdministered: number;
  penta3Coverage: number;
  dropoutRate: number;
  zeroDoseChildren: number;
}

export interface PHAAefiSummary {
  total: number;
  mild: number;
  moderate: number;
  severe: number;
}

export interface PHACoverageTrendPoint {
  month: string;
  coverage: number;
}

export interface PHARegionalCoverage {
  region: string;
  coverage: number;
}

export interface PHADashboardData {
  kpis: PHAKPIs;
  aefiSummary: PHAAefiSummary;
  coverageTrend: PHACoverageTrendPoint[];
  regionalCoverage: PHARegionalCoverage[];
}

/** A single column descriptor returned by the /pha/reports endpoint */
export interface PHAReportColumn {
  key: string;
  label: string;
}

/** Full report response — dynamic columns + all rows + summary metrics */
export interface PHAReportResponse {
  columns: PHAReportColumn[];
  rows: Record<string, string | number>[];
  totalRows: number;
  /** Aggregated summary metrics (e.g. avgCoverage, totalAefiReports).
   *  Keys are camelCase, values are numbers. */
  summary: Record<string, number>;
}

// ============================================================
// API functions
// ============================================================

/**
 * Fetch all PHA dashboard data from the backend.
 * The bearer token is added automatically by apiRequest.
 * On 401 (expired / invalid token), apiRequest redirects to /auth/login.
 *
 * @param months - Number of months for the trend chart (1–24, default 12)
 */
export async function getPHADashboard(months = 12): Promise<PHADashboardData> {
  return apiRequest<PHADashboardData>(`/pha/dashboard?months=${months}`);
}

/**
 * Fetch tabular data for a PHA report.
 * Returns dynamic columns + all rows + summary metrics.
 * The same response is used for both the live preview and the CSV export.
 *
 * @param reportType - One of the 8 recognised report type identifiers
 * @param region     - 'All Regions' or a specific Ghana region name
 * @param from       - Start date as YYYY-MM-DD
 * @param to         - End date   as YYYY-MM-DD
 */
export async function getPHAReport(
  reportType: string,
  region: string,
  from: string,
  to: string,
): Promise<PHAReportResponse> {
  const params = new URLSearchParams({ type: reportType, region, from, to });
  return apiRequest<PHAReportResponse>(`/pha/reports?${params}`);
}

// ── Certificate Verification ─────────────────────────────────────────────────

export interface PHACertificateVerifyResult {
  found: boolean;
  isValid?: boolean;
  isPending?: boolean;
  certificateId: string;
  childName?: string;
  motherName?: string;
  issuedDate?: string;
  completionStatus?: string;
  vaccinesCompleted?: string[];
  issuedBy?: string;
  region?: string;
  status?: string;
}

/**
 * Verify a certificate by its ID against the live database.
 * Returns validity metadata and limited identity fields for
 * manual verification cross-checking.
 */
export async function verifyPHACertificate(
  certificateId: string,
): Promise<PHACertificateVerifyResult> {
  const params = new URLSearchParams({ id: certificateId });
  return apiRequest<PHACertificateVerifyResult>(
    `/pha/certificates/verify?${params}`,
  );
}

/**
 * Public certificate verification — no login required.
 * Calls /api/public/certificates/verify which has no auth guard.
 * Does NOT attach auth headers or redirect to login on failure.
 */
export async function verifyPublicCertificate(
  certificateId: string,
): Promise<PHACertificateVerifyResult> {
  const params = new URLSearchParams({ id: certificateId });
  const response = await fetch(
    `${API_BASE_URL}/public/certificates/verify?${params}`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  return handleResponse<PHACertificateVerifyResult>(response, true);
}
