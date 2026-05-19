import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from './database/database.service';
import { SmsService } from './sms.service';
import { formatAppointmentDate, formatAppointmentTime } from './appointment-format';

@Injectable()
export class VaccinationSchedulerService {
  private readonly logger = new Logger(VaccinationSchedulerService.name);
  private readonly appointmentNoShowGraceMinutes = 120;

  constructor(
    private readonly db: DatabaseService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Send SMS reminders for vaccinations due today
   * Runs every day at 8:00 AM Ghana time
   * @param testPhoneNumber Optional phone number to override all recipients (for testing)
   */
  @Cron('0 8 * * *', {
    name: 'vaccination-due-today-reminders',
    timeZone: 'Africa/Accra',
  })
  async sendVaccinationDueTodayReminders(testPhoneNumber?: string) {
    this.logger.log('Starting daily vaccination reminder check...');
    if (testPhoneNumber) {
      this.logger.log(`[TEST MODE] All SMS will be sent to: ${testPhoneNumber}`);
    }

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Get all children with their birth dates and guardian info (through child_guardian junction table)
      const { data: children, error: childrenError } = await this.db['_supabase']
        .from('children')
        .select(`
          id,
          full_name,
          date_of_birth,
          child_guardian!inner (
            is_primary,
            guardian:guardians (
              id,
              full_name,
              phone_primary,
              preferred_contact
            )
          )
        `)
        .eq('is_active', true)
        .eq('child_guardian.is_primary', true);

      if (childrenError) {
        this.logger.error('Error fetching children:', childrenError);
        return;
      }

      if (!children || children.length === 0) {
        this.logger.log('No active children found');
        return;
      }

      this.logger.log(`Checking ${children.length} children for due vaccinations...`);

      let remindersSent = 0;
      let remindersSkipped = 0;

      // Process each child
      for (const child of children) {
        try {
          // Get upcoming vaccinations for this child
          const upcomingVaccinations = await this.db.getUpcomingVaccinations(
            child.id,
            child.date_of_birth,
          );

          if (!upcomingVaccinations || upcomingVaccinations.length === 0) {
            continue;
          }

          // Filter vaccinations due today
          const vaccinationsDueToday = upcomingVaccinations.filter(
            (vax) => vax.dueDate === today,
          );

          if (vaccinationsDueToday.length === 0) {
            continue;
          }

          // Get guardian information from child_guardian junction table
          const childGuardianLink = child.child_guardian as any;
          const guardian = childGuardianLink?.[0]?.guardian;
          
          if (!guardian || !guardian.phone_primary) {
            this.logger.warn(`No guardian phone for child ${child.full_name}`);
            remindersSkipped++;
            continue;
          }

          // Send SMS for each vaccination due today
          for (const vaccination of vaccinationsDueToday) {
            const vaccine = vaccination.vaccine as any;
            const vaccineName = vaccine?.name || 'Unknown Vaccine';
            
            const message = `REMINDER: ${child.full_name}'s ${vaccineName} vaccination is DUE TODAY (${vaccination.schedule_name}). Please visit your health facility today. - CVCC Ghana`;

            // Use test phone number if provided (for testing), otherwise use actual guardian phone
            const recipientPhone = testPhoneNumber || guardian.phone_primary;

            const smsSent = await this.smsService.sendSms(
              recipientPhone,
              message,
            );

            if (smsSent) {
              remindersSent++;
              
              // Log the notification in database
              await this.logNotification({
                template_id: 'vaccination_due_today',
                recipient_type: 'guardian',
                recipient_id: guardian.id,
                channel: 'sms',
                recipient_contact: recipientPhone,
                subject: `Vaccination Due Today - ${child.full_name}`,
                message,
                status: 'sent',
                child_id: child.id,
                vaccine_id: vaccine?.id,
              });

              this.logger.log(
                `✓ Sent reminder to ${guardian.full_name} for ${child.full_name} - ${vaccineName}`,
              );
            } else {
              this.logger.warn(
                `✗ Failed to send reminder to ${guardian.full_name} for ${child.full_name} - ${vaccineName}`,
              );
              remindersSkipped++;
            }

            // Small delay to avoid rate limiting
            await this.sleep(500);
          }
        } catch (error) {
          this.logger.error(
            `Error processing child ${child.full_name}:`,
            error,
          );
          remindersSkipped++;
        }
      }

      this.logger.log(
        `Vaccination reminder check complete. Sent: ${remindersSent}, Skipped: ${remindersSkipped}`,
      );
    } catch (error) {
      this.logger.error('Error in vaccination reminder scheduler:', error);
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
      this.logger.error(`Failed to fetch guardian phone for ${guardianId}:`, error);
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
      this.logger.error(`Failed to fetch child name for ${childId}:`, error);
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

  /**
   * Auto-mark overdue scheduled/confirmed appointments as missed.
   * Runs every 30 minutes in Ghana time.
   */
  @Cron('*/30 * * * *', {
    name: 'appointment-no-show-check',
    timeZone: 'Africa/Accra',
  })
  async autoMarkOverdueAppointmentsAsMissed() {
    try {
      const todayUtc = new Date().toISOString().split('T')[0];
      const appointments = await this.fetchOverdueAppointmentCandidates(todayUtc);
      if (!appointments) return;

      if (!appointments || appointments.length === 0) {
        return;
      }

      const now = new Date();
      let markedMissed = 0;
      let smsSent = 0;

      for (const appointment of appointments as any[]) {
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
          this.logger.error(
            `Failed to auto-mark appointment ${appointment.id} as missed:`,
            updateError,
          );
          continue;
        }

        if (!updatedAppointment) {
          continue;
        }

        markedMissed++;

        const guardianPhone = await this.getGuardianPhoneById(appointment.guardian_id);
        const contactPhone = this.parseAppointmentContactPhone(appointment.notes);
        const recipientPhone = contactPhone || guardianPhone;

        if (!recipientPhone) {
          continue;
        }

        const childId = appointment.child_id as string | null | undefined;
        const childName = await this.getChildNameById(childId);
        const dateLabel = formatAppointmentDate(appointment.scheduled_date);
        const timeLabel = formatAppointmentTime(appointment.scheduled_time);
        const timeSuffix = timeLabel ? ` at ${timeLabel}` : '';
        const smsMessage = `CVCC: Your appointment for ${childName} on ${dateLabel}${timeSuffix} was marked as MISSED because attendance was not recorded. Please rebook from your dashboard or contact your facility.`;

        const sent = await this.smsService.sendSms(recipientPhone, smsMessage);

        if (sent) {
          smsSent++;
          const guardianId = appointment.guardian_id as string | null | undefined;
          if (guardianId) {
            await this.logNotification({
              template_id: 'appointment_missed_auto',
              recipient_type: 'guardian',
              recipient_id: guardianId,
              channel: 'sms',
              recipient_contact: recipientPhone,
              subject: `Missed Appointment - ${childName}`,
              message: smsMessage,
              status: 'sent',
              child_id: childId ?? undefined,
            });
          }
        } else {
          this.logger.warn(`Failed to send missed appointment SMS to ${recipientPhone}`);
        }

        await this.sleep(300);
      }

      if (markedMissed > 0 || smsSent > 0) {
        this.logger.log(
          `Appointment no-show check complete. Marked missed: ${markedMissed}, SMS sent: ${smsSent}`,
        );
      }
    } catch (error) {
      this.logger.error('Error during appointment no-show scheduler job:', error);
    }
  }

  /**
   * Fetch appointments that are candidates for auto-marking as missed.
   * Retries transient network timeouts to reduce noisy scheduler failures.
   */
  private async fetchOverdueAppointmentCandidates(todayUtc: string) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await this.db.supabase
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
        .in('status', ['scheduled', 'confirmed'])
        .lte('scheduled_date', todayUtc);

      if (!error) {
        return data ?? [];
      }

      const errorMessage = String((error as any)?.message || '').toLowerCase();
      const isTransientNetworkError =
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('connect');

      if (!isTransientNetworkError || attempt === maxAttempts) {
        this.logger.error('Error fetching overdue appointment candidates:', error);
        return null;
      }

      const retryDelayMs = attempt * 1000;
      this.logger.warn(
        `Transient fetch error loading overdue appointments (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`,
      );
      await this.sleep(retryDelayMs);
    }

