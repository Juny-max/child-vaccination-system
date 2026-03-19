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
import { CreateHqBranchDto, UpdateHqBranchDto } from './hq-branches.dto';
import {
  CreateHqUserDto,
  HqUserStatus,
  UpdateHqUserDto,
} from './hq-users.dto';
import { RegisterStaffDto } from './register-staff.dto';
import { UpdateStaffDto } from './update-staff.dto';

@Injectable()
export class BranchManagerService {
  private readonly logger = new Logger(BranchManagerService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
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
          .in('role', ['facility-nurse', 'chw'])
          .eq('status', 'active'),

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
          .select('id, chw_id, child_id, visit_date, status, vaccines_administered, notes, users!inner(full_name, branch_id)')
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
        (s: any) => s.role === 'chw' && s.last_login_at && new Date(s.last_login_at) > oneDayAgo,
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
        .select('quantity_remaining, expiry_date, vaccines(name)')
        .eq('facility_id', branchId)
        .order('expiry_date', { ascending: true });

      const today = new Date();
      const ninetyDaysOut = new Date();
      ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

      // Aggregate quantities per vaccine name (there may be multiple batches)
      const stockMap = new Map<string, { remaining: number; earliestExpiry: Date }>();
      (stockRows ?? []).forEach((row: any) => {
        const vaccineName: string = (row.vaccines as any)?.name ?? 'Unknown';
        const remaining: number = row.quantity_remaining ?? 0;
        const expiry = new Date(row.expiry_date);
        const existing = stockMap.get(vaccineName);
        if (existing) {
          existing.remaining += remaining;
          if (expiry < existing.earliestExpiry) existing.earliestExpiry = expiry;
        } else {
          stockMap.set(vaccineName, { remaining, earliestExpiry: expiry });
        }
      });

      const stockAlerts = Array.from(stockMap.entries()).map(([vaccine, { remaining, earliestExpiry }]) => {
        const daysToExpiry = Math.ceil((earliestExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = earliestExpiry <= ninetyDaysOut;

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
          vaccine,
          remaining,
          status,
          daysToExpiry,
          expiryDate: earliestExpiry.toISOString().split('T')[0],
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

      // ── Step 13: Catchment coverage heatmap ───────────────────────────
      const catchments = catchmentRows.data ?? [];
      const catchmentCoverage = await this.computeCatchmentCoverage(db, catchments, branchId);

      // ── Step 14: Dropout analysis (Dose 1 vs Dose 3 for key vaccines) ─
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

    return {
      totalBranches: branchCount ?? 0,
      totalUsers: userCount ?? 0,
      childrenRegistered: childrenCount ?? 0,
      chwsActiveToday: activeChwCount ?? 0,
      totalChws: totalChwCount ?? 0,
      chwSyncPercentage,
    };
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
      .select('id, metadata')
      .eq('code', code.trim())
      .single();

    if (branchError || !branch) {
      throw new NotFoundException({
        message: `Branch not found: ${code}`,
        code: 'BRANCH_NOT_FOUND',
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

    await this.emailService.sendStaffInviteEmail(
      {
        email: normalizedEmail,
        name: dto.fullName.trim(),
        role: this.toDisplayRole(role),
      },
      temporaryPassword,
    );

    const users = await this.getHqUsers();
    return users.find((item) => item.id === createdUser.id);
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

  async registerStaff(branchId: string, dto: RegisterStaffDto) {
    const db = this.databaseService.supabase;
    const normalizedEmail = dto.email.trim().toLowerCase();

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
        phone_number: dto.phoneNumber,
        national_id: dto.nationalId ?? null,
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

    await this.emailService.sendStaffInviteEmail(
      { email: normalizedEmail, name: dto.fullName.trim(), role: dto.role },
      temporaryPassword,
    );

    // Don't return temporaryPassword in API response (security: could be logged by proxies)
    // The password is sent via email to the user
    return { id: created.id, email: created.email, emailSent: true };
  }

  async getStaffList(branchId: string, filters: { role?: string; status?: string; search?: string }) {
    const db = this.databaseService.supabase;
    let query = db
      .from('users')
      .select('id, full_name, email, phone_number, role, status, created_at')
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
    if (dto.phoneNumber) payload.phone_number = dto.phoneNumber;
    if (dto.nationalId !== undefined) payload.national_id = dto.nationalId;
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

    return (data ?? []).map((v: any) => ({
      ...v,
      schedules: scheduleMap.get(v.id) ?? [],
    }));
    return (data ?? []).map((v: any) => {
      const vaccineSchedules = scheduleMap.get(v.id) ?? [];
      const firstSchedule = vaccineSchedules[0];
      return {
        id: v.code, // Use code as ID for frontend compatibility
        dbId: v.id,
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
      ...c,
      branch_name: branchMap.get(c.branch_id) || null,
      assigned_chw_name: chwMap.get(c.assigned_chw_id) || null,
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
    return data ?? [];
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
