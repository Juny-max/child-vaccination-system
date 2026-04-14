import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../common/database/database.service';
import { EmailService } from '../common/email.service';
import { QrTokenService } from '../common/qr-token.service';
import { CreateHqBranchDto, UpdateHqBranchDto } from './hq-branches.dto';
import {
  CreateHqUserDto,
  HqUserStatus,
  UpdateHqUserDto,
} from './hq-users.dto';
import {
  AssignBranchCatchmentAreaDto,
  CreateBranchCatchmentAreaDto,
  UpdateBranchCatchmentAreaDto,
} from './catchment-areas.dto';
import { RegisterStaffDto } from './register-staff.dto';
import { UpdateStaffDto } from './update-staff.dto';

type BranchChildQueueType =
  | 'overdue'
  | 'zero-dose'
  | 'missed'
  | 'failed-reminder';

type BranchChildQueuePriority = 'critical' | 'high' | 'medium' | 'low';

type BranchChildQueueItem = {
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
};

@Injectable()
export class BranchManagerService {
  private readonly logger = new Logger(BranchManagerService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
    private readonly qrTokenService: QrTokenService,
  ) {}

  /**
   * Returns all data for the Branch Manager dashboard in a single request.
   * Scoped to the manager's own branch — no cross-branch data leaks.
   */
  async getDashboardData(branchId: string) {
    const db = this.databaseService.supabase;

    try {
      // ── Step 1: Fetch branch metadata + children (parallel) ───────────
      // Children are fetched here (not in Step 4) so childIdList is available
      // for the today-count and weekly-trend queries below.  The inner-join on
      // child_guardian excludes orphaned seed records — matching the nurse portal.
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const [branchResult, childrenEarlyResult] = await Promise.all([
        db.from('branches')
          .select('id, name, region, district, code')
          .eq('id', branchId)
          .single(),
        db.from('children')
          .select('id, full_name, date_of_birth, child_guardian!inner(child_id)')
          .eq('primary_facility_id', branchId)
          .eq('is_active', true),
      ]);
      const branch = branchResult.data;

      // Deduplicate (a child with 2 guardians returns 2 rows from the inner-join)
      const seenChildIds = new Set<string>();
      const allChildrenIds = (childrenEarlyResult.data ?? []).filter((c: any) => {
        if (seenChildIds.has(c.id)) return false;
        seenChildIds.add(c.id);
        return true;
      });
      const childIdList = allChildrenIds.map((c: any) => c.id);

      // ── Step 2: Run independent aggregate queries in parallel ──────────
      const [
        childrenCount,
        vaccinationsTodayCount,
        staffRows,
        vaccinationSchedulesRows,
        aefiRows,
        syncQueueRows,
        notificationRows,
        visitLogRows,
        weeklyVaxRows,
        catchmentRows,
        vaccinatedEventsResult,
      ] = await Promise.all([
        // Total children registered at this branch
        db
          .from('children')
          .select('id', { count: 'exact', head: true })
          .eq('primary_facility_id', branchId)
          .eq('is_active', true),

        // Vaccinations completed today — scoped via child_id so historical events
        // with facility_id = null are still counted correctly.
        childIdList.length > 0
          ? db
              .from('vaccination_events')
              .select('id', { count: 'exact', head: true })
              .in('child_id', childIdList)
              .eq('status', 'completed')
              .eq('administered_date', todayStr)
          : Promise.resolve({ count: 0, data: null, error: null }),

        // Staff assigned to this branch (nurses + CHWs)
        db
          .from('users')
          .select('id, full_name, role, status, last_login_at')
          .eq('branch_id', branchId)
          .in('role', ['facility-nurse', 'chw']),

        // National vaccination schedule (mandatory doses) for overdue computation
        db
          .from('vaccination_schedules')
          .select('vaccine_id, dose_number, due_days_from_birth, vaccines(name)')
          .eq('is_mandatory', true)
          .order('due_days_from_birth', { ascending: true }),

        // AEFI events at this branch — scoped by child_id (not facility_id)
        childIdList.length > 0
          ? db
              .from('aefi_reports')
              .select('id, severity, status, symptoms, created_at, children(full_name)')
              .in('child_id', childIdList)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),

        // Pending sync queue items from staff at this branch
        db
          .from('sync_queue')
          .select('id, entity_type, status, created_at, users!inner(full_name, branch_id)')
          .eq('users.branch_id', branchId)
          .in('status', ['pending', 'failed', 'conflict'])
          .order('created_at', { ascending: false })
          .limit(10),

        // Failed notifications for children at this branch — scoped by child_id
        childIdList.length > 0
          ? db
              .from('notifications')
              .select('id, channel, recipient_contact, message, status, error_message, created_at, child_id, children(full_name)')
              .in('child_id', childIdList)
              .in('status', ['failed', 'bounced'])
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),

        // CHW visit logs for the past 7 days
        db
          .from('visit_logs')
          .select('id, chw_id, child_id, visit_date, status, vaccines_administered, notes, users!inner(full_name, branch_id), children(full_name)')
          .eq('users.branch_id', branchId)
          .gte('visit_date', sevenDaysAgoStr)
          .order('visit_date', { ascending: false })
          .limit(50),

        // Weekly vaccination data for trend chart (last 7 days) — child_id scoped
        childIdList.length > 0
          ? db
              .from('vaccination_events')
              .select('administered_date')
              .in('child_id', childIdList)
              .eq('status', 'completed')
              .gte('administered_date', sevenDaysAgoStr)
              .order('administered_date', { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        // Catchment areas under this branch
        db
          .from('catchment_areas')
          .select('id, name, code, population_estimate, assigned_chw_id')
          .eq('branch_id', branchId),

        // All completed vaccination events for branch children (coverage + overdue)
        childIdList.length > 0
          ? db
              .from('vaccination_events')
              .select('child_id, vaccine_id, dose_number')
              .in('child_id', childIdList)
              .eq('status', 'completed')
          : Promise.resolve({ data: [], error: null }),
      ]);

      // ── Step 3: Compute KPIs ──────────────────────────────────────────
      const totalChildren = childrenCount.count ?? 0;
      const vaccinationsToday = (vaccinationsTodayCount as any).count ?? 0;
      const staff = staffRows.data ?? [];

      // CHWs "active today" = logged in within last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const chwsActiveToday = staff.filter(
        (s: any) =>
          s.role === 'chw' &&
          s.status === 'active' &&
          s.last_login_at &&
          new Date(s.last_login_at) > oneDayAgo,
      ).length;

      const pendingSyncs = (syncQueueRows.data ?? []).length;

      // ── Step 4: Branch coverage — unique children with ≥ 1 completed vaccination ──
      // vaccinatedEvents and allChildrenIds are already available from Steps 1 & 2.
      const vaccinatedEvents = vaccinatedEventsResult.data ?? [];

      const uniqueVaccinatedIds = new Set(
        vaccinatedEvents.map((e: any) => e.child_id),
      );
      const uniqueVaccinatedCount = uniqueVaccinatedIds.size;

      // Zero-dose children: registered at this branch but NEVER received any vaccine.
      const zeroDoseChildren = allChildrenIds.filter(
        (c: any) => !uniqueVaccinatedIds.has(c.id),
      ).length;

      const branchCoverage =
        totalChildren > 0
          ? Math.min(
              100,
              parseFloat(
                ((uniqueVaccinatedCount / totalChildren) * 100).toFixed(1),
              ),
            )
          : 0;

      // ── Step 5: 7-day coverage trend ──────────────────────────────────
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const trendMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayLabel = dayNames[d.getDay()];
        trendMap.set(dayLabel, 0);
      }
      (weeklyVaxRows.data ?? []).forEach((e: any) => {
        const d = new Date(e.administered_date);
        const dayLabel = dayNames[d.getDay()];
        trendMap.set(dayLabel, (trendMap.get(dayLabel) ?? 0) + 1);
      });
      const coverageTrend = Array.from(trendMap.entries()).map(([day, count]) => ({
        day,
        vaccinations: count,
      }));

      // ── Step 6: Stock alerts from stock_inventory table ──────────────
      const { data: stockRows } = await db
        .from('stock_inventory')
        .select('vaccine_id, quantity_remaining, expiry_date, vaccines(name)')
        .eq('facility_id', branchId)
        .order('expiry_date', { ascending: true });

      const today = new Date();
      const ninetyDaysOut = new Date();
      ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

      // Aggregate quantities per vaccine name (there may be multiple batches)
      const stockMap = new Map<
        string,
        {
          vaccineId: string;
          vaccine: string;
          remaining: number;
          earliestExpiryAll: Date;
          earliestExpiryWithStock: Date | null;
        }
      >();
      (stockRows ?? []).forEach((row: any) => {
        const vaccineId: string = row.vaccine_id;
        const vaccineName: string = (row.vaccines as any)?.name ?? 'Unknown';
        const remaining: number = row.quantity_remaining ?? 0;
        const expiry = new Date(row.expiry_date);
        const key = `${vaccineId}::${vaccineName}`;
        const existing = stockMap.get(key);
        if (existing) {
          existing.remaining += remaining;
          if (expiry < existing.earliestExpiryAll) existing.earliestExpiryAll = expiry;
          if (remaining > 0) {
            if (!existing.earliestExpiryWithStock || expiry < existing.earliestExpiryWithStock) {
              existing.earliestExpiryWithStock = expiry;
            }
          }
        } else {
          stockMap.set(key, {
            vaccineId,
            vaccine: vaccineName,
            remaining,
            earliestExpiryAll: expiry,
            earliestExpiryWithStock: remaining > 0 ? expiry : null,
          });
        }
      });