    return null;
  }

  /**
   * Log notification to database
   */
  private async logNotification(data: {
    template_id: string;
    recipient_type: string;
    recipient_id: string;
    channel: string;
    recipient_contact?: string;
    subject?: string | null;
    message: string;
    status: string;
    child_id?: string;
    vaccine_id?: string;
  }) {
    try {
      const recipientContact = data.recipient_contact?.trim();
      if (!recipientContact) {
        this.logger.warn(
          `Skipping notification log for template ${data.template_id}: missing recipient_contact.`,
        );
        return;
      }

      const { error } = await this.db['_supabase']
        .from('notifications')
        .insert({
          template_id: data.template_id,
          recipient_type: data.recipient_type,
          recipient_id: data.recipient_id,
          channel: data.channel,
          recipient_contact: recipientContact,
          subject: data.subject ?? null,
          message: data.message,
          status: data.status,
          metadata: {
            child_id: data.child_id,
            vaccine_id: data.vaccine_id,
            sent_at: new Date().toISOString(),
          },
          sent_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error('Error logging notification:', error);
      }
    } catch (error) {
      this.logger.error('Failed to log notification to database:', error);
    }
  }

  /**
   * Helper to sleep/delay execution
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for testing (can be called via endpoint)
   * @param testPhoneNumber Optional phone number to override all recipients (for testing)
   */
  async sendRemindersNow(testPhoneNumber?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log('Manual vaccination reminder trigger...');
    if (testPhoneNumber) {
      this.logger.log(`Using test phone number: ${testPhoneNumber}`);
    }
    await this.sendVaccinationDueTodayReminders(testPhoneNumber);
    return {
      success: true,
      message: testPhoneNumber 
        ? `Vaccination reminders sent to test number ${testPhoneNumber}. Check logs for details.`
        : 'Vaccination reminders sent. Check logs for details.',
    };
  }
}
