import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { SmsService } from '../common/sms.service';
import { EmailService } from '../common/email.service';
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
  RequestEmailChangeDto,
  VerifyEmailChangeDto,
  CreateAppointmentDto,
  VaccinationStatus,
  CertificateCompletionStatus,
} from './dto';

@Injectable()
export class ParentService {
  private readonly appointmentRetentionDays = 30;
  private readonly appointmentNoShowGraceMinutes = 120;
  private readonly emailChangeTokenSecret =
    process.env.EMAIL_CHANGE_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'cvcc-email-change-secret';
  private readonly emailChangeTokenTtlMs = 30 * 60 * 1000;

  constructor(
    private readonly db: DatabaseService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

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

  private encodeBase64Url(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
  }

  private decodeBase64Url(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
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

  private verifyEmailChangeToken(token: string): {
    userId: string;
    guardianId: string;
    newEmail: string;
    currentEmail: string | null;
    exp: number;
    nonce: string;
  } {
    const [encodedPayload, providedSignature] = token.split('.');

    if (!encodedPayload || !providedSignature) {
      throw new BadRequestException('Invalid verification token format.');
    }

    const expectedSignature = this.signEmailChangePayload(encodedPayload);
    const providedSignatureBuffer = Buffer.from(providedSignature, 'utf8');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
    ) {
      throw new BadRequestException('Invalid verification token signature.');
    }

    let payload: {
      userId: string;
      guardianId: string;
      newEmail: string;
      currentEmail: string | null;
      exp: number;
      nonce: string;
    };

    try {
      payload = JSON.parse(this.decodeBase64Url(encodedPayload));
    } catch {
      throw new BadRequestException('Invalid verification token payload.');
    }

    if (
      !payload?.userId ||
      !payload?.guardianId ||
      !payload?.newEmail ||
      typeof payload?.exp !== 'number'
    ) {
      throw new BadRequestException('Malformed verification token.');
    }

    if (Date.now() > payload.exp) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    return payload;
  }

  /**
   * Remove cancelled/completed appointments older than retention window.
   */
  private async cleanupExpiredAppointments(guardianId: string): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - this.appointmentRetentionDays);

    const year = cutoff.getFullYear();
    const month = String(cutoff.getMonth() + 1).padStart(2, '0');
    const day = String(cutoff.getDate()).padStart(2, '0');
    const cutoffDate = `${year}-${month}-${day}`;

