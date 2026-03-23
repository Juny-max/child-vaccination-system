import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  SyncCHWVaccinationsDto,
  SyncResultDto,
  CHWVaccinationDto,
} from './dto';

type ChwOfflineChild = {
  id: string;
  cvccId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  primaryFacilityId?: string;
  catchmentAreaId: string;
  guardianName?: string;
  guardianPhone?: string;
  updatedAt: string;
};

type AssignedChild = {
  id: string;
  cvccId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  primaryFacilityId?: string;
  guardianName?: string;
  guardianPhone?: string;
  village?: string;
  catchmentAreaId: string;
};

@Injectable()
export class ChwService {
  private readonly logger = new Logger(ChwService.name);

  constructor(private readonly db: DatabaseService) {}

  private toChildArray(rawChild: any): any[] {
    if (!rawChild) {
      return [];
    }
    return Array.isArray(rawChild) ? rawChild : [rawChild];
  }

  private readVaccineName(vaccine: any): string | undefined {
    if (Array.isArray(vaccine)) {
      return vaccine[0]?.name;
    }
    return vaccine?.name;
  }

  private readVaccineId(vaccine: any): string | undefined {
    if (Array.isArray(vaccine)) {
      return vaccine[0]?.id;
    }
    return vaccine?.id;
  }

