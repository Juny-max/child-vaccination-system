import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly senderName: string;
  private readonly apiUrl: string;

  constructor() {
    this.clientId = process.env.HUBTEL_CLIENT_ID || '';
    this.clientSecret = process.env.HUBTEL_CLIENT_SECRET || '';
    this.senderName = process.env.HUBTEL_SENDER_NAME || 'CVCC';
    this.apiUrl = process.env.HUBTEL_API_URL || 'https://smsc.hubtel.com/v1/messages/send';
  }

  /**
   * Send welcome SMS with login credentials to parent
   */
  async sendWelcomeSms(
    to: string,
    name: string,
    email: string,
    tempPassword: string,
  ): Promise<boolean> {
    try {
      const message = `Welcome ${name}! Your CVCC parent portal access:\nEmail: ${email}\nPassword: ${tempPassword}\nLogin: ${process.env.FRONTEND_URL}/auth/login\nChange password on first login.`;

      return await this.sendSms(to, message);
    } catch (error) {
      this.logger.error(`Failed to send welcome SMS to ${to}`, error);
      return false;
    }
  }

  /**
   * Send SMS notification about successful registration
   */
  async sendRegistrationSms(
    to: string,
    name: string,
  ): Promise<boolean> {
    try {
      const message = `Hello ${name}, you have been registered in the Child Vaccination Command Center. You will receive SMS reminders for your child's vaccination appointments. Thank you!`;

      return await this.sendSms(to, message);
    } catch (error) {
      this.logger.error(`Failed to send registration SMS to ${to}`, error);
      return false;
    }
  }

  /**
   * Send a generic SMS using Hubtel API
   */
  async sendSms(to: string, content: string): Promise<boolean> {
    try {
      // Validate configuration
      if (!this.clientId || !this.clientSecret) {
        this.logger.warn('Hubtel SMS credentials not configured. SMS not sent.');
        return false;
      }

      // Format phone number for Ghana (ensure it starts with 233)
      const formattedPhone = this.formatPhoneNumber(to);

      // Build the Hubtel API request
      const response = await axios.get(this.apiUrl, {
        params: {
          clientid: this.clientId,
          clientsecret: this.clientSecret,
          from: this.senderName,
          to: formattedPhone,
          content: content,
        },
        timeout: 10000, // 10 second timeout
      });

      // Hubtel returns response data with messageId on success
      // status: 0 in the response body = success
      const data = response.data;
      if (data?.messageId || (response.status >= 200 && response.status < 300)) {
        this.logger.log(`SMS sent successfully to ${formattedPhone} (messageId: ${data?.messageId || 'N/A'})`);
        return true;
      } else {
        this.logger.error(`Unexpected Hubtel response (HTTP ${response.status}):`, data);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Hubtel API error: ${error.message}`,
          error.response?.data,
        );
      } else {
        this.logger.error(`Failed to send SMS to ${to}`, error);
      }
      return false;
    }
  }

  /**
   * Format phone number for Ghana
   * Converts various formats to international format (233XXXXXXXXX)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 233
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    }

    // If doesn't start with 233, add it (assuming Ghana number)
    if (!cleaned.startsWith('233')) {
      cleaned = '233' + cleaned;
    }

    return cleaned;
  }

  /**
   * Send vaccination reminder SMS
   */
  async sendVaccinationReminder(
    to: string,
    childName: string,
    vaccineName: string,
    dueDate: string,
  ): Promise<boolean> {
    try {
      const message = `Reminder: ${childName}'s ${vaccineName} vaccination is due on ${dueDate}. Please visit your health facility. - CVCC`;

      return await this.sendSms(to, message);
    } catch (error) {
      this.logger.error(`Failed to send vaccination reminder SMS to ${to}`, error);
      return false;
    }
  }

  /**
   * Send appointment confirmation SMS
   */
  async sendAppointmentConfirmation(
    to: string,
    childName: string,
    appointmentDate: string,
    facilityName: string,
  ): Promise<boolean> {
    try {
      const message = `Appointment confirmed for ${childName} on ${appointmentDate} at ${facilityName}. See you there! - CVCC`;

      return await this.sendSms(to, message);
    } catch (error) {
      this.logger.error(`Failed to send appointment confirmation SMS to ${to}`, error);
      return false;
    }
  }
}