      const stockAlerts = Array.from(stockMap.values()).map(({ vaccineId, vaccine, remaining, earliestExpiryAll, earliestExpiryWithStock }) => {
        // Use the earliest expiry among batches that still have doses; fallback to any batch date when fully out of stock.
        const effectiveExpiry = earliestExpiryWithStock ?? earliestExpiryAll;
        const daysToExpiry = Math.ceil((effectiveExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = effectiveExpiry <= ninetyDaysOut;

        let status: string;
        if (daysToExpiry <= 0) {
          status = 'expired';
        } else if (remaining === 0) {
          status = 'out-of-stock';
        } else if (isExpiringSoon && remaining < 100) {
          status = 'critical';
        } else if (remaining < 100 || isExpiringSoon) {
          status = 'low';
        } else if (remaining < 200) {
          status = 'moderate';
        } else {
          status = 'adequate';
        }

        return {
          vaccineId,
          vaccine,
          remaining,
          status,
          daysToExpiry,
          expiryDate: effectiveExpiry.toISOString().split('T')[0],
        };
      });

      // Sort: out-of-stock first, then critical, low, moderate, adequate
      const statusOrder: Record<string, number> = {
        'expired': 0, 'out-of-stock': 1, critical: 2, low: 3, moderate: 4, adequate: 5,
      };
      stockAlerts.sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

      // ── Step 7: Compute overdue vaccinations from national schedule ────
      // A child is overdue if:
      //   their age in days > due_days_from_birth + 14-day grace period
      //   AND they have not received that vaccine/dose yet.
      // We show at most one entry per child (the most overdue missing dose).
      const GRACE_DAYS = 14;
      // Exact set: child + vaccine + dose  (for events where dose_number is recorded)
      const receivedExact = new Set<string>();
      // Loose set: child + vaccine only    (for legacy events where dose_number is null)
      const receivedVaccine = new Set<string>();
      (vaccinatedEvents).forEach((ev: any) => {
        if (!ev.vaccine_id) return;
        if (ev.dose_number != null) {
          receivedExact.add(`${ev.child_id}:${ev.vaccine_id}:${ev.dose_number}`);
        } else {
          // dose_number not stored — treat as covering every dose of this vaccine
          receivedVaccine.add(`${ev.child_id}:${ev.vaccine_id}`);
        }
      });

      const rawOverdue: any[] = [];
      for (const child of allChildrenIds) {
        if (!child.date_of_birth) continue;
        const dob = new Date(child.date_of_birth);
        const ageInDays = Math.floor(
          (today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Find worst (most overdue) missing dose for this child
        let worstOverdue: any = null;
        for (const schedule of (vaccinationSchedulesRows.data ?? [])) {
          if (ageInDays > schedule.due_days_from_birth + GRACE_DAYS) {
            const exactKey = `${child.id}:${schedule.vaccine_id}:${schedule.dose_number}`;
            const looseKey = `${child.id}:${schedule.vaccine_id}`;
            if (!receivedExact.has(exactKey) && !receivedVaccine.has(looseKey)) {
              const daysOverdue = ageInDays - schedule.due_days_from_birth;
              if (!worstOverdue || daysOverdue > worstOverdue.daysOverdue) {
                const dueDate = new Date(
                  dob.getTime() + schedule.due_days_from_birth * 24 * 60 * 60 * 1000,
                );
                const dueDateStr = dueDate.toLocaleDateString('en-GH', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
                worstOverdue = {
                  id: `${child.id}-${schedule.vaccine_id}-${schedule.dose_number}`,
                  child: child.full_name ?? 'Unknown',
                  detail: `${(schedule.vaccines as any)?.name ?? 'Vaccine'} (Dose ${schedule.dose_number}) \u2014 was due ${dueDateStr}`,
                  status: daysOverdue > 30 ? 'Critical' : daysOverdue > 14 ? 'High' : 'Moderate',
                  daysOverdue,
                  timestamp: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
                };
              }
            }
          }
        }
        if (worstOverdue) rawOverdue.push(worstOverdue);
      }
      rawOverdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
      const overdueList = rawOverdue.slice(0, 20);

      // ── Step 8: Format AEFI events ────────────────────────────────────
      const aefiList = (aefiRows.data ?? []).map((a: any) => ({
        id: a.id,
        child: (a.children as any)?.full_name ?? 'Unknown',
        detail: (a.symptoms ?? []).join(', ') || 'Symptoms reported',
        status: this.formatAefiStatus(a.status),
        timestamp: this.timeAgo(new Date(a.created_at)),
      }));

      // ── Step 9: Format sync errors ────────────────────────────────────
      const syncErrors = (syncQueueRows.data ?? []).map((s: any) => ({
        id: s.id,
        child: 'N/A',
        detail: `${s.status === 'conflict' ? 'Data conflict' : 'Failed to sync'} on ${s.entity_type} (${(s.users as any)?.full_name ?? 'Staff'})`,
        timestamp: this.timeAgo(new Date(s.created_at)),
      }));

      // ── Step 10: Format notification failures ─────────────────────────
      const notificationFailures = (notificationRows.data ?? []).map((n: any) => ({
        id: n.id,
        child: (n.children as any)?.full_name ?? 'Guardian/Unknown',
        detail: `${n.channel?.toUpperCase() ?? 'Notification'} to ${n.recipient_contact ?? 'unknown contact'} — ${n.error_message || n.status}`,
        timestamp: this.timeAgo(new Date(n.created_at)),
      }));

      // ── Step 11: Staff roster ─────────────────────────────────────────
      const staffRoster = staff.map((s: any) => ({
        id: s.id,
        name: s.full_name,
        role: s.role === 'facility-nurse' ? 'Nurse' : 'CHW',
        status: s.status,
        lastActive: s.last_login_at
          ? this.formatLastActive(new Date(s.last_login_at))
          : 'Never',
      }));

      // ── Step 12: CHW productivity (past 7 days) ───────────────────────
      const chwStaff = staff.filter((s: any) => s.role === 'chw');
      const visitsByChw = new Map<string, { name: string; registrations: number; vaccinations: number }>();

      chwStaff.forEach((chw: any) => {
        visitsByChw.set(chw.id, { name: chw.full_name, registrations: 0, vaccinations: 0 });
      });

      (visitLogRows.data ?? []).forEach((v: any) => {
        const entry = visitsByChw.get(v.chw_id);
        if (entry) {
          if (v.status === 'completed') {
            entry.registrations += 1;
            entry.vaccinations += (v.vaccines_administered ?? []).length;
          }
        }
      });

      const chwProductivity = Array.from(visitsByChw.values());

      // ── Step 13: Recent visit logs for branch manager tracker ──────────
      const recentVisitLogs = (visitLogRows.data ?? []).map((v: any) => ({
        id: v.id,
        visitDate: v.visit_date,
        chwName: (v.users as any)?.full_name ?? 'Unknown CHW',
        childName: (v.children as any)?.full_name ?? 'Unknown child',
        status: v.status ?? 'pending',
        vaccinesAdministered: Array.isArray(v.vaccines_administered)
          ? v.vaccines_administered.length
          : 0,
        notes: v.notes ?? '',
      }));

      // ── Step 14: Catchment coverage heatmap ───────────────────────────
      const catchments = catchmentRows.data ?? [];
      const catchmentCoverage = await this.computeCatchmentCoverage(db, catchments, branchId);

      // ── Step 15: Dropout analysis (Dose 1 vs Dose 3 for key vaccines) ─
      const dropoutData = await this.computeDropoutAnalysis(db, branchId);

      return {
        branchMeta: {
          name: branch?.name ?? 'Unknown Branch',
          region: branch?.region ?? 'Unknown Region',
          district: branch?.district ?? undefined,
        },
        kpis: {
          childrenRegistered: totalChildren,
          vaccinationsToday,
          chwsActiveToday,
          pendingSyncs,
          zeroDoseChildren,
        },
        branchCoverage,
        coverageTrend,
        stockAlerts,
        overdueVaccinations: overdueList,
        aefiEvents: aefiList,
        syncErrors,
        notificationFailures,
        staffRoster,
        chwProductivity,
        recentVisitLogs,
        catchmentCoverage,
        dropoutData,
      };
    } catch (error) {
      this.logger.error('Branch Manager dashboard query failed', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async computeCatchmentCoverage(
    db: any,
    catchments: any[],
    branchId: string,
  ) {
    if (catchments.length === 0) {
      // No catchment areas defined — return branch-level summary instead
      return [{ name: 'Branch Total', coverage: 0, status: 'No data' }];
    }

    // Get children per catchment via guardian's catchment_area_id
    const { data: guardianCatchments } = await db
      .from('guardians')
      .select('id, catchment_area_id')
      .in(
        'catchment_area_id',
        catchments.map((c: any) => c.id),
      );

    // For each catchment, count children and vaccinated children
    const results = catchments.map((ca: any) => {
      const guardiansInCatchment = (guardianCatchments ?? []).filter(
        (g: any) => g.catchment_area_id === ca.id,
      ).length;
      const population = ca.population_estimate ?? guardiansInCatchment ?? 0;
      const coverage = population > 0
        ? parseFloat(((guardiansInCatchment / population) * 100).toFixed(0))
        : 0;

      let status: string;
      if (coverage >= 80) status = 'High';
      else if (coverage >= 60) status = 'Moderate';
      else if (coverage >= 40) status = 'Low';
      else status = 'Critical';

      return { name: ca.name, coverage, status };
    });

    return results;
  }

  private async computeDropoutAnalysis(db: any, branchId: string) {
    // Get key multi-dose vaccines: DPT/Penta, OPV, Pneumococcal
    const { data: vaccines } = await db
      .from('vaccines')
      .select('id, code, name')
      .in('code', [
        'VAC-PENTA1', 'VAC-PENTA3',
        'VAC-OPV1', 'VAC-OPV3',
        'VAC-PCV1', 'VAC-PCV3',
      ]);

    if (!vaccines || vaccines.length === 0) {
      return [];
    }

    const vaccineMap = new Map<string, string>();
    (vaccines ?? []).forEach((v: any) => vaccineMap.set(v.code, v.id));

    const pairs = [
      { label: 'Penta', dose1Code: 'VAC-PENTA1', dose3Code: 'VAC-PENTA3' },
      { label: 'OPV', dose1Code: 'VAC-OPV1', dose3Code: 'VAC-OPV3' },
      { label: 'PCV', dose1Code: 'VAC-PCV1', dose3Code: 'VAC-PCV3' },
    ];

    const dropoutData = [];

    for (const pair of pairs) {
      const dose1Id = vaccineMap.get(pair.dose1Code);
      const dose3Id = vaccineMap.get(pair.dose3Code);

      const [dose1Count, dose3Count] = await Promise.all([
        dose1Id
          ? db
              .from('vaccination_events')
              .select('child_id', { count: 'exact', head: true })
              .eq('facility_id', branchId)
              .eq('vaccine_id', dose1Id)
              .eq('status', 'completed')
          : Promise.resolve({ count: 0 }),
        dose3Id
          ? db
              .from('vaccination_events')
              .select('child_id', { count: 'exact', head: true })
              .eq('facility_id', branchId)
              .eq('vaccine_id', dose3Id)
              .eq('status', 'completed')
          : Promise.resolve({ count: 0 }),
      ]);

      dropoutData.push({
        vaccine: pair.label,
        series1: dose1Count.count ?? 0,
        series3: dose3Count.count ?? 0,
      });
    }

    return dropoutData;
  }

  private timeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  private formatLastActive(date: Date): string {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today · ${time}`;
    if (isYesterday) return `Yesterday · ${time}`;
    return date.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' }) + ` · ${time}`;
  }

  private formatAefiStatus(status: string): string {
    const map: Record<string, string> = {
      reported: 'New',
      'under-review': 'Under review',
      investigated: 'Investigated',
      resolved: 'Resolved',
      escalated: 'Escalated',
    };
    return map[status] ?? status;
  }

  private calculateAgeLabel(dateOfBirth?: string | null): string {
    if (!dateOfBirth) {
      return 'Unknown';
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return 'Unknown';
    }

    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    if (today.getDate() < birthDate.getDate()) {
      months -= 1;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years > 0) {
      return `${years} year${years === 1 ? '' : 's'}`;
    }

    if (months > 0) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }

    const diffMs = today.getTime() - birthDate.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stock management write operations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the full list of active vaccines for the delivery form dropdown.
   */
  async getVaccines(): Promise<Array<{ id: string; name: string }>> {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('vaccines')
      .select('id, name')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) {
      this.logger.error('Failed to fetch vaccines list', error);
      throw new Error(`Failed to fetch vaccines: ${error.message}`);
    }
    return data ?? [];
  }

  /**
   * Search branch child records by child name, CVCC ID, guardian phone, or QR token.
   * Results are strictly scoped to the manager's branch.
   */
  async searchBranchChildren(branchId: string, query: string) {
    const db = this.databaseService.supabase;
    const rawQuery = (query || '').trim();
    if (!rawQuery) {
      return [];
    }

    const trimmedQuery = rawQuery.toLowerCase();

    const childSelect = `
      id,
      cvcc_id,
      full_name,
      date_of_birth,
      gender,
      primary_facility_id,
      qr_code_payload,
      branches:primary_facility_id (
        id,
        name
      ),
      child_guardian!inner (
        is_primary,
        guardians (
          id,
          full_name,
          phone_primary
        )
      )
    `;

    let children: any[] | null = null;

    if (this.qrTokenService.isChildToken(rawQuery)) {
      const { data: tokenChildren, error: tokenError } = await db
        .from('children')
        .select(childSelect)
        .eq('primary_facility_id', branchId)
        .eq('is_active', true)
        .eq('qr_code_payload', rawQuery)
        .limit(20);

      if (tokenError) {
        throw new InternalServerErrorException(
          `Failed to search child records: ${tokenError.message}`,
        );
      }

      children = tokenChildren || [];
    } else if (this.qrTokenService.isCertificateToken(rawQuery)) {
      const { data: certificate, error: certificateError } = await db
        .from('certificates')
        .select('child_id')
        .eq('qr_payload', rawQuery)
        .single();

      if (certificateError && certificateError.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          `Failed to search child records: ${certificateError.message}`,
        );
      }

      if (certificate?.child_id) {
        const { data: certificateChild, error: childError } = await db
          .from('children')
          .select(childSelect)
          .eq('id', certificate.child_id)
          .eq('primary_facility_id', branchId)
          .eq('is_active', true)
          .limit(1);

        if (childError) {
          throw new InternalServerErrorException(
            `Failed to search child records: ${childError.message}`,
          );
        }

        children = certificateChild || [];
      } else {
        children = [];
      }
    }

    if (!children || children.length === 0) {
      const { data: fuzzyChildren, error: fuzzyError } = await db
        .from('children')
        .select(childSelect)
        .eq('primary_facility_id', branchId)
        .eq('is_active', true)
        .or(`cvcc_id.ilike.%${trimmedQuery}%,full_name.ilike.%${trimmedQuery}%`)
        .limit(20);

      if (fuzzyError) {
        throw new InternalServerErrorException(
          `Failed to search child records: ${fuzzyError.message}`,
        );
      }

      children = fuzzyChildren || [];
    }

    const { data: byPhone, error: phoneError } = await db
      .from('guardians')
      .select(`
        id,
        full_name,
        phone_primary,
        child_guardian!inner (
          child_id,
          is_primary,
          children (
            id,
            cvcc_id,
            full_name,
            date_of_birth,
            gender,
            primary_facility_id,
            is_active,
            branches:primary_facility_id (
              id,
              name
            )
          )
        )
      `)
      .ilike('phone_primary', `%${trimmedQuery}%`)
      .limit(20);

    if (phoneError) {
      throw new InternalServerErrorException(
        `Failed to search child records: ${phoneError.message}`,
      );
    }

    const allChildren: any[] = [];

    if (children) {
      children.forEach((child: any) => {
        const primaryGuardianLink = Array.isArray(child.child_guardian)
          ? child.child_guardian.find((cg: any) => cg.is_primary) ||
            child.child_guardian[0]
          : child.child_guardian;

        const guardianJoin = primaryGuardianLink?.guardians as any;
        const guardianData = Array.isArray(guardianJoin)
          ? guardianJoin[0]
          : guardianJoin;

        allChildren.push({
          ...child,
          guardian: guardianData
            ? {
                id: guardianData.id,
                full_name: guardianData.full_name,
                phone_primary: guardianData.phone_primary,
              }
            : null,
        });
      });
    }

    if (byPhone) {
      byPhone.forEach((guardian: any) => {
        const childGuardianLinks = Array.isArray(guardian.child_guardian)
          ? guardian.child_guardian
          : [guardian.child_guardian];

        childGuardianLinks.forEach((link: any) => {
          const linkedChild = Array.isArray(link?.children)
            ? link.children[0]
            : link?.children;

          if (!linkedChild) return;
          if (linkedChild.primary_facility_id !== branchId) return;
          if (linkedChild.is_active === false) return;

          allChildren.push({
            ...linkedChild,
            guardian: {
              id: guardian.id,
              full_name: guardian.full_name,
              phone_primary: guardian.phone_primary,
            },
          });
        });
      });
    }

    const uniqueChildren = Array.from(
      new Map(allChildren.map((child: any) => [child.id, child])).values(),
    ).slice(0, 20);

    if (uniqueChildren.length === 0) {
      return [];
    }

    const childIds = uniqueChildren.map((child: any) => child.id);
    const { data: completedEvents, error: completedEventsError } = await db
      .from('vaccination_events')
      .select('child_id, administered_date')
      .in('child_id', childIds)
      .eq('status', 'completed');

    if (completedEventsError) {
      throw new InternalServerErrorException(
        `Failed to load child vaccination summaries: ${completedEventsError.message}`,
      );
    }

    const vaccinationSummaryMap = new Map<
      string,
      { completedCount: number; lastVisit: string | null }
    >();

    (completedEvents ?? []).forEach((event: any) => {
      const existing = vaccinationSummaryMap.get(event.child_id) ?? {
        completedCount: 0,
        lastVisit: null,
      };

      const nextCount = existing.completedCount + 1;
      const nextLastVisit =
        !existing.lastVisit || event.administered_date > existing.lastVisit
          ? event.administered_date
          : existing.lastVisit;

      vaccinationSummaryMap.set(event.child_id, {
        completedCount: nextCount,
        lastVisit: nextLastVisit,
      });
    });

    return Promise.all(
      uniqueChildren.map(async (child: any) => {
        let upcoming: any[] = [];
        try {
          upcoming =
            (await this.databaseService.getUpcomingVaccinations(
              child.id,
              child.date_of_birth,
            )) || [];
        } catch {
          upcoming = [];
        }

        const sortedUpcoming = [...upcoming].sort((a: any, b: any) =>
          String(a?.dueDate ?? '').localeCompare(String(b?.dueDate ?? '')),
        );

        const upcomingCount = sortedUpcoming.filter((item: any) => !item.isOverdue).length;
        const overdueCount = sortedUpcoming.filter((item: any) => item.isOverdue).length;

        let vaccinationStatus: 'Complete' | 'In Progress' | 'Overdue' =
          'In Progress';
        if (overdueCount > 0) {
          vaccinationStatus = 'Overdue';
        } else if (sortedUpcoming.length === 0) {
          vaccinationStatus = 'Complete';
        }

        const nextDue = sortedUpcoming[0];
        const branchData = Array.isArray(child.branches)
          ? child.branches[0]
          : child.branches;
        const vaccinationSummary = vaccinationSummaryMap.get(child.id) ?? {
          completedCount: 0,
          lastVisit: null,
        };

        return {
          id: child.id,
          childId: child.cvcc_id,
          childName: child.full_name,
          dateOfBirth: child.date_of_birth,
          age: this.calculateAgeLabel(child.date_of_birth),
          gender: child.gender || 'Unknown',
          guardianName: child.guardian?.full_name || 'Unknown',
          guardianPhone: child.guardian?.phone_primary || 'N/A',
          facilityName: branchData?.name || 'Unknown facility',
          vaccinationStatus,
          completedVaccines: vaccinationSummary.completedCount,
          upcomingVaccines: upcomingCount,
          overdueVaccines: overdueCount,
          nextVaccine: nextDue?.vaccine?.name || null,
          nextDueDate: nextDue?.dueDate || null,
          lastVisit: vaccinationSummary.lastVisit,
        };
      }),
    );
  }

  /**
   * Return action-first child management queues for branch managers.
   */
  async getChildManagementQueues(branchId: string): Promise<{
    overdue: BranchChildQueueItem[];
    zeroDose: BranchChildQueueItem[];
    missed: BranchChildQueueItem[];
    failedReminders: BranchChildQueueItem[];
  }> {
    const db = this.databaseService.supabase;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const childSelect = `
      id,
      cvcc_id,
      full_name,
      date_of_birth,
      child_guardian!inner (
        is_primary,
        guardians (
          id,
          full_name,
          phone_primary
        )
      )
    `;

    const [childrenResult, schedulesResult, missedResult] =
      await Promise.all([
        db
          .from('children')
          .select(childSelect)
          .eq('primary_facility_id', branchId)
          .eq('is_active', true),
        db
          .from('vaccination_schedules')
          .select('vaccine_id, dose_number, due_days_from_birth, vaccines(name)')
          .eq('is_mandatory', true)
          .order('due_days_from_birth', { ascending: true }),
        db
          .from('appointments')
          .select(`
            id,
            child_id,
            scheduled_date,
            scheduled_time,
            vaccines(name),
            children (
              id,
              cvcc_id,
              full_name,
              child_guardian!inner (
                is_primary,
                guardians (
                  id,
                  full_name,
                  phone_primary
                )
              )
            )
          `)
          .eq('facility_id', branchId)
          .eq('status', 'missed')
          .gte('scheduled_date', thirtyDaysAgoStr)
          .lte('scheduled_date', todayStr)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false })
          .limit(200),
      ]);

    if (childrenResult.error) {
      throw new InternalServerErrorException(
        `Failed to load branch children: ${childrenResult.error.message}`,
      );
    }

    if (schedulesResult.error) {
      throw new InternalServerErrorException(
        `Failed to load vaccination schedules: ${schedulesResult.error.message}`,
      );
    }

    if (missedResult.error) {
      throw new InternalServerErrorException(
        `Failed to load missed appointments: ${missedResult.error.message}`,
      );
    }

    const children = childrenResult.data ?? [];
    const childMap = new Map<
      string,
      {
        childId: string;
        childCvccId: string;
        childName: string;
        guardianId: string | null;
        guardianName: string;
        guardianPhone: string;
        dateOfBirth: string | null;
      }
    >();

    children.forEach((child: any) => {
      const guardianLink = Array.isArray(child.child_guardian)
        ? child.child_guardian.find((entry: any) => entry.is_primary) ||
          child.child_guardian[0]
        : child.child_guardian;

      const guardianJoin = guardianLink?.guardians as any;
      const guardian = Array.isArray(guardianJoin)
        ? guardianJoin[0]
        : guardianJoin;

      childMap.set(child.id, {
        childId: child.id,
        childCvccId: child.cvcc_id || 'N/A',
        childName: child.full_name || 'Unknown',
        guardianId: guardian?.id || null,
        guardianName: guardian?.full_name || 'Unknown',
        guardianPhone: guardian?.phone_primary || 'N/A',
        dateOfBirth: child.date_of_birth || null,
      });
    });

    const childIds = Array.from(childMap.keys());
    if (childIds.length === 0) {
      return {
        overdue: [],
        zeroDose: [],
        missed: [],
        failedReminders: [],
      };
    }

    const guardianToChildIds = new Map<string, string[]>();
    childMap.forEach((child) => {
      if (!child.guardianId) return;
      const existing = guardianToChildIds.get(child.guardianId) || [];
      existing.push(child.childId);
      guardianToChildIds.set(child.guardianId, existing);
    });

    const guardianIds = Array.from(guardianToChildIds.keys());

    const [completedResult, notificationResult, followUpAuditResult] = await Promise.all([
      db
        .from('vaccination_events')
        .select('child_id, vaccine_id, dose_number, administered_date')
        .in('child_id', childIds)
        .eq('status', 'completed'),
      guardianIds.length > 0
        ? db
            .from('notifications')
            .select('id, recipient_id, metadata, status, error_message, recipient_contact, channel, created_at')
            .eq('recipient_type', 'guardian')
            .in('recipient_id', guardianIds)
            .in('status', ['failed', 'bounced'])
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      db
        .from('audit_logs')
        .select('entity_id, created_at, after_data')
        .eq('category', 'branch-follow-up')
        .eq('entity_type', 'child')
        .in('entity_id', childIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (completedResult.error) {
      throw new InternalServerErrorException(
        `Failed to load vaccination events: ${completedResult.error.message}`,
      );
    }

    if (notificationResult.error) {
      throw new InternalServerErrorException(
        `Failed to load failed reminders: ${notificationResult.error.message}`,
      );
    }

    if (followUpAuditResult.error) {
      throw new InternalServerErrorException(
        `Failed to load follow-up assignments: ${followUpAuditResult.error.message}`,
      );
    }

    const completedEvents = completedResult.data ?? [];
    const latestAssignmentByQueueKey = new Map<
      string,
      { assignedToUserId: string | null; assignedToName: string | null; assignedAt: string | null }
    >();

    (followUpAuditResult.data ?? []).forEach((audit: any) => {
      const childId = typeof audit.entity_id === 'string' ? audit.entity_id : null;
      if (!childId) return;

      const afterData =
        audit.after_data && typeof audit.after_data === 'object'
          ? (audit.after_data as Record<string, unknown>)
          : {};

      if (afterData.action !== 'assign_follow_up') return;

      const queueTypeRaw = afterData.queue_type;
      if (
        queueTypeRaw !== 'overdue' &&
        queueTypeRaw !== 'zero-dose' &&
        queueTypeRaw !== 'missed' &&
        queueTypeRaw !== 'failed-reminder'
      ) {
        return;
      }

      const key = `${childId}:${queueTypeRaw}`;
      if (latestAssignmentByQueueKey.has(key)) return;

      latestAssignmentByQueueKey.set(key, {
        assignedToUserId:
          typeof afterData.assigned_to_user_id === 'string'
            ? afterData.assigned_to_user_id
            : null,
        assignedToName:
          typeof afterData.assigned_to_name === 'string'
            ? afterData.assigned_to_name
            : null,
        assignedAt:
          typeof afterData.assigned_at === 'string'
            ? afterData.assigned_at
            : typeof audit.created_at === 'string'
              ? audit.created_at
              : null,
      });
    });

    const attachAssignment = (item: BranchChildQueueItem): BranchChildQueueItem => {
      const assignment = latestAssignmentByQueueKey.get(
        `${item.childId}:${item.queueType}`,
      );

      if (!assignment) {
        return item;
      }

      return {
        ...item,
        assignedToUserId: assignment.assignedToUserId,
        assignedToName: assignment.assignedToName,
        assignedAt: assignment.assignedAt,
      };
    };

    const schedules = schedulesResult.data ?? [];
    const receivedExact = new Set<string>();
    const receivedVaccine = new Set<string>();
    const completedCountByChild = new Map<string, number>();

    completedEvents.forEach((event: any) => {
      if (!event.child_id || !event.vaccine_id) return;

      completedCountByChild.set(
        event.child_id,
        (completedCountByChild.get(event.child_id) ?? 0) + 1,
      );

      if (event.dose_number != null) {
        receivedExact.add(
          `${event.child_id}:${event.vaccine_id}:${event.dose_number}`,
        );
      } else {
        receivedVaccine.add(`${event.child_id}:${event.vaccine_id}`);
      }
    });

    const overdue: BranchChildQueueItem[] = [];
    const zeroDose: BranchChildQueueItem[] = [];
    const GRACE_DAYS = 14;

    childMap.forEach((child) => {
      const completedCount = completedCountByChild.get(child.childId) ?? 0;

      if (completedCount === 0) {
        const birthDate = child.dateOfBirth ? new Date(child.dateOfBirth) : null;
        const ageDays = birthDate
          ? Math.max(
              0,
              Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)),
            )
          : 0;

        zeroDose.push(attachAssignment({
          id: `zero-dose-${child.childId}`,
          queueType: 'zero-dose',
          childId: child.childId,
          childCvccId: child.childCvccId,
          childName: child.childName,
          guardianName: child.guardianName,
          guardianPhone: child.guardianPhone,
          reason: 'No completed vaccinations recorded yet.',
          priority: ageDays > 180 ? 'high' : 'medium',
          referenceDate: child.dateOfBirth,
          daysOpen: ageDays,
        }));
      }

      if (!child.dateOfBirth) return;

      const dob = new Date(child.dateOfBirth);
      const ageInDays = Math.floor(
        (today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24),
      );

      const mostOverdue = schedules.reduce<
        { schedule: any; daysOverdue: number; dueDate: Date } | null
      >((current, schedule: any) => {
        if (ageInDays <= schedule.due_days_from_birth + GRACE_DAYS) {
          return current;
        }

        const exactKey = `${child.childId}:${schedule.vaccine_id}:${schedule.dose_number}`;
        const looseKey = `${child.childId}:${schedule.vaccine_id}`;

        if (receivedExact.has(exactKey) || receivedVaccine.has(looseKey)) {
          return current;
        }

        const daysOverdue = ageInDays - schedule.due_days_from_birth;
        const dueDate = new Date(
          dob.getTime() + schedule.due_days_from_birth * 24 * 60 * 60 * 1000,
        );

        if (!current || daysOverdue > current.daysOverdue) {
          return {
            schedule,
            daysOverdue,
            dueDate,
          };
        }

        return current;
      }, null);

      if (!mostOverdue) return;

      overdue.push(attachAssignment({
        id: `overdue-${child.childId}-${mostOverdue.schedule.vaccine_id}-${mostOverdue.schedule.dose_number}`,
        queueType: 'overdue',
        childId: child.childId,
        childCvccId: child.childCvccId,
        childName: child.childName,
        guardianName: child.guardianName,
        guardianPhone: child.guardianPhone,
        reason: `Overdue vaccination: ${(mostOverdue.schedule.vaccines as any)?.name ?? 'Vaccine'} (Dose ${mostOverdue.schedule.dose_number})`,
        priority:
          mostOverdue.daysOverdue > 30
            ? 'critical'
            : mostOverdue.daysOverdue > 14
              ? 'high'
              : 'medium',
        referenceDate: mostOverdue.dueDate.toISOString().split('T')[0],
        daysOpen: mostOverdue.daysOverdue,
      }));
    });

    const missedLatestByChild = new Map<string, BranchChildQueueItem>();
    (missedResult.data ?? []).forEach((appointment: any) => {
      const child = Array.isArray(appointment.children)
        ? appointment.children[0]
        : appointment.children;

      const childId = child?.id || appointment.child_id;
      if (!childId) return;

      const baseChild = childMap.get(childId);
      if (!baseChild) return;

      const scheduledDate = appointment.scheduled_date || null;
      const scheduledDateObj = scheduledDate
        ? new Date(`${scheduledDate}T00:00:00`)
        : null;
      const daysSinceMissed = scheduledDateObj
        ? Math.max(
            0,
            Math.floor((today.getTime() - scheduledDateObj.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;

      const candidate = attachAssignment({
        id: `missed-${appointment.id}`,
        queueType: 'missed',
        childId: baseChild.childId,
        childCvccId: baseChild.childCvccId,
        childName: baseChild.childName,
        guardianName: baseChild.guardianName,
        guardianPhone: baseChild.guardianPhone,
        reason: `Missed appointment: ${appointment.vaccines?.name ?? 'Scheduled visit'}${appointment.scheduled_time ? ` at ${String(appointment.scheduled_time).slice(0, 5)}` : ''}`,
        priority: daysSinceMissed > 14 ? 'high' : 'medium',
        referenceDate: scheduledDate,
        daysOpen: daysSinceMissed,
      });

      const existing = missedLatestByChild.get(baseChild.childId);
      if (!existing) {
        missedLatestByChild.set(baseChild.childId, candidate);
        return;
      }

      const existingDate = existing.referenceDate ?? '';
      const candidateDate = candidate.referenceDate ?? '';
      if (candidateDate > existingDate) {
        missedLatestByChild.set(baseChild.childId, candidate);
      }
    });

    const failedReminderLatestByChild = new Map<string, BranchChildQueueItem>();
    (notificationResult.data ?? []).forEach((notification: any) => {
      const metadata =
        notification.metadata && typeof notification.metadata === 'object'
          ? (notification.metadata as Record<string, unknown>)
          : {};

      const childIdFromMetadata =
        typeof metadata.child_id === 'string'
          ? metadata.child_id
          : typeof metadata.childId === 'string'
            ? metadata.childId
            : null;

      let childId = childIdFromMetadata;
      if (!childId && typeof notification.recipient_id === 'string') {
        const linkedChildren = guardianToChildIds.get(notification.recipient_id);
        if (linkedChildren?.length === 1) {
          childId = linkedChildren[0];
        }
      }

      if (!childId || !childMap.has(childId)) return;

      const baseChild = childMap.get(childId)!;
      const reason =
        notification.error_message ||
        `${String(notification.channel || 'Notification').toUpperCase()} delivery failed`;

      const candidate = attachAssignment({
        id: `failed-reminder-${notification.id}`,
        queueType: 'failed-reminder',
        childId: baseChild.childId,
        childCvccId: baseChild.childCvccId,
        childName: baseChild.childName,
        guardianName: baseChild.guardianName,
        guardianPhone:
          baseChild.guardianPhone !== 'N/A'
            ? baseChild.guardianPhone
            : notification.recipient_contact || 'N/A',
        reason,
        priority: 'high',
        referenceDate: notification.created_at
          ? String(notification.created_at).slice(0, 10)
          : null,
        daysOpen: notification.created_at
          ? Math.max(
              0,
              Math.floor(
                (today.getTime() - new Date(notification.created_at).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0,
      });

      const existing = failedReminderLatestByChild.get(childId);
      if (!existing) {
        failedReminderLatestByChild.set(childId, candidate);
        return;
      }

      const existingDate = existing.referenceDate ?? '';
      const candidateDate = candidate.referenceDate ?? '';
      if (candidateDate > existingDate) {
        failedReminderLatestByChild.set(childId, candidate);
      }
    });

    overdue.sort((a, b) => b.daysOpen - a.daysOpen);
    zeroDose.sort((a, b) => b.daysOpen - a.daysOpen);

    const missed = Array.from(missedLatestByChild.values()).sort(
      (a, b) => b.daysOpen - a.daysOpen,
    );
    const failedReminders = Array.from(failedReminderLatestByChild.values()).sort(
      (a, b) => b.daysOpen - a.daysOpen,
    );

    return {
      overdue: overdue.slice(0, 50),
      zeroDose: zeroDose.slice(0, 50),
      missed: missed.slice(0, 50),
      failedReminders: failedReminders.slice(0, 50),
    };
  }

  async assignChildFollowUp(
    branchId: string,
    actorUserId: string,
    dto: {
      childId: string;
      assigneeUserId: string;
      queueType: BranchChildQueueType;
      reason?: string;
      notes?: string;
    },
  ) {
    const db = this.databaseService.supabase;

    const [childResult, assigneeResult] = await Promise.all([
      db
        .from('children')
        .select('id, full_name, primary_facility_id, is_active')
        .eq('id', dto.childId)
        .maybeSingle(),
      db
        .from('users')
        .select('id, full_name, email, role, branch_id, status')
        .eq('id', dto.assigneeUserId)
        .maybeSingle(),
    ]);

    if (childResult.error) {
      throw new InternalServerErrorException(
        `Failed to validate child record: ${childResult.error.message}`,
      );
    }

    if (!childResult.data) {
      throw new NotFoundException('Child record not found.');
    }

    if (
      childResult.data.primary_facility_id !== branchId ||
      childResult.data.is_active === false
    ) {
      throw new ForbiddenException('You can only assign follow-up within your branch.');
    }

    if (assigneeResult.error) {
      throw new InternalServerErrorException(
        `Failed to validate assignee: ${assigneeResult.error.message}`,
      );
    }

    if (!assigneeResult.data) {
      throw new NotFoundException('Assigned staff member not found.');
    }

    const assignee = assigneeResult.data;
    const isEligibleRole =
      assignee.role === 'facility-nurse' || assignee.role === 'chw';

    if (!isEligibleRole || assignee.branch_id !== branchId || assignee.status !== 'active') {
      throw new BadRequestException(
        'Follow-up can only be assigned to an active nurse or CHW in this branch.',
      );
    }

    const assignedAt = new Date().toISOString();

    const { error: auditError } = await db.from('audit_logs').insert({
      user_id: actorUserId,
      action: 'update',
      entity_type: 'child',
      entity_id: dto.childId,
      after_data: {
        action: 'assign_follow_up',
        queue_type: dto.queueType,
        reason: dto.reason || null,
        notes: dto.notes || null,
        assigned_to_user_id: assignee.id,
        assigned_to_name: assignee.full_name,
        assigned_to_role: assignee.role,
        assigned_at: assignedAt,
      },
      category: 'branch-follow-up',
    });

    if (auditError) {
      throw new InternalServerErrorException(
        `Failed to assign follow-up task: ${auditError.message}`,
      );
    }

    const queueLabel = dto.queueType.replace('-', ' ');
    const notificationMessage =
      `You have been assigned a child follow-up. Child: ${childResult.data.full_name}. ` +
      `Queue: ${queueLabel}. Please review and action it from your dashboard.`;

    const { error: notificationError } = await db.from('notifications').insert({
      template_id: 'branch_follow_up_assignment',
      recipient_type: 'staff',
      recipient_id: assignee.id,
      channel: 'push',
      recipient_contact: assignee.email,
      subject: 'New follow-up assignment',
      message: notificationMessage,
      status: 'sent',
      metadata: {
        child_id: dto.childId,
        queue_type: dto.queueType,
        assigned_by_user_id: actorUserId,
        branch_id: branchId,
        reason: dto.reason || null,
        notes: dto.notes || null,
        assigned_at: assignedAt,
      },
      sent_at: assignedAt,
    });

    let responseMessage = `Follow-up assigned to ${assignee.full_name}.`;
    if (notificationError) {
      this.logger.error(
        `Follow-up assigned but assignee notification failed: ${notificationError.message}`,
      );
      responseMessage =
        `Follow-up assigned to ${assignee.full_name}. Dashboard notification could not be queued.`;
    }

    return {
      success: true,
      message: responseMessage,
      assignment: {
        childId: dto.childId,
        childName: childResult.data.full_name,
        assigneeUserId: assignee.id,
        assigneeName: assignee.full_name,
        assigneeRole: assignee.role,
        queueType: dto.queueType,
      },
    };
  }

  /**
   * Logs a new vaccine shipment into stock_inventory.
   * quantity_used is initialised to 0; quantity_remaining equals quantity_received.
   */
  async logStockDelivery(
    branchId: string,
    userId: string,
    dto: {
      vaccineId: string;
      batchNumber: string;
      lotNumber?: string;
      manufacturer?: string;
      expiryDate: string;
      quantityReceived: number;
      receivedDate: string;
    },
  ) {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('stock_inventory')
      .insert({
        vaccine_id: dto.vaccineId,
        facility_id: branchId,
        batch_number: dto.batchNumber,
        lot_number: dto.lotNumber ?? null,
        manufacturer: dto.manufacturer ?? null,
        expiry_date: dto.expiryDate,
        quantity_received: dto.quantityReceived,
        quantity_used: 0,
        quantity_remaining: dto.quantityReceived,
        received_date: dto.receivedDate,
        received_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to log stock delivery', error);
      throw new Error(`Failed to log delivery: ${error.message}`);
    }
    return data;
  }

  async resetExpiringStock(
    branchId: string,
    dto: {
      vaccineId: string;
      expiryWindowDays?: number;
    },
  ) {
    const db = this.databaseService.supabase;
    const expiryWindowDays = dto.expiryWindowDays ?? 90;
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + expiryWindowDays);
    const cutoffDate = cutoff.toISOString().split('T')[0];

    const { data: matchingRows, error: matchingError } = await db
      .from('stock_inventory')
      .select('id, quantity_remaining, quantity_used, quantity_received')
      .eq('facility_id', branchId)
      .eq('vaccine_id', dto.vaccineId)
      .lte('expiry_date', cutoffDate)
      .gt('quantity_remaining', 0);

    if (matchingError) {
      this.logger.error('Failed to fetch expiring stock rows for reset', matchingError);
      throw new Error(`Failed to reset stock: ${matchingError.message}`);
    }

    if (!matchingRows || matchingRows.length === 0) {
      return {
        resetRows: 0,
        resetDoses: 0,
        message: 'No expiring stock rows were eligible for reset.',
      };
    }

    const rowIds = matchingRows.map((r: any) => r.id);
    const resetDoses = matchingRows.reduce(
      (sum: number, row: any) => sum + (row.quantity_remaining ?? 0),
      0,
    );

    for (const row of matchingRows) {
      const { error } = await db
        .from('stock_inventory')
        .update({
          quantity_used: (row.quantity_used ?? 0) + (row.quantity_remaining ?? 0),
          quantity_remaining: 0,
        })
        .eq('id', row.id);

      if (error) {
        this.logger.error('Failed to reset expiring stock row', error);
        throw new Error(`Failed to reset stock: ${error.message}`);
      }
    }

    return {
      resetRows: rowIds.length,
      resetDoses,
      message: `Reset ${resetDoses} expiring dose(s) across ${rowIds.length} stock batch(es).`,
    };
  }

  async getHqBranches() {
    const db = this.databaseService.supabase;

    const { data: branches, error: branchError } = await db
      .from('branches')
      .select('id, name, code, region, status, metadata')
      .order('code', { ascending: true });

    if (branchError) {
      throw new InternalServerErrorException({
        message: `Failed to load branches: ${branchError.message}`,
        code: 'HQ_BRANCHES_FETCH_FAILED',
      });
    }

    const branchIds = (branches ?? []).map((branch: any) => branch.id);
    const { data: catchments, error: catchmentError } = branchIds.length
      ? await db
          .from('catchment_areas')
          .select('branch_id, name')
          .in('branch_id', branchIds)
      : { data: [], error: null as any };

    if (catchmentError) {
      throw new InternalServerErrorException({
        message: `Failed to load catchment areas: ${catchmentError.message}`,
        code: 'HQ_BRANCHES_CATCHMENT_FETCH_FAILED',
      });
    }

    const catchmentMap = new Map<string, string[]>();
    (catchments ?? []).forEach((catchment: any) => {
      const existing = catchmentMap.get(catchment.branch_id) ?? [];
      existing.push(catchment.name);
      catchmentMap.set(catchment.branch_id, existing);
    });

    return (branches ?? []).map((branch: any) => {
      const metadata = (branch.metadata ?? {}) as {
        managerName?: string;
        assignedChwNames?: string[];
      };

      return {
        id: branch.code,
        dbId: branch.id,
        name: branch.name,
        region: branch.region,
        manager: metadata.managerName ?? 'Unassigned',
        status: branch.status,
        catchmentAreas: catchmentMap.get(branch.id) ?? [],
        assignedChws: metadata.assignedChwNames ?? [],
      };
    });
  }

  async getHqAnalytics(filters: { region?: string; branch?: string; window?: string }) {
    const db = this.databaseService.supabase;
    const regionFilter = (filters.region ?? '').trim();
    const branchFilter = (filters.branch ?? '').trim();
    const windowFilter = (filters.window ?? '').trim();
    const windowMonths = this.resolveAnalyticsWindowMonths(windowFilter);

    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - (windowMonths - 1), 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    let branchQuery = db
      .from('branches')
      .select('id, name, code, region');

    if (regionFilter && regionFilter !== 'All regions') {
      branchQuery = branchQuery.eq('region', regionFilter);
    }

    const { data: branchRows, error: branchError } = await branchQuery;

    if (branchError) {
      throw new InternalServerErrorException({
        message: `Failed to load analytics branches: ${branchError.message}`,
        code: 'HQ_ANALYTICS_BRANCH_FETCH_FAILED',
      });
    }

    const filteredBranches = (branchRows ?? []).filter((branch: any) => {
      if (!branchFilter || branchFilter === 'All branches') return true;
      const normalizedFilter = branchFilter.toLowerCase();
      return (
        String(branch.name ?? '').toLowerCase() === normalizedFilter
        || String(branch.code ?? '').toLowerCase() === normalizedFilter
      );
    });

    const branchIds = filteredBranches.map((branch: any) => branch.id);
    const trendSkeleton = this.buildMonthlyTrendSkeleton(startDate, windowMonths);

    if (!branchIds.length) {
      return {
        filters: {
          region: regionFilter || 'All regions',
          branch: branchFilter || 'All branches',
          window: windowFilter || `Last ${windowMonths} months`,
        },
        trend: trendSkeleton,
      };
    }

    const { data: vaccineRows, error: vaccineError } = await db
      .from('vaccines')
      .select('id, name, code');

    if (vaccineError) {
      throw new InternalServerErrorException({
        message: `Failed to load vaccines for analytics: ${vaccineError.message}`,
        code: 'HQ_ANALYTICS_VACCINE_FETCH_FAILED',
      });
    }

    const measlesVaccineIds = (vaccineRows ?? [])
      .filter((vaccine: any) => {
        const name = String(vaccine.name ?? '').toLowerCase();
        const code = String(vaccine.code ?? '').toLowerCase();
        return name.includes('measles') || code.includes('measles') || code.includes('mmr');
      })
      .map((vaccine: any) => vaccine.id);

    const dpt3VaccineIds = (vaccineRows ?? [])
      .filter((vaccine: any) => {
        const name = String(vaccine.name ?? '').toLowerCase();
        const code = String(vaccine.code ?? '').toLowerCase();
        return (
          name.includes('dpt')
          || code.includes('dpt')
          || name.includes('penta')
          || code.includes('penta')
        );
      })
      .map((vaccine: any) => vaccine.id);

    const [measlesEventsResult, dpt3EventsResult] = await Promise.all([
      measlesVaccineIds.length
        ? db
            .from('vaccination_events')
            .select('administered_date')
            .in('facility_id', branchIds)
            .in('vaccine_id', measlesVaccineIds)
            .eq('status', 'completed')
            .gte('administered_date', startDateStr)
        : Promise.resolve({ data: [], error: null as any }),
      dpt3VaccineIds.length
        ? db
            .from('vaccination_events')
            .select('administered_date')
            .in('facility_id', branchIds)
            .in('vaccine_id', dpt3VaccineIds)
            .eq('status', 'completed')
            .gte('administered_date', startDateStr)
        : Promise.resolve({ data: [], error: null as any }),
    ]);

    if (measlesEventsResult.error) {
      throw new InternalServerErrorException({
        message: `Failed to load measles analytics: ${measlesEventsResult.error.message}`,
        code: 'HQ_ANALYTICS_MEASLES_FETCH_FAILED',
      });
    }

    if (dpt3EventsResult.error) {
      throw new InternalServerErrorException({
        message: `Failed to load DPT analytics: ${dpt3EventsResult.error.message}`,
        code: 'HQ_ANALYTICS_DPT_FETCH_FAILED',
      });
    }

    const measlesByMonth = new Map<string, number>();
    (measlesEventsResult.data ?? []).forEach((event: any) => {
      if (!event.administered_date) return;
      const monthKey = String(event.administered_date).slice(0, 7);
      measlesByMonth.set(monthKey, (measlesByMonth.get(monthKey) ?? 0) + 1);
    });

    const dptByMonth = new Map<string, number>();
    (dpt3EventsResult.data ?? []).forEach((event: any) => {
      if (!event.administered_date) return;
      const monthKey = String(event.administered_date).slice(0, 7);
      dptByMonth.set(monthKey, (dptByMonth.get(monthKey) ?? 0) + 1);
    });

    const trend = trendSkeleton.map((row) => ({
      period: row.period,
      measles: measlesByMonth.get(row.monthKey) ?? 0,
      dpt3: dptByMonth.get(row.monthKey) ?? 0,
    }));

    return {
      filters: {
        region: regionFilter || 'All regions',
        branch: branchFilter || 'All branches',
        window: windowFilter || `Last ${windowMonths} months`,
      },
      trend,
    };
  }

  async getHqOverviewStats() {
    const db = this.databaseService.supabase;

    // Get total active branches
    const { count: branchCount, error: branchError } = await db
      .from('branches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (branchError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch branch count: ${branchError.message}`,
        code: 'HQ_OVERVIEW_BRANCH_COUNT_FAILED',
      });
    }

    // Get total active users (excluding parents)
    const { count: userCount, error: userError } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .neq('role', 'parent');

    if (userError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch user count: ${userError.message}`,
        code: 'HQ_OVERVIEW_USER_COUNT_FAILED',
      });
    }

    // Get total children registered
    const { count: childrenCount, error: childrenError } = await db
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (childrenError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch children count: ${childrenError.message}`,
        code: 'HQ_OVERVIEW_CHILDREN_COUNT_FAILED',
      });
    }

    // Get CHWs active in last 24 hours (based on last_login_at)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeChwCount, error: chwError } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'chw')
      .eq('status', 'active')
      .gte('last_login_at', twentyFourHoursAgo);

    if (chwError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch active CHW count: ${chwError.message}`,
        code: 'HQ_OVERVIEW_CHW_COUNT_FAILED',
      });
    }

    // Get total CHWs for percentage calculation
    const { count: totalChwCount, error: totalChwError } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'chw')
      .eq('status', 'active');

    if (totalChwError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch total CHW count: ${totalChwError.message}`,
        code: 'HQ_OVERVIEW_TOTAL_CHW_COUNT_FAILED',
      });
    }