  private toReadableDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private toAgeLabel(dateOfBirth: string): string {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    const months = Math.max(
      0,
      (now.getFullYear() - dob.getFullYear()) * 12 +
        (now.getMonth() - dob.getMonth()),
    );

    if (months < 24) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }

    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'}`;
  }

  private async getAssignedChildren(chwUserId: string): Promise<AssignedChild[]> {
    this.logger.debug('[CHW getAssignedChildren] Fetching assigned catchments');
    
    const { data: catchments, error: catchmentError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, community')
      .eq('assigned_chw_id', chwUserId);

    if (catchmentError) {
      throw new BadRequestException(catchmentError.message);
    }

    this.logger.debug(`[CHW getAssignedChildren] Found ${(catchments || []).length} catchment areas`);

    const catchmentIds = (catchments || []).map((item: any) => item.id);
    const catchmentMap = new Map<string, string | undefined>(
      (catchments || []).map((item: any) => [item.id, item.community]),
    );

    if (catchmentIds.length === 0) {
      this.logger.debug('[CHW getAssignedChildren] No catchments found');
      return [];
    }

    const { data: guardians, error: guardiansError } = await this.db.supabase
      .from('guardians')
      .select(`
        id,
        full_name,
        phone_primary,
        community,
        city,
        catchment_area_id,
        child_guardian (
          is_primary,
          children (
            id,
            cvcc_id,
            full_name,
            date_of_birth,
            gender,
            primary_facility_id
          )
        )
      `)
      .in('catchment_area_id', catchmentIds);

    if (guardiansError) {
      throw new BadRequestException(guardiansError.message);
    }

    this.logger.debug(`[CHW getAssignedChildren] Found ${(guardians || []).length} guardians`);

    const deduped = new Map<string, AssignedChild>();

    (guardians || []).forEach((guardian: any) => {
      const links = Array.isArray(guardian.child_guardian)
        ? guardian.child_guardian
        : [];

      links.forEach((link: any) => {
        const children = this.toChildArray(link?.children);
        children.forEach((child: any) => {
          if (!child?.id) return;

          if (!deduped.has(child.id) || link.is_primary) {
            deduped.set(child.id, {
              id: child.id,
              cvccId: child.cvcc_id,
              fullName: child.full_name,
              dateOfBirth: child.date_of_birth,
              gender: child.gender,
              primaryFacilityId: child.primary_facility_id || undefined,
              guardianName: guardian.full_name || undefined,
              guardianPhone: guardian.phone_primary || undefined,
              village:
                guardian.community ||
                catchmentMap.get(guardian.catchment_area_id) ||
                guardian.city ||
                undefined,
              catchmentAreaId: guardian.catchment_area_id,
            });
          }
        });
      });
    });

    this.logger.debug(`[CHW getAssignedChildren] Found ${deduped.size} unique children`);

    return Array.from(deduped.values());
  }

  async getDashboardSummary(chwUserId: string) {
    const assignedChildren = await this.getAssignedChildren(chwUserId);

    const visitCandidates = assignedChildren.slice(0, 5);
    const visits = await Promise.all(
      visitCandidates.map(async (child, index) => {
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.dateOfBirth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccine = this.readVaccineName(next?.vaccine);

        return {
          id: `VIS-${index + 1}`,
          childId: child.id,
          childName: child.fullName,
          vaccineDue: nextVaccine || 'Review chart',
          householdLocation: child.village || 'Assigned catchment',
          distanceKm: Number((1 + index * 0.8).toFixed(1)),
        };
      }),
    );

    const { count: pendingQueueCount } = await this.db.supabase
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', chwUserId)
      .in('status', ['pending', 'failed']);

    return {
      totalAssignedChildren: assignedChildren.length,
      pendingQueueCount: pendingQueueCount || 0,
      visits,
      fetchedAt: new Date().toISOString(),
    };
  }

  async searchChildren(query: string, chwUserId: string) {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const assignedChildren = await this.getAssignedChildren(chwUserId);

    // Debug logging disabled for security (no PII logging)
    // const log = { user: chwUserId, query, count: assignedChildren.length };

    const matches = assignedChildren.filter((child) => {
      return (
        child.fullName.toLowerCase().includes(normalized) ||
        child.cvccId.toLowerCase().includes(normalized) ||
        (child.guardianName || '').toLowerCase().includes(normalized) ||
        (child.guardianPhone || '').replace(/\s+/g, '').includes(normalized.replace(/\s+/g, ''))
      );
    });

    return Promise.all(
      matches.slice(0, 20).map(async (child) => {
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.dateOfBirth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccineName = this.readVaccineName(next?.vaccine);

        return {
          id: child.id,
          childId: child.cvccId,
          childName: child.fullName,
          motherName: child.guardianName || 'Unknown',
          motherPhone: child.guardianPhone || 'N/A',
          nextVaccine: nextVaccineName || 'Review chart',
          village: child.village || 'Assigned catchment',
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
        };
      }),
    );
  }

  /**
   * Search all children without catchment restriction
   * Used when CHW is online and can help children from any area
   */
  async searchAllChildren(query: string, chwUserId: string) {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    this.logger.debug('[CHW Search All] Starting search');

    // Strategy 1: Search children by name or CVCC ID
    const { data: childrenByName, error: nameError } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        child_guardian!inner (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary,
            community,
            city,
            catchment_area_id
          )
        )
      `)
      .or(`full_name.ilike.%${normalized}%,cvcc_id.ilike.%${normalized}%`)
      .limit(20);

    if (nameError) {
      throw new BadRequestException(nameError.message);
    }

    // Strategy 2: Search guardians by phone, then get their children
    const phoneNormalized = normalized.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    this.logger.debug('[CHW Search All] Searching by phone');
    
    const { data: guardiansByPhone, error: phoneError } = await this.db.supabase
      .from('guardians')
      .select(`
        id,
        full_name,
        phone_primary,
        community,
        city,
        catchment_area_id,
        child_guardian!inner (
          is_primary,
          children (
            id,
            cvcc_id,
            full_name,
            date_of_birth,
            gender,
            primary_facility_id
          )
        )
      `)
      .ilike('phone_primary', `%${phoneNormalized}%`)
      .limit(20);

    if (phoneError) {
      console.error('[CHW Search All] Phone search error:', phoneError);
    } else {
      // Debug logging disabled for security (no phone number logging)
      // const guardianCount = (guardiansByPhone || []).length;
    }

    // Combine results and deduplicate by child ID
    const childrenMap = new Map();

    // Add children from name search
    (childrenByName || []).forEach((child: any) => {
      if (!childrenMap.has(child.id)) {
        childrenMap.set(child.id, child);
      }
    });

    // Add children from phone search
    (guardiansByPhone || []).forEach((guardian: any) => {
      const guardianLinks = Array.isArray(guardian.child_guardian)
        ? guardian.child_guardian
        : [];
      guardianLinks.forEach((link: any) => {
        const child = Array.isArray(link.children) ? link.children[0] : link.children;
        if (child && !childrenMap.has(child.id)) {
          // Reconstruct child object with guardian data
          childrenMap.set(child.id, {
            ...child,
            child_guardian: [{
              is_primary: link.is_primary,
              guardians: {
                id: guardian.id,
                full_name: guardian.full_name,
                phone_primary: guardian.phone_primary,
                community: guardian.community,
                city: guardian.city,
                catchment_area_id: guardian.catchment_area_id,
              }
            }]
          });
        }
      });
    });

    const childrenWithGuardians = Array.from(childrenMap.values()).slice(0, 20);

    this.logger.debug(`[CHW Search All] Search returned ${childrenWithGuardians.length} results`);

    // Pre-fetch child catchment info for all children at once
    const childIds = Array.from(childrenMap.keys());
    const { data: childrenWithCatchment } = await this.db.supabase
      .from('children')
      .select('id, catchment_area_id')
      .in('id', childIds);

    const childCatchmentMap = new Map(
      (childrenWithCatchment || []).map((c: any) => [c.id, c.catchment_area_id])
    );

    // Pre-fetch all catchment area names
    const catchmentIds = [...new Set(
      (childrenWithCatchment || [])
        .map((c: any) => c.catchment_area_id)
        .filter(Boolean)
    )];

    let catchmentNameMap = new Map<string, { name: string; branchId: string }>();
    if (catchmentIds.length > 0) {
      const { data: catchments } = await this.db.supabase
        .from('catchment_areas')
        .select('id, name, branch_id')
        .in('id', catchmentIds);
      catchmentNameMap = new Map(
        (catchments || []).map((c: any) => [c.id, { name: c.name, branchId: c.branch_id }])
      );
    }

    const results = await Promise.all(
      (childrenWithGuardians || []).map(async (child: any) => {
        // Find primary guardian
        const guardianLinks = Array.isArray(child.child_guardian)
          ? child.child_guardian
          : [];
        const primaryLink = guardianLinks.find((link: any) => link.is_primary);
        const guardianData = Array.isArray(primaryLink?.guardians)
          ? primaryLink.guardians[0]
          : primaryLink?.guardians;

        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.date_of_birth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccineName = this.readVaccineName(next?.vaccine);

        // Get child's direct catchment_area_id (for pull transfer)
        const childCatchmentId = childCatchmentMap.get(child.id);
        const catchmentInfo = childCatchmentId ? catchmentNameMap.get(childCatchmentId) : null;

        return {
          id: child.id,
          childId: child.cvcc_id,
          childName: child.full_name,
          motherName: guardianData?.full_name || 'Unknown',
          motherPhone: guardianData?.phone_primary || 'N/A',
          nextVaccine: nextVaccineName || 'Review chart',
          village: guardianData?.community || guardianData?.city || 'Unknown',
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          // Include child's direct catchment info for pull transfer decision
          catchmentAreaId: childCatchmentId || null,
          currentZoneName: catchmentInfo?.name || null,
          currentBranchId: catchmentInfo?.branchId || null,
        };
      }),
    );

    return results;
  }

  /**
   * Search mothers/guardians directly by name or phone
   * Used by CHW minimal registration autocomplete
   */
  async searchMothers(query: string) {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const compact = normalized.replace(/\s+/g, '');

    const { data, error } = await this.db.supabase
      .from('guardians')
      .select('id, full_name, phone_primary')
      .or(`full_name.ilike.%${normalized}%,phone_primary.ilike.%${compact}%`)
      .limit(10);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((guardian: any) => ({
      id: guardian.id,
      name: guardian.full_name,
      phone: guardian.phone_primary || '',
    }));
  }

  async getChildChart(childId: string, chwUserId: string) {
    const assignedChildren = await this.getAssignedChildren(chwUserId);
    const child = assignedChildren.find((entry) => entry.id === childId);

    if (!child) {
      throw new NotFoundException('Child not found in your assigned catchment');
    }

    const history = await this.db.getVaccinationHistory(child.id);
    const upcoming = await this.db.getUpcomingVaccinations(
      child.id,
      child.dateOfBirth,
    );

    return {
      id: child.id,
      name: child.fullName,
      age: this.toAgeLabel(child.dateOfBirth),
      motherName: child.guardianName || 'Unknown',
      motherPhone: child.guardianPhone || 'N/A',
      village: child.village || 'Assigned catchment',
      outstandingVaccines: (upcoming || []).map((item: any) => ({
        id: `${this.readVaccineId(item.vaccine) || item.dose_number}-${item.dose_number}`,
        name: this.readVaccineName(item.vaccine) || 'Scheduled vaccine',
        status: item.isOverdue ? 'overdue' : 'due',
        scheduledDate: this.toReadableDate(item.dueDate),
      })),
      history: (history || []).map((event: any) => ({
        id: event.id,
        name: this.readVaccineName(event.vaccine) || 'Vaccine',
        status: 'completed',
        scheduledDate: this.toReadableDate(event.administered_date),
        administeredDate: this.toReadableDate(event.administered_date),
      })),
    };
  }

  /**
   * Get child chart without catchment restriction
   * Used when CHW is online and can help children from any area
   */
  async getChildChartAll(childId: string, chwUserId: string) {
    this.logger.debug('[CHW Chart All] Fetching child chart');

    // Get child data without catchment filter
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        child_guardian!inner (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary,
            community,
            city,
            catchment_area_id
          )
        )
      `)
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException('Child not found');
    }

    // Find primary guardian
    const guardianLinks = Array.isArray(child.child_guardian)
      ? child.child_guardian
      : [];
    const primaryLink = guardianLinks.find((link: any) => link.is_primary);
    const guardianData = Array.isArray(primaryLink?.guardians)
      ? primaryLink.guardians[0]
      : primaryLink?.guardians;

    const history = await this.db.getVaccinationHistory(child.id);
    const upcoming = await this.db.getUpcomingVaccinations(
      child.id,
      child.date_of_birth,
    );

    this.logger.debug('[CHW Chart All] Child chart retrieved');

    return {
      id: child.id,
      name: child.full_name,
      age: this.toAgeLabel(child.date_of_birth),
      motherName: guardianData?.full_name || 'Unknown',
      motherPhone: guardianData?.phone_primary || 'N/A',
      village: guardianData?.community || guardianData?.city || 'Unknown area',
      outstandingVaccines: (upcoming || []).map((item: any) => ({
        id: `${this.readVaccineId(item.vaccine) || item.dose_number}-${item.dose_number}`,
        name: this.readVaccineName(item.vaccine) || 'Scheduled vaccine',
        status: item.isOverdue ? 'overdue' : 'due',
        scheduledDate: this.toReadableDate(item.dueDate),
      })),
      history: (history || []).map((event: any) => ({
        id: event.id,
        name: this.readVaccineName(event.vaccine) || 'Vaccine',
        status: 'completed',
        scheduledDate: this.toReadableDate(event.administered_date),
        administeredDate: this.toReadableDate(event.administered_date),
      })),
    };
  }

  async queueOfflineRegistration(chwUserId: string, payload: any) {
    const { data, error } = await this.db.supabase
      .from('sync_queue')
      .insert({
        user_id: chwUserId,
        entity_type: 'child',
        operation: 'create',
        payload,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message || 'Failed to queue registration');
    }

    return {
      queued: true,
      queueId: data.id,
      status: data.status,
      createdAt: data.created_at,
    };
  }

  async getChildrenByAssignedCatchmentArea(
    catchmentAreaId: string,
    chwUserId: string,
  ) {
    if (!catchmentAreaId) {
      throw new BadRequestException('catchmentAreaId is required');
    }

    const { data: catchmentArea, error: catchmentError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, code, community, branch_id, assigned_chw_id')
      .eq('id', catchmentAreaId)
      .single();

    if (catchmentError || !catchmentArea) {
      throw new NotFoundException('Catchment area not found');
    }

    if (!catchmentArea.assigned_chw_id || catchmentArea.assigned_chw_id !== chwUserId) {
      throw new ForbiddenException(
        'You are not assigned to this catchment area',
      );
    }

    const { data: guardians, error: guardiansError } = await this.db.supabase
      .from('guardians')
      .select(`
        id,
        full_name,
        phone_primary,
        catchment_area_id,
        child_guardian (
          is_primary,
          relationship,
          children (
            id,
            cvcc_id,
            full_name,
            date_of_birth,
            gender,
            primary_facility_id,
            updated_at
          )
        )
      `)
      .eq('catchment_area_id', catchmentAreaId);

    if (guardiansError) {
      throw new BadRequestException(guardiansError.message);
    }

    const dedupedChildren = new Map<string, ChwOfflineChild>();

    (guardians || []).forEach((guardian: any) => {
      const childLinks = Array.isArray(guardian.child_guardian)
        ? guardian.child_guardian
        : [];

      childLinks.forEach((link: any) => {
        const children = this.toChildArray(link?.children);
        children.forEach((child: any) => {
          if (!child?.id) return;

          if (!dedupedChildren.has(child.id) || link.is_primary) {
            dedupedChildren.set(child.id, {
              id: child.id,
              cvccId: child.cvcc_id,
              fullName: child.full_name,
              dateOfBirth: child.date_of_birth,
              gender: child.gender,
              primaryFacilityId: child.primary_facility_id || undefined,
              catchmentAreaId,
              guardianName: guardian.full_name || undefined,
              guardianPhone: guardian.phone_primary || undefined,
              updatedAt: child.updated_at || new Date().toISOString(),
            });
          }
        });
      });
    });

    return {
      catchmentArea: {
        id: catchmentArea.id,
        name: catchmentArea.name,
        code: catchmentArea.code,
        community: catchmentArea.community,
        branchId: catchmentArea.branch_id,
      },
      totalChildren: dedupedChildren.size,
      children: Array.from(dedupedChildren.values()),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Sync offline CHW vaccinations to the database
   * Accepts batch vaccinations with GPS coordinates
   */
  async syncOfflineVaccinations(
    dto: SyncCHWVaccinationsDto,
    chwUserId: string,
  ): Promise<SyncResultDto> {
    const result: SyncResultDto = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    // Process each vaccination
    for (const vaccination of dto.vaccinations) {
      try {
        // Lookup vaccine by name to get vaccine_id
        const { data: vaccine, error: vaccineError } = await this.db.supabase
          .from('vaccines')
          .select('id, name')
          .eq('name', vaccination.vaccineName)
          .single();

        if (vaccineError || !vaccine) {
          result.failed++;
          result.errors.push({
            vaccination,
            reason: `Vaccine not found: ${vaccination.vaccineName}`,
          });
          continue;
        }

        // Build notes with GPS coordinates if available
        let notes = vaccination.notes || '';
        if (
          typeof vaccination.latitude === 'number' &&
          typeof vaccination.longitude === 'number'
        ) {
          const gpsData = JSON.stringify({
            latitude: vaccination.latitude,
            longitude: vaccination.longitude,
            recordedAt: vaccination.recordedDate,
          });
          notes = notes ? `${notes}\n\nGPS: ${gpsData}` : `GPS: ${gpsData}`;
        }

        // Insert vaccination event
        const { error: insertError } = await this.db.supabase
          .from('vaccination_events')
          .insert({
            child_id: vaccination.childId,
            vaccine_id: vaccine.id,
            dose_number: 1, // Default to dose 1 for CHW field visits
            administered_date: vaccination.recordedDate,
            administered_by_user_id: chwUserId,
            batch_number: null, // CHW field visits don't have batch numbers
            lot_number: null,
            expiry_date: null,
            vaccination_site: null, // Could be inferred from GPS but keeping simple
            status: 'completed',
            notes: notes || null,
          });

        if (insertError) {
          result.failed++;
          result.errors.push({
            vaccination,
            reason: `Database error: ${insertError.message}`,
          });
          continue;
        }

        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          vaccination,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Transfer Out: Remove child from CHW's catchment area
   * Sets child's catchment_area_id to NULL (soft disconnect)
   * Used when a mother/child leaves the area
   */
  async transferOut(childId: string, chwUserId: string, reason?: string) {
    this.logger.debug('[CHW TransferOut] Processing transfer out');

    // Get CHW's catchment area(s)
    const { data: chwCatchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name')
      .eq('assigned_chw_id', chwUserId);

    if (!chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const chwCatchmentIds = chwCatchments.map(c => c.id);

    // Get child's current info
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Verify child is in CHW's catchment
    if (!child.catchment_area_id || !chwCatchmentIds.includes(child.catchment_area_id)) {
      throw new ForbiddenException(
        'Cannot transfer out: This child is not in your assigned catchment area'
      );
    }

    // Get catchment name for audit log
    const previousCatchment = chwCatchments.find(c => c.id === child.catchment_area_id);

    // Set catchment_area_id to NULL
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({ catchment_area_id: null })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer out failed: ${updateError.message}`);
    }

    // Log the transfer in audit_logs
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_out',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        previousCatchment: previousCatchment?.name || 'Unknown',
        reason: reason || 'Family relocated',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: `${child.full_name} transferred out successfully`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: previousCatchment?.name,
      newCatchment: null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Transfer In: Add child to CHW's catchment area
   * Updates child's catchment_area_id to CHW's assigned catchment
   * Used when a new mother arrives in the area (found via global search)
   */
  async transferIn(childId: string, chwUserId: string, notes?: string) {
    this.logger.debug('[CHW TransferIn] Processing transfer in');

    // Get CHW's primary catchment area
    const { data: chwCatchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community')
      .eq('assigned_chw_id', chwUserId)
      .limit(1);

    if (!chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const chwCatchment = chwCatchments[0];

    // Get child's current info
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if child is already in this CHW's catchment
    if (child.catchment_area_id === chwCatchment.id) {
      return {
        success: true,
        message: `${child.full_name} is already in your catchment area`,
        childId: child.id,
        childName: child.full_name,
        previousCatchment: chwCatchment.name,
        newCatchment: chwCatchment.name,
        timestamp: new Date().toISOString(),
      };
    }

    // Store previous catchment for audit
    let previousCatchmentName = 'None (was transferred out)';
    if (child.catchment_area_id) {
      const { data: prevCatchment } = await this.db.supabase
        .from('catchment_areas')
        .select('name')
        .eq('id', child.catchment_area_id)
        .single();
      if (prevCatchment) {
        previousCatchmentName = prevCatchment.name;
      }
    }

    // Update child's catchment_area_id to CHW's catchment
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({ catchment_area_id: chwCatchment.id })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer in failed: ${updateError.message}`);
    }

    // Log the transfer in audit_logs
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_in',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        previousCatchment: previousCatchmentName,
        newCatchment: chwCatchment.name,
        catchmentCommunity: chwCatchment.community,
        notes: notes || 'Family relocated to this area',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: `${child.full_name} transferred in successfully. Now in your local register.`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: previousCatchmentName,
      newCatchment: chwCatchment.name,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Transfer Pull: Forcefully pull a child from another catchment area
   *
   * This is the "Pull Mechanism" - a CHW can pull a child's record from
   * another CHW's catchment area, even if the old CHW hasn't transferred them out.
   *
   * Creates dual audit logs:
   * 1. transfer_out for the OLD catchment (logs +1 Transfer Out for old branch)
   * 2. transfer_in for the NEW catchment (logs +1 Transfer In for new branch)
   */
  async transferPull(childId: string, chwUserId: string, notes?: string) {
    this.logger.debug('[CHW TransferPull] Processing forceful pull transfer');

    // 1. Get new CHW's primary catchment area
    const { data: chwCatchments, error: chwError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community, branch_id')
      .eq('assigned_chw_id', chwUserId)
      .limit(1);

    if (chwError || !chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const newCatchment = chwCatchments[0];

    // 2. Get child's current info including existing catchment
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if child is already in this CHW's catchment
    if (child.catchment_area_id === newCatchment.id) {
      return {
        success: true,
        message: `${child.full_name} is already in your catchment area`,
        childId: child.id,
        childName: child.full_name,
        previousCatchment: newCatchment.name,
        newCatchment: newCatchment.name,
        wasPulled: false,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Get old catchment info (for audit logging)
    let oldCatchmentName = 'None (unassigned)';
    let oldCatchmentBranchId: string | null = null;
    let oldCatchmentId: string | null = child.catchment_area_id;

    if (child.catchment_area_id) {
      const { data: oldCatchment } = await this.db.supabase
        .from('catchment_areas')
        .select('id, name, branch_id, assigned_chw_id')
        .eq('id', child.catchment_area_id)
        .single();

      if (oldCatchment) {
        oldCatchmentName = oldCatchment.name;
        oldCatchmentBranchId = oldCatchment.branch_id;
      }
    }

    // 4. Update child's catchment_area_id to new CHW's catchment
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({
        catchment_area_id: newCatchment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer pull failed: ${updateError.message}`);
    }

    const timestamp = new Date().toISOString();

    // 5. Log TRANSFER OUT for the OLD catchment's branch
    // This creates a +1 Transfer Out record for the old branch manager's stats
    if (oldCatchmentId) {
      await this.db.supabase.from('audit_logs').insert({
        user_id: chwUserId, // The CHW who initiated the pull
        action: 'transfer_out',
        resource_type: 'child',
        resource_id: childId,
        details: {
          childName: child.full_name,
          fromCatchment: oldCatchmentName,
          fromCatchmentId: oldCatchmentId,
          fromBranchId: oldCatchmentBranchId,
          toCatchment: newCatchment.name,
          toCatchmentId: newCatchment.id,
          toBranchId: newCatchment.branch_id,
          transferType: 'pull', // Marks this as a pull transfer (not manual release)
          notes: notes || 'Child pulled to new catchment area',
          timestamp,
        },
      });
    }

    // 6. Log TRANSFER IN for the NEW catchment's branch
    // This creates a +1 Transfer In record for the new branch manager's stats
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_in',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        fromCatchment: oldCatchmentName,
        fromCatchmentId: oldCatchmentId,
        fromBranchId: oldCatchmentBranchId,
        toCatchment: newCatchment.name,
        toCatchmentId: newCatchment.id,
        toBranchId: newCatchment.branch_id,
        transferType: 'pull', // Marks this as a pull transfer
        notes: notes || 'Child pulled via global search',
        timestamp,
      },
    });

    this.logger.log(
      `[CHW TransferPull] Child ${child.full_name} pulled from ${oldCatchmentName} to ${newCatchment.name}`,
    );

    return {
      success: true,
      message: `${child.full_name} has been transferred to your catchment area.`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: oldCatchmentName,
      newCatchment: newCatchment.name,
      newCatchmentId: newCatchment.id,
      wasPulled: true,
      timestamp,
    };
  }

  /**
   * Get CHW's local register (children in their catchment)
   * Uses child's direct catchment_area_id instead of guardian's
   */
  async getLocalRegister(chwUserId: string) {
    this.logger.debug('[CHW getLocalRegister] Fetching local register');

    // Get CHW's catchment areas
    const { data: catchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community')
      .eq('assigned_chw_id', chwUserId);

    if (!catchments || catchments.length === 0) {
      this.logger.debug('[CHW getLocalRegister] No catchments assigned');
      return [];
    }

    const catchmentIds = catchments.map(c => c.id);

    // Query children directly by catchment_area_id
    const { data: children, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        catchment_area_id,
        child_guardian!inner (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary
          )
        )
      `)
      .in('catchment_area_id', catchmentIds)
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      throw new BadRequestException(`Failed to fetch local register: ${error.message}`);
    }

    // Transform to frontend format
    const register = (children || []).map((child: any) => {
      const primaryGuardian = (child.child_guardian || [])
        .find((cg: any) => cg.is_primary && cg.guardians)
        ?.guardians;

      return {
        id: child.id,
        cvccId: child.cvcc_id,
        fullName: child.full_name,
        dateOfBirth: child.date_of_birth,
        gender: child.gender,
        primaryFacilityId: child.primary_facility_id,
        catchmentAreaId: child.catchment_area_id,
        guardianName: primaryGuardian?.full_name || 'Unknown',
        guardianPhone: primaryGuardian?.phone_primary || 'N/A',
      };
    });

    this.logger.debug(`[CHW getLocalRegister] Register retrieved successfully`);

    return register;
  }
}

