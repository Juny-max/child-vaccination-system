import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class PhaService {
  private readonly logger = new Logger(PhaService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Returns all data needed for the PHA national dashboard.
   * Only aggregated statistics are returned — no PII, no individual records.
   */
  async getDashboardData(timeRangeMonths = 12) {
    const db = this.databaseService.supabase;

    try {
      // ── Step 1: Look up vaccine IDs by canonical code (safe, non-hardcoded) ──
      const { data: vaccineRows } = await db
        .from('vaccines')
        .select('id, code')
        .in('code', ['VAC-PENTA1', 'VAC-PENTA3']);

      const penta1Id = vaccineRows?.find((v) => v.code === 'VAC-PENTA1')?.id ?? null;
      const penta3Id = vaccineRows?.find((v) => v.code === 'VAC-PENTA3')?.id ?? null;

      // ── Step 2: Run independent aggregate queries in parallel ──────────────
      const [
        childrenCount,
        dosesCount,
        aefiRows,
        penta1Rows,
        penta3Rows,
        allVaccinatedRows,
        branchRows,
      ] = await Promise.all([
        // Total children registered
        db.from('children').select('id', { count: 'exact', head: true }),

        // Total doses administered
        db
          .from('vaccination_events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),

        // AEFI: only severity field, no patient details returned
        db.from('aefi_reports').select('severity'),

        // Children who received Penta1 (for dropout numerator)
        penta1Id
          ? db
              .from('vaccination_events')
              .select('child_id')
              .eq('vaccine_id', penta1Id)
              .eq('status', 'completed')
              .limit(50000)
          : Promise.resolve({ data: [] }),

        // Children who received Penta3 (WHO benchmark vaccine)
        penta3Id
          ? db
              .from('vaccination_events')
              .select('child_id')
              .eq('vaccine_id', penta3Id)
              .eq('status', 'completed')
              .limit(50000)
          : Promise.resolve({ data: [] }),

        // All vaccinated children (for zero-dose calculation)
        db
          .from('vaccination_events')
          .select('child_id')
          .eq('status', 'completed')
          .limit(50000),

        // Active branches with region (no sensitive data)
        db
          .from('branches')
          .select('id, region')
          .eq('status', 'active'),
      ]);

      const totalChildren = childrenCount.count ?? 0;
      const totalDoses = dosesCount.count ?? 0;

      // ── Step 3: Compute KPI metrics ────────────────────────────────────────
      const penta1Set = new Set<string>(
        (penta1Rows.data ?? []).map((e: any) => e.child_id),
      );
      const penta3Set = new Set<string>(
        (penta3Rows.data ?? []).map((e: any) => e.child_id),
      );
      const vaccinatedSet = new Set<string>(
        (allVaccinatedRows.data ?? []).map((e: any) => e.child_id),
      );

      const penta3Count = penta3Set.size;
      const penta1Count = penta1Set.size;

      const penta3Coverage =
        totalChildren > 0
          ? parseFloat(((penta3Count / totalChildren) * 100).toFixed(1))
          : 0;

      const dropoutRate =
        penta1Count > 0
          ? parseFloat(
              (((penta1Count - penta3Count) / penta1Count) * 100).toFixed(1),
            )
          : 0;

      const zeroDoseChildren = Math.max(0, totalChildren - vaccinatedSet.size);

      // ── Step 4: AEFI summary ───────────────────────────────────────────────
      const aefiData = aefiRows.data ?? [];
      const aefiSummary = {
        total: aefiData.length,
        mild: aefiData.filter((a: any) => a.severity === 'mild').length,
        moderate: aefiData.filter((a: any) => a.severity === 'moderate').length,
        severe: aefiData.filter((a: any) =>
          ['severe', 'life-threatening'].includes(a.severity),
        ).length,
      };

      // ── Step 5: Penta3 coverage trend (monthly, all-time) ────────────────
      // No date cutoff — return every month that has data so the chart is
      // never empty regardless of how old the seed records are.
      // The frontend slices to the last N months based on the user's selection.
      const trendBaseQuery = db
        .from('vaccination_events')
        .select('administered_date, child_id')
        .eq('status', 'completed')
        .order('administered_date', { ascending: true })
        .limit(50000);

      const { data: trendRows } = await (penta3Id
        ? trendBaseQuery.eq('vaccine_id', penta3Id)
        : trendBaseQuery);

      const monthMap = new Map<string, Set<string>>();
      (trendRows ?? []).forEach((e: any) => {
        const d = new Date(e.administered_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap.has(key)) monthMap.set(key, new Set());
        monthMap.get(key)!.add(e.child_id);
      });

      const coverageTrend = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, childSet]) => {
          const [year, month] = key.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return {
            month: date.toLocaleDateString('en-GH', {
              month: 'short',
              year: 'numeric',
            }),
            coverage:
              totalChildren > 0
                ? parseFloat(
                    ((childSet.size / totalChildren) * 100).toFixed(1),
                  )
                : 0,
          };
        });

      // ── Step 6: Regional coverage ─────────────────────────────────────────
      const branchRegionMap = new Map<string, string>();
      (branchRows.data ?? []).forEach((b: any) => branchRegionMap.set(b.id, b.region));

      // Children registered per region (via primary_facility_id)
      const { data: childFacilityRows } = await db
        .from('children')
        .select('id, primary_facility_id')
        .not('primary_facility_id', 'is', null)
        .limit(50000);

      const regionTotalMap = new Map<string, number>();
      (childFacilityRows ?? []).forEach((c: any) => {
        const region = branchRegionMap.get(c.primary_facility_id);
        if (region) {
          regionTotalMap.set(region, (regionTotalMap.get(region) ?? 0) + 1);
        }
      });

      // Children vaccinated per region (via vaccination_events.facility_id)
      const { data: regionalVaxRows } = await db
        .from('vaccination_events')
        .select('child_id, facility_id')
        .eq('status', 'completed')
        .not('facility_id', 'is', null)
        .limit(50000);

      const regionVaxMap = new Map<string, Set<string>>();
      (regionalVaxRows ?? []).forEach((e: any) => {
        const region = branchRegionMap.get(e.facility_id);
        if (region) {
          if (!regionVaxMap.has(region)) regionVaxMap.set(region, new Set());
          regionVaxMap.get(region)!.add(e.child_id);
        }
      });

      // Build regional coverage array — always emit all 16 Ghana regions
      const GHANA_REGIONS = [
        'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
        'Volta', 'Oti', 'Bono', 'Bono East', 'Ahafo',
        'Northern', 'Savannah', 'North East', 'Upper East', 'Upper West', 'Western North',
      ];

      const regionalCoverage = GHANA_REGIONS.map((region) => {
        const vaccinated = regionVaxMap.get(region)?.size ?? 0;
        const total = regionTotalMap.get(region) ?? 0;
        const coverage =
          total > 0 ? parseFloat(((vaccinated / total) * 100).toFixed(1)) : 0;
        return { region, coverage };
      }).sort((a, b) => b.coverage - a.coverage);

      return {
        kpis: {
          totalChildrenRegistered: totalChildren,
          totalDosesAdministered: totalDoses,
          penta3Coverage,
          dropoutRate: Math.max(0, dropoutRate),
          zeroDoseChildren,
        },
        aefiSummary,
        coverageTrend,
        regionalCoverage,
      };
    } catch (error) {
      this.logger.error('PHA dashboard query failed', error);
      throw error;
    }
  }

  /**
   * Returns structured tabular data for a given PHA report type.
   * All responses contain only aggregated statistics — no PII.
   *
   * @param reportType  One of the 8 recognised PHA report identifiers
   * @param region      'All Regions' or a specific Ghana region name
   * @param from        Start date as YYYY-MM-DD
   * @param to          End date   as YYYY-MM-DD
   */
  async getReportData(
    reportType: string,
    region: string,
    from: string,
    to: string,
  ) {
    const db = this.databaseService.supabase;

    try {
      // ── Shared: load every active branch for region mapping ───────────────
      const { data: branches } = await db
        .from('branches')
        .select('id, name, region')
        .eq('status', 'active');

      const branchRegionMap = new Map<string, string>(
        (branches ?? []).map((b: any) => [b.id, b.region]),
      );
      const branchNameMap = new Map<string, string>(
        (branches ?? []).map((b: any) => [b.id, b.name]),
      );

      // Branch IDs that belong to the requested region (null = all regions)
      const regionBranchIds: string[] | null =
        region === 'All Regions'
          ? null
          : (branches ?? [])
              .filter((b: any) => b.region === region)
              .map((b: any) => b.id);

      // ── DROPOUT ANALYSIS ─────────────────────────────────────────────────
      if (reportType === 'dropout-analysis') {
        const { data: vaccineRows } = await db
          .from('vaccines')
          .select('id, code')
          .in('code', ['VAC-PENTA1', 'VAC-PENTA3']);

        const penta1Id = vaccineRows?.find((v: any) => v.code === 'VAC-PENTA1')?.id;
        const penta3Id = vaccineRows?.find((v: any) => v.code === 'VAC-PENTA3')?.id;

        let p1Q: any = db
          .from('vaccination_events')
          .select('child_id, facility_id')
          .eq('status', 'completed')
          .gte('administered_date', from)
          .lte('administered_date', to)
          .limit(50000);

        let p3Q: any = db
          .from('vaccination_events')
          .select('child_id, facility_id')
          .eq('status', 'completed')
          .gte('administered_date', from)
          .lte('administered_date', to)
          .limit(50000);

        if (penta1Id) p1Q = p1Q.eq('vaccine_id', penta1Id);
        if (penta3Id) p3Q = p3Q.eq('vaccine_id', penta3Id);
        if (regionBranchIds) {
          p1Q = p1Q.in('facility_id', regionBranchIds);
          p3Q = p3Q.in('facility_id', regionBranchIds);
        }

        const [{ data: p1Rows }, { data: p3Rows }] = await Promise.all([p1Q, p3Q]);

        const p1ByRegion = new Map<string, Set<string>>();
        const p3ByRegion = new Map<string, Set<string>>();

        (p1Rows ?? []).forEach((e: any) => {
          const r = branchRegionMap.get(e.facility_id) ?? 'Unknown';
          if (!p1ByRegion.has(r)) p1ByRegion.set(r, new Set());
          p1ByRegion.get(r)!.add(e.child_id);
        });
        (p3Rows ?? []).forEach((e: any) => {
          const r = branchRegionMap.get(e.facility_id) ?? 'Unknown';
          if (!p3ByRegion.has(r)) p3ByRegion.set(r, new Set());
          p3ByRegion.get(r)!.add(e.child_id);
        });

        const allRegions = new Set([...p1ByRegion.keys(), ...p3ByRegion.keys()]);
        const rows = Array.from(allRegions)
          .map((r) => {
            const dpt1 = p1ByRegion.get(r)?.size ?? 0;
            const dpt3 = p3ByRegion.get(r)?.size ?? 0;
            const dropoutRate =
              dpt1 > 0
                ? parseFloat((((dpt1 - dpt3) / dpt1) * 100).toFixed(1))
                : 0;
            return { region: r, dpt1Children: dpt1, dpt3Children: dpt3, dropoutRate };
          })
          .sort((a, b) => b.dropoutRate - a.dropoutRate);

        const avgDropoutRate =
          rows.length > 0
            ? parseFloat(
                (rows.reduce((s, r) => s + r.dropoutRate, 0) / rows.length).toFixed(1),
              )
            : 0;

        return {
          columns: [
            { key: 'region', label: 'Region' },
            { key: 'dpt1Children', label: 'DPT1 Children' },
            { key: 'dpt3Children', label: 'DPT3 Children' },
            { key: 'dropoutRate', label: 'Dropout Rate (%)' },
          ],
          rows,
          totalRows: rows.length,
          summary: { avgDropoutRate },
        };
      }

      // ── AEFI SURVEILLANCE ─────────────────────────────────────────────────
      if (reportType === 'aefi-surveillance') {
        // Resolve region from child's primary_facility_id (aefi_reports has no direct facility_id)
        let childQ: any = db
          .from('children')
          .select('id, primary_facility_id')
          .not('primary_facility_id', 'is', null)
          .limit(50000);
        if (regionBranchIds) childQ = childQ.in('primary_facility_id', regionBranchIds);

        const [{ data: childRows }, { data: aefiRows }] = await Promise.all([
          childQ,
          db
            .from('aefi_reports')
            .select('child_id, severity, onset_date')
            .gte('onset_date', from)
            .lte('onset_date', to)
            .limit(50000),
        ]);

        const childRegionMap = new Map<string, string>();
        (childRows ?? []).forEach((c: any) => {
          const r = branchRegionMap.get(c.primary_facility_id) ?? 'Unknown';
          childRegionMap.set(c.id, r);
        });

        const regionAefi = new Map<
          string,
          { mild: number; moderate: number; severe: number }
        >();
        (aefiRows ?? []).forEach((a: any) => {
          const r = childRegionMap.get(a.child_id);
          if (!r) return;
          if (!regionAefi.has(r)) regionAefi.set(r, { mild: 0, moderate: 0, severe: 0 });
          const entry = regionAefi.get(r)!;
          if (a.severity === 'mild') entry.mild++;
          else if (a.severity === 'moderate') entry.moderate++;
          else if (['severe', 'life-threatening'].includes(a.severity)) entry.severe++;
        });

        const rows = Array.from(regionAefi.entries())
          .map(([region, c]) => ({
            region,
            mild: c.mild,
            moderate: c.moderate,
            severe: c.severe,
            total: c.mild + c.moderate + c.severe,
          }))
          .sort((a, b) => b.total - a.total);

        const totalAefiReports = rows.reduce((s, r) => s + r.total, 0);
        const severeReports = rows.reduce((s, r) => s + r.severe, 0);

        return {
          columns: [
            { key: 'region', label: 'Region' },
            { key: 'mild', label: 'Mild' },
            { key: 'moderate', label: 'Moderate' },
            { key: 'severe', label: 'Severe' },
            { key: 'total', label: 'Total Reports' },
          ],
          rows,
          totalRows: rows.length,
          summary: { totalAefiReports, severeReports },
        };
      }

      // ── CERTIFICATE ISSUANCE ──────────────────────────────────────────────
      if (reportType === 'certificate-issuance') {
        let certQ: any = db
          .from('certificates')
          .select('child_id, issued_by_facility_id, issued_date')
          .eq('status', 'issued')
          .gte('issued_date', from)
          .lte('issued_date', to)
          .limit(50000);
        if (regionBranchIds)
          certQ = certQ.in('issued_by_facility_id', regionBranchIds);

        const { data: certRows } = await certQ;

        // Group by region × month
        const certMap = new Map<string, number>();
        (certRows ?? []).forEach((c: any) => {
          const r = branchRegionMap.get(c.issued_by_facility_id) ?? 'Unknown';
          const d = new Date(c.issued_date);
          const key = `${r}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          certMap.set(key, (certMap.get(key) ?? 0) + 1);
        });

        const rows = Array.from(certMap.entries())
          .map(([key, count]) => {
            const [region, monthKey] = key.split('|');
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return {
              region,
              month: date.toLocaleDateString('en-GH', {
                month: 'short',
                year: 'numeric',
              }),
              certificatesIssued: count,
            };
          })
          .sort((a, b) => a.region.localeCompare(b.region));

        const totalCertificates = rows.reduce((s, r) => s + r.certificatesIssued, 0);

        return {
          columns: [
            { key: 'region', label: 'Region' },
            { key: 'month', label: 'Month' },
            { key: 'certificatesIssued', label: 'Certificates Issued' },
          ],
          rows,
          totalRows: rows.length,
          summary: { totalCertificates },
        };
      }

      // ── FACILITY PERFORMANCE ──────────────────────────────────────────────
      if (reportType === 'facility-performance') {
        let childQ: any = db
          .from('children')
          .select('id, primary_facility_id')
          .not('primary_facility_id', 'is', null)
          .limit(50000);
        let eventQ: any = db
          .from('vaccination_events')
          .select('child_id, facility_id')
          .eq('status', 'completed')
          .gte('administered_date', from)
          .lte('administered_date', to)
          .limit(50000);

        if (regionBranchIds) {
          childQ = childQ.in('primary_facility_id', regionBranchIds);
          eventQ = eventQ.in('facility_id', regionBranchIds);
        }

        const [{ data: childRows }, { data: eventRows }] = await Promise.all([
          childQ,
          eventQ,
        ]);

        const facilityChildMap = new Map<string, number>();
        (childRows ?? []).forEach((c: any) => {
          facilityChildMap.set(
            c.primary_facility_id,
            (facilityChildMap.get(c.primary_facility_id) ?? 0) + 1,
          );
        });

        const facilityDosesMap = new Map<string, number>();
        const facilityVaxSet = new Map<string, Set<string>>();
        (eventRows ?? []).forEach((e: any) => {
          facilityDosesMap.set(
            e.facility_id,
            (facilityDosesMap.get(e.facility_id) ?? 0) + 1,
          );
          if (!facilityVaxSet.has(e.facility_id))
            facilityVaxSet.set(e.facility_id, new Set());
          facilityVaxSet.get(e.facility_id)!.add(e.child_id);
        });

        const allFacilities = new Set([
          ...facilityChildMap.keys(),
          ...facilityDosesMap.keys(),
        ]);

        const rows = Array.from(allFacilities)
          .map((fid) => {
            const total = facilityChildMap.get(fid) ?? 0;
            const doses = facilityDosesMap.get(fid) ?? 0;
            const vaccinated = facilityVaxSet.get(fid)?.size ?? 0;
            const coverage =
              total > 0 ? parseFloat(((vaccinated / total) * 100).toFixed(1)) : 0;
            return {
              facility: branchNameMap.get(fid) ?? fid,
              region: branchRegionMap.get(fid) ?? 'Unknown',
              totalChildren: total,
              dosesAdministered: doses,
              vaccinatedChildren: vaccinated,
              coverage,
            };
          })
          .sort((a, b) => b.coverage - a.coverage);

        const avgCoverage =
          rows.length > 0
            ? parseFloat(
                (rows.reduce((s, r) => s + r.coverage, 0) / rows.length).toFixed(1),
              )
            : 0;

        return {
          columns: [
            { key: 'facility', label: 'Facility' },
            { key: 'region', label: 'Region' },
            { key: 'totalChildren', label: 'Total Children' },
            { key: 'dosesAdministered', label: 'Doses Administered' },
            { key: 'vaccinatedChildren', label: 'Vaccinated Children' },
            { key: 'coverage', label: 'Coverage (%)' },
          ],
          rows,
          totalRows: rows.length,
          summary: { avgCoverage },
        };
      }

      // ── VACCINE UTILISATION ───────────────────────────────────────────────
      if (reportType === 'vaccine-stock') {
        const { data: vaccines } = await db
          .from('vaccines')
          .select('id, code, name')
          .order('name');

        let eventQ: any = db
          .from('vaccination_events')
          .select('vaccine_id, child_id, facility_id')
          .eq('status', 'completed')
          .gte('administered_date', from)
          .lte('administered_date', to)
          .limit(50000);
        if (regionBranchIds) eventQ = eventQ.in('facility_id', regionBranchIds);

        const { data: eventRows } = await eventQ;

        const vaccineAdminMap = new Map<string, number>();
        const vaccineChildMap = new Map<string, Set<string>>();
        (eventRows ?? []).forEach((e: any) => {
          vaccineAdminMap.set(
            e.vaccine_id,
            (vaccineAdminMap.get(e.vaccine_id) ?? 0) + 1,
          );
          if (!vaccineChildMap.has(e.vaccine_id))
            vaccineChildMap.set(e.vaccine_id, new Set());
          vaccineChildMap.get(e.vaccine_id)!.add(e.child_id);
        });

        const rows = (vaccines ?? [])
          .map((v: any) => ({
            vaccine: v.name,
            code: v.code,
            dosesAdministered: vaccineAdminMap.get(v.id) ?? 0,
            uniqueChildren: vaccineChildMap.get(v.id)?.size ?? 0,
          }))
          .sort((a: any, b: any) => b.dosesAdministered - a.dosesAdministered);

        const totalDosesAdministered = rows.reduce(
          (s: number, r: any) => s + r.dosesAdministered,
          0,
        );

        return {
          columns: [
            { key: 'vaccine', label: 'Vaccine' },
            { key: 'code', label: 'Code' },
            { key: 'dosesAdministered', label: 'Doses Administered' },
            { key: 'uniqueChildren', label: 'Unique Children' },
          ],
          rows,
          totalRows: rows.length,
          summary: { totalDosesAdministered },
        };
      }

      // ── DEFAULT: national-coverage / regional-coverage / who-monthly ──────
      const { data: vaccines } = await db
        .from('vaccines')
        .select('id, name')
        .order('name');

      let childQ: any = db
        .from('children')
        .select('id, primary_facility_id')
        .not('primary_facility_id', 'is', null)
        .limit(50000);

      // Coverage is a cumulative metric: a child vaccinated any time in the past
      // is still "vaccinated" today.  Only WHO-Monthly uses a date window because
      // it summarises doses administered in that specific period.
      let eventQ: any = db
        .from('vaccination_events')
        .select('child_id, vaccine_id, facility_id')
        .eq('status', 'completed')
        .limit(50000);
      if (reportType === 'who-monthly') {
        eventQ = eventQ.gte('administered_date', from).lte('administered_date', to);
      }

      if (regionBranchIds) {
        childQ = childQ.in('primary_facility_id', regionBranchIds);
        // eventQ region scoping is handled via inScopeChildIds (child's primary facility),
        // so no facility_id filter is applied on events for coverage reports.
      }

      const [{ data: childRows }, { data: eventRows }] = await Promise.all([
        childQ,
        eventQ,
      ]);

      // Build region counts AND a child → primary_facility lookup in one pass.
      // Both the denominator and the numerator use the child's registered facility
      // so that coverage is always attributed to the region where the child lives,
      // regardless of which specific clinic administered the dose.
      const regionChildMap = new Map<string, number>();
      const childFacilityMap = new Map<string, string>(); // child_id → primary_facility_id
      (childRows ?? []).forEach((c: any) => {
        const r = branchRegionMap.get(c.primary_facility_id) ?? 'Unknown';
        regionChildMap.set(r, (regionChildMap.get(r) ?? 0) + 1);
        childFacilityMap.set(c.id, c.primary_facility_id);
      });

      // Set of in-scope child IDs (respects region filter applied via childQ)
      const inScopeChildIds = new Set(childFacilityMap.keys());

      // Vaccinated children per vaccine per region — region attributed via
      // the child's primary facility, NOT the event's facility_id.
      const vaxMap = new Map<string, Map<string, Set<string>>>();
      (eventRows ?? []).forEach((e: any) => {
        if (!inScopeChildIds.has(e.child_id)) return; // out-of-region child
        const facilityId = childFacilityMap.get(e.child_id) ?? e.facility_id;
        const r = branchRegionMap.get(facilityId) ?? 'Unknown';
        if (!vaxMap.has(e.vaccine_id)) vaxMap.set(e.vaccine_id, new Map());
        const rMap = vaxMap.get(e.vaccine_id)!;
        if (!rMap.has(r)) rMap.set(r, new Set());
        rMap.get(r)!.add(e.child_id);
      });

      const rows: any[] = [];
      for (const vaccine of (vaccines ?? []) as any[]) {
        const rMap = vaxMap.get(vaccine.id) ?? new Map();
        for (const [region, total] of regionChildMap) {
          const vaccinated = rMap.get(region)?.size ?? 0;
          const coverage =
            total > 0 ? parseFloat(((vaccinated / total) * 100).toFixed(1)) : 0;
          rows.push({ region, vaccine: vaccine.name, vaccinated, totalChildren: total, coverage });
        }
      }
      rows.sort(
        (a, b) =>
          a.region.localeCompare(b.region) || a.vaccine.localeCompare(b.vaccine),
      );

      const avgCoverage =
        rows.length > 0
          ? parseFloat(
              (rows.reduce((s, r) => s + r.coverage, 0) / rows.length).toFixed(1),
            )
          : 0;

      return {
        columns: [
          { key: 'region', label: 'Region' },
          { key: 'vaccine', label: 'Vaccine' },
          { key: 'vaccinated', label: 'Vaccinated' },
          { key: 'totalChildren', label: 'Total Children' },
          { key: 'coverage', label: 'Coverage (%)' },
        ],
        rows,
        totalRows: rows.length,
        summary: { avgCoverage },
      };
    } catch (error) {
      this.logger.error('PHA getReportData failed', error);
      throw error;
    }
  }

  /**
   * Verify a single vaccination certificate by its certificate_id string.
   * Returns only non-PII fields — no child name, DOB, or parent contact.
   */
  async verifyCertificate(certificateId: string) {
    const db = this.databaseService.supabase;

    // TEMP- prefixed IDs are synthetic placeholders generated by the parent
    // portal for children who are registered but have not yet had a formal
    // certificate issued. Strip the prefix and look up the child directly.
    if (certificateId.startsWith('TEMP-')) {
      const cvccId = certificateId.slice(5); // strip "TEMP-"
      const { data: child, error: childError } = await db
        .from('children')
        .select('cvcc_id, is_active')
        .eq('cvcc_id', cvccId)
        .single();

      if (childError || !child) {
        return { found: false, certificateId };
      }

      // Child exists but no formal certificate yet — vaccination in progress
      return {
        found: true,
        isValid: false,
        isPending: true,
        certificateId,
        childCvccId: child.cvcc_id,
      };
    }

    const { data, error } = await db
      .from('certificates')
      .select(
        'certificate_id, issued_date, completion_status, vaccines_completed, status, issued_by_facility_id, branches!issued_by_facility_id(name, region)',
      )
      .eq('certificate_id', certificateId)
      .single();

    if (error || !data) {
      // No certificate found — check if a child with this CVCC ID exists.
      // If so, they are registered but vaccination is still in progress.
      const { data: child, error: childError } = await db
        .from('children')
        .select('cvcc_id, is_active')
        .eq('cvcc_id', certificateId)
        .single();

      if (!childError && child) {
        return {
          found: true,
          isValid: false,
          isPending: true,
          certificateId,
          childCvccId: child.cvcc_id,
        };
      }

      return { found: false, certificateId };
    }

    // Revoked / expired certificates are not valid
    const isValid = data.status === 'issued';

    const branches: any = data.branches;
    const facilityName = Array.isArray(branches)
      ? branches[0]?.name ?? 'Unknown Facility'
      : branches?.name ?? 'Unknown Facility';
    const region = Array.isArray(branches)
      ? branches[0]?.region ?? 'Unknown Region'
      : branches?.region ?? 'Unknown Region';

    return {
      found: true,
      isValid,
      certificateId: data.certificate_id,
      issuedDate: data.issued_date,
      completionStatus: data.completion_status,
      vaccinesCompleted: data.vaccines_completed ?? [],
      issuedBy: facilityName,
      region,
      status: data.status,
    };
  }
}
