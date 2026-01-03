import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  ChildProfileDto,
  VaccinationRecordDto,
  UpcomingVaccinationDto,
  MissedVaccinationDto,
  CertificateDto,
  AppointmentDto,
  MotherDetailsDto,
  NotificationDto,
  ParentDashboardDto,
  ChildSummaryDto,
  UpdateMotherDetailsDto,
  CreateAppointmentDto,
  VaccinationStatus,
  CertificateCompletionStatus,
} from './dto';

@Injectable()
export class ParentService {
  constructor(private readonly db: DatabaseService) {}

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): string {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const months =
      (today.getFullYear() - birth.getFullYear()) * 12 +
      (today.getMonth() - birth.getMonth());

    if (months < 1) {
      const days = Math.floor(
        (today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24),
      );
      return `${days} days`;
    } else if (months < 12) {
      return `${months} month${months === 1 ? '' : 's'}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) {
        return `${years} year${years === 1 ? '' : 's'}`;
      }
      return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
    }
  }

  /**
   * Format weight as string
   */
  private formatWeight(weight: number | null): string {
    if (!weight) return 'N/A';
    return `${weight} kg`;
  }

  /**
   * Format length as string
   */
  private formatLength(length: number | null): string {
    if (!length) return 'N/A';
    return `${length} cm`;
  }

  /**
   * Parse emergency contacts from guardian notes
   */
  private parseEmergencyContacts(notes: string | null): Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    isPrimary: boolean;
  }> {
    if (!notes) return [];

    // First, try to parse as JSON (new format)
    try {
      const parsed = JSON.parse(notes);
      if (parsed.emergencyContacts && Array.isArray(parsed.emergencyContacts)) {
        return parsed.emergencyContacts.map((c: any, index: number) => ({
          id: c.id || `ec-${index + 1}`,
          name: c.name || '',
          relationship: c.relationship || '',
          phone: c.phone || '',
          isPrimary: c.isPrimary ?? index === 0,
        }));
      }
    } catch {
      // Not JSON, try legacy format
    }

    // Legacy format: Parse emergency contacts from notes field
    // Format: "Name (Relationship) • +233..."
    const contacts: Array<{
      id: string;
      name: string;
      relationship: string;
      phone: string;
      isPrimary: boolean;
    }> = [];
    const matches = notes.match(
      /(\w+\s+\w+)\s*\((\w+)\)\s*[•·]\s*(\+?\d[\d\s]+)/g,
    );

    if (matches) {
      matches.forEach((match, index) => {
        const parts = match.match(/(\w+\s+\w+)\s*\((\w+)\)\s*[•·]\s*(\+?\d[\d\s]+)/);
        if (parts) {
          contacts.push({
            id: `CONTACT-${String(index + 1).padStart(3, '0')}`,
            name: parts[1].trim(),
            relationship: parts[2].trim(),
            phone: parts[3].trim(),
            isPrimary: index === 0,
          });
        }
      });
    }

    return contacts;
  }

  // =========================================================================
  // GUARDIAN (MOTHER) METHODS
  // =========================================================================

  /**
   * Get guardian profile by user ID
   */
  async getGuardianProfile(userId: string): Promise<MotherDetailsDto> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    return {
      id: guardian.id,
      name: guardian.full_name,
      primaryPhone: guardian.phone_primary,
      secondaryPhone: guardian.phone_alternate,
      email: guardian.email,
      addressLine1: guardian.address_line1,
      landmark: guardian.landmark,
      city: guardian.city,
      region: guardian.region,
      country: guardian.country || 'Ghana',
      postalCode: guardian.postal_code,
      preferredContactMethod: guardian.preferred_contact,
      emergencyContacts: this.parseEmergencyContacts(guardian.notes),
    };
  }

  /**
   * Update guardian profile
   */
  async updateGuardianProfile(
    userId: string,
    updates: UpdateMotherDetailsDto,
  ): Promise<MotherDetailsDto> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const client = this.db.supabase;

    // Build the notes field with emergency contacts if provided
    let notesValue = guardian.notes;
    if (updates.emergencyContacts) {
      notesValue = JSON.stringify({
        emergencyContacts: updates.emergencyContacts.map((c, index) => ({
          id: `ec-${index + 1}`,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          isPrimary: c.isPrimary ?? index === 0,
        })),
      });
    }

    const { error } = await client
      .from('guardians')
      .update({
        full_name: updates.name || guardian.full_name,
        phone_primary: updates.primaryPhone || guardian.phone_primary,
        phone_alternate: updates.secondaryPhone,
        email: updates.email,
        address_line1: updates.addressLine1 || guardian.address_line1,
        landmark: updates.landmark,
        city: updates.city || guardian.city,
        region: updates.region || guardian.region,
        postal_code: updates.postalCode,
        preferred_contact: updates.preferredContactMethod || guardian.preferred_contact,
        notes: notesValue,
      })
      .eq('id', guardian.id);

    if (error) throw new Error(error.message);

    // Log the update
    await this.db.createAuditLog(
      userId,
      'update',
      'guardians',
      guardian.id,
      { before: guardian, after: updates },
    );

    return this.getGuardianProfile(userId);
  }

  // =========================================================================
  // CHILDREN METHODS
  // =========================================================================

  /**
   * Get all children for the authenticated parent
   */
  async getChildren(userId: string): Promise<ChildProfileDto[]> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const childRelations = await this.db.getChildrenByGuardianId(guardian.id);

    return (childRelations || []).map((relation: any) => {
      const child = relation.child;
      return {
        id: child.id,
        childId: child.cvcc_id,  // CVCC ID for display (e.g., CHILD-001)
        name: child.full_name,
        dateOfBirth: child.date_of_birth,
        age: this.calculateAge(child.date_of_birth),
        gender: child.gender,
        weight: this.formatWeight(child.birth_weight),
        length: this.formatLength(child.birth_length),
        bloodType: child.blood_type || 'Unknown',
        profilePhoto: child.profile_photo_url || '/images/demo-child-1.svg',
        registrationDate: child.created_at || child.date_of_birth,
        facilityName: child.primary_facility?.name || 'Not assigned',
        facilityId: child.primary_facility?.id || '',
      };
    });
  }

  /**
   * Get a specific child's details
   */
  async getChildDetails(
    userId: string,
    childId: string,
  ): Promise<ChildProfileDto> {
    const children = await this.getChildren(userId);
    const child = children.find((c) => c.id === childId);

    if (!child) {
      throw new NotFoundException('Child not found or not authorized');
    }

    return child;
  }

  // =========================================================================
  // VACCINATION METHODS
  // =========================================================================

  /**
   * Get vaccination history for a child
   */
  async getVaccinationHistory(
    userId: string,
    childId: string,
  ): Promise<VaccinationRecordDto[]> {
    // Verify parent has access to this child
    await this.getChildDetails(userId, childId);

    const history = await this.db.getVaccinationHistory(childId);

    return (history || []).map((event: any) => {
      const status = this.determineVaccinationStatus(event.status);

      return {
        id: event.id,
        vaccine: event.vaccine?.name || 'Unknown',
        vaccineCode: event.vaccine?.code || '',
        dose: `${event.dose_number}`,
        date: event.administered_date,
        status,
        administeredBy: event.administered_by?.full_name || 'Unknown',
        facility: event.facility?.name || 'Unknown',
        batchNumber: event.batch_number,
        notes: event.notes,
      };
    });
  }

  /**
   * Get upcoming vaccinations for a child
   */
  async getUpcomingVaccinations(
    userId: string,
    childId: string,
  ): Promise<UpcomingVaccinationDto[]> {
    const child = await this.getChildDetails(userId, childId);
    const upcoming = await this.db.getUpcomingVaccinations(
      childId,
      child.dateOfBirth,
    );

    return (upcoming || []).map((v: any) => ({
      scheduleId: v.id,
      vaccine: v.vaccine?.name || 'Unknown',
      vaccineCode: v.vaccine?.code || '',
      doseNumber: v.dose_number,
      scheduleName: v.schedule_name,
      dueDate: v.dueDate,
      isOverdue: v.isOverdue,
      daysOverdue: v.daysOverdue,
      isMandatory: v.is_mandatory,
    }));
  }

  /**
   * Get all missed vaccinations for guardian's children
   */
  async getMissedVaccinations(userId: string): Promise<MissedVaccinationDto[]> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    return this.db.getMissedVaccinations(guardian.id);
  }

  private determineVaccinationStatus(dbStatus: string): VaccinationStatus {
    switch (dbStatus) {
      case 'completed':
        return VaccinationStatus.COMPLETE;
      case 'missed':
        return VaccinationStatus.OVERDUE;
      default:
        return VaccinationStatus.ON_TRACK;
    }
  }

  // =========================================================================
  // CERTIFICATE METHODS
  // =========================================================================

  /**
   * Get certificates for a child
   * Completion status is DYNAMICALLY calculated based on actual vaccination events,
   * NOT from the stored certificate status (to prevent data inconsistency)
   */
  async getCertificates(
    userId: string,
    childId: string,
  ): Promise<CertificateDto[]> {
    const child = await this.getChildDetails(userId, childId);
    const certificates = await this.db.getCertificates(childId);
    
    // Get actual vaccination completion status (not from certificate table)
    const vaccinationStatus = await this.db.getVaccinationCompletionStatus(childId);

    return (certificates || []).map((cert: any) => ({
      certificateId: cert.certificate_id,
      childId: child.childId, // Use human-readable CVCC ID instead of UUID
      childName: child.name,
      issuedDate: cert.issued_date,
      issuedBy: cert.issued_by?.full_name || 'Unknown',
      issuedByFacility: cert.facility?.name || 'Unknown',
      // Use ACTUAL completion status from vaccination_events, not stored certificate status
      completionStatus: vaccinationStatus.isComplete
        ? CertificateCompletionStatus.COMPLETE
        : CertificateCompletionStatus.PARTIAL,
      qrPayload: cert.qr_payload,
      // Use actual completed vaccines from vaccination_events
      vaccinesCompleted: vaccinationStatus.completedVaccines,
      lastVerified: cert.last_verified_at
        ? new Date(cert.last_verified_at).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
      pdfUrl: cert.pdf_url,
      // Add progress info for UI
      vaccinationProgress: `${vaccinationStatus.completedCount}/${vaccinationStatus.totalRequired}`,
    }));
  }

  /**
   * Get all certificates for all children
   */
  async getAllCertificates(userId: string): Promise<CertificateDto[]> {
    const children = await this.getChildren(userId);
    const allCertificates: CertificateDto[] = [];

    for (const child of children) {
      const certs = await this.getCertificates(userId, child.id);
      allCertificates.push(...certs);
    }

    return allCertificates;
  }

  // =========================================================================
  // APPOINTMENT METHODS
  // =========================================================================

  /**
   * Get all appointments for guardian
   */
  async getAppointments(userId: string): Promise<AppointmentDto[]> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const appointments = await this.db.getAppointments(guardian.id);

    return (appointments || []).map((apt: any) => ({
      id: apt.id,
      purpose: apt.vaccine?.name
        ? `${apt.vaccine.name} vaccination`
        : 'Health visit',
      childId: apt.child?.id || '',
      childName: apt.child?.full_name || 'Unknown',
      facilityId: apt.facility?.id || '',
      facilityName: apt.facility?.name || 'TBD',
      scheduledDate: apt.scheduled_date,
      scheduledTime: apt.scheduled_time || 'TBD',
      status: apt.status,
      notes: apt.notes,
    }));
  }

  /**
   * Request a new appointment
   */
  async createAppointment(
    userId: string,
    request: CreateAppointmentDto,
  ): Promise<AppointmentDto> {
    // Verify parent has access to this child
    await this.getChildDetails(userId, request.childId);

    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const client = this.db.supabase;

    const { data, error } = await client
      .from('appointments')
      .insert({
        child_id: request.childId,
        guardian_id: guardian.id,
        vaccine_id: request.vaccineId,
        scheduled_date: request.preferredDate,
        scheduled_time: request.preferredTime,
        status: 'scheduled',
        notes: request.notes,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Log the creation
    await this.db.createAuditLog(userId, 'create', 'appointments', data.id, {
      after: data,
    });

    return {
      id: data.id,
      purpose: 'Vaccination appointment',
      childId: request.childId,
      childName: '',
      facilityId: '',
      facilityName: 'TBD',
      scheduledDate: data.scheduled_date,
      scheduledTime: data.scheduled_time || 'TBD',
      status: data.status,
      notes: data.notes,
    };
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(
    userId: string,
    appointmentId: string,
    reason?: string,
  ): Promise<void> {
    const appointments = await this.getAppointments(userId);
    const appointment = appointments.find((a) => a.id === appointmentId);

    if (!appointment) {
      throw new NotFoundException('Appointment not found or not authorized');
    }

    const client = this.db.supabase;

    const { error } = await client
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: reason
          ? `${appointment.notes || ''} [Cancelled: ${reason}]`
          : appointment.notes,
      })
      .eq('id', appointmentId);

    if (error) throw new BadRequestException(error.message);

    await this.db.createAuditLog(userId, 'update', 'appointments', appointmentId, {
      before: { status: appointment.status },
      after: { status: 'cancelled', reason },
    });
  }

  // =========================================================================
  // NOTIFICATION METHODS
  // =========================================================================

  /**
   * Get notifications for guardian
   */
  async getNotifications(userId: string): Promise<NotificationDto[]> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const notifications = await this.db.getNotifications(guardian.id);

    return (notifications || []).map((n: any) => ({
      id: n.id,
      type: n.template_id,
      subject: n.subject || 'Notification',
      message: n.message,
      channel: n.channel,
      status: n.status,
      sentAt: n.sent_at,
      createdAt: n.created_at,
    }));
  }

  // =========================================================================
  // DASHBOARD METHODS
  // =========================================================================

  /**
   * Get parent dashboard summary
   */
  async getDashboard(userId: string): Promise<ParentDashboardDto> {
    const guardian = await this.getGuardianProfile(userId);
    const children = await this.getChildren(userId);
    const appointments = await this.getAppointments(userId);
    const missedVaccinations = await this.getMissedVaccinations(userId);
    const notifications = await this.getNotifications(userId);

    // Build child summaries with vaccination progress
    const childSummaries: ChildSummaryDto[] = await Promise.all(
      children.map(async (child) => {
        const history = await this.db.getVaccinationHistory(child.id);
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.dateOfBirth,
        );
        const certs = await this.db.getCertificates(child.id);

        const completed = history?.length || 0;
        const total = completed + (upcoming?.length || 0);
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        const nextVax = upcoming?.find((v: any) => !v.isOverdue);
        const hasMissed = upcoming?.some((v: any) => v.isOverdue) || false;
        const hasComplete = certs?.some(
          (c: any) => c.completion_status === 'Complete',
        ) || false;

        // Extract vaccine name from nested object
        const nextVaxVaccine = nextVax?.vaccine as unknown as { id: string; code: string; name: string; description: string } | null;

        return {
          id: child.id,
          name: child.name,
          age: child.age,
          profilePhoto: child.profilePhoto,
          vaccinationProgress: {
            completed,
            total,
            percentage,
          },
          nextVaccination: nextVax
            ? {
                vaccine: nextVaxVaccine?.name || 'Unknown',
                dueDate: nextVax.dueDate,
              }
            : null,
          hasMissedVaccinations: hasMissed,
          hasCompleteCertificate: hasComplete,
        };
      }),
    );

    // Filter upcoming appointments
    const upcomingAppointments = appointments.filter(
      (a) => a.status === 'scheduled' || a.status === 'confirmed',
    );

    // Health reminders
    const healthReminders = [
      'Keep your child hydrated and observe for any reactions within 24 hours after each shot.',
      'Carry the child health record booklet to every visit.',
      'Update the nurse if your child shows signs of fever lasting more than 48 hours.',
    ];

    return {
      guardian: {
        name: guardian.name,
        email: guardian.email || '',
      },
      children: childSummaries,
      upcomingAppointments: upcomingAppointments.slice(0, 3),
      missedVaccinations,
      recentNotifications: notifications.slice(0, 5),
      healthReminders,
    };
  }
}
