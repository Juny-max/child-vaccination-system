import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type EmailDispatchResult = {
  success: boolean;
  errorMessage?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create SMTP transporter using Brevo
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // Use TLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendWelcomeEmail(
    to: { email: string; name: string },
    tempPassword: string,
  ): Promise<boolean> {
    try {
      // Use verified sender email from env, not the SMTP login
      const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      
      await this.transporter.sendMail({
        from: `"Child Vaccination System" <${senderEmail}>`,
        to: to.email,
        subject: 'Welcome to Child Vaccination Command Center - Your Login Credentials',
        html: this.getWelcomeEmailTemplate(to.name, to.email, tempPassword),
      });

      this.logger.log(`Welcome email sent to ${to.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to.email}`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(
    to: { email: string; name: string },
    tempPassword: string,
  ): Promise<boolean> {
    const result = await this.sendPasswordResetEmailWithStatus(to, tempPassword);
    return result.success;
  }

  async sendPasswordResetEmailWithStatus(
    to: { email: string; name: string },
    tempPassword: string,
  ): Promise<EmailDispatchResult> {
    try {
      const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      await this.transporter.sendMail({
        from: `"Child Vaccination System" <${senderEmail}>`,
        to: to.email,
        subject: 'Password Reset - Child Vaccination Command Center',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
            <h2>Password Reset Request</h2>
            <p>Hello ${to.name},</p>
            <p>Your password has been reset by an administrator. Use the temporary password below to sign in:</p>
            <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #15803d;">${tempPassword}</p>
            <p>For security, you will be required to change this password immediately after login.</p>
            <p>
              <a href="${frontendUrl}/auth/login" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px;">
                Login Now
              </a>
            </p>
          </div>
        `,
      });

      this.logger.log(`Password reset email sent to ${to.email}`);
      return { success: true };
    } catch (error: any) {
      const reason =
        error?.response ||
        error?.message ||
        'SMTP delivery failed';

      this.logger.error(`Failed to send password reset email to ${to.email}`, error);
      return {
        success: false,
        errorMessage: String(reason),
      };
    }
  }

  async sendStaffInviteEmail(
    to: { email: string; name: string; role: string },
    tempPassword: string,
  ): Promise<boolean> {
    try {
      const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      await this.transporter.sendMail({
        from: `"Child Vaccination System" <${senderEmail}>`,
        to: to.email,
        subject: 'Your Staff Account - Child Vaccination Command Center',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
            <h2>Staff Account Created</h2>
            <p>Hello ${to.name},</p>
            <p>Your ${to.role} account has been created.</p>
            <p><strong>Email:</strong> ${to.email}</p>
            <p><strong>Temporary Password:</strong> <span style="font-size: 18px; color: #15803d; font-weight: 700;">${tempPassword}</span></p>
            <p>You will be required to change this password when you sign in.</p>
            <p>
              <a href="${frontendUrl}/auth/login" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px;">
                Login
              </a>
            </p>
          </div>
        `,
      });

      this.logger.log(`Staff invite email sent to ${to.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send staff invite email to ${to.email}`, error);
      return false;
    }
  }

  private getWelcomeEmailTemplate(
    name: string,
    email: string,
    tempPassword: string,
  ): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CVCC</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🏥 Child Vaccination Command Center
              </h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
                Your child's health journey starts here
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                Welcome, ${name}! 👋
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your account has been created by the health facility. You can now access the parent portal to view your child's vaccination records, upcoming appointments, and more.
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">
                      🔐 Your Login Credentials
                    </h3>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Email:</span>
                          <br>
                          <strong style="color: #1f2937; font-size: 16px;">${email}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Temporary Password:</span>
                          <br>
                          <code style="background-color: #ffffff; color: #15803d; font-size: 20px; font-weight: 700; padding: 8px 16px; border-radius: 6px; display: inline-block; margin-top: 5px; letter-spacing: 2px; border: 1px solid #d1d5db;">
                            ${tempPassword}
                          </code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Important Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin: 20px 0;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                      <strong>⚠️ Important:</strong> For your security, you will be asked to change your password when you first log in.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/auth/login" 
                       style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                      Log In to Your Account →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                If you did not request this account, please contact your local health facility immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Child Vaccination Command Center<br>
                Ministry of Health - Protecting Ghana's Children
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
