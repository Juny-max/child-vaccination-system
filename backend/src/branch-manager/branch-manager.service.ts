import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { EmailService } from '../common/email.service';
import { CreateHqBranchDto, UpdateHqBranchDto } from './hq-branches.dto';
import {
  CreateHqUserDto,
  HqUserStatus,
  UpdateHqUserDto,
} from './hq-users.dto';

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
      throw new Error(`Failed to load branches: ${branchError.message}`);
    }

    const branchIds = (branches ?? []).map((branch: any) => branch.id);
    const { data: catchments, error: catchmentError } = branchIds.length
      ? await db
          .from('catchment_areas')
          .select('branch_id, name')
          .in('branch_id', branchIds)
      : { data: [], error: null as any };

    if (catchmentError) {
      throw new Error(`Failed to load catchment areas: ${catchmentError.message}`);
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

  async createHqBranch(dto: CreateHqBranchDto) {
    const db = this.databaseService.supabase;
    const normalizedCatchments = this.normalizeUniqueValues(dto.catchmentAreas);

    if (!normalizedCatchments.length) {
      throw new Error('At least one catchment area is required');
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
      throw new Error(`Failed to create branch: ${createError?.message ?? 'unknown error'}`);
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
      throw new Error('At least one catchment area is required');
    }

    const { data: currentBranch, error: currentError } = await db
      .from('branches')
      .select('id, metadata')
      .eq('code', normalizedCode)
      .single();

    if (currentError || !currentBranch) {
      throw new Error(`Branch not found: ${normalizedCode}`);
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
      throw new Error(`Failed to update branch: ${updateError.message}`);
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

    if (branchError || !branch) {
      throw new Error(`Failed to update branch status: ${branchError?.message ?? 'branch not found'}`);
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
      throw new Error(`Branch not found: ${code}`);
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
      throw new Error(`Failed to update CHW assignment: ${updateError.message}`);
    }

    const [fullBranch] = await this.getHqBranches().then((rows) => rows.filter((row) => row.dbId === branch.id));
    return fullBranch;
  }

  async getHqUsers() {
    const db = this.databaseService.supabase;

    const { data, error } = await db
      .from('users')
      .select('id, full_name, email, role, status, branch_id, branches(name, code)')
      .in('role', ['hq-admin', 'branch-manager', 'facility-nurse', 'chw', 'data-officer', 'pha'])
      .order('full_name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Failed to load users: ${error.message}`);
    }

    return (data ?? []).map((user: any) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: this.toDisplayRole(user.role),
      branch: user.branches?.name ?? undefined,
      status: user.status === 'inactive' ? 'inactive' : 'active',
    }));
  }

  async createHqUser(dto: CreateHqUserDto) {
    const db = this.databaseService.supabase;
    const normalizedEmail = dto.email.trim().toLowerCase();
    const role = this.toStorageRole(dto.role);
    const branchId = await this.resolveBranchId(dto.branch);

    const { data: existing, error: existingError } = await db
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingError) {
      throw new InternalServerErrorException(
        `Failed to validate user email: ${existingError.message}`,
      );
    }

    if (existing) {
      throw new ConflictException(`User with email ${normalizedEmail} already exists`);
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = this.hashPassword(temporaryPassword);

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
        `Failed to create user: ${createError?.message ?? 'unknown error'}`,
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

  async updateHqUser(userId: string, dto: UpdateHqUserDto) {
    const db = this.databaseService.supabase;
    const branchId = await this.resolveBranchId(dto.branch);

    const payload: Record<string, any> = {};
    if (dto.fullName !== undefined) payload.full_name = dto.fullName.trim();
    if (dto.email !== undefined) payload.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) payload.role = this.toStorageRole(dto.role);
    if (dto.branch !== undefined) payload.branch_id = branchId;

    const { data: updated, error } = await db
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id')
      .single();

    if (error || !updated) {
      if (error?.code === 'PGRST116' || !updated) {
        throw new NotFoundException('User not found');
      }
      const message = (error as any)?.message ?? 'unknown error';
      throw new BadRequestException(`Failed to update user: ${message}`);
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
        throw new NotFoundException('User not found');
      }
      const message = (error as any)?.message ?? 'unknown error';
      throw new BadRequestException(
        `Failed to update user status: ${message}`,
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
      throw new NotFoundException(`User not found for email ${normalizedEmail}`);
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = this.hashPassword(temporaryPassword);

    const { error: updateError } = await db
      .from('users')
      .update({
        password_hash: passwordHash,
        must_change_password: true,
      })
      .eq('id', user.id);

    if (updateError) {
      throw new BadRequestException(`Failed to reset password: ${updateError.message}`);
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

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private toStorageRole(role: string): string {
    const roleMap: Record<string, string> = {
      'HQ Admin': 'hq-admin',
      'Branch Manager': 'branch-manager',
      'Facility Nurse': 'facility-nurse',
      'Community Health Worker': 'chw',
      'Data Officer': 'data-officer',
      'Public Health Authority': 'pha',
      'hq-admin': 'hq-admin',
      'branch-manager': 'branch-manager',
      'facility-nurse': 'facility-nurse',
      chw: 'chw',
      'data-officer': 'data-officer',
      pha: 'pha',
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
      throw new InternalServerErrorException(`Failed to resolve branch: ${codeError.message}`);
    }

    if (branchByCode) return branchByCode.id;

    const { data: branchByName, error: nameError } = await db
      .from('branches')
      .select('id')
      .eq('name', normalized)
      .maybeSingle();

    if (nameError) {
      throw new InternalServerErrorException(`Failed to resolve branch: ${nameError.message}`);
    }

    if (!branchByName) {
      throw new NotFoundException(`Branch "${normalized}" not found`);
    }

    return branchByName.id;
  }

  private async generateNextBranchCode(): Promise<string> {
    const db = this.databaseService.supabase;
    const { data: rows, error } = await db
      .from('branches')
      .select('code');

    if (error) {
      throw new Error(`Failed to generate branch code: ${error.message}`);
    }

    const maxCode = (rows ?? []).reduce((highest: number, row: any) => {
      const parsed = Number.parseInt(String(row.code ?? '').replace('BR-', ''), 10);
      return Number.isNaN(parsed) ? highest : Math.max(highest, parsed);
    }, 0);

    return `BR-${String(maxCode + 1).padStart(3, '0')}`;
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
      throw new Error(`Failed to clear catchment areas: ${deleteError.message}`);
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
      throw new Error(`Failed to save catchment areas: ${insertError.message}`);
    }
  }
}
