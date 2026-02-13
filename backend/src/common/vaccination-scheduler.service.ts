import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from './database/database.service';
import { SmsService } from './sms.service';

@Injectable()
export class VaccinationSchedulerService {
  private readonly logger = new Logger(VaccinationSchedulerService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Send SMS reminders for vaccinations due today
   * Runs every day at 8:00 AM Ghana time
   */
  @Cron('0 8 * * *', {
    name: 'vaccination-due-today-reminders',
    timeZone: 'Africa/Accra',
  })
  async sendVaccinationDueTodayReminders() {
    this.logger.log('Starting daily vaccination reminder check...');

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Get all children with their birth dates and guardian info
      const { data: children, error: childrenError } = await this.db['_supabase']
        .from('children')
        .select(`
          id,
          full_name,
          date_of_birth,
          guardian_id,
          guardian:guardians (
            id,
            full_name,
            phone_primary,
            preferred_contact
          )
        `)
        .eq('status', 'active');

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

          // Get guardian information
          const guardian = child.guardian as any;
          
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

            const smsSent = await this.smsService.sendSms(
              guardian.phone_primary,
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
                phone_number: guardian.phone_primary,
                subject: `Vaccination Due Today - ${child.full_name}`,
                content: message,
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

  /**
   * Log notification to database
   */
  private async logNotification(data: {
    template_id: string;
    recipient_type: string;
    recipient_id: string;
    channel: string;
    phone_number?: string;
    email?: string;
    subject: string;
    content: string;
    status: string;
    child_id?: string;
    vaccine_id?: string;
  }) {
    try {
      const { error } = await this.db['_supabase']
        .from('notifications')
        .insert({
          template_id: data.template_id,
          recipient_type: data.recipient_type,
          recipient_id: data.recipient_id,
          channel: data.channel,
          phone_number: data.phone_number,
          email: data.email,
          subject: data.subject,
          content: data.content,
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
   */
  async sendRemindersNow(): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log('Manual vaccination reminder trigger...');
    await this.sendVaccinationDueTodayReminders();
    return {
      success: true,
      message: 'Vaccination reminders sent. Check logs for details.',
    };
  }
}
