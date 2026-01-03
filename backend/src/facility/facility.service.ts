import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  ChildSearchResultDto,
  FacilityChildProfileDto,
  VaccinationEventDto,
  ScheduledVaccineDto,
} from './dto';

@Injectable()
export class FacilityService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Search for children by name, CVCC ID, or guardian phone number
   */
  async searchChildren(
    query: string,
    facilityId?: string,
  ): Promise<ChildSearchResultDto[]> {
    const trimmedQuery = query.trim().toLowerCase();

    // Search in children table with joins to guardians and facilities
    const { data: children, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        child_id,
        first_name,
        last_name,
        date_of_birth,
        gender,
        guardian:guardians (
          id,
          name,
          primary_phone
        ),
        branch:branches (
          id,
          name
        )
      `)
      .or(
        `child_id.ilike.%${trimmedQuery}%,first_name.ilike.%${trimmedQuery}%,last_name.ilike.%${trimmedQuery}%`,
      )
      .limit(10);

    if (error) throw new Error(error.message);

    // Also search by guardian phone
    const { data: byPhone, error: phoneError } = await this.db.supabase
      .from('guardians')
      .select(`
        id,
        name,
        primary_phone,
        children (
          id,
          child_id,
          first_name,
          last_name,
          date_of_birth,
          gender,
          branch:branches (
            id,
            name
          )
        )
      `)
      .ilike('primary_phone', `%${trimmedQuery}%`)
      .limit(10);

    if (phoneError) throw new Error(phoneError.message);

    // Combine results
    const allChildren: any[] = [];

    // Add direct child matches
    if (children) {
      allChildren.push(...children);
    }

    // Add children found via guardian phone
    if (byPhone) {
      byPhone.forEach((guardian: any) => {
        if (guardian.children && Array.isArray(guardian.children)) {
          guardian.children.forEach((child: any) => {
            allChildren.push({
              ...child,
              guardian: {
                id: guardian.id,
                name: guardian.name,
                primary_phone: guardian.primary_phone,
              },
            });
          });
        }
      });
    }

    // Remove duplicates by id
    const uniqueChildren = Array.from(
      new Map(allChildren.map((c) => [c.id, c])).values(),
    );

    // Get vaccination status for each child
    const results: ChildSearchResultDto[] = await Promise.all(
      uniqueChildren.map(async (child: any) => {
        const age = this.calculateAge(child.date_of_birth);

        // Get last vaccination event
        const { data: lastVaccination } = await this.db.supabase
          .from('vaccination_events')
          .select('administered_date')
          .eq('child_id', child.id)
          .order('administered_date', { ascending: false })
          .limit(1)
          .single();

        // Get vaccination counts
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.date_of_birth,
        );
        const upcomingCount = upcoming?.filter((v) => !v.isOverdue).length || 0;
        const overdueCount = upcoming?.filter((v) => v.isOverdue).length || 0;

        let vaccinationStatus: 'Complete' | 'In Progress' | 'Overdue' =
          'In Progress';
        if (overdueCount > 0) {
          vaccinationStatus = 'Overdue';
        } else if (upcomingCount === 0) {
          vaccinationStatus = 'Complete';
        }

        return {
          id: child.id,
          childId: child.child_id,
          name: `${child.first_name} ${child.last_name}`,
          dateOfBirth: child.date_of_birth,
          age,
          gender: child.gender || 'Unknown',
          guardianName: child.guardian?.name || 'Unknown',
          guardianPhone: child.guardian?.primary_phone || 'N/A',
          lastVisit: lastVaccination?.administered_date || null,
          facilityName: child.branch?.name || 'Unknown',
          vaccinationStatus,
          upcomingVaccines: upcomingCount,
          overdueVaccines: overdueCount,
        };
      }),
    );

    return results;
  }

  /**
   * Get detailed child profile
   */
  async getChildProfile(childId: string): Promise<FacilityChildProfileDto> {
    const { data: child, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        child_id,
        first_name,
        last_name,
        date_of_birth,
        gender,
        weight,
        length,
        blood_type,
        profile_photo,
        created_at,
        guardian:guardians (
          id,
          name,
          primary_phone,
          email,
          address
        ),
        branch:branches (
          id,
          name
        )
      `)
      .eq('id', childId)
      .single();

    if (error || !child) {
      throw new NotFoundException('Child not found');
    }

    const age = this.calculateAge(child.date_of_birth);

    // Get vaccination counts
    const { data: completed } = await this.db.supabase
      .from('vaccination_events')
      .select('id')
      .eq('child_id', childId)
      .eq('status', 'completed');

    const upcoming = await this.db.getUpcomingVaccinations(
      childId,
      child.date_of_birth,
    );

    // Get last visit
    const { data: lastVaccination } = await this.db.supabase
      .from('vaccination_events')
      .select('administered_date')
      .eq('child_id', childId)
      .order('administered_date', { ascending: false })
      .limit(1)
      .single();

    // Get next due vaccine
    const nextDue = upcoming
      ?.filter((v) => !v.isOverdue)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

    // Extract guardian and branch (they come as objects from the join)
    const guardian = child.guardian as any;
    const branch = child.branch as any;

    return {
      id: child.id,
      childId: child.child_id,
      name: `${child.first_name} ${child.last_name}`,
      dateOfBirth: child.date_of_birth,
      age,
      gender: child.gender || 'Unknown',
      weight: child.weight,
      length: child.length,
      bloodType: child.blood_type,
      profilePhoto: child.profile_photo,
      guardianId: guardian?.id,
      guardianName: guardian?.name || 'Unknown',
      guardianPhone: guardian?.primary_phone || 'N/A',
      guardianEmail: guardian?.email,
      guardianAddress: guardian?.address,
      facilityId: branch?.id,
      facilityName: branch?.name || 'Unknown',
      registrationDate: child.created_at,
      lastVisit: lastVaccination?.administered_date || null,
      vaccinationsCompleted: completed?.length || 0,
      vaccinationsTotal: (completed?.length || 0) + (upcoming?.length || 0),
      nextVaccineDue: nextDue?.dueDate || null,
      hasOverdueVaccines: upcoming?.some((v) => v.isOverdue) || false,
    };
  }

  /**
   * Get vaccination history for a child
   */
  async getVaccinationHistory(childId: string): Promise<VaccinationEventDto[]> {
    const history = await this.db.getVaccinationHistory(childId);

    return (history || []).map((event: any) => ({
      id: event.id,
      vaccineId: event.vaccine?.id,
      vaccineName: event.vaccine?.name || 'Unknown',
      vaccineCode: event.vaccine?.code || '',
      doseNumber: event.dose_number,
      administeredDate: event.administered_date,
      administeredBy: event.administered_by?.full_name || 'Unknown',
      batchNumber: event.batch_number,
      lotNumber: event.lot_number,
      vaccinationSite: event.vaccination_site,
      status: event.status,
      notes: event.notes,
    }));
  }

  /**
   * Get upcoming/scheduled vaccinations for a child
   */
  async getScheduledVaccinations(
    childId: string,
    dateOfBirth: string,
  ): Promise<ScheduledVaccineDto[]> {
    const upcoming = await this.db.getUpcomingVaccinations(
      childId,
      dateOfBirth,
    );

    return (upcoming || []).map((v: any) => ({
      scheduleId: v.id,
      vaccineName: v.vaccine?.name || 'Unknown',
      vaccineCode: v.vaccine?.code || '',
      doseNumber: v.dose_number,
      dueDate: v.dueDate,
      isOverdue: v.isOverdue,
      daysOverdue: v.daysOverdue,
      isMandatory: v.is_mandatory,
    }));
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): string {
    const birth = new Date(dateOfBirth);
    const now = new Date();
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());

    if (months < 12) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return `${years} year${years === 1 ? '' : 's'}`;
    }

    return `${years}y ${remainingMonths}m`;
  }
}
