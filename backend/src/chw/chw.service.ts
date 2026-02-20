import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

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
    const { data: catchments, error: catchmentError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, community')
      .eq('assigned_chw_id', chwUserId);

    if (catchmentError) {
      throw new BadRequestException(catchmentError.message);
    }

    const catchmentIds = (catchments || []).map((item: any) => item.id);
    const catchmentMap = new Map<string, string | undefined>(
      (catchments || []).map((item: any) => [item.id, item.community]),
    );

    if (catchmentIds.length === 0) {
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
}