    const chwSyncPercentage = totalChwCount && totalChwCount > 0
      ? Math.round(((activeChwCount ?? 0) / totalChwCount) * 100)
      : 0;

    // Calculate national vaccination coverage rate
    // Coverage = children with completed vaccination schedule / total children registered
    let nationalCoverageRate = 0;

    if (childrenCount && childrenCount > 0) {
      // Count children with completed vaccinations using existing tables
      const { data: childrenWithVaccines } = await db
        .from('children')
        .select('id')
        .eq('is_active', true);

      if (childrenWithVaccines && childrenWithVaccines.length > 0) {
        const childIds = childrenWithVaccines.map((c: any) => c.id);

        // Count children with at least 3 vaccinations (BCG, OPV/IPV, DPT/Penta)
        const { data: vaccinationCounts } = await db
          .from('vaccination_events')
          .select('child_id')
          .in('child_id', childIds)
          .eq('status', 'completed');

        const uniqueChildrenWithVaccines = new Set(
          (vaccinationCounts ?? []).map((v: any) => v.child_id)
        ).size;

        nationalCoverageRate = Math.round(
          ((uniqueChildrenWithVaccines ?? 0) / childrenCount) * 100
        );
      }
    }

    return {
      totalBranches: branchCount ?? 0,
      totalUsers: userCount ?? 0,
      childrenRegistered: childrenCount ?? 0,
      chwsActiveToday: activeChwCount ?? 0,
      totalChws: totalChwCount ?? 0,
      chwSyncPercentage,
      nationalCoverageRate,
    };
  }

  async getHqAefiReports(params: { limit?: number; priority?: string }) {
    const db = this.databaseService.supabase;
    const limit = params.limit || 10;

    let query = db
      .from('aefi_reports')
      .select(`
        id,
        child_id,
        vaccination_event_id,
        severity,
        onset_date,
        reported_by_user_id,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by priority/severity if specified
    if (params.priority && params.priority !== 'all') {
      query = query.eq('severity', params.priority);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException({
        message: `Failed to fetch AEFI reports: ${error.message}`,
        code: 'HQ_AEFI_FETCH_FAILED',
      });
    }

    // Fetch related data separately if available
    const childIds = (data ?? [])
      .map((report: any) => report.child_id)
      .filter((id: any) => id);
    const vaccEventIds = (data ?? [])
      .map((report: any) => report.vaccination_event_id)
      .filter((id: any) => id);

    let childMap: Record<string, any> = {};
    let vaccineMap: Record<string, any> = {};

    if (childIds.length > 0) {
      const { data: children } = await db
        .from('children')
        .select('id, name')
        .in('id', [...new Set(childIds)]);
      childMap = Object.fromEntries(
        (children ?? []).map((c: any) => [c.id, c])
      );
    }

    // Fetch vaccination events to get vaccine_id
    let vaccEventMap: Record<string, any> = {};
    if (vaccEventIds.length > 0) {
      const { data: vaccEvents } = await db
        .from('vaccination_events')
        .select('id, vaccine_id')
        .in('id', [...new Set(vaccEventIds)]);
      
      vaccEventMap = Object.fromEntries(
        (vaccEvents ?? []).map((ve: any) => [ve.id, ve])
      );

      // Get unique vaccine IDs
      const vaccineIds = (vaccEvents ?? [])
        .map((ve: any) => ve.vaccine_id)
        .filter((id: any) => id);

      if (vaccineIds.length > 0) {
        const { data: vaccines } = await db
          .from('vaccines')
          .select('id, name')
          .in('id', [...new Set(vaccineIds)]);
        vaccineMap = Object.fromEntries(
          (vaccines ?? []).map((v: any) => [v.id, v])
        );
      }
    }

    // Transform data for frontend
    return (data ?? []).map((report: any) => {
      const vaccEventData = vaccEventMap[report.vaccination_event_id];
      const vaccineId = vaccEventData?.vaccine_id;

      return {
        id: report.id,
        child: childMap[report.child_id]?.name || 'Unknown',
        vaccine: vaccineMap[vaccineId]?.name || 'Unknown vaccine',
        branch: 'Field Report',
        reportedAt: report.created_at,
        priority: report.severity === 'severe' ? 'High' : report.severity === 'moderate' ? 'Medium' : 'Low',
      };
    });
  }

  async getHqDeviceSyncStatus() {
    const db = this.databaseService.supabase;

    // Get all CHW users and their last sync/login times
    const { data: chwUsers, error: chwError } = await db
      .from('users')
      .select('id, full_name, branch_id, last_login_at, created_at')
      .eq('role', 'chw')
      .eq('status', 'active')
      .order('last_login_at', { ascending: false });

    if (chwError) {
      throw new InternalServerErrorException({
        message: `Failed to fetch CHW device status: ${chwError.message}`,
        code: 'HQ_DEVICE_SYNC_FETCH_FAILED',
      });
    }

    // For each CHW, count pending vaccination forms
    const deviceStatus = await Promise.all(
      (chwUsers ?? []).map(async (chw: any) => {
        // Count pending vaccination_events for this CHW (could track via branch or chw_id if available)
        const { count: pendingForms } = await db
          .from('vaccination_events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('facility_id', chw.branch_id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

        const lastSyncTime = chw.last_login_at ? new Date(chw.last_login_at) : null;
        const nowTime = new Date();
        const diffMs = lastSyncTime ? nowTime.getTime() - lastSyncTime.getTime() : Number.MAX_SAFE_INTEGER;
        let lastSyncText = 'Never';
        
        if (lastSyncTime) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);

          if (diffDays > 0) {
            lastSyncText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          } else if (diffHours > 0) {
            lastSyncText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          } else {
            lastSyncText = 'Just now';
          }
        }

        return {
          id: chw.id,
          name: chw.full_name,
          branch: 'Field',
          lastSync: lastSyncText,
          lastSyncAt: chw.last_login_at,
          pending: pendingForms ?? 0,
          diffMs,
          status: diffMs > 24 * 60 * 60 * 1000 ? 'stale' : 'active', // Mark as stale if not synced in 24 hours
        };
      })
    );

    return deviceStatus
      .sort((a, b) => {
        // Prioritize devices with pending forms and older last sync times
        if (a.status !== b.status) return a.status === 'stale' ? -1 : 1;
        if (a.pending !== b.pending) return b.pending - a.pending;
        return b.diffMs - a.diffMs;
      })
      .map(({ diffMs, ...rest }) => rest) // Remove diffMs from result
      .slice(0, 10); // Return top 10 devices needing attention
  }

  async createHqBranch(dto: CreateHqBranchDto) {
    const db = this.databaseService.supabase;
    const normalizedCatchments = this.normalizeUniqueValues(dto.catchmentAreas);

    if (!normalizedCatchments.length) {
      throw new BadRequestException({
        message: 'At least one catchment area is required',
        code: 'CATCHMENT_REQUIRED',
      });
    }

    // Validate branch name and region
    if (!dto.name?.trim()) {
      throw new BadRequestException({
        message: 'Branch name is required',
        code: 'BRANCH_NAME_REQUIRED',
      });
    }

    if (!dto.region?.trim()) {
      throw new BadRequestException({
        message: 'Region is required',
        code: 'REGION_REQUIRED',
      });
    }

    // Validate manager name if provided
    if (dto.manager !== undefined && dto.manager !== null && !dto.manager.trim()) {
      throw new BadRequestException({
        message: 'Manager name cannot be empty',
        code: 'MANAGER_NAME_INVALID',
      });
    }

    const code = await this.generateNextBranchCode();
    const { data: createdBranch, error: createError } = await db
      .from('branches')
      .insert({
        name: dto.name.trim(),
        code,
        region: dto.region.trim(),
        status: 'active',
        metadata: {
          managerName: dto.manager?.trim() || 'Unassigned',
          assignedChwNames: [],
        },
      })
      .select('id, name, code, region, status, metadata')
      .single();

    if (createError || !createdBranch) {
      throw new BadRequestException({
        message: `Failed to create branch: ${createError?.message ?? 'unknown error'}`,
        code: 'HQ_BRANCH_CREATE_FAILED',
      });
    }

    await this.replaceCatchmentsForBranch(createdBranch.id, createdBranch.code, normalizedCatchments);
    const [fullBranch] = await this.getHqBranches().then((rows) => rows.filter((row) => row.dbId === createdBranch.id));
    return fullBranch;
  }

  async updateHqBranch(code: string, dto: UpdateHqBranchDto) {
    const db = this.databaseService.supabase;
    const normalizedCode = code.trim();
    const normalizedCatchments = this.normalizeUniqueValues(dto.catchmentAreas);

    if (!normalizedCatchments.length) {
      throw new BadRequestException({
        message: 'At least one catchment area is required',
        code: 'CATCHMENT_REQUIRED',
      });
    }

    // Validate branch name and region
    if (!dto.name?.trim()) {
      throw new BadRequestException({
        message: 'Branch name is required',
        code: 'BRANCH_NAME_REQUIRED',
      });
    }

    if (!dto.region?.trim()) {
      throw new BadRequestException({
        message: 'Region is required',
        code: 'REGION_REQUIRED',
      });
    }

    // Validate manager name if provided
    if (dto.manager !== undefined && dto.manager !== null && !dto.manager.trim()) {
      throw new BadRequestException({
        message: 'Manager name cannot be empty',
        code: 'MANAGER_NAME_INVALID',
      });
    }

    const { data: currentBranch, error: currentError } = await db
      .from('branches')
      .select('id, metadata')
      .eq('code', normalizedCode)
      .single();

    if (currentError || !currentBranch) {
      throw new NotFoundException({
        message: `Branch not found: ${normalizedCode}`,
        code: 'BRANCH_NOT_FOUND',
      });
    }

    const currentMetadata = (currentBranch.metadata ?? {}) as {
      assignedChwNames?: string[];
      managerName?: string;
    };

    const { error: updateError } = await db
      .from('branches')
      .update({
        name: dto.name.trim(),
        region: dto.region.trim(),
        metadata: {
          ...currentMetadata,
          managerName: dto.manager?.trim() || 'Unassigned',
          assignedChwNames: currentMetadata.assignedChwNames ?? [],
        },
      })
      .eq('id', currentBranch.id);

    if (updateError) {
      throw new BadRequestException({
        message: `Failed to update branch: ${updateError.message}`,
        code: 'HQ_BRANCH_UPDATE_FAILED',
      });
    }

    await this.replaceCatchmentsForBranch(currentBranch.id, normalizedCode, normalizedCatchments);

    const [fullBranch] = await this.getHqBranches().then((rows) => rows.filter((row) => row.dbId === currentBranch.id));
    return fullBranch;
  }

  async updateHqBranchStatus(code: string, status: 'active' | 'inactive') {
    const db = this.databaseService.supabase;
    const { data: branch, error: branchError } = await db
      .from('branches')
      .update({ status })
      .eq('code', code.trim())
      .select('id')
      .single();
    const branchErrorMessage = (branchError as { message?: string } | null)?.message;

    if (branchError || !branch) {
      if ((branchError as any)?.code === 'PGRST116' || !branch) {
        throw new NotFoundException({
          message: `Branch not found: ${code.trim()}`,
          code: 'BRANCH_NOT_FOUND',
        });
      }

      throw new BadRequestException({
        message: `Failed to update branch status: ${branchErrorMessage ?? 'unknown error'}`,
        code: 'HQ_BRANCH_STATUS_UPDATE_FAILED',
      });
    }

    const [fullBranch] = await this.getHqBranches().then((rows) => rows.filter((row) => row.dbId === branch.id));
    return fullBranch;
  }

  async updateHqBranchChws(code: string, assignedChws: string[]) {
    const db = this.databaseService.supabase;
    const normalizedChws = this.normalizeUniqueValues(assignedChws);

    const { data: branch, error: branchError } = await db
      .from('branches')
      .select('id, code, name, metadata')
      .eq('code', code.trim())
      .single();

    if (branchError || !branch) {
      throw new NotFoundException({
        message: `Branch not found: ${code}`,
        code: 'BRANCH_NOT_FOUND',
      });
    }

    // Check for duplicate CHW assignments across branches
    const { data: allBranches } = await db
      .from('branches')
      .select('id, code, name, metadata');

    const conflicts: Array<{ chwName: string; assignedTo: string }> = [];

    normalizedChws.forEach((chwName) => {
      allBranches?.forEach((otherBranch: any) => {
        // Skip current branch
        if (otherBranch.id === branch.id) return;

        const otherMetadata = (otherBranch.metadata ?? {}) as Record<string, any>;
        const otherChws = (otherMetadata.assignedChwNames ?? []) as string[];

        if (otherChws.includes(chwName)) {
          conflicts.push({
            chwName,
            assignedTo: otherBranch.name,
          });
        }
      });
    });

    if (conflicts.length > 0) {
      const conflictList = conflicts
        .map((c) => `"${c.chwName}" is already assigned to ${c.assignedTo}`)
        .join('; ');

      throw new ConflictException({
        message: `Cannot assign CHW to multiple branches. ${conflictList}. Remove from the other branch first.`,
        code: 'CHW_ALREADY_ASSIGNED',
        conflicts,
      });
    }

    const metadata = (branch.metadata ?? {}) as Record<string, any>;
    const { error: updateError } = await db
      .from('branches')
      .update({
        metadata: {
          ...metadata,
          assignedChwNames: normalizedChws,
          managerName: metadata.managerName ?? 'Unassigned',
        },
      })
      .eq('id', branch.id);

    if (updateError) {
      throw new BadRequestException({
        message: `Failed to update CHW assignment: ${updateError.message}`,
        code: 'HQ_BRANCH_CHW_UPDATE_FAILED',
      });
    }

    const [fullBranch] = await this.getHqBranches().then((rows) => rows.filter((row) => row.dbId === branch.id));
    return fullBranch;
  }

  async cleanupDuplicateChwAssignments() {
    const db = this.databaseService.supabase;
    const { data: allBranches } = await db
      .from('branches')
      .select('id, code, name, metadata, created_at')
      .order('created_at', { ascending: true });

    if (!allBranches || allBranches.length === 0) {
      return { message: 'No branches found', cleaned: 0 };
    }

    // Map CHW names to the branches they're assigned to (in creation order)
    const chwToBranches = new Map<string, any[]>();

    allBranches.forEach((branch: any) => {
      const metadata = (branch.metadata ?? {}) as Record<string, any>;
      const chws = (metadata.assignedChwNames ?? []) as string[];

      chws.forEach((chwName) => {
        if (!chwToBranches.has(chwName)) {
          chwToBranches.set(chwName, []);
        }
        chwToBranches.get(chwName)!.push(branch);
      });
    });

    // Find duplicates and clean them up
    const duplicateChws: Array<{ chwName: string; keptIn: string; removedFrom: string[] }> = [];
    let cleanupCount = 0;

    for (const [chwName, branches] of chwToBranches.entries()) {
      if (branches.length > 1) {
        // Keep in the first (oldest) branch, remove from others
        const keptBranch = branches[0];
        const removedBranches = branches.slice(1);

        duplicateChws.push({
          chwName,
          keptIn: keptBranch.name,
          removedFrom: removedBranches.map((b) => b.name),
        });

        // Update each branch to remove this CHW if it's not the keeper
        for (const branchToClean of removedBranches) {
          const metadata = (branchToClean.metadata ?? {}) as Record<string, any>;
          const chws = ((metadata.assignedChwNames ?? []) as string[]).filter((c) => c !== chwName);

          const { error } = await db
            .from('branches')
            .update({
              metadata: {
                ...metadata,
                assignedChwNames: chws,
              },
            })
            .eq('id', branchToClean.id);

          if (!error) {
            cleanupCount++;
          }
        }
      }
    }

    return {
      message: `Cleanup complete: removed ${cleanupCount} duplicate CHW assignments`,
      cleaned: cleanupCount,
      details: duplicateChws,
    };
  }

  async deleteHqBranch(code: string) {
    const db = this.databaseService.supabase;

    // Look up branch by code
    const { data: branch, error: lookupError } = await db
      .from('branches')
      .select('id, name')
      .eq('code', code)
      .maybeSingle();

    if (lookupError) {
      throw new InternalServerErrorException('Failed to look up branch');
    }
    if (!branch) throw new NotFoundException(`Branch with code "${code}" not found`);

    // Check for dependent records before attempting deletion
    const [staffCount, childrenCount, catchmentCount] = await Promise.all([
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branch.id),
      db
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('primary_facility_id', branch.id),
      db
        .from('catchment_areas')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branch.id),
    ]);

    // Fail closed: if any dependency check errored or did not return a count, abort deletion
    const dependencyErrors = [
      staffCount?.error,
      childrenCount?.error,
      catchmentCount?.error,
    ].filter((err) => err);

    const invalidCounts =
      staffCount?.count == null ||
      childrenCount?.count == null ||
      catchmentCount?.count == null;

    if (dependencyErrors.length > 0 || invalidCounts) {
      this.logger.error('Failed to verify dependent records before deleting branch', {
        staffError: staffCount?.error,
        childrenError: childrenCount?.error,
        catchmentError: catchmentCount?.error,
        staffCount: staffCount?.count,
        childrenCount: childrenCount?.count,
        catchmentCount: catchmentCount?.count,
      });
      throw new InternalServerErrorException(
        'Failed to verify branch dependencies before deletion',
      );
    }

    const issues: string[] = [];
    if ((staffCount.count ?? 0) > 0) issues.push(`${staffCount.count} staff member(s)`);
    if ((childrenCount.count ?? 0) > 0) issues.push(`${childrenCount.count} registered child(ren)`);
    if ((catchmentCount.count ?? 0) > 0) issues.push(`${catchmentCount.count} catchment area(s)`);

    if (issues.length > 0) {
      throw new BadRequestException({
        message: `Cannot delete branch. It has dependent records: ${issues.join(', ')}. Please remove these first.`,
        code: 'BRANCH_HAS_DEPENDENTS',
      });
    }

    const { error } = await db.from('branches').delete().eq('id', branch.id);
    if (error) {
      this.logger.error('Failed to delete branch', error);
      throw new InternalServerErrorException(
        'Failed to delete branch. Please try again.',
      );
    }
    return { success: true, deleted: branch.name };
  }

  async getHqUsers() {
    const db = this.databaseService.supabase;

    const { data, error } = await db
      .from('users')
      .select('id, full_name, email, role, status, branch_id')
      .in('role', ['hq-admin', 'branch-manager', 'facility-nurse', 'chw', 'data-officer', 'pha', 'parent'])
      .order('full_name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException({
        message: `Failed to load users: ${error.message}`,
        code: 'HQ_USERS_FETCH_FAILED',
      });
    }

    const branchIds = Array.from(
      new Set((data ?? []).map((user: any) => user.branch_id).filter(Boolean)),
    );

    const { data: branches, error: branchesError } = branchIds.length
      ? await db
          .from('branches')
          .select('id, name, code')
          .in('id', branchIds)
      : { data: [], error: null as any };

    if (branchesError) {
      throw new InternalServerErrorException({
        message: `Failed to load branch lookup: ${branchesError.message}`,
        code: 'HQ_USERS_BRANCH_LOOKUP_FAILED',
      });
    }

    const branchMap = new Map<string, { name: string; code: string }>();
    (branches ?? []).forEach((branch: any) => {
      branchMap.set(branch.id, {
        name: branch.name,
        code: branch.code,
      });
    });

    return (data ?? []).map((user: any) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: this.toDisplayRole(user.role),
      branch: user.branch_id ? branchMap.get(user.branch_id)?.name : undefined,
      status: user.status === 'inactive' ? 'inactive' : 'active',
    }));
  }

  async createHqUser(dto: CreateHqUserDto, actorUserId?: string) {
    const db = this.databaseService.supabase;
    const normalizedEmail = dto.email.trim().toLowerCase();
    const role = this.toStorageRole(dto.role);
    await this.assertHqAdminRoleProvisioningAllowed(role, {
      actorUserId,
      operation: 'create_hq_user',
      targetUserId: null,
      targetEmail: normalizedEmail,
    });
    const branchId = await this.resolveBranchId(dto.branch);

    const { data: existing, error: existingError } = await db
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingError) {
      throw new InternalServerErrorException(
        {
          message: `Failed to validate user email: ${existingError.message}`,
          code: 'HQ_USER_EMAIL_VALIDATION_FAILED',
        },
      );
    }

    if (existing) {
      throw new ConflictException({
        message: `User with email ${normalizedEmail} already exists`,
        code: 'EMAIL_EXISTS',
      });
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);

    const { data: createdUser, error: createError } = await db
      .from('users')
      .insert({
        full_name: dto.fullName.trim(),
        email: normalizedEmail,
        role,
        status: 'active',
        branch_id: branchId,
        password_hash: passwordHash,
        must_change_password: true,
      })
      .select('id')
      .single();

    if (createError || !createdUser) {
      throw new BadRequestException(
        {
          message: `Failed to create user: ${createError?.message ?? 'unknown error'}`,
          code: 'HQ_USER_CREATE_FAILED',
        },
      );
    }

    const emailDispatch = await this.emailService.sendStaffInviteEmailWithStatus(
      {
        email: normalizedEmail,
        name: dto.fullName.trim(),
        role: this.toDisplayRole(role),
      },
      temporaryPassword,
    );

    const users = await this.getHqUsers();
    const createdUserRecord = users.find((item) => item.id === createdUser.id);

    if (!createdUserRecord) {
      throw new InternalServerErrorException({
        message: 'User created, but failed to load the created user profile.',
        code: 'HQ_USER_CREATED_BUT_NOT_FETCHED',
      });
    }

    return {
      ...createdUserRecord,
      emailSent: emailDispatch.success,
      message: emailDispatch.success
        ? `User created and temporary password emailed to ${normalizedEmail}.`
        : `User created, but invitation email delivery failed for ${normalizedEmail}.`,
      reason: emailDispatch.success ? null : (emailDispatch.errorMessage ?? 'Email delivery failed'),
      temporaryPassword: emailDispatch.success ? undefined : temporaryPassword,
    };
  }

  async updateHqUser(userId: string, dto: UpdateHqUserDto, actorUserId?: string) {
    const db = this.databaseService.supabase;
    const branchId = await this.resolveBranchId(dto.branch);

    // Check if email already exists when trying to update it
    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const { data: existingUser, error: existingError } = await db
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingError) {
        throw new InternalServerErrorException({
          message: `Failed to validate user email: ${existingError.message}`,
          code: 'HQ_USER_EMAIL_VALIDATION_FAILED',
        });
      }

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException({
          message: `User with email ${normalizedEmail} already exists`,
          code: 'EMAIL_EXISTS',
        });
      }
    }

    const payload: Record<string, any> = {};
    if (dto.fullName !== undefined) payload.full_name = dto.fullName.trim();
    if (dto.email !== undefined) payload.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) {
      const targetRole = this.toStorageRole(dto.role);
      await this.assertHqAdminRoleProvisioningAllowed(targetRole, {
        actorUserId,
        operation: 'update_hq_user_role',
        targetUserId: userId,
        targetEmail: dto.email?.trim().toLowerCase() ?? null,
      });
      payload.role = targetRole;
    }
    if (dto.branch !== undefined) payload.branch_id = branchId;

    const { data: updated, error } = await db
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id')
      .single();

    if (error || !updated) {
      if (error?.code === 'PGRST116' || !updated) {
        throw new NotFoundException({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }
      const message = (error as any)?.message ?? 'unknown error';
      throw new BadRequestException({
        message: `Failed to update user: ${message}`,
        code: 'HQ_USER_UPDATE_FAILED',
      });
    }

    const users = await this.getHqUsers();
    return users.find((item) => item.id === updated.id);
  }

  async updateHqUserStatus(userId: string, status: HqUserStatus) {
    const db = this.databaseService.supabase;
    const { data: updated, error } = await db
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select('id')
      .single();

    if (error || !updated) {
      if (error?.code === 'PGRST116' || !updated) {
        throw new NotFoundException({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }
      const message = (error as any)?.message ?? 'unknown error';
      throw new BadRequestException(
        {
          message: `Failed to update user status: ${message}`,
          code: 'HQ_USER_STATUS_UPDATE_FAILED',
        },
      );
    }

    const users = await this.getHqUsers();
    return users.find((item) => item.id === updated.id);
  }

  async resetHqUserPassword(email: string) {
    const db = this.databaseService.supabase;
    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error: userError } = await db
      .from('users')
      .select('id, email, full_name')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      throw new NotFoundException({
        message: `User not found for email ${normalizedEmail}`,
        code: 'USER_NOT_FOUND',
      });
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);

    const { error: updateError } = await db
      .from('users')
      .update({
        password_hash: passwordHash,
        must_change_password: true,
      })
      .eq('id', user.id);

    if (updateError) {
      throw new BadRequestException({
        message: `Failed to reset password: ${updateError.message}`,
        code: 'PASSWORD_RESET_UPDATE_FAILED',
      });
    }

    const emailDispatch = await this.emailService.sendPasswordResetEmailWithStatus(
      {
        email: user.email,
        name: user.full_name ?? 'User',
      },
      temporaryPassword,
    );

    if (emailDispatch.success) {
      return {
        emailSent: true,
        message: `Password reset email sent to ${user.email}.`,
        reason: null,
      };
    }

    return {
      emailSent: false,
      message: `Password was reset for ${user.email}, but email delivery failed.`,
      reason: emailDispatch.errorMessage ?? 'SMTP delivery failed',
    };
  }

  private normalizeUniqueValues(values: string[] | string): string[] {
    const list = Array.isArray(values) ? values : values.split(',');
    const deduped = new Set(
      list
        .map((value) => value.trim())
        .filter(Boolean),
    );
    return Array.from(deduped);
  }

  private generateTemporaryPassword(length = 10): string {
    return randomBytes(length)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, length);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private toStorageRole(role: string): string {
    const roleMap: Record<string, string> = {
      'HQ Admin': 'hq-admin',
      'Branch Manager': 'branch-manager',
      'Facility Nurse': 'facility-nurse',
      'Community Health Worker': 'chw',
      'Data Officer': 'data-officer',
      'Public Health Authority': 'pha',
      Parent: 'parent',
      'hq-admin': 'hq-admin',
      'branch-manager': 'branch-manager',
      'facility-nurse': 'facility-nurse',
      chw: 'chw',
      'data-officer': 'data-officer',
      pha: 'pha',
      parent: 'parent',
    };

    return roleMap[role] ?? role;
  }

  private toDisplayRole(role: string): string {
    const displayMap: Record<string, string> = {
      'hq-admin': 'HQ Admin',
      'branch-manager': 'Branch Manager',
      'facility-nurse': 'Facility Nurse',
      chw: 'Community Health Worker',
      'data-officer': 'Data Officer',
      pha: 'Public Health Authority',
      parent: 'Parent',
    };

    return displayMap[role] ?? role;
  }

  private async assertHqAdminRoleProvisioningAllowed(
    role: string,
    context: {
      actorUserId?: string;
      operation: 'create_hq_user' | 'update_hq_user_role';
      targetUserId: string | null;
      targetEmail: string | null;
    },
  ): Promise<void> {
    if (role !== 'hq-admin') return;

    const detailPayload = {
      reason: 'hq_admin_role_provision_blocked',
      attemptedRole: role,
      operation: context.operation,
      actorUserId: context.actorUserId ?? null,
      targetUserId: context.targetUserId,
      targetEmail: context.targetEmail,
    };

    this.logger.warn(`Blocked HQ Admin role provisioning attempt: ${JSON.stringify(detailPayload)}`);

    try {
      await this.databaseService.createAuditLog(
        context.actorUserId ?? null,
        'blocked_hq_admin_role_assignment',
        'users',
        context.targetUserId,
        { after: detailPayload },
      );
    } catch (auditError) {
      this.logger.warn(`Failed to write blocked HQ admin assignment audit log: ${String(auditError)}`);
    }

    throw new ForbiddenException({
      message: 'HQ Admin role cannot be created or assigned from this console.',
      code: 'HQ_ADMIN_ROLE_FORBIDDEN',
    });
  }

  private async resolveBranchId(branch?: string): Promise<string | null> {
    if (branch === undefined) return null;
    const normalized = branch.trim();
    if (!normalized) return null;

    const db = this.databaseService.supabase;

    const { data: branchByCode, error: codeError } = await db
      .from('branches')
      .select('id')
      .eq('code', normalized)
      .maybeSingle();

    if (codeError) {
      throw new InternalServerErrorException({
        message: `Failed to resolve branch: ${codeError.message}`,
        code: 'BRANCH_RESOLVE_FAILED',
      });
    }

    if (branchByCode) return branchByCode.id;

    const { data: branchByName, error: nameError } = await db
      .from('branches')
      .select('id')
      .eq('name', normalized)
      .maybeSingle();

    if (nameError) {
      throw new InternalServerErrorException({
        message: `Failed to resolve branch: ${nameError.message}`,
        code: 'BRANCH_RESOLVE_FAILED',
      });
    }

    if (!branchByName) {
      throw new NotFoundException({
        message: `Branch "${normalized}" not found`,
        code: 'BRANCH_NOT_FOUND',
      });
    }

    return branchByName.id;
  }

  private async generateNextBranchCode(): Promise<string> {
    const db = this.databaseService.supabase;
    const { data: rows, error } = await db
      .from('branches')
      .select('code');

    if (error) {
      throw new InternalServerErrorException({
        message: `Failed to generate branch code: ${error.message}`,
        code: 'HQ_BRANCH_CODE_GENERATION_FAILED',
      });
    }

    const maxCode = (rows ?? []).reduce((highest: number, row: any) => {
      const parsed = Number.parseInt(String(row.code ?? '').replace('BR-', ''), 10);
      return Number.isNaN(parsed) ? highest : Math.max(highest, parsed);
    }, 0);

    return `BR-${String(maxCode + 1).padStart(3, '0')}`;
  }

  private resolveAnalyticsWindowMonths(windowValue?: string): number {
    const normalized = String(windowValue ?? '').toLowerCase();
    if (normalized.includes('12')) return 12;
    if (normalized.includes('6')) return 6;
    return 6;
  }

  private buildMonthlyTrendSkeleton(startDate: Date, months: number): Array<{ monthKey: string; period: string }> {
    return Array.from({ length: months }).map((_, index) => {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const period = monthDate.toLocaleDateString('en-GH', {
        month: 'short',
        year: 'numeric',
      });

      return { monthKey, period };
    });
  }

  private async replaceCatchmentsForBranch(
    branchId: string,
    branchCode: string,
    catchmentAreas: string[],
  ) {
    const db = this.databaseService.supabase;

    const { error: deleteError } = await db
      .from('catchment_areas')
      .delete()
      .eq('branch_id', branchId);

    if (deleteError) {
      throw new InternalServerErrorException({
        message: `Failed to clear catchment areas: ${deleteError.message}`,
        code: 'HQ_BRANCH_CATCHMENT_CLEAR_FAILED',
      });
    }

    const payload = catchmentAreas.map((name, index) => ({
      branch_id: branchId,
      name,
      community: name,
      code: `CA-${branchCode.replace('BR-', '')}-${String(index + 1).padStart(2, '0')}`,
    }));

    const { error: insertError } = await db
      .from('catchment_areas')
      .insert(payload);

    if (insertError) {
      throw new InternalServerErrorException({
        message: `Failed to save catchment areas: ${insertError.message}`,
        code: 'HQ_BRANCH_CATCHMENT_SAVE_FAILED',
      });
    }
  }

  // ── Branch Manager Staff Management ────────────────────────────────────────

  async createBranchCatchmentArea(
    branchId: string,
    dto: CreateBranchCatchmentAreaDto,
  ) {
    const db = this.databaseService.supabase;
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Catchment area name is required.');
    }

    const geometry = this.extractCatchmentGeometry(dto.boundaries);
    const code = await this.generateNextBranchCatchmentCode(branchId);

    const { data, error } = await db
      .from('catchment_areas')
      .insert({
        branch_id: branchId,
        name,
        code,
        polygon: geometry,
        assigned_chw_id: null,
      })
      .select('id, name, code, branch_id, polygon, assigned_chw_id, created_at, updated_at')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException({
          message: `Catchment area "${name}" already exists in this branch.`,
          code: 'CATCHMENT_NAME_EXISTS',
        });
      }

      throw new InternalServerErrorException({
        message: `Failed to save catchment area: ${error?.message ?? 'Unknown error'}`,
        code: 'CATCHMENT_CREATE_FAILED',
      });
    }

    return this.mapBranchCatchmentArea(data);
  }

  async getBranchCatchmentAreas(branchId: string) {
    const db = this.databaseService.supabase;

    const { data, error } = await db
      .from('catchment_areas')
      .select('id, name, code, branch_id, polygon, assigned_chw_id, created_at, updated_at')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException({
        message: `Failed to fetch catchment areas: ${error.message}`,
        code: 'CATCHMENT_FETCH_FAILED',
      });
    }

    const rows = data ?? [];
    const chwIds = [...new Set(rows.map((row: any) => row.assigned_chw_id).filter(Boolean))] as string[];

    const chwNameMap = new Map<string, string>();
    if (chwIds.length > 0) {
      const { data: chws, error: chwError } = await db
        .from('users')
        .select('id, full_name')
        .in('id', chwIds)
        .eq('branch_id', branchId)
        .eq('role', 'chw');

      if (chwError) {
        throw new InternalServerErrorException({
          message: `Failed to resolve CHW assignments: ${chwError.message}`,
          code: 'CATCHMENT_CHW_LOOKUP_FAILED',
        });
      }

      (chws ?? []).forEach((chw: any) => {
        chwNameMap.set(chw.id, chw.full_name ?? 'Unknown CHW');
      });
    }

    const result = await Promise.all(
      rows.map(async (row: any) => {
        // 1. Active Children Count
        const { count: activeChildren } = await db
          .from('children')
          .select('*', { count: 'exact', head: true })
          .eq('catchment_area_id', row.id)
          .eq('is_active', true);

        // 2. Transferred In Count (search by catchment name in audit details)
        const { count: transferredIn } = await db
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('action', 'transfer_in')
          .filter('details->>newCatchment', 'eq', row.name);

        // 3. Transferred Out Count (search by catchment name in audit details)
        const { count: transferredOut } = await db
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('action', 'transfer_out')
          .filter('details->>previousCatchment', 'eq', row.name);

        const stats = {
          activeChildren: activeChildren || 0,
          transferredIn: transferredIn || 0,
          transferredOut: transferredOut || 0,
        };

        return this.mapBranchCatchmentArea(row, chwNameMap, stats);
      })
    );

    return result;
  }

  async updateBranchCatchmentArea(
    branchId: string,
    catchmentAreaId: string,
    dto: UpdateBranchCatchmentAreaDto,
  ) {
    const db = this.databaseService.supabase;

    const { data: existingZone, error: zoneError } = await db
      .from('catchment_areas')
      .select('id, branch_id')
      .eq('id', catchmentAreaId)
      .maybeSingle();

    if (zoneError) {
      throw new InternalServerErrorException({
        message: `Failed to verify catchment area: ${zoneError.message}`,
        code: 'CATCHMENT_LOOKUP_FAILED',
      });
    }

    if (!existingZone) {
      throw new NotFoundException({
        message: 'Catchment area not found.',
        code: 'CATCHMENT_NOT_FOUND',
      });
    }

    if (existingZone.branch_id !== branchId) {
      throw new ForbiddenException('You can only update catchment areas within your branch.');
    }

    const payload: Record<string, any> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException({
          message: 'Catchment area name cannot be empty.',
          code: 'CATCHMENT_NAME_REQUIRED',
        });
      }
      payload.name = name;
    }

    if (dto.boundaries !== undefined) {
      payload.polygon = this.extractCatchmentGeometry(dto.boundaries);
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException({
        message: 'No catchment changes were provided.',
        code: 'CATCHMENT_UPDATE_EMPTY',
      });
    }

    const { data: updated, error: updateError } = await db
      .from('catchment_areas')
      .update(payload)
      .eq('id', catchmentAreaId)
      .eq('branch_id', branchId)
      .select('id, name, code, branch_id, polygon, assigned_chw_id, created_at, updated_at')
      .single();

    if (updateError || !updated) {
      if (updateError?.code === '23505') {
        throw new ConflictException({
          message: `Catchment area name already exists in this branch.`,
          code: 'CATCHMENT_NAME_EXISTS',
        });
      }

      throw new InternalServerErrorException({
        message: `Failed to update catchment area: ${updateError?.message ?? 'Unknown error'}`,
        code: 'CATCHMENT_UPDATE_FAILED',
      });
    }

    const assignedChwId = updated.assigned_chw_id ?? null;
    const chwNameMap = new Map<string, string>();

    if (assignedChwId) {
      const { data: chw, error: chwError } = await db
        .from('users')
        .select('id, full_name')
        .eq('id', assignedChwId)
        .eq('branch_id', branchId)
        .eq('role', 'chw')
        .maybeSingle();

      if (chwError) {
        throw new InternalServerErrorException({
          message: `Failed to resolve CHW assignment: ${chwError.message}`,
          code: 'CATCHMENT_CHW_LOOKUP_FAILED',
        });
      }

      if (chw?.id) {
        chwNameMap.set(chw.id, chw.full_name ?? 'Unknown CHW');
      }
    }

    return this.mapBranchCatchmentArea(updated, chwNameMap);
  }

  async deleteBranchCatchmentArea(
    branchId: string,
    catchmentAreaId: string,
  ) {
    const db = this.databaseService.supabase;

    const { data: existingZone, error: zoneError } = await db
      .from('catchment_areas')
      .select('id, name, branch_id')
      .eq('id', catchmentAreaId)
      .maybeSingle();

    if (zoneError) {
      throw new InternalServerErrorException({
        message: `Failed to verify catchment area: ${zoneError.message}`,
        code: 'CATCHMENT_LOOKUP_FAILED',
      });
    }

    if (!existingZone) {
      throw new NotFoundException({
        message: 'Catchment area not found.',
        code: 'CATCHMENT_NOT_FOUND',
      });
    }

    if (existingZone.branch_id !== branchId) {
      throw new ForbiddenException('You can only delete catchment areas within your branch.');
    }

    const { error: deleteError } = await db
      .from('catchment_areas')
      .delete()
      .eq('id', catchmentAreaId)
      .eq('branch_id', branchId);

    if (deleteError) {
      throw new InternalServerErrorException({
        message: `Failed to delete catchment area: ${deleteError.message}`,
        code: 'CATCHMENT_DELETE_FAILED',
      });
    }

    return {
      success: true,
      id: catchmentAreaId,
      name: existingZone.name,
    };
  }

  async assignBranchCatchmentArea(
    branchId: string,
    catchmentAreaId: string,
    dto: AssignBranchCatchmentAreaDto,
  ) {
    const db = this.databaseService.supabase;

    const { data: existingZone, error: zoneError } = await db
      .from('catchment_areas')
      .select('id, branch_id')
      .eq('id', catchmentAreaId)
      .maybeSingle();

    if (zoneError) {
      throw new InternalServerErrorException({
        message: `Failed to verify catchment area: ${zoneError.message}`,
        code: 'CATCHMENT_LOOKUP_FAILED',
      });
    }

    if (!existingZone) {
      throw new NotFoundException({
        message: 'Catchment area not found.',
        code: 'CATCHMENT_NOT_FOUND',
      });
    }

    if (existingZone.branch_id !== branchId) {
      throw new ForbiddenException('You can only assign CHWs within your branch.');
    }

    const { data: chw, error: chwError } = await db
      .from('users')
      .select('id, full_name, role, branch_id, status')
      .eq('id', dto.chwId)
      .maybeSingle();

    if (chwError) {
      throw new InternalServerErrorException({
        message: `Failed to validate CHW assignment: ${chwError.message}`,
        code: 'CATCHMENT_ASSIGN_VALIDATE_FAILED',
      });
    }

    if (!chw || chw.role !== 'chw' || chw.branch_id !== branchId) {
      throw new BadRequestException({
        message: 'Selected CHW is invalid or not assigned to your branch.',
        code: 'INVALID_CHW_ASSIGNMENT',
      });
    }

    if (chw.status !== 'active') {
      throw new BadRequestException({
        message: 'Only active CHWs can be assigned to a catchment area.',
        code: 'INACTIVE_CHW_ASSIGNMENT',
      });
    }

    const { data: updated, error: updateError } = await db
      .from('catchment_areas')
      .update({ assigned_chw_id: dto.chwId })
      .eq('id', catchmentAreaId)
      .eq('branch_id', branchId)
      .select('id, name, code, branch_id, polygon, assigned_chw_id, created_at, updated_at')
      .single();

    if (updateError || !updated) {
      throw new InternalServerErrorException({
        message: `Failed to assign CHW: ${updateError?.message ?? 'Unknown error'}`,
        code: 'CATCHMENT_ASSIGN_FAILED',
      });
    }

    const chwNameMap = new Map<string, string>([[chw.id, chw.full_name ?? 'Unknown CHW']]);
    return this.mapBranchCatchmentArea(updated, chwNameMap);
  }

  async registerStaff(branchId: string, dto: RegisterStaffDto) {
    const db = this.databaseService.supabase;
    const normalizedEmail = dto.email.trim().toLowerCase();

    const missingEmailConfig = this.emailService.getMissingEmailConfig();
    if (missingEmailConfig.length > 0) {
      throw new InternalServerErrorException({
        message: `Staff invite email is not configured. Missing: ${missingEmailConfig.join(', ')}`,
        code: 'STAFF_INVITE_EMAIL_CONFIG_MISSING',
      });
    }

    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      throw new ConflictException({ message: 'A user with this email already exists.', code: 'EMAIL_EXISTS' });
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);

    const { data: created, error } = await db
      .from('users')
      .insert({
        full_name: dto.fullName.trim(),
        email: normalizedEmail,
        phone: dto.phoneNumber,
        role: dto.role,
        branch_id: branchId,
        password_hash: passwordHash,
        must_change_password: true,
        status: 'active',
      })
      .select('id, email')
      .single();

    if (error || !created) {
      this.logger.error(`Staff registration failed: ${error?.message}`, error?.stack);
      throw new InternalServerErrorException({ message: 'Failed to register staff. Please try again.', code: 'STAFF_CREATE_FAILED' });
    }

    const emailDispatch = await this.emailService.sendStaffInviteEmailWithStatus(
      { email: normalizedEmail, name: dto.fullName.trim(), role: dto.role },
      temporaryPassword,
    );

  if (!emailDispatch.success) {
      // Roll back account creation so credentials are never left undisclosed.
      const { error: rollbackError } = await db
        .from('users')
        .delete()
        .eq('id', created.id);

      if (rollbackError) {
        this.logger.error(
          `Staff invite email failed and rollback failed for ${normalizedEmail}: ${rollbackError.message}`,
          rollbackError.stack,
        );
      }

      throw new InternalServerErrorException({
        message:
          'Staff account was not created because invitation email could not be sent. Check email settings and try again.',
        code: 'STAFF_INVITE_EMAIL_FAILED',
        reason: emailDispatch.errorMessage ?? null,
      });
    }

    return {
      id: created.id,
      email: created.email,
      emailSent: true,
      message: `Staff account created and temporary password emailed to ${normalizedEmail}.`,
      reason: null,
    };
  }

  async getStaffList(branchId: string, filters: { role?: string; status?: string; search?: string }) {
    const db = this.databaseService.supabase;
    let query = db
      .from('users')
      .select('id, full_name, email, phone_number:phone, role, status, created_at')
      .eq('branch_id', branchId)
      .in('role', ['facility-nurse', 'chw']);

    if (filters.role) query = query.eq('role', filters.role);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.ilike('full_name', `%${filters.search}%`);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to fetch staff list');
    return data ?? [];
  }

  async updateStaff(staffId: string, branchId: string, dto: UpdateStaffDto) {
    const db = this.databaseService.supabase;

    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('id', staffId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Staff member not found in your branch.');

    const payload: Record<string, any> = {};
    if (dto.fullName) payload.full_name = dto.fullName.trim();
    if (dto.email) payload.email = dto.email.trim().toLowerCase();
    if (dto.phoneNumber) payload.phone = dto.phoneNumber;
    if (dto.catchmentAreaId !== undefined) payload.catchment_area_id = dto.catchmentAreaId;
    if (dto.specialization !== undefined) payload.specialization = dto.specialization;

    const { error } = await db.from('users').update(payload).eq('id', staffId);
    if (error) throw new InternalServerErrorException('Failed to update staff member.');
    return { success: true };
  }

  async updateStaffStatus(staffId: string, branchId: string, status: string) {
    const db = this.databaseService.supabase;

    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('id', staffId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Staff member not found in your branch.');

    const { error } = await db.from('users').update({ status }).eq('id', staffId);
    if (error) throw new InternalServerErrorException('Failed to update staff status.');
    return { success: true, status };
  }

  private async generateNextBranchCatchmentCode(branchId: string): Promise<string> {
    const db = this.databaseService.supabase;

    const { data: branch, error: branchError } = await db
      .from('branches')
      .select('code')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError || !branch) {
      throw new InternalServerErrorException({
        message: `Failed to resolve branch code: ${branchError?.message ?? 'Branch not found'}`,
        code: 'CATCHMENT_CODE_BRANCH_LOOKUP_FAILED',
      });
    }

    const branchCodeSegment = String(branch.code ?? '')
      .trim()
      .toUpperCase()
      .replace(/^BR-/, '') || '00';

    const prefix = `CA-${branchCodeSegment}-`;

    const { data: existingCodes, error: codeError } = await db
      .from('catchment_areas')
      .select('code')
      .eq('branch_id', branchId)
      .ilike('code', `${prefix}%`);

    if (codeError) {
      throw new InternalServerErrorException({
        message: `Failed to generate catchment code: ${codeError.message}`,
        code: 'CATCHMENT_CODE_GENERATION_FAILED',
      });
    }

    const maxSerial = (existingCodes ?? []).reduce((max: number, row: any) => {
      const code = String(row.code ?? '');
      if (!code.startsWith(prefix)) return max;
      const parsed = Number.parseInt(code.slice(prefix.length), 10);
      if (Number.isNaN(parsed)) return max;
      return Math.max(max, parsed);
    }, 0);

    return `${prefix}${String(maxSerial + 1).padStart(2, '0')}`;
  }

  private extractCatchmentGeometry(
    boundaries: Record<string, any>,
  ): { type: 'Polygon' | 'MultiPolygon'; coordinates: any[] } {
    if (!boundaries || typeof boundaries !== 'object') {
      throw new BadRequestException({
        message: 'Boundaries payload is required.',
        code: 'CATCHMENT_BOUNDARIES_REQUIRED',
      });
    }

    const geometryCandidate = boundaries.type === 'Feature'
      ? boundaries.geometry
      : boundaries;

    if (!geometryCandidate || typeof geometryCandidate !== 'object') {
      throw new BadRequestException({
        message: 'Invalid GeoJSON geometry payload.',
        code: 'CATCHMENT_GEOMETRY_INVALID',
      });
    }

    const geometryType = geometryCandidate.type;
    if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
      throw new BadRequestException({
        message: 'Only Polygon and MultiPolygon shapes are supported.',
        code: 'CATCHMENT_GEOMETRY_TYPE_INVALID',
      });
    }

    if (!Array.isArray(geometryCandidate.coordinates) || geometryCandidate.coordinates.length === 0) {
      throw new BadRequestException({
        message: 'GeoJSON coordinates are required for catchment boundaries.',
        code: 'CATCHMENT_GEOMETRY_COORDS_MISSING',
      });
    }

    return {
      type: geometryType,
      coordinates: geometryCandidate.coordinates,
    };
  }

  private mapBranchCatchmentArea(
    row: any,
    chwNameMap: Map<string, string> = new Map<string, string>(),
    stats?: { activeChildren: number; transferredIn: number; transferredOut: number },
  ) {
    const geometry = row.polygon
      ? this.extractCatchmentGeometry(row.polygon)
      : null;

    const assignedChwId = row.assigned_chw_id ?? null;
    const assignedChwName = assignedChwId
      ? (chwNameMap.get(assignedChwId) ?? null)
      : null;

    return {
      id: row.id,
      branchId: row.branch_id,
      name: row.name,
      code: row.code,
      boundaries: geometry
        ? {
            type: 'Feature',
            geometry,
            properties: {
              catchmentId: row.id,
              name: row.name,
              code: row.code,
            },
          }
        : null,
      assignedChwId,
      assignedChwName,
      status: assignedChwId ? 'assigned' : 'unassigned',
      stats: stats || { activeChildren: 0, transferredIn: 0, transferredOut: 0 },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HQ ADMIN — VACCINE CONFIGURATION (master catalogue)
  // ═══════════════════════════════════════════════════════════════════════════

  async getHqVaccines() {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('vaccines')
      .select('id, code, name, description, manufacturer, status, created_at, updated_at')
      .order('name', { ascending: true });
    if (error) {
      this.logger.error('Failed to fetch vaccine catalogue', error);
      throw new InternalServerErrorException('Failed to fetch vaccine catalogue');
    }

    // Attach schedule rows for each vaccine
    const vaccineIds = (data ?? []).map((v: any) => v.id);
    const { data: schedules, error: schedulesError } = await db
      .from('vaccination_schedules')
      .select('id, vaccine_id, dose_number, schedule_name, due_days_from_birth, min_age_days, max_age_days, is_mandatory, sort_order')
      .in('vaccine_id', vaccineIds.length ? vaccineIds : ['__none__'])
      .order('sort_order', { ascending: true });
    if (schedulesError) {
      this.logger.error('Failed to fetch vaccination schedules', schedulesError);
      throw new InternalServerErrorException('Failed to fetch vaccination schedules');
    }

    const scheduleMap = new Map<string, any[]>();
    for (const s of schedules ?? []) {
      const list = scheduleMap.get(s.vaccine_id) ?? [];
      list.push(s);
      scheduleMap.set(s.vaccine_id, list);
    }

    return (data ?? []).map((v: any) => {
      const vaccineSchedules = scheduleMap.get(v.id) ?? [];
      const firstSchedule = vaccineSchedules[0];
      return {
        id: v.id,
        code: v.code,
        name: v.name,
        schedule: firstSchedule?.schedule_name || v.description || 'Standard schedule',
        dueDays: firstSchedule?.due_days_from_birth ?? 0,
        status: v.status,
        schedules: vaccineSchedules,
      };
    });
  }

  async createHqVaccine(dto: {
    code: string;
    name: string;
    description?: string;
    manufacturer?: string;
  }) {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('vaccines')
      .insert({
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        manufacturer: dto.manufacturer?.trim() || null,
        status: 'active',
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new ConflictException(`Vaccine code "${dto.code}" already exists`);
      this.logger.error('Failed to create vaccine', error);
      throw new InternalServerErrorException('Failed to create vaccine');
    }
    return data;
  }

  async updateHqVaccine(
    vaccineId: string,
    dto: { name?: string; description?: string; manufacturer?: string; status?: string },
  ) {
    const db = this.databaseService.supabase;
    const payload: Record<string, any> = {};
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.description !== undefined) payload.description = dto.description.trim() || null;
    if (dto.manufacturer !== undefined) payload.manufacturer = dto.manufacturer.trim() || null;
    if (dto.status !== undefined) payload.status = dto.status;

    if (Object.keys(payload).length === 0) throw new BadRequestException('No fields to update');

    const { data, error } = await db
      .from('vaccines')
      .update(payload)
      .eq('id', vaccineId)
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to update vaccine', error);
      throw new InternalServerErrorException('Failed to update vaccine');
    }
    if (!data) throw new NotFoundException('Vaccine not found');
    return data;
  }

  async deleteHqVaccine(vaccineId: string) {
    const db = this.databaseService.supabase;

    // First, check if there are any vaccination events using this vaccine
    const { count: eventCount, error: countError } = await db
      .from('vaccination_events')
      .select('*', { count: 'exact', head: true })
      .eq('vaccine_id', vaccineId);

    if (countError) {
      this.logger.error('Failed to check vaccination events', countError);
      throw new InternalServerErrorException('Failed to check vaccine usage');
    }

    if (eventCount && eventCount > 0) {
      throw new BadRequestException(
        `Cannot delete this vaccine. It has been used in ${eventCount} vaccination record(s). Consider archiving it instead.`
      );
    }

    // Delete all associated schedules
    const { error: scheduleError } = await db
      .from('vaccination_schedules')
      .delete()
      .eq('vaccine_id', vaccineId);

    if (scheduleError) {
      this.logger.error('Failed to delete vaccine schedules', scheduleError);
      throw new InternalServerErrorException('Failed to delete vaccine schedules');
    }

    // Then delete the vaccine itself
    const { data, error } = await db
      .from('vaccines')
      .delete()
      .eq('id', vaccineId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to delete vaccine', error);
      throw new InternalServerErrorException('Failed to delete vaccine');
    }

    if (!data) throw new NotFoundException('Vaccine not found');

    return { success: true, deleted: data.name };
  }

  async createHqSchedule(dto: {
    vaccineId: string;
    doseNumber: number;
    scheduleName: string;
    dueDaysFromBirth: number;
    minAgeDays?: number;
    maxAgeDays?: number;
    isMandatory?: boolean;
    sortOrder?: number;
  }) {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('vaccination_schedules')
      .insert({
        vaccine_id: dto.vaccineId,
        dose_number: dto.doseNumber,
        schedule_name: dto.scheduleName.trim(),
        due_days_from_birth: dto.dueDaysFromBirth,
        min_age_days: dto.minAgeDays ?? null,
        max_age_days: dto.maxAgeDays ?? null,
        is_mandatory: dto.isMandatory ?? true,
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to create vaccination schedule', error);
      throw new InternalServerErrorException('Failed to create vaccination schedule');
    }
    return data;
  }

  async updateHqSchedule(
    scheduleId: string,
    dto: {
      doseNumber?: number;
      scheduleName?: string;
      dueDaysFromBirth?: number;
      minAgeDays?: number;
      maxAgeDays?: number;
      isMandatory?: boolean;
      sortOrder?: number;
    },
  ) {
    const db = this.databaseService.supabase;
    const payload: Record<string, any> = {};
    if (dto.doseNumber !== undefined) payload.dose_number = dto.doseNumber;
    if (dto.scheduleName !== undefined) payload.schedule_name = dto.scheduleName.trim();
    if (dto.dueDaysFromBirth !== undefined) payload.due_days_from_birth = dto.dueDaysFromBirth;
    if (dto.minAgeDays !== undefined) payload.min_age_days = dto.minAgeDays;
    if (dto.maxAgeDays !== undefined) payload.max_age_days = dto.maxAgeDays;
    if (dto.isMandatory !== undefined) payload.is_mandatory = dto.isMandatory;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;

    if (Object.keys(payload).length === 0) throw new BadRequestException('No fields to update');

    const { data, error } = await db
      .from('vaccination_schedules')
      .update(payload)
      .eq('id', scheduleId)
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to update vaccination schedule', error);
      throw new InternalServerErrorException('Failed to update vaccination schedule');
    }
    if (!data) throw new NotFoundException('Schedule entry not found');
    return data;
  }

  async deleteHqSchedule(scheduleId: string) {
    const db = this.databaseService.supabase;
    const { error } = await db
      .from('vaccination_schedules')
      .delete()
      .eq('id', scheduleId);
    if (error) {
      this.logger.error('Failed to delete vaccination schedule', error);
      throw new InternalServerErrorException('Failed to delete vaccination schedule');
    }
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HQ ADMIN — CATCHMENT AREA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async getHqCatchmentAreas() {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('catchment_areas')
      .select('id, name, code, branch_id, community, population_estimate, assigned_chw_id, created_at, updated_at')
      .order('name', { ascending: true });
    if (error) {
      this.logger.error('Failed to fetch catchment areas', error);
      throw new InternalServerErrorException('Failed to fetch catchment areas');
    }

    // Enrich with branch name and CHW name
    const branchIds = [...new Set((data ?? []).map((c: any) => c.branch_id).filter(Boolean))];
    const chwIds = [...new Set((data ?? []).map((c: any) => c.assigned_chw_id).filter(Boolean))];

    const [branchResult, chwResult] = await Promise.all([
      branchIds.length
        ? db.from('branches').select('id, name').in('id', branchIds)
        : { data: [] },
      chwIds.length
        ? db.from('users').select('id, full_name').in('id', chwIds)
        : { data: [] },
    ]);

    const branchMap = new Map((branchResult.data ?? []).map((b: any) => [b.id, b.name]));
    const chwMap = new Map((chwResult.data ?? []).map((c: any) => [c.id, c.full_name]));

    return (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      branchId: c.branch_id,
      branchName: branchMap.get(c.branch_id) || null,
      community: c.community,
      populationEstimate: c.population_estimate,
      assignedChwId: c.assigned_chw_id,
      assignedChwName: chwMap.get(c.assigned_chw_id) || null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async createHqCatchmentArea(dto: {
    name: string;
    code: string;
    branchId: string;
    community?: string;
    populationEstimate?: number;
    assignedChwId?: string;
  }) {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('catchment_areas')
      .insert({
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        branch_id: dto.branchId,
        community: dto.community?.trim() || null,
        population_estimate: dto.populationEstimate ?? null,
        assigned_chw_id: dto.assignedChwId || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new ConflictException(`Catchment area code "${dto.code}" already exists`);
      this.logger.error('Failed to create catchment area', error);
      throw new InternalServerErrorException('Failed to create catchment area');
    }
    return data;
  }

  async updateHqCatchmentArea(
    catchmentId: string,
    dto: {
      name?: string;
      community?: string;
      populationEstimate?: number;
      assignedChwId?: string;
      branchId?: string;
    },
  ) {
    const db = this.databaseService.supabase;
    const payload: Record<string, any> = {};
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.community !== undefined) payload.community = dto.community.trim() || null;
    if (dto.populationEstimate !== undefined) payload.population_estimate = dto.populationEstimate;
    if (dto.assignedChwId !== undefined) payload.assigned_chw_id = dto.assignedChwId || null;
    if (dto.branchId !== undefined) payload.branch_id = dto.branchId;

    if (Object.keys(payload).length === 0) throw new BadRequestException('No fields to update');

    const { data, error } = await db
      .from('catchment_areas')
      .update(payload)
      .eq('id', catchmentId)
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to update catchment area', error);
      throw new InternalServerErrorException('Failed to update catchment area');
    }
    if (!data) throw new NotFoundException('Catchment area not found');
    return data;
  }

  async deleteHqCatchmentArea(catchmentId: string) {
    const db = this.databaseService.supabase;
    const { error } = await db
      .from('catchment_areas')
      .delete()
      .eq('id', catchmentId);
    if (error) {
      this.logger.error('Failed to delete catchment area', error);
      throw new InternalServerErrorException('Failed to delete catchment area');
    }
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HQ ADMIN — SYSTEM SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  async getHqSystemSettings() {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('system_settings')
      .select('id, category, value, description, is_public, updated_by_user_id, created_at, updated_at')
      .order('category', { ascending: true });
    if (error) {
      this.logger.error('Failed to fetch system settings', error);
      throw new InternalServerErrorException('Failed to fetch system settings');
    }
    return (data ?? []).map((s: any) => {
      // value is stored as a JSONB object e.g. { value: 80 } — extract to plain string
      const rawVal = s.value;
      const normalizedValue =
        rawVal !== null && typeof rawVal === 'object' && 'value' in rawVal
          ? String(rawVal.value)
          : rawVal !== null && rawVal !== undefined
          ? String(rawVal)
          : '';
      return {
        id: s.id,
        key: s.id,          // id column doubles as the setting key
        value: normalizedValue,
        description: s.description ?? '',
        category: s.category ?? 'general',
        readOnly: s.is_public === false ? false : false, // all settings are editable unless locked
        updatedAt: s.updated_at,
        updatedBy: s.updated_by_user_id,
      };
    });
  }

  async updateHqSystemSetting(
    settingId: string,
    dto: { value: any; description?: string },
    actorUserId?: string,
  ) {
    const db = this.databaseService.supabase;
    const payload: Record<string, any> = {
      value: dto.value,
      updated_by_user_id: actorUserId || null,
    };
    if (dto.description !== undefined) payload.description = dto.description;

    const { data, error } = await db
      .from('system_settings')
      .update(payload)
      .eq('id', settingId)
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to update system setting', error);
      throw new InternalServerErrorException('Failed to update system setting');
    }
    if (!data) throw new NotFoundException('Setting not found');
    return data;
  }

  async createHqSystemSetting(dto: {
    id: string;
    category: string;
    value: any;
    description?: string;
    isPublic?: boolean;
  }, actorUserId?: string) {
    const db = this.databaseService.supabase;
    const { data, error } = await db
      .from('system_settings')
      .insert({
        id: dto.id,
        category: dto.category,
        value: dto.value,
        description: dto.description || null,
        is_public: dto.isPublic ?? false,
        updated_by_user_id: actorUserId || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new ConflictException(`Setting "${dto.id}" already exists`);
      this.logger.error('Failed to create system setting', error);
      throw new InternalServerErrorException('Failed to create system setting');
    }
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HQ ADMIN — AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  async getHqAuditLogs(filters: {
    action?: string;
    entityType?: string;
    category?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = this.databaseService.supabase;
    let query = db
      .from('audit_logs')
      .select('id, user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent, category, created_at');

    if (filters.action) query = query.eq('action', filters.action);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.userId) query = query.eq('user_id', filters.userId);

    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 100;
    const offset = filters.offset && filters.offset > 0 ? filters.offset : 0;

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to fetch audit logs', error);
      throw new InternalServerErrorException('Failed to fetch audit logs');
    }

    // Enrich with user names
    const userIds = [...new Set((data ?? []).map((l: any) => l.user_id).filter(Boolean))];
    let userMap = new Map<string, string>();
    if (userIds.length) {
      const { data: users } = await db
        .from('users')
        .select('id, full_name')
        .in('id', userIds);
      userMap = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));
    }

    return {
      data: (data ?? []).map((l: any) => ({
        ...l,
        user_name: userMap.get(l.user_id) || null,
      })),
      pagination: { limit, offset, returned: (data ?? []).length },
    };
  }
}
