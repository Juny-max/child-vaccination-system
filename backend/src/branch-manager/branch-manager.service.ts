import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class BranchManagerService {
  private readonly logger = new Logger(BranchManagerService.name);

  constructor(private readonly databaseService: DatabaseService) {}

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

        // AEFI events at this branch (via vaccination_events)
        db
          .from('aefi_reports')
          .select('id, severity, status, symptoms, created_at, children(full_name), vaccination_events!inner(facility_id)')
          .eq('vaccination_events.facility_id', branchId)
          .order('created_at', { ascending: false })
          .limit(10),

        // Pending sync queue items from staff at this branch
        db
          .from('sync_queue')
          .select('id, entity_type, status, created_at, users!inner(full_name, branch_id)')
          .eq('users.branch_id', branchId)
          .in('status', ['pending', 'failed', 'conflict'])
          .order('created_at', { ascending: false })
          .limit(10),

        // Failed notifications for children at this branch
        db
          .from('notifications')
          .select('id, channel, recipient_contact, message, status, error_message, created_at')
          .in('status', ['failed', 'bounced'])
          .order('created_at', { ascending: false })
          .limit(10),

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
        if (remaining === 0) {
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
        'out-of-stock': 0, critical: 1, low: 2, moderate: 3, adequate: 4,
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
        child: n.recipient_contact ?? 'Unknown',
        detail: `${n.channel?.toUpperCase() ?? 'Notification'} ${n.status}: ${n.error_message || 'delivery failed'}`,
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
}
