import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { EmailService } from '../common/email.service';
import { SmsService } from '../common/sms.service';
import { QrTokenService } from '../common/qr-token.service';
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
  MissedAppointmentReminderDto,
  RegisterGuardianDto,
  RegisteredGuardianDto,
  RegisterChildDto,
  RegisteredChildDto,
  GuardianOptionDto,
  AppointmentRequestDto,
  UpdateAppointmentStatusDto,
} from './dto';

@Injectable()
export class FacilityService {
  private readonly logger = new Logger(FacilityService.name);
  private readonly emailChangeTokenSecret =
    process.env.EMAIL_CHANGE_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'cvcc-email-change-secret';
  private readonly emailChangeTokenTtlMs = 30 * 60 * 1000;
  private readonly phoneChangeOtpSecret =
    process.env.PHONE_CHANGE_OTP_SECRET ||
    process.env.JWT_SECRET ||
    'cvcc-phone-change-otp-secret';
  private readonly phoneChangeOtpTtlMs = 10 * 60 * 1000;
  private readonly phoneChangeOtpLength = 6;

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly qrTokenService: QrTokenService,
  ) {}

  /**
   * Search for children by name, CVCC ID, or guardian phone number
   */
  async searchChildren(
    query: string,
    facilityId?: string,
  ): Promise<ChildSearchResultDto[]> {
    const rawQuery = query.trim();
    const trimmedQuery = rawQuery.toLowerCase();

    let children: any[] | null = null;
    const childSelect = `
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
        `;

    // Opaque QR tokens are resolved by exact match to avoid fuzzy collisions.
    if (this.qrTokenService.isChildToken(rawQuery)) {
      const { data: tokenChildren, error: tokenError } = await this.db.supabase
        .from('children')
        .select(childSelect)
        .eq('qr_code_payload', rawQuery)
        .limit(10);

      if (tokenError) throw new Error(tokenError.message);
      children = tokenChildren || [];
    } else if (this.qrTokenService.isCertificateToken(rawQuery)) {
      const { data: certificate, error: certificateError } = await this.db.supabase
        .from('certificates')
        .select('child_id')
        .eq('qr_payload', rawQuery)
        .single();

      if (certificateError) {
        // PGRST116 means no row found; treat as no match and continue to normal search.
        if (certificateError.code !== 'PGRST116') {
          throw new Error(certificateError.message);
        }
      }

      if (certificate?.child_id) {
        const { data: certChildren, error: certChildError } = await this.db.supabase
          .from('children')
          .select(childSelect)
          .eq('id', certificate.child_id)
          .limit(1);

        if (certChildError) throw new Error(certChildError.message);
        children = certChildren || [];
      } else {
        children = [];
      }
    }

    // Search in children table with joins using child_guardian pivot table
    if (!children || children.length === 0) {
      const { data: fuzzyChildren, error } = await this.db.supabase
        .from('children')
        .select(childSelect)
        .or(
          `cvcc_id.ilike.%${trimmedQuery}%,full_name.ilike.%${trimmedQuery}%`,
        )
        .limit(10);

      if (error) throw new Error(error.message);
      children = fuzzyChildren || [];
    }

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
        place_of_birth,
        delivery_type,
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
      throw new NotFoundException('Child not found');
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
      placeOfBirth: child.place_of_birth,
      deliveryType: child.delivery_type,
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
    facilityId?: string,
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

    let resolvedDoseNumber = dto.doseNumber;

    // Backward compatibility: if client does not send a dose, infer the next completed dose.
    if (!resolvedDoseNumber) {
      const { data: latestDose, error: latestDoseError } = await this.db.supabase
        .from('vaccination_events')
        .select('dose_number')
        .eq('child_id', childId)
        .eq('vaccine_id', vaccine.id)
        .eq('status', 'completed')
        .order('dose_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDoseError) {
        this.logger.warn(
          `Failed to infer dose number for ${vaccine.name}: ${latestDoseError.message}`,
        );
      }

      resolvedDoseNumber = (latestDose?.dose_number || 0) + 1;
    }

    // Create vaccination event
    const { data: event, error } = await this.db.supabase
      .from('vaccination_events')
      .insert({
        child_id: childId,
        vaccine_id: vaccine.id,
        dose_number: resolvedDoseNumber,
        administered_date: dto.administeredDate,
        administered_by_user_id: userId,
        facility_id: facilityId || null,
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
      console.error(`Failed to record vaccination: ${error.message}`);
      throw new Error('Failed to record vaccination. Please try again.');
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

    // ── Decrement stock inventory ──────────────────────────────────────
    // Find the batch that was used (match on facility + vaccine + batch number if known).
    // We always decrement by 1 dose, using FIFO (earliest expiry first) as the fallback.
    if (facilityId) {
      try {
        let stockBatch: { id: string; quantity_remaining: number | null; quantity_used: number | null } | null = null;

        if (dto.batchNumber) {
          // Prefer the exact batch that was administered
          const { data } = await this.db.supabase
            .from('stock_inventory')
            .select('id, quantity_remaining, quantity_used')
            .eq('vaccine_id', vaccine.id)
            .eq('facility_id', facilityId)
            .eq('batch_number', dto.batchNumber)
            .limit(1)
            .maybeSingle();
          stockBatch = data;
        }

        if (!stockBatch) {
          // Fallback: earliest-expiry batch with stock remaining (FIFO)
          const { data } = await this.db.supabase
            .from('stock_inventory')
            .select('id, quantity_remaining, quantity_used')
            .eq('vaccine_id', vaccine.id)
            .eq('facility_id', facilityId)
            .gt('quantity_remaining', 0)
            .order('expiry_date', { ascending: true })
            .limit(1)
            .maybeSingle();
          stockBatch = data;
        }

        if (stockBatch) {
          const newRemaining = Math.max(0, (stockBatch.quantity_remaining ?? 0) - 1);
          await this.db.supabase
            .from('stock_inventory')
            .update({
              quantity_used: (stockBatch.quantity_used ?? 0) + 1,
              quantity_remaining: newRemaining,
            })
            .eq('id', stockBatch.id);
        }
      } catch (stockError) {
        // Stock decrement failure must not abort the vaccination record — log only
        this.logger.warn(`Stock decrement failed for vaccine ${vaccine.name}: ${(stockError as Error).message}`);
      }
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
      console.error(`Failed to record measurement: ${error.message}`);
      throw new Error('Failed to record measurement. Please try again.');
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
      console.error(`Failed to record session note: ${error.message}`);
      throw new Error('Failed to record session note. Please try again.');
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
      console.error(`Failed to fetch session notes: ${error.message}`);
      throw new Error('Failed to fetch session notes. Please try again.');
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
    actorUserId?: string,
    baseUrl?: string,
  ): Promise<GuardianDto> {
    const trimmedEmailInput =
      typeof dto.email === 'string' ? dto.email.trim().toLowerCase() : '';
    const requestedEmail = trimmedEmailInput.length > 0 ? trimmedEmailInput : null;

    const { data: currentGuardian, error: currentGuardianError } = await this.db.supabase
      .from('guardians')
      .select(
        'id, user_id, full_name, phone_primary, phone_alternate, email, address_line1, landmark, city, region, preferred_contact',
      )
      .eq('id', guardianId)
      .maybeSingle();

    if (currentGuardianError) {
      throw new BadRequestException(
        `Failed to load guardian details: ${currentGuardianError.message}`,
      );
    }

    if (!currentGuardian) {
      throw new NotFoundException('Guardian record not found.');
    }

    const currentPrimaryPhone = this.normalizePhoneForOtp(
      currentGuardian.phone_primary || '',
    );
    const requestedPrimaryPhone = this.normalizePhoneForOtp(dto.phonePrimary || '');
    const isPrimaryPhoneChangeRequested =
      requestedPrimaryPhone.length > 0 && requestedPrimaryPhone !== currentPrimaryPhone;

    if (isPrimaryPhoneChangeRequested) {
      const otpCode = (dto.phoneOtpCode || '').trim();
      const otpToken = (dto.phoneOtpToken || '').trim();
      const hasOtpCode = otpCode.length > 0;
      const hasOtpToken = otpToken.length > 0;

      if (hasOtpCode !== hasOtpToken) {
        throw new BadRequestException(
          'Both OTP code and OTP session token are required to confirm phone update.',
        );
      }

      if (!hasOtpCode) {
        const generatedOtp = this.generatePhoneChangeOtpCode();
        const generatedOtpHash = this.hashPhoneChangeOtp(generatedOtp);
        const phoneOtpToken = this.createPhoneChangeOtpToken({
          guardianId: currentGuardian.id,
          phonePrimary: requestedPrimaryPhone,
          otpHash: generatedOtpHash,
          exp: Date.now() + this.phoneChangeOtpTtlMs,
          nonce: randomBytes(12).toString('hex'),
        });

        const otpSent = await this.smsService.sendSms(
          dto.phonePrimary,
          `CVCC verification code: ${generatedOtp}. Share this code with the nurse to confirm your new phone number. Expires in 10 minutes.`,
        );

        if (!otpSent) {
          throw new BadRequestException(
            'Unable to send verification OTP to this phone number. Confirm the number and try again.',
          );
        }

        return {
          id: currentGuardian.id,
          fullName: currentGuardian.full_name,
          phonePrimary: currentGuardian.phone_primary,
          phoneAlternate: currentGuardian.phone_alternate,
          email: currentGuardian.email,
          addressLine1: currentGuardian.address_line1,
          landmark: currentGuardian.landmark,
          city: currentGuardian.city,
          region: currentGuardian.region,
          preferredContact:
            currentGuardian.preferred_contact === 'email' ? 'email' : 'sms',
          message: `OTP sent to ${dto.phonePrimary}. Enter the code to confirm this number before saving.`,
          phoneOtpRequired: true,
          phoneOtpToken,
        };
      }

      this.verifyPhoneChangeOtpToken(
        otpToken,
        currentGuardian.id,
        requestedPrimaryPhone,
        otpCode,
      );
    }

    const linkedUser = currentGuardian.user_id
      ? await this.db.getUserById(currentGuardian.user_id).catch(() => null)
      : null;

    const currentGuardianEmail = currentGuardian.email
      ? String(currentGuardian.email).trim().toLowerCase()
      : null;
    const currentAccountEmail = linkedUser?.email
      ? String(linkedUser.email).trim().toLowerCase()
      : null;
    const effectiveCurrentEmail = currentGuardianEmail || currentAccountEmail;

    if (dto.preferredContact === 'email' && !requestedEmail && !effectiveCurrentEmail) {
      throw new BadRequestException(
        'Email address is required when preferred contact method is Email.',
      );
    }

    let guardianEmailToPersist: string | null = currentGuardianEmail;
    let guardianUserIdToPersist: string | null = currentGuardian.user_id || null;
    let responseMessage: string | undefined;
    let emailVerificationRequired = false;
    let credentialsEmailSent = false;

    const isEmailChangeRequested =
      requestedEmail !== null && requestedEmail !== effectiveCurrentEmail;

    if (isEmailChangeRequested && requestedEmail) {
      const existingUser = await this.db.getUserByEmail(requestedEmail);

      if (!effectiveCurrentEmail) {
        if (existingUser && existingUser.id !== guardianUserIdToPersist) {
          throw new ConflictException('This email is already in use by another account.');
        }

        let tempPassword: string | null = null;

        if (!guardianUserIdToPersist) {
          if (existingUser) {
            guardianUserIdToPersist = existingUser.id;
          } else {
            tempPassword = this.generateTempPassword();
            const passwordHash = await this.hashPassword(tempPassword);

            const { data: createdUser, error: createUserError } = await this.db.supabase
              .from('users')
              .insert({
                email: requestedEmail,
                phone: dto.phonePrimary,
                full_name: dto.fullName,
                role: 'parent',
                status: 'active',
                password_hash: passwordHash,
                must_change_password: true,
              })
              .select('id')
              .single();

            if (createUserError || !createdUser) {
              if (createUserError?.code === '23505') {
                throw new ConflictException('This email is already in use by another account.');
              }
              throw new BadRequestException(
                `Failed to create parent account: ${createUserError?.message || 'Unknown error'}`,
              );
            }

            guardianUserIdToPersist = createdUser.id;
          }
        } else if (currentAccountEmail !== requestedEmail) {
          if (existingUser && existingUser.id !== guardianUserIdToPersist) {
            throw new ConflictException('This email is already in use by another account.');
          }

          const { error: updateUserEmailError } = await this.db.supabase
            .from('users')
            .update({
              email: requestedEmail,
              updated_at: new Date().toISOString(),
            })
            .eq('id', guardianUserIdToPersist);

          if (updateUserEmailError) {
            if (updateUserEmailError.code === '23505') {
              throw new ConflictException('This email is already in use by another account.');
            }
            throw new BadRequestException(
              `Failed to update account email: ${updateUserEmailError.message}`,
            );
          }
        }

        guardianEmailToPersist = requestedEmail;

        if (tempPassword) {
          credentialsEmailSent = await this.emailService.sendWelcomeEmail(
            { email: requestedEmail, name: dto.fullName },
            tempPassword,
          );

          responseMessage = credentialsEmailSent
            ? `Guardian details updated. Login credentials sent to ${requestedEmail}.`
            : 'Guardian details updated. Parent account created, but credential email delivery failed.';
        }
      } else {
        if (!guardianUserIdToPersist) {
          const tempPassword = this.generateTempPassword();
          const passwordHash = await this.hashPassword(tempPassword);

          const { data: createdUser, error: createUserError } = await this.db.supabase
            .from('users')
            .insert({
              email: requestedEmail,
              phone: dto.phonePrimary,
              full_name: dto.fullName,
              role: 'parent',
              status: 'active',
              password_hash: passwordHash,
              must_change_password: true,
            })
            .select('id')
            .single();

          if (createUserError || !createdUser) {
            if (createUserError?.code === '23505') {
              throw new ConflictException('This email is already in use by another account.');
            }
            throw new BadRequestException(
              `Failed to create parent account: ${createUserError?.message || 'Unknown error'}`,
            );
          }

          guardianUserIdToPersist = createdUser.id;
          guardianEmailToPersist = requestedEmail;
          credentialsEmailSent = await this.emailService.sendWelcomeEmail(
            { email: requestedEmail, name: dto.fullName },
            tempPassword,
          );

          responseMessage = credentialsEmailSent
            ? `Guardian details updated. Login credentials sent to ${requestedEmail}.`
            : 'Guardian details updated. Parent account created, but credential email delivery failed.';
          const { data: guardian, error } = await this.db.supabase
            .from('guardians')
            .update({
              user_id: guardianUserIdToPersist,
              full_name: dto.fullName,
              phone_primary: dto.phonePrimary,
              phone_alternate: dto.phoneAlternate || null,
              email: guardianEmailToPersist,
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
            this.logger.error(`Failed to update guardian: ${error.message}`);
            throw new BadRequestException('Failed to update guardian. Please try again.');
          }

          if (actorUserId) {
            await this.db.createAuditLog(actorUserId, 'update', 'guardians', guardian.id, {
              before: {
                fullName: currentGuardian.full_name,
                phonePrimary: currentGuardian.phone_primary,
                email: currentGuardianEmail,
                preferredContact: currentGuardian.preferred_contact,
              },
              after: {
                fullName: dto.fullName,
                phonePrimary: dto.phonePrimary,
                requestedEmail,
                effectiveCurrentEmail,
                emailVerificationRequired: false,
              },
            });
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
            preferredContact: guardian.preferred_contact === 'email' ? 'email' : 'sms',
            message: responseMessage,
            credentialsEmailSent: credentialsEmailSent || undefined,
          };
        }

        if (existingUser && existingUser.id !== guardianUserIdToPersist) {
          throw new ConflictException('This email is already in use by another account.');
        }

        const verificationToken = this.createEmailChangeToken({
          userId: guardianUserIdToPersist,
          guardianId: currentGuardian.id,
          newEmail: requestedEmail,
          currentEmail: effectiveCurrentEmail,
          exp: Date.now() + this.emailChangeTokenTtlMs,
          nonce: randomBytes(12).toString('hex'),
        });

        const frontendUrl = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationLink = `${frontendUrl}/parent/dashboard/mother-details?emailChangeToken=${encodeURIComponent(verificationToken)}`;

        const verificationSent = await this.emailService.sendEmailChangeVerificationEmail(
          {
            email: requestedEmail,
            name: dto.fullName || currentGuardian.full_name || 'Parent',
          },
          verificationLink,
        );

        if (!verificationSent) {
          throw new BadRequestException(
            'Unable to send email verification right now. Please try again shortly.',
          );
        }

        emailVerificationRequired = true;
        responseMessage =
          'Verification link sent to the new email. The account email will update after verification.';
      }
    }

    if (!requestedEmail && !effectiveCurrentEmail) {
      guardianEmailToPersist = null;
    } else if (!requestedEmail && effectiveCurrentEmail) {
      guardianEmailToPersist = currentGuardianEmail || effectiveCurrentEmail;
    }

    const { data: guardian, error } = await this.db.supabase
      .from('guardians')
      .update({
        user_id: guardianUserIdToPersist,
        full_name: dto.fullName,
        phone_primary: dto.phonePrimary,
        phone_alternate: dto.phoneAlternate || null,
        email: emailVerificationRequired
          ? currentGuardianEmail || effectiveCurrentEmail
          : guardianEmailToPersist,
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
      this.logger.error(`Failed to update guardian: ${error.message}`);
      throw new BadRequestException('Failed to update guardian. Please try again.');
    }

    if (actorUserId) {
      await this.db.createAuditLog(actorUserId, 'update', 'guardians', guardian.id, {
        before: {
          fullName: currentGuardian.full_name,
          phonePrimary: currentGuardian.phone_primary,
          email: currentGuardianEmail,
          preferredContact: currentGuardian.preferred_contact,
        },
        after: {
          fullName: dto.fullName,
          phonePrimary: dto.phonePrimary,
          requestedEmail,
          effectiveCurrentEmail,
          emailVerificationRequired,
        },
      });
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
      preferredContact: guardian.preferred_contact === 'email' ? 'email' : 'sms',
      message: responseMessage,
      emailVerificationRequired: emailVerificationRequired || undefined,
      credentialsEmailSent: credentialsEmailSent || undefined,
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
      const primaryGuardian =
        child?.child_guardian?.find((cg: any) => cg.is_primary) ||
        child?.child_guardian?.[0];

      // Supabase FK join can come back as either an object or a single-item array.
      const guardianJoin = primaryGuardian?.guardians as any;
      const guardianData = Array.isArray(guardianJoin)
        ? guardianJoin[0]
        : guardianJoin;

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
          relationship,
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
            community,
            preferred_contact,
            nhis_number,
            emergency_contact_name,
            emergency_contact_phone
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
        const primaryGuardian = child.child_guardian?.find((cg: any) => cg.is_primary)
          || child.child_guardian?.[0]; // fallback to first guardian if none marked primary
        // Supabase returns a single object for many-to-one FK joins, not an array
        const guardianData = primaryGuardian?.guardians as any;
        
        // Get the most overdue vaccine
        const mostOverdue = overdueVaccines.sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)[0];
        const vaccineName = mostOverdue.vaccine?.[0]?.name || mostOverdue.schedule_name || 'Unknown vaccine';

        // Build address string from parts
        const addressParts = [guardianData?.address_line1, guardianData?.landmark, guardianData?.city, guardianData?.region].filter(Boolean);

        followUps.push({
          id: `URG-${child.cvcc_id?.slice(-4) || child.id.slice(0, 8)}`,
          childId: child.id,
          childName: child.full_name,
          reason: `Overdue for ${vaccineName} by ${mostOverdue.daysOverdue} days`,
          caregiver: guardianData?.full_name || 'Unknown',
          contact: guardianData?.phone_primary || 'N/A',
          daysOverdue: mostOverdue.daysOverdue,
          guardianId: guardianData?.id,
          phoneAlternate: guardianData?.phone_alternate || undefined,
          email: guardianData?.email || undefined,
          address: addressParts.length > 0 ? addressParts.join(', ') : undefined,
          community: guardianData?.community || undefined,
          preferredContact: guardianData?.preferred_contact || undefined,
          relationship: primaryGuardian?.relationship || undefined,
          nhisNumber: guardianData?.nhis_number || undefined,
          emergencyContactName: guardianData?.emergency_contact_name || undefined,
          emergencyContactPhone: guardianData?.emergency_contact_phone || undefined,
        });
      }
    }

    // Sort by days overdue (most urgent first) and limit
    return followUps
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);
  }

  /**
   * Get missed appointment reminders for nurse follow-up.
   */
  async getMissedAppointmentReminders(
    facilityId?: string,
    days = 14,
  ): Promise<MissedAppointmentReminderDto[]> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 60) : 14;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - safeDays);
    const cutoffDate = cutoff.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    let query = this.db.supabase
      .from('appointments')
      .select(`
        id,
        child_id,
        scheduled_date,
        scheduled_time,
        status,
        children (
          id,
          full_name,
          child_guardian!inner (
            is_primary,
            relationship,
            guardians (
              id,
              full_name,
              phone_primary,
              phone_alternate,
              email
            )
          )
        ),
        vaccines (
          name
        )
      `)
      .eq('status', 'missed')
      .gte('scheduled_date', cutoffDate)
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false });

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching missed appointment reminders:', error);
      return [];
    }

    return (appointments || []).map((apt: any) => {
      const child = apt.children;
      const primaryGuardian =
        child?.child_guardian?.find((cg: any) => cg.is_primary) ||
        child?.child_guardian?.[0];

      const guardianJoin = primaryGuardian?.guardians as any;
      const guardianData = Array.isArray(guardianJoin)
        ? guardianJoin[0]
        : guardianJoin;

      const missedDate = apt.scheduled_date
        ? new Date(`${apt.scheduled_date}T00:00:00`)
        : null;
      const dayDiff = missedDate
        ? Math.floor((Date.now() - missedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: apt.id,
        childId: child?.id || apt.child_id,
        childName: child?.full_name || 'Unknown',
        caregiver: guardianData?.full_name || 'Unknown',
        contact: guardianData?.phone_primary || 'N/A',
        scheduledDate: apt.scheduled_date || '',
        scheduledTime: apt.scheduled_time ? apt.scheduled_time.slice(0, 5) : '—',
        vaccine: apt.vaccines?.name || 'Make-up dose',
        daysSinceMissed: Math.max(0, dayDiff),
        status: apt.status || 'missed',
        guardianId: guardianData?.id || undefined,
        phoneAlternate: guardianData?.phone_alternate || undefined,
        email: guardianData?.email || undefined,
        relationship: primaryGuardian?.relationship || undefined,
      };
    });
  }

  /**
   * List guardians for facility child registration picker
   */
  async listGuardians(
    query?: string,
    limit = 20,
    offset = 0,
  ): Promise<GuardianOptionDto[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    let guardianQuery = this.db.supabase
      .from('guardians')
      .select('id, full_name, phone_primary, community')
      .order('full_name', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);

    const trimmed = query?.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/[%_]/g, '\\$&');
      guardianQuery = guardianQuery.or(
        `full_name.ilike.%${escaped}%,phone_primary.ilike.%${escaped}%,community.ilike.%${escaped}%`,
      );
    }

    const { data, error } = await guardianQuery;

    if (error) {
      throw new Error(`Failed to load guardians: ${error.message}`);
    }

    return (data || []).map((guardian: any) => ({
      id: guardian.id,
      name: guardian.full_name,
      phone: guardian.phone_primary || 'N/A',
      community: guardian.community || 'Unknown community',
    }));
  }

  /**
   * Register child and notify guardian
   */
  async registerChild(
    dto: RegisterChildDto,
    userId: string,
    branchIdFromToken?: string,
  ): Promise<RegisteredChildDto> {
    const maxChildAgeYears = 5;
    const facilityId = branchIdFromToken || dto.branchId;
    if (!facilityId) {
      throw new BadRequestException('Facility information missing. Please re-login and try again.');
    }

    const parsedDateOfBirth = new Date(`${dto.dateOfBirth}T00:00:00`);
    if (Number.isNaN(parsedDateOfBirth.getTime())) {
      throw new BadRequestException('Invalid date of birth.');
    }

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const earliestAllowedDate = new Date(todayDate);
    earliestAllowedDate.setFullYear(earliestAllowedDate.getFullYear() - maxChildAgeYears);
    const normalizedDob = new Date(
      parsedDateOfBirth.getFullYear(),
      parsedDateOfBirth.getMonth(),
      parsedDateOfBirth.getDate(),
    );

    if (normalizedDob > todayDate) {
      throw new BadRequestException('Date of birth cannot be in the future.');
    }

    if (normalizedDob < earliestAllowedDate) {
      throw new BadRequestException(
        `Only children aged ${maxChildAgeYears} years or below can be registered.`,
      );
    }

    const { data: guardian, error: guardianError } = await this.db.supabase
      .from('guardians')
      .select('id, full_name, phone_primary')
      .eq('id', dto.guardianId)
      .single();

    if (guardianError || !guardian) {
      throw new BadRequestException('Selected guardian was not found. Please refresh and try again.');
    }

    let cvccId = '';
    let child: { id: string } | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      cvccId = `CVCC-${dateStr}-${randomSuffix}`;
      const qrPayload = this.qrTokenService.generateChildToken();

      const { data: insertedChild, error: childError } = await this.db.supabase
        .from('children')
        .insert({
          cvcc_id: cvccId,
          qr_code_payload: qrPayload,
          full_name: dto.fullName,
          date_of_birth: dto.dateOfBirth,
          gender: dto.gender,
          birth_weight: dto.birthWeight ?? null,
          birth_length: dto.birthLength ?? null,
          head_circumference: dto.headCircumference ?? null,
          place_of_birth: dto.placeOfBirth || null,
          delivery_type: dto.deliveryType || null,
          birth_order: dto.birthOrder || null,
          blood_type: dto.bloodType || null,
          critical_notes: dto.notes || null,
          profile_photo_url: dto.profilePhotoUrl || null,
          primary_facility_id: facilityId,
          created_by_user_id: userId,
          is_active: true,
        })
        .select('id')
        .single();

      if (!childError && insertedChild) {
        child = insertedChild;
        lastError = null;
        break;
      }

      lastError = childError;
      if (childError?.code !== '23505') {
        break;
      }
    }

    if (!child) {
      if (lastError?.code === '23505') {
        throw new ConflictException('Could not generate a unique child QR token. Please try again.');
      }
      throw new Error(`Failed to register child: ${lastError?.message || 'Unknown error'}`);
    }

    const { error: linkError } = await this.db.supabase
      .from('child_guardian')
      .insert({
        child_id: child.id,
        guardian_id: dto.guardianId,
        relationship: 'mother',
        is_primary: true,
      });

    if (linkError) {
      await this.db.supabase.from('children').delete().eq('id', child.id);
      throw new Error(`Failed to link child to guardian: ${linkError.message}`);
    }

    let smsSent = false;
    if (guardian.phone_primary) {
      smsSent = await this.smsService.sendSms(
        guardian.phone_primary,
        `CVCC: ${dto.fullName} has been registered successfully. Child ID: ${cvccId}. You will receive vaccination reminders by SMS.`,
      );
    }

    return {
      id: child.id,
      cvccId,
      guardianId: guardian.id,
      guardianName: guardian.full_name,
      guardianPhone: guardian.phone_primary || 'N/A',
      smsSent,
      message: smsSent
        ? `Child registered successfully. SMS sent to ${guardian.phone_primary}.`
        : 'Child registered successfully. SMS notification could not be delivered.',
    };
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
      if (error.code === '23505') {
        if (error.message?.includes('guardians_user_id_key')) {
          throw new ConflictException(
            'This email is already linked to an existing caregiver profile. Please search and use the existing mother record instead of creating a duplicate.',
          );
        }
        if (error.message?.includes('guardians_phone_primary_key')) {
          throw new ConflictException(
            'This phone number is already linked to an existing caregiver profile.',
          );
        }
      }
      throw new BadRequestException(`Failed to register guardian: ${error.message}`);
    }

    // Determine what message to show based on preferred contact method
    let message = '';
    let emailSent = false;
    let smsSent = false;

    if (dto.preferredContact === 'email' && dto.email && tempPassword && userId) {
      // Send welcome email with credentials
      emailSent = await this.emailService.sendWelcomeEmail(
        { email: dto.email, name: dto.fullName },
        tempPassword,
      );
      
      // Also send SMS notification if phone number is available
      if (dto.phoneNumber) {
        smsSent = await this.smsService.sendWelcomeSms(
          dto.phoneNumber,
          dto.fullName,
          dto.email,
          tempPassword,
        );
      }
      
      if (emailSent && smsSent) {
        message = `Guardian registered successfully. Login credentials sent to ${dto.email} and ${dto.phoneNumber}. The parent will be asked to change their password on first login.`;
      } else if (emailSent) {
        message = `Guardian registered successfully. Login credentials sent to ${dto.email}. The parent will be asked to change their password on first login.`;
      } else if (smsSent) {
        message = `Guardian registered successfully. SMS sent to ${dto.phoneNumber} but email delivery failed. Please verify email address: ${dto.email}`;
      } else {
        message = `Guardian registered successfully. Account created but delivery failed. Please manually provide credentials: Email: ${dto.email}, Password: ${tempPassword}`;
      }
    } else if (dto.preferredContact === 'email' && dto.email && !tempPassword) {
      message = `Guardian registered successfully. The email ${dto.email} is already registered. The parent can use their existing credentials to log in.`;
      
      // Send SMS notification about registration
      if (dto.phoneNumber) {
        smsSent = await this.smsService.sendRegistrationSms(
          dto.phoneNumber,
          dto.fullName,
        );
      }
    } else if (dto.preferredContact === 'sms') {
      // Send SMS with credentials if email and password were created
      if (dto.email && tempPassword && userId) {
        smsSent = await this.smsService.sendWelcomeSms(
          dto.phoneNumber,
          dto.fullName,
          dto.email,
          tempPassword,
        );
        
        if (smsSent) {
          message = `Guardian registered successfully. Login credentials sent via SMS to ${dto.phoneNumber}. The parent will be asked to change their password on first login.`;
        } else {
          message = `Guardian registered successfully. Account created but SMS delivery failed. Please manually provide credentials: Email: ${dto.email}, Password: ${tempPassword}`;
        }
      } else {
        // No email/portal access, just send registration confirmation
        smsSent = await this.smsService.sendRegistrationSms(
          dto.phoneNumber,
          dto.fullName,
        );
        
        if (smsSent) {
          message = `Guardian registered successfully. SMS confirmation sent to ${dto.phoneNumber}. SMS reminders will be sent for vaccination appointments.`;
        } else {
          message = `Guardian registered successfully. SMS reminders will be sent to ${dto.phoneNumber}.`;
        }
      }
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
      smsSent: smsSent || undefined, // Indicate if SMS was sent successfully
    };
  }

  /**
   * Generate a temporary password
   */
  private encodeBase64Url(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
  }

  private signEmailChangePayload(encodedPayload: string): string {
    return createHmac('sha256', this.emailChangeTokenSecret)
      .update(encodedPayload)
      .digest('base64url');
  }

  private createEmailChangeToken(payload: {
    userId: string;
    guardianId: string;
    newEmail: string;
    currentEmail: string | null;
    exp: number;
    nonce: string;
  }): string {
    const encodedPayload = this.encodeBase64Url(JSON.stringify(payload));
    const signature = this.signEmailChangePayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private normalizePhoneForOtp(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private generatePhoneChangeOtpCode(): string {
    const min = 10 ** (this.phoneChangeOtpLength - 1);
    const max = 10 ** this.phoneChangeOtpLength;
    return Math.floor(min + Math.random() * (max - min)).toString();
  }

  private hashPhoneChangeOtp(code: string): string {
    return createHmac('sha256', this.phoneChangeOtpSecret)
      .update(code.trim())
      .digest('base64url');
  }

  private signPhoneChangeOtpPayload(encodedPayload: string): string {
    return createHmac('sha256', this.phoneChangeOtpSecret)
      .update(encodedPayload)
      .digest('base64url');
  }

  private decodeBase64Url(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
  }

  private createPhoneChangeOtpToken(payload: {
    guardianId: string;
    phonePrimary: string;
    otpHash: string;
    exp: number;
    nonce: string;
  }): string {
    const encodedPayload = this.encodeBase64Url(JSON.stringify(payload));
    const signature = this.signPhoneChangeOtpPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private verifyPhoneChangeOtpToken(
    token: string,
    expectedGuardianId: string,
    expectedPhonePrimary: string,
    otpCode: string,
  ): void {
    const [encodedPayload, providedSignature] = token.split('.');

    if (!encodedPayload || !providedSignature) {
      throw new BadRequestException(
        'Invalid OTP session. Please request a new verification code.',
      );
    }

    const expectedSignature = this.signPhoneChangeOtpPayload(encodedPayload);
    const providedSignatureBuffer = Buffer.from(providedSignature, 'utf8');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
    ) {
      throw new BadRequestException(
        'Invalid OTP session. Please request a new verification code.',
      );
    }

    let payload: {
      guardianId: string;
      phonePrimary: string;
      otpHash: string;
      exp: number;
      nonce: string;
    };

    try {
      payload = JSON.parse(this.decodeBase64Url(encodedPayload));
    } catch {
      throw new BadRequestException(
        'Invalid OTP session. Please request a new verification code.',
      );
    }

    if (
      !payload?.guardianId ||
      !payload?.phonePrimary ||
      !payload?.otpHash ||
      typeof payload?.exp !== 'number'
    ) {
      throw new BadRequestException(
        'Invalid OTP session. Please request a new verification code.',
      );
    }

    if (Date.now() > payload.exp) {
      throw new BadRequestException(
        'OTP code has expired. Request a new code and try again.',
      );
    }

    const normalizedExpectedPhone = this.normalizePhoneForOtp(expectedPhonePrimary);
    if (
      payload.guardianId !== expectedGuardianId ||
      payload.phonePrimary !== normalizedExpectedPhone
    ) {
      throw new BadRequestException(
        'OTP does not match this pending phone number update.',
      );
    }

    const submittedOtpHash = this.hashPhoneChangeOtp(otpCode);
    const submittedOtpHashBuffer = Buffer.from(submittedOtpHash, 'utf8');
    const payloadOtpHashBuffer = Buffer.from(payload.otpHash, 'utf8');

    if (
      submittedOtpHashBuffer.length !== payloadOtpHashBuffer.length ||
      !timingSafeEqual(submittedOtpHashBuffer, payloadOtpHashBuffer)
    ) {
      throw new BadRequestException('Invalid OTP code. Please try again.');
    }
  }

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

  /**
   * Get pending appointment requests for a facility
   */
  async getAppointmentRequests(
    facilityId?: string,
    status?: string,
  ): Promise<AppointmentRequestDto[]> {
    const statusFilter = status || 'scheduled';

    let query = this.db.supabase
      .from('appointments')
      .select(`
        id,
        child_id,
        scheduled_date,
        scheduled_time,
        status,
        notes,
        created_at,
        updated_at,
        vaccine_id,
        children (
          id,
          cvcc_id,
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
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching appointment requests:', error);
      return [];
    }

    return (appointments || []).map((apt: any) => {
      const child = apt.children;
      const primaryGuardian = child?.child_guardian?.find(
        (cg: any) => cg.is_primary,
      );
      const guardianData = primaryGuardian?.guardians;

      return {
        id: apt.id,
        childId: child?.id || apt.child_id,
        childName: child?.full_name || 'Unknown',
        childCvccId: child?.cvcc_id || 'N/A',
        vaccine: apt.vaccines?.name || 'Make-up dose',
        guardianName: guardianData?.full_name || 'Unknown',
        guardianPhone: guardianData?.phone_primary || 'N/A',
        scheduledDate: apt.scheduled_date,
        scheduledTime: apt.scheduled_time
          ? apt.scheduled_time.slice(0, 5)
          : '—',
        status: apt.status,
        notes: apt.notes || '',
        createdAt: apt.created_at,
        updatedAt: apt.updated_at,
      };
    });
  }

  /**
   * Update appointment status (confirm, reject, complete)
   */
  async updateAppointmentStatus(
    appointmentId: string,
    dto: UpdateAppointmentStatusDto,
  ): Promise<{ success: boolean; message: string }> {
    const updateData: any = {
      status: dto.action,
    };

    // If confirming, allow overriding date/time
    if (dto.action === 'confirmed') {
      if (dto.confirmedDate) updateData.scheduled_date = dto.confirmedDate;
      if (dto.confirmedTime) updateData.scheduled_time = dto.confirmedTime;
    }

    // If completing, set completed_at
    if (dto.action === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Append nurse notes if provided
    if (dto.notes) {
      const { data: existing } = await this.db.supabase
        .from('appointments')
        .select('notes')
        .eq('id', appointmentId)
        .single();

      updateData.notes = existing?.notes
        ? `${existing.notes}\n---\nNurse: ${dto.notes}`
        : `Nurse: ${dto.notes}`;
    }

    const { error } = await this.db.supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (error) {
      console.error('Error updating appointment:', error);
      throw new NotFoundException('Appointment not found or could not be updated');
    }

    // Try to send SMS notification to guardian
    try {
      // First try via guardian_id on the appointment
      let guardianPhone: string | null = null;
      let childName = 'your child';

      const { data: apt } = await this.db.supabase
        .from('appointments')
        .select(`
          scheduled_date,
          scheduled_time,
          child_id,
          guardian_id,
          notes,
          children ( full_name ),
          guardians ( full_name, phone_primary )
        `)
        .eq('id', appointmentId)
        .single();

      if (apt) {
        childName = (apt.children as any)?.full_name || 'your child';

        // Priority 1: Use the contact phone from booking form (stored as [CONTACT_PHONE:xxx] in notes)
        const contactMatch = ((apt.notes as string) || '').match(/\[CONTACT_PHONE:([^\]]+)\]/i);
        if (contactMatch) {
          guardianPhone = contactMatch[1].trim();
          console.log(`[Appointment SMS] Using booking contact phone: ${guardianPhone}`);
        }

        // Priority 2: Guardian phone from appointment FK
        if (!guardianPhone) {
          guardianPhone = (apt.guardians as any)?.phone_primary || null;
        }

        // Priority 3: Fallback via child_guardian junction table
        if (!guardianPhone && apt.child_id) {
          const { data: childGuardian } = await this.db.supabase
            .from('child_guardian')
            .select('guardians ( phone_primary )')
            .eq('child_id', apt.child_id)
            .eq('is_primary', true)
            .single();

          guardianPhone = (childGuardian?.guardians as any)?.phone_primary || null;
        }
      }

      console.log(`[Appointment SMS] Action: ${dto.action}, Phone: ${guardianPhone || 'NOT FOUND'}, Child: ${childName}`);

      if (guardianPhone) {
        let smsMessage = '';
        if (dto.action === 'confirmed') {
          const date = apt?.scheduled_date || '';
          const time = apt?.scheduled_time
            ? ` at ${(apt.scheduled_time as string).slice(0, 5)}`
            : '';
          smsMessage = `CVCC: Your appointment for ${childName}'s vaccination has been CONFIRMED for ${date}${time}. Please arrive 15 minutes early with the child health record book.`;
        } else if (dto.action === 'cancelled') {
          smsMessage = `CVCC: Your appointment request for ${childName}'s vaccination could not be scheduled at this time. Please contact the facility for alternative dates.`;
        } else if (dto.action === 'completed') {
          smsMessage = `CVCC: ${childName}'s vaccination appointment has been completed. Thank you for protecting your child!`;
        }

        if (smsMessage) {
          const sent = await this.smsService.sendSms(guardianPhone, smsMessage);
          console.log(`[Appointment SMS] Sent to ${guardianPhone}: ${sent ? 'SUCCESS' : 'FAILED'}`);
        }
      } else {
        console.warn(`[Appointment SMS] No guardian phone found for appointment ${appointmentId}`);
      }
    } catch (smsError) {
      console.error('Failed to send appointment SMS notification:', smsError);
      // Don't fail the update if SMS fails
    }

    const actionLabels: Record<string, string> = {
      confirmed: 'confirmed',
      cancelled: 'rejected',
      completed: 'marked as completed',
    };

    return {
      success: true,
      message: `Appointment ${actionLabels[dto.action] || 'updated'} successfully`,
    };
  }

  /**
   * Get branch/facility details by ID
   */
  async getBranchDetails(branchId: string) {
    const { data: branch, error } = await this.db.supabase
      .from('branches')
      .select('id, name, code, region, district, address, phone, email')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      region: branch.region,
      district: branch.district,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
    };
  }

  /**
   * Get the current in-stock batch info (batch number + expiry date) for a
   * vaccine at a given facility.  Returns null when no matching stock is found.
   */
  async getVaccineStockInfo(
    vaccineName: string,
    facilityId: string,
  ): Promise<{ batchNumber: string; expiryDate: string } | null> {
    // Resolve vaccine by name
    const { data: vaccine } = await this.db.supabase
      .from('vaccines')
      .select('id')
      .ilike('name', vaccineName.trim())
      .limit(1)
      .maybeSingle();

    if (!vaccine) return null;

    const today = new Date().toISOString().split('T')[0];

    // Pick the most recently received, non-expired batch with remaining stock
    const { data: stock } = await this.db.supabase
      .from('stock_inventory')
      .select('batch_number, expiry_date, quantity_received, quantity_used')
      .eq('vaccine_id', vaccine.id)
      .eq('facility_id', facilityId)
      .gte('expiry_date', today)
      .order('received_date', { ascending: false })
      .limit(10);

    if (!stock || stock.length === 0) return null;

    // Prefer a batch that still has remaining units; fall back to first result
    const available = stock.find(
      (s: any) => (s.quantity_received - (s.quantity_used ?? 0)) > 0,
    ) ?? stock[0];

    return {
      batchNumber: available.batch_number,
      expiryDate: available.expiry_date,
    };
  }
}
