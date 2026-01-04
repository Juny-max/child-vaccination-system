import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { EmailService } from '../common/email.service';
import {
  ChildSearchResultDto,
  FacilityChildProfileDto,
  VaccinationEventDto,
  ScheduledVaccineDto,
  AdministerVaccineDto,
  RecordGrowthMeasurementDto,
  GrowthMeasurementDto,
  RecordSessionNoteDto,
  SessionNoteDto,
  UpdateGuardianDto,
  GuardianDto,
  TodayAppointmentDto,
  UrgentFollowUpDto,
  RegisterGuardianDto,
  RegisteredGuardianDto,
} from './dto';

@Injectable()
export class FacilityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Search for children by name, CVCC ID, or guardian phone number
   */
  async searchChildren(
    query: string,
    facilityId?: string,
  ): Promise<ChildSearchResultDto[]> {
    const trimmedQuery = query.trim().toLowerCase();

    // Search in children table with joins using child_guardian pivot table
    const { data: children, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        child_guardian!inner (
          guardian_id,
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary
          )
        ),
        branches:primary_facility_id (
          id,
          name
        )
      `)
      .or(
        `cvcc_id.ilike.%${trimmedQuery}%,full_name.ilike.%${trimmedQuery}%`,
      )
      .limit(10);

    if (error) throw new Error(error.message);

    // Also search by guardian phone
    const { data: byPhone, error: phoneError } = await this.db.supabase
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
            branches:primary_facility_id (
              id,
              name
            )
          )
        )
      `)
      .ilike('phone_primary', `%${trimmedQuery}%`)
      .limit(10);

    if (phoneError) throw new Error(phoneError.message);

    // Combine results and normalize structure
    const allChildren: any[] = [];

    // Add direct child matches
    if (children) {
      children.forEach((child: any) => {
        // Get primary guardian from child_guardian array
        const primaryGuardianLink = Array.isArray(child.child_guardian)
          ? child.child_guardian.find((cg: any) => cg.is_primary)
          : child.child_guardian;
        
        const guardianData = primaryGuardianLink?.guardians;
        
        allChildren.push({
          ...child,
          guardian: guardianData ? {
            id: guardianData.id,
            full_name: guardianData.full_name,
            phone_primary: guardianData.phone_primary,
          } : null,
        });
      });
    }

    // Add children found via guardian phone
    if (byPhone) {
      byPhone.forEach((guardian: any) => {
        const childGuardianLinks = Array.isArray(guardian.child_guardian) 
          ? guardian.child_guardian 
          : [guardian.child_guardian];
          
        childGuardianLinks.forEach((link: any) => {
          if (link?.children) {
            allChildren.push({
              ...link.children,
              guardian: {
                id: guardian.id,
                full_name: guardian.full_name,
                phone_primary: guardian.phone_primary,
              },
            });
          }
        });
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

        // Get branch name
        const branchName = child.branches?.name || 'Unknown';

        return {
          id: child.id,
          childId: child.cvcc_id,
          name: child.full_name,
          dateOfBirth: child.date_of_birth,
          age,
          gender: child.gender || 'Unknown',
          guardianName: child.guardian?.full_name || 'Unknown',
          guardianPhone: child.guardian?.phone_primary || 'N/A',
          lastVisit: lastVaccination?.administered_date || null,
          facilityName: branchName,
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
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        birth_weight,
        birth_length,
        blood_type,
        profile_photo_url,
        created_at,
        primary_facility_id,
        child_guardian (
          guardian_id,
          is_primary,
          relationship,
          guardians (
            id,
            full_name,
            phone_primary,
            email,
            address_line1,
            landmark,
            city,
            region,
            preferred_contact
          )
        ),
        branches:primary_facility_id (
          id,
          name
        )
      `)
      .eq('id', childId)
      .single();

    if (error || !child) {
      console.error('Error fetching child profile:', error);
      throw new NotFoundException(`Child not found: ${error?.message || 'Unknown error'}`);
    }

    const age = this.calculateAge(child.date_of_birth);

    // Get primary guardian
    const primaryGuardianLink = Array.isArray(child.child_guardian)
      ? child.child_guardian.find((cg: any) => cg.is_primary)
      : child.child_guardian;
    
    const guardianData = primaryGuardianLink?.guardians;
    
    // Handle branch data (could be array or object)
    const branchData = Array.isArray(child.branches) ? child.branches[0] : child.branches;

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

    return {
      id: child.id,
      childId: child.cvcc_id,
      name: child.full_name,
      dateOfBirth: child.date_of_birth,
      age,
      gender: child.gender || 'Unknown',
      weight: child.birth_weight,
      length: child.birth_length,
      bloodType: child.blood_type,
      profilePhoto: child.profile_photo_url,
      guardianId: (guardianData as any)?.id,
      guardianName: (guardianData as any)?.full_name || 'Unknown',
      guardianPhone: (guardianData as any)?.phone_primary || 'N/A',
      guardianEmail: (guardianData as any)?.email,
      guardianAddress: [
        (guardianData as any)?.address_line1,
        (guardianData as any)?.landmark,
        (guardianData as any)?.city,
        (guardianData as any)?.region,
      ].filter(Boolean).join(', ') || 'Not provided',
      guardianPreferredContact: (guardianData as any)?.preferred_contact || 'sms',
      facilityId: (branchData as any)?.id,
      facilityName: (branchData as any)?.name || 'Unknown',
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
   * Administer a vaccine to a child
   */
  async administerVaccine(
    childId: string,
    dto: AdministerVaccineDto,
    userId: string,
  ): Promise<VaccinationEventDto> {
    // Get vaccine info from the database
    const { data: vaccine, error: vaccineError } = await this.db.supabase
      .from('vaccines')
      .select('id, name, code')
      .eq('name', dto.vaccineName)
      .single();

    if (vaccineError || !vaccine) {
      throw new NotFoundException(`Vaccine ${dto.vaccineName} not found`);
    }

    // Create vaccination event
    const { data: event, error } = await this.db.supabase
      .from('vaccination_events')
      .insert({
        child_id: childId,
        vaccine_id: vaccine.id,
        dose_number: 1, // You might want to calculate this based on history
        administered_date: dto.administeredDate,
        administered_by_user_id: userId,
        batch_number: dto.batchNumber,
        lot_number: dto.batchNumber, // Using batch as lot for now
        expiry_date: dto.expiryDate || null,
        vaccination_site: dto.vaccinationSite || null,
        status: 'completed',
        notes: dto.aefiFlag ? null : (dto.notes || null), // Notes go to AEFI report if AEFI flagged
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record vaccination: ${error.message}`);
    }

    // If AEFI flag is set, create an AEFI report
    if (dto.aefiFlag && event) {
      await this.db.supabase
        .from('aefi_reports')
        .insert({
          vaccination_event_id: event.id,
          child_id: childId,
          reported_by_user_id: userId,
          symptoms: ['Reported during vaccination'],
          severity: 'mild', // Default severity, should be updated by medical staff
          onset_date: dto.administeredDate,
          status: 'reported',
          notes: dto.notes || 'AEFI flagged during vaccination administration',
          notified_branch_nurse: false,
        });
    }

    return {
      id: event.id,
      vaccineId: event.vaccine_id,
      vaccineName: vaccine.name,
      vaccineCode: vaccine.code,
      doseNumber: event.dose_number,
      administeredDate: event.administered_date,
      administeredBy: dto.administeredBy,
      batchNumber: event.batch_number,
      lotNumber: event.lot_number,
      vaccinationSite: event.vaccination_site,
      status: event.status,
      notes: event.notes,
    };
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

  /**
   * Record a growth monitoring measurement for a child
   */
  async recordGrowthMeasurement(
    childId: string,
    dto: RecordGrowthMeasurementDto,
    userId: string,
    facilityId?: string,
  ): Promise<GrowthMeasurementDto> {
    const { data: measurement, error } = await this.db.supabase
      .from('growth_monitoring')
      .insert({
        child_id: childId,
        measurement_date: dto.measurementDate,
        weight_kg: dto.weightKg,
        length_cm: dto.lengthCm || null,
        head_circumference_cm: dto.headCircumferenceCm || null,
        muac_cm: dto.muacCm || null,
        temperature_c: dto.temperatureC || null,
        recorded_by_user_id: userId,
        recorded_by_name: dto.recordedByName,
        facility_id: facilityId || null,
        notes: dto.notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record measurement: ${error.message}`);
    }

    return {
      id: measurement.id,
      childId: measurement.child_id,
      measurementDate: measurement.measurement_date,
      weightKg: measurement.weight_kg,
      lengthCm: measurement.length_cm,
      headCircumferenceCm: measurement.head_circumference_cm,
      muacCm: measurement.muac_cm,
      temperatureC: measurement.temperature_c,
      recordedByName: measurement.recorded_by_name,
      notes: measurement.notes,
      createdAt: measurement.created_at,
    };
  }

  /**
   * Get growth monitoring history for a child
   */
  async getGrowthMonitoringHistory(
    childId: string,
  ): Promise<GrowthMeasurementDto[]> {
    const { data: measurements, error } = await this.db.supabase
      .from('growth_monitoring')
      .select('*')
      .eq('child_id', childId)
      .order('measurement_date', { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch growth monitoring history: ${error.message}`,
      );
    }

    return measurements.map((m) => ({
      id: m.id,
      childId: m.child_id,
      measurementDate: m.measurement_date,
      weightKg: m.weight_kg,
      lengthCm: m.length_cm,
      headCircumferenceCm: m.head_circumference_cm,
      muacCm: m.muac_cm,
      temperatureC: m.temperature_c,
      recordedByName: m.recorded_by_name,
      notes: m.notes,
      createdAt: m.created_at,
    }));
  }

  /**
   * Record a clinic session note for a child visit
   */
  async recordSessionNote(
    childId: string,
    dto: RecordSessionNoteDto,
    userId: string,
    facilityId?: string,
  ): Promise<SessionNoteDto> {
    const { data: note, error } = await this.db.supabase
      .from('clinic_session_notes')
      .insert({
        child_id: childId,
        facility_id: facilityId || null,
        visit_date: dto.visitDate,
        recorded_by_user_id: userId,
        recorded_by_name: dto.recordedByName,
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record session note: ${error.message}`);
    }

    return {
      id: note.id,
      childId: note.child_id,
      visitDate: note.visit_date,
      recordedByName: note.recorded_by_name,
      notes: note.notes,
      createdAt: note.created_at,
    };
  }

  /**
   * Get clinic session notes for a child
   */
  async getSessionNotes(childId: string): Promise<SessionNoteDto[]> {
    const { data: notes, error } = await this.db.supabase
      .from('clinic_session_notes')
      .select('*')
      .eq('child_id', childId)
      .order('visit_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch session notes: ${error.message}`);
    }

    return notes.map((n) => ({
      id: n.id,
      childId: n.child_id,
      visitDate: n.visit_date,
      recordedByName: n.recorded_by_name,
      notes: n.notes,
      createdAt: n.created_at,
    }));
  }

  /**
   * Get guardian details for a child
   */
  async getGuardianByChildId(childId: string): Promise<GuardianDto> {
    // Get guardian through child_guardian pivot table
    const { data: childGuardian, error: pivotError } = await this.db.supabase
      .from('child_guardian')
      .select(`
        guardian_id,
        guardians (
          id,
          full_name,
          phone_primary,
          phone_alternate,
          email,
          address_line1,
          landmark,
          city,
          region,
          preferred_contact
        )
      `)
      .eq('child_id', childId)
      .eq('is_primary', true)
      .single();

    if (pivotError) {
      console.error('Error fetching guardian:', pivotError);
      throw new NotFoundException(`Guardian for child ${childId} not found: ${pivotError.message}`);
    }

    if (!childGuardian) {
      throw new NotFoundException(`No primary guardian found for child ${childId}`);
    }

    // guardians might be an object or array depending on the relationship
    const guardian = Array.isArray(childGuardian.guardians) 
      ? childGuardian.guardians[0] 
      : childGuardian.guardians;
    
    if (!guardian) {
      throw new NotFoundException(`Guardian data not found for child ${childId}`);
    }

    return {
      id: guardian.id,
      fullName: guardian.full_name,
      phonePrimary: guardian.phone_primary,
      phoneAlternate: guardian.phone_alternate,
      email: guardian.email,
      addressLine1: guardian.address_line1,
      landmark: guardian.landmark,
      city: guardian.city,
      region: guardian.region,
      preferredContact: guardian.preferred_contact || 'sms',
    };
  }

  /**
   * Update guardian details
   */
  async updateGuardian(
    guardianId: string,
    dto: UpdateGuardianDto,
  ): Promise<GuardianDto> {
    const { data: guardian, error } = await this.db.supabase
      .from('guardians')
      .update({
        full_name: dto.fullName,
        phone_primary: dto.phonePrimary,
        phone_alternate: dto.phoneAlternate || null,
        email: dto.email || null,
        address_line1: dto.addressLine1,
        landmark: dto.landmark || null,
        city: dto.city,
        region: dto.region,
        preferred_contact: dto.preferredContact || 'sms',
      })
      .eq('id', guardianId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update guardian: ${error.message}`);
    }

    return {
      id: guardian.id,
      fullName: guardian.full_name,
      phonePrimary: guardian.phone_primary,
      phoneAlternate: guardian.phone_alternate,
      email: guardian.email,
      addressLine1: guardian.address_line1,
      landmark: guardian.landmark,
      city: guardian.city,
      region: guardian.region,
      preferredContact: guardian.preferred_contact || 'sms',
    };
  }

  /**
   * Get today's appointments for a facility
   */
  async getTodaysAppointments(facilityId?: string): Promise<TodayAppointmentDto[]> {
    const today = new Date().toISOString().split('T')[0];

    let query = this.db.supabase
      .from('appointments')
      .select(`
        id,
        child_id,
        scheduled_date,
        scheduled_time,
        status,
        vaccine_id,
        children (
          id,
          full_name,
          child_guardian!inner (
            is_primary,
            guardians (
              full_name,
              phone_primary
            )
          )
        ),
        vaccines (
          name
        )
      `)
      .eq('scheduled_date', today)
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_time', { ascending: true });

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }

    return (appointments || []).map((apt: any) => {
      const child = apt.children;
      const primaryGuardian = child?.child_guardian?.find((cg: any) => cg.is_primary);
      const guardianData = primaryGuardian?.guardians?.[0];

      return {
        id: apt.id,
        childId: child?.id || apt.child_id,
        childName: child?.full_name || 'Unknown',
        caregiver: guardianData?.full_name || 'Unknown',
        scheduledTime: apt.scheduled_time ? apt.scheduled_time.slice(0, 5) : '—',
        vaccine: apt.vaccines?.name || 'General checkup',
        contact: guardianData?.phone_primary || 'N/A',
        status: apt.status,
      };
    });
  }

  /**
   * Get urgent follow-ups (children with overdue vaccinations)
   */
  async getUrgentFollowUps(facilityId?: string): Promise<UrgentFollowUpDto[]> {
    const today = new Date();
    
    // Get all children with scheduled vaccines that are overdue
    let query = this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        primary_facility_id,
        child_guardian!inner (
          is_primary,
          guardians (
            full_name,
            phone_primary
          )
        )
      `);

    if (facilityId) {
      query = query.eq('primary_facility_id', facilityId);
    }

    const { data: children, error } = await query;

    if (error) {
      console.error('Error fetching children for follow-ups:', error);
      return [];
    }

    const followUps: UrgentFollowUpDto[] = [];

    // For each child, check their vaccination status
    for (const child of children || []) {
      const scheduled = await this.db.getUpcomingVaccinations(
        child.id,
        child.date_of_birth,
      );

      // Find overdue vaccines
      const overdueVaccines = (scheduled || []).filter((v: any) => v.isOverdue);
      
      if (overdueVaccines.length > 0) {
        const primaryGuardian = child.child_guardian?.find((cg: any) => cg.is_primary);
        const guardianData = primaryGuardian?.guardians?.[0];
        
        // Get the most overdue vaccine
        const mostOverdue = overdueVaccines.sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)[0];
        const vaccineName = mostOverdue.vaccine?.[0]?.name || mostOverdue.schedule_name || 'Unknown vaccine';

        followUps.push({
          id: `URG-${child.cvcc_id?.slice(-4) || child.id.slice(0, 8)}`,
          childId: child.id,
          childName: child.full_name,
          reason: `Overdue for ${vaccineName} by ${mostOverdue.daysOverdue} days`,
          caregiver: guardianData?.full_name || 'Unknown',
          contact: guardianData?.phone_primary || 'N/A',
          daysOverdue: mostOverdue.daysOverdue,
        });
      }
    }

    // Sort by days overdue (most urgent first) and limit
    return followUps
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);
  }

  /**
   * Register a new guardian (mother/caregiver)
   */
  async registerGuardian(dto: RegisterGuardianDto): Promise<RegisteredGuardianDto> {
    // Build the address string
    const addressParts = [dto.addressLine1];
    if (dto.landmark) addressParts.push(dto.landmark);
    addressParts.push(dto.city, dto.region);
    if (dto.country) addressParts.push(dto.country);
    
    let userId: string | null = null;
    let tempPassword: string | null = null;

    // If email is provided, create a user account with temporary password
    if (dto.email) {
      // Generate a temporary password (8 characters)
      tempPassword = this.generateTempPassword();
      const passwordHash = await this.hashPassword(tempPassword);

      // Create user account
      const { data: newUser, error: userError } = await this.db.supabase
        .from('users')
        .insert({
          email: dto.email,
          phone: dto.phoneNumber,
          full_name: dto.fullName,
          role: 'parent',
          status: 'active',
          password_hash: passwordHash,
          must_change_password: true, // Force password change on first login
        })
        .select()
        .single();

      if (userError) {
        // If email already exists, log but continue with guardian registration
        if (userError.code === '23505') { // Unique violation
          console.log('User with this email already exists, linking to existing account');
          // Get existing user
          const { data: existingUser } = await this.db.supabase
            .from('users')
            .select('id')
            .eq('email', dto.email)
            .single();
          if (existingUser) {
            userId = existingUser.id;
          }
        } else {
          console.error('Error creating user account:', userError);
        }
      } else {
        userId = newUser.id;
      }
    }

    // Insert into guardians table
    const { data: guardian, error } = await this.db.supabase
      .from('guardians')
      .insert({
        user_id: userId, // Link to user account if created
        full_name: dto.fullName,
        phone_primary: dto.phoneNumber,
        phone_alternate: dto.alternatePhone || null,
        email: dto.email || null,
        address_line1: dto.addressLine1,
        landmark: dto.landmark || null,
        city: dto.city,
        region: dto.region,
        country: dto.country || 'Ghana',
        postal_code: dto.postalCode || null,
        ghana_card_number: dto.ghanaCard || null,
        nhis_number: dto.nhisNumber || null,
        preferred_contact: dto.preferredContact,
        emergency_contact_name: dto.emergencyContactName || null,
        emergency_contact_phone: dto.emergencyContactPhone || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error registering guardian:', error);
      throw new Error(`Failed to register guardian: ${error.message}`);
    }

    // Determine what message to show based on preferred contact method
    let message = '';
    let emailSent = false;

    if (dto.preferredContact === 'email' && dto.email && tempPassword && userId) {
      // Send welcome email with credentials
      emailSent = await this.emailService.sendWelcomeEmail(
        { email: dto.email, name: dto.fullName },
        tempPassword,
      );
      
      if (emailSent) {
        message = `Guardian registered successfully. Login credentials have been sent to ${dto.email}. The parent will be asked to change their password on first login.`;
      } else {
        message = `Guardian registered successfully. Account created but email delivery failed. Please manually provide the credentials: Email: ${dto.email}, Temporary Password: ${tempPassword}`;
      }
    } else if (dto.preferredContact === 'email' && dto.email && !tempPassword) {
      message = `Guardian registered successfully. The email ${dto.email} is already registered. The parent can use their existing credentials to log in.`;
    } else if (dto.preferredContact === 'sms') {
      message = `Guardian registered successfully. SMS reminders will be sent to ${dto.phoneNumber}. No portal access created (email not provided).`;
    } else {
      message = 'Guardian registered successfully.';
    }

    return {
      id: guardian.id,
      fullName: guardian.full_name,
      phonePrimary: guardian.phone_primary,
      phoneAlternate: guardian.phone_alternate,
      email: guardian.email,
      addressLine1: guardian.address_line1,
      landmark: guardian.landmark,
      city: guardian.city,
      region: guardian.region,
      country: guardian.country,
      ghanaCard: guardian.ghana_card_number,
      nhisNumber: guardian.nhis_number,
      preferredContact: guardian.preferred_contact,
      message,
      emailSent: emailSent || undefined, // Indicate if email was sent successfully
    };
  }

  /**
   * Generate a temporary password
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Hash password using SHA-256 (same as auth service)
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