    const { error } = await this.db.supabase
      .from('appointments')
      .delete()
      .eq('guardian_id', guardianId)
      .in('status', ['cancelled', 'completed'])
      .lte('scheduled_date', cutoffDate);

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  private parseAppointmentContactPhone(notes: string | null | undefined): string | null {
    if (!notes) return null;
    const match = notes.match(/\[CONTACT_PHONE:([^\]]+)\]/i);
    return match?.[1]?.trim() || null;
  }

  private async getGuardianPhoneById(guardianId: string | null | undefined): Promise<string | null> {
    if (!guardianId) return null;

    const { data, error } = await this.db.supabase
      .from('guardians')
      .select('phone_primary')
      .eq('id', guardianId)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch guardian phone for ${guardianId}:`, error);
      return null;
    }

    return data?.phone_primary || null;
  }

  private async getChildNameById(childId: string | null | undefined): Promise<string> {
    if (!childId) return 'your child';

    const { data, error } = await this.db.supabase
      .from('children')
      .select('full_name')
      .eq('id', childId)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch child name for ${childId}:`, error);
      return 'your child';
    }

    return data?.full_name || 'your child';
  }

  private getAppointmentMissDeadline(
    scheduledDate: string,
    scheduledTime?: string | null,
  ): Date | null {
    if (!scheduledDate) return null;

    const [yearRaw, monthRaw, dayRaw] = scheduledDate.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if ([year, month, day].some((value) => Number.isNaN(value))) {
      return null;
    }

    let hour = 23;
    let minute = 59;

    if (scheduledTime && scheduledTime !== 'TBD') {
      const [hourRaw, minuteRaw] = scheduledTime.split(':');
      const parsedHour = Number(hourRaw);
      const parsedMinute = Number(minuteRaw);

      if (!Number.isNaN(parsedHour) && !Number.isNaN(parsedMinute)) {
        hour = parsedHour;
        minute = parsedMinute;
      }
    }

    const deadlineUtcMs =
      Date.UTC(year, month - 1, day, hour, minute, 0) +
      this.appointmentNoShowGraceMinutes * 60 * 1000;

    return new Date(deadlineUtcMs);
  }

  private async markOverdueAppointmentsAsMissed(guardianId: string): Promise<void> {
    const todayUtc = new Date().toISOString().slice(0, 10);

    const { data: candidates, error } = await this.db.supabase
      .from('appointments')
      .select(`
        id,
        child_id,
        guardian_id,
        scheduled_date,
        scheduled_time,
        status,
        notes
      `)
      .eq('guardian_id', guardianId)
      .in('status', ['scheduled', 'confirmed'])
      .lte('scheduled_date', todayUtc);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const now = new Date();
    for (const appointment of (candidates || []) as any[]) {
      const deadline = this.getAppointmentMissDeadline(
        appointment.scheduled_date,
        appointment.scheduled_time,
      );

      if (!deadline || now <= deadline) {
        continue;
      }

      const autoMissedTag = `[AUTO_MISSED:${new Date().toISOString()}]`;
      const updatedNotes = appointment.notes
        ? `${appointment.notes}\n${autoMissedTag}`
        : autoMissedTag;

      const { data: updatedAppointment, error: updateError } = await this.db.supabase
        .from('appointments')
        .update({
          status: 'missed',
          notes: updatedNotes,
        })
        .eq('id', appointment.id)
        .in('status', ['scheduled', 'confirmed'])
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error(
          `Failed to auto-mark appointment ${appointment.id} as missed:`,
          updateError,
        );
        continue;
      }

      if (!updatedAppointment) {
        continue;
      }

      const contactPhone = this.parseAppointmentContactPhone(appointment.notes);
      const guardianPhone = await this.getGuardianPhoneById(appointment.guardian_id);
      const smsTargetPhone = contactPhone || guardianPhone;

      if (!smsTargetPhone) {
        continue;
      }

      const childName = await this.getChildNameById(appointment.child_id);
      const timeLabel = appointment.scheduled_time
        ? ` at ${String(appointment.scheduled_time).slice(0, 5)}`
        : '';
      const smsMessage = `CVCC: Your appointment for ${childName} on ${appointment.scheduled_date}${timeLabel} was marked as MISSED because attendance was not recorded. Please rebook from your dashboard or contact your facility.`;

      try {
        await this.smsService.sendSms(smsTargetPhone, smsMessage);
      } catch (smsError) {
        console.error(
          `Failed to send missed appointment SMS for appointment ${appointment.id}:`,
          smsError,
        );
      }
    }
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
        // Email updates are applied only through the verified email-change flow.
        email: guardian.email,
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

  async requestGuardianEmailChange(
    userId: string,
    request: RequestEmailChangeDto,
    baseUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const newEmail = request.newEmail.trim().toLowerCase();
    const currentEmail = guardian.email ? String(guardian.email).trim().toLowerCase() : null;

    if (currentEmail && newEmail === currentEmail) {
      throw new BadRequestException('This is already your current email address.');
    }

    const existingUser = await this.db.getUserByEmail(newEmail);
    if (existingUser && existingUser.id !== guardian.user_id) {
      throw new ConflictException('This email is already in use by another account.');
    }

    const verificationToken = this.createEmailChangeToken({
      userId,
      guardianId: guardian.id,
      newEmail,
      currentEmail,
      exp: Date.now() + this.emailChangeTokenTtlMs,
      nonce: randomBytes(12).toString('hex'),
    });

    const frontendUrl = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/parent/dashboard/mother-details?emailChangeToken=${encodeURIComponent(verificationToken)}`;
    const recipientName = guardian.full_name || 'Parent';

    const emailSent = await this.emailService.sendEmailChangeVerificationEmail(
      { email: newEmail, name: recipientName },
      verificationLink,
    );

    if (!emailSent) {
      throw new BadRequestException(
        'Unable to send verification email right now. Please try again shortly.',
      );
    }

    await this.db.createAuditLog(userId, 'update', 'guardians', guardian.id, {
      after: {
        event: 'email_change_requested',
        previousEmail: currentEmail,
        requestedEmail: newEmail,
      },
    });

    return {
      success: true,
      message: `Verification link sent to ${newEmail}. Please verify before the email is updated.`,
    };
  }

  async verifyGuardianEmailChange(
    userId: string,
    request: VerifyEmailChangeDto,
  ): Promise<MotherDetailsDto> {
    const guardian = await this.db.getGuardianByUserId(userId);

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    const payload = this.verifyEmailChangeToken(request.token.trim());

    if (payload.userId !== userId || payload.guardianId !== guardian.id) {
      throw new BadRequestException('This verification link does not match your account.');
    }

    const normalizedCurrentEmail = guardian.email
      ? String(guardian.email).trim().toLowerCase()
      : null;

    if (payload.currentEmail !== normalizedCurrentEmail) {
      throw new BadRequestException(
        'This verification link is no longer valid. Please request a new email change.',
      );
    }

    const newEmail = payload.newEmail.trim().toLowerCase();
    const existingUser = await this.db.getUserByEmail(newEmail);

    if (existingUser && existingUser.id !== guardian.user_id) {
      throw new ConflictException('This email is already in use by another account.');
    }

    const client = this.db.supabase;

    const { error: guardianUpdateError } = await client
      .from('guardians')
      .update({ email: newEmail })
      .eq('id', guardian.id);

    if (guardianUpdateError) {
      throw new BadRequestException(
        `Failed to update guardian email: ${guardianUpdateError.message}`,
      );
    }

    if (guardian.user_id) {
      const { error: userUpdateError } = await client
        .from('users')
        .update({
          email: newEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guardian.user_id);

      if (userUpdateError) {
        if (userUpdateError.code === '23505') {
          throw new ConflictException('This email is already in use by another account.');
        }
        throw new BadRequestException(
          `Failed to update account email: ${userUpdateError.message}`,
        );
      }
    }

    await this.db.createAuditLog(userId, 'update', 'guardians', guardian.id, {
      before: { email: normalizedCurrentEmail },
      after: {
        event: 'email_change_verified',
        email: newEmail,
      },
    });

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
        qrPayload: child.qr_code_payload,
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
        doseNumber: event.dose_number,
        administeredDate: event.administered_date,
        status,
        administeredBy: event.administered_by?.full_name || 'Unknown',
        facilityName: event.facility?.name || 'Unknown',
        batchNumber: event.batch_number,
        nextDoseDate: undefined,
        sideEffects: event.notes,
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

  private determineVaccinationStatus(dbStatus: string): 'Completed' | 'Scheduled' | 'Missed' {
    switch (dbStatus?.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'scheduled':
        return 'Scheduled';
      case 'missed':
        return 'Missed';
      default:
        return 'Scheduled';
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

    // Get child's registration facility name
    const client = this.db.supabase;
    const { data: childData } = await client
      .from('children')
      .select('primary_facility_id, branches!primary_facility_id(name)')
      .eq('id', child.id)
      .single();
    
    // Handle both object and array responses from Supabase
    const branches: any = childData?.branches;
    const facilityName = Array.isArray(branches) 
      ? branches[0]?.name || 'Not issued yet'
      : branches?.name || 'Not issued yet';

    if (!certificates || certificates.length === 0) {
      return [
        {
          certificateId: `TEMP-${child.childId}`,
          childId: child.childId,
          childName: child.name,
          issuedDate: 'Not issued yet',
          issuedBy: 'Not issued yet',
          issuedByFacility: facilityName,
          completionStatus: vaccinationStatus.isComplete
            ? CertificateCompletionStatus.COMPLETE
            : CertificateCompletionStatus.PARTIAL,
          qrPayload: child.qrPayload || `TEMP-${child.childId}`,
          vaccinesCompleted: vaccinationStatus.completedVaccines,
          lastVerified: null,
          pdfUrl: null,
          vaccinationProgress: `${vaccinationStatus.completedCount}/${vaccinationStatus.totalRequired}`,
        },
      ];
    }

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

    try {
      await this.markOverdueAppointmentsAsMissed(guardian.id);
    } catch (missedMarkError) {
      console.error(
        'Failed to auto-mark overdue parent appointments as missed:',
        missedMarkError,
      );
    }

    try {
      await this.cleanupExpiredAppointments(guardian.id);
    } catch (cleanupError) {
      console.error('Failed to cleanup expired parent appointments:', cleanupError);
    }

    const appointments = await this.db.getAppointments(guardian.id);

    return (appointments || []).map((apt: any) => {
      // Extract purpose from notes if it contains "Make-up dose:" info
      let purpose = 'Health visit';
      if (apt.vaccine?.name) {
        purpose = `${apt.vaccine.name} vaccination`;
      } else if (apt.notes) {
        // Check for make-up dose pattern in notes
        const makeupMatch = apt.notes.match(/Make-up dose:\s*([^.\n]+)/);
        if (makeupMatch) {
          purpose = `${makeupMatch[1].trim()} make-up dose`;
        }
      }

      // Clean notes: remove [CONTACT_PHONE:xxx] tag before sending to frontend
      let cleanNotes = apt.notes || '';
      cleanNotes = cleanNotes.replace(/\[CONTACT_PHONE:[^\]]*\]\n?/g, '').trim();

      return {
        id: apt.id,
        purpose,
        childId: apt.child?.id || '',
        childName: apt.child?.full_name || 'Unknown',
        childCvccId: apt.child?.cvcc_id || undefined,
        vaccineName: apt.vaccine?.name || undefined,
        facilityId: apt.facility?.id || '',
        facilityName: apt.facility?.name || 'Not assigned',
        facilityPhone: apt.facility?.phone || undefined,
        facilityAddress: apt.facility?.address || undefined,
        scheduledDate: apt.scheduled_date,
        scheduledTime: apt.scheduled_time || '',
        status: apt.status,
        notes: cleanNotes || null,
      };
    });
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

    // Prepend contact phone as a parseable tag in notes if provided
    let notes = request.notes || '';
    if (request.contactPhone) {
      notes = `[CONTACT_PHONE:${request.contactPhone}]${notes ? '\n' + notes : ''}`;
    }

    const { data, error } = await client
      .from('appointments')
      .insert({
        child_id: request.childId,
        guardian_id: guardian.id,
        vaccine_id: request.vaccineId,
        facility_id: request.facilityId || null,
        scheduled_date: request.preferredDate,
        scheduled_time: request.preferredTime,
        status: 'scheduled',
        notes: notes,
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

    let notifications: NotificationDto[] = [];
    try {
      notifications = await this.getNotifications(userId);
    } catch (error) {
      console.error('Dashboard notifications query failed:', error);
    }

    // Build child summaries with vaccination progress
    const childSummaries: ChildSummaryDto[] = await Promise.all(
      children.map(async (child) => {
        try {
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
        } catch (error) {
          console.error(`Dashboard child summary query failed for child ${child.id}:`, error);

          return {
            id: child.id,
            name: child.name,
            age: child.age,
            profilePhoto: child.profilePhoto,
            vaccinationProgress: {
              completed: 0,
              total: 0,
              percentage: 0,
            },
            nextVaccination: null,
            hasMissedVaccinations: false,
            hasCompleteCertificate: false,
          };
        }
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
