import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
type EmailProvider = 'brevo-api' | 'smtp';

type EmailDispatchResult = {
  success: boolean;
  errorMessage?: string;
  provider?: EmailProvider;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransporter?: nodemailer.Transporter;

  private resolveSenderEmail(): string {
    const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!senderEmail) {
      throw new Error('SMTP_FROM or SMTP_USER is not configured');
    }
    return senderEmail;
  }

  private getErrorMessage(error: any): string {
    const detail = error?.response?.data ?? error?.message ?? error;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }

  private async sendViaBrevoApi(
    payload: { to: { email: string; name: string }; subject: string; html: string },
    senderEmail: string,
    senderName: string,
    apiKey: string,
  ): Promise<void> {
    await axios.post(
      BREVO_API_URL,
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: payload.to.email, name: payload.to.name }],
        subject: payload.subject,
        htmlContent: payload.html,
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
  }

  private async sendViaSmtp(
    payload: { to: { email: string; name: string }; subject: string; html: string },
    senderEmail: string,
    senderName: string,
  ): Promise<void> {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !portRaw || !user || !pass) {
      throw new Error('SMTP transport is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
    }

    const port = Number.parseInt(portRaw, 10);
    if (Number.isNaN(port)) {
      throw new Error('SMTP_PORT is invalid. It must be a number.');
    }

    if (!this.smtpTransporter) {
      this.smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
    }

    await this.smtpTransporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: `"${payload.to.name}" <${payload.to.email}>`,
      subject: payload.subject,
      html: payload.html,
    });
  }

  getMissingEmailConfig(): string[] {
    const missing: string[] = [];
    const hasBrevoApiKey = Boolean(process.env.BREVO_API_KEY?.trim());
    const hasSmtpHost = Boolean(process.env.SMTP_HOST?.trim());
    const hasSmtpPort = Boolean(process.env.SMTP_PORT?.trim());
    const hasSmtpUser = Boolean(process.env.SMTP_USER?.trim());
    const hasSmtpPass = Boolean(process.env.SMTP_PASS?.trim());

    // Allow SMTP_USER as a fallback sender identity when SMTP_FROM is omitted.
    if (!(process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim())) {
      missing.push('SMTP_FROM');
    }

    // We need at least one provider path:
    // 1) Brevo API key, or
    // 2) SMTP transport credentials.
    if (!hasBrevoApiKey) {
      if (!hasSmtpHost) missing.push('SMTP_HOST');
      if (!hasSmtpPort) missing.push('SMTP_PORT');
      if (!hasSmtpUser) missing.push('SMTP_USER');
      if (!hasSmtpPass) missing.push('SMTP_PASS');
    }

    return missing;
  }

  private async sendEmail(payload: {
    to: { email: string; name: string };
    subject: string;
    html: string;
  }): Promise<EmailProvider> {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = this.resolveSenderEmail();
    const senderName = 'Child Vaccination Command Center';

    const missing = this.getMissingEmailConfig();
    if (missing.length > 0) {
      this.logger.error(`Email provider is not configured. Missing: ${missing.join(', ')}`);
      throw new Error(`Email provider is not configured. Missing: ${missing.join(', ')}`);
    }

    if (apiKey) {
      try {
        await this.sendViaBrevoApi(payload, senderEmail, senderName, apiKey);
        return 'brevo-api';
      } catch (error: any) {
        const detail = this.getErrorMessage(error);
        this.logger.warn(`Brevo API send failed. Falling back to SMTP transport. Reason: ${detail}`);
      }
    } else {
      this.logger.warn('BREVO_API_KEY is not set. Falling back to SMTP transport.');
    }

    try {
      await this.sendViaSmtp(payload, senderEmail, senderName);
      return 'smtp';
    } catch (error: any) {
      const detail = this.getErrorMessage(error);
      this.logger.error('SMTP send failed', detail);
      throw new Error(detail);
    }
  }

  async sendWelcomeEmail(
    to: { email: string; name: string },
    tempPassword: string,
  ): Promise<boolean> {
    try {
      const provider = await this.sendEmail({
        to,
        subject: 'Welcome to Child Vaccination Command Center - Your Login Credentials',
        html: this.getWelcomeEmailTemplate(to.name, to.email, tempPassword),
      });
      this.logger.log(`Welcome email sent to ${to.email} via ${provider}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to.email}`, error);
      return false;
    }
  }

  // Self-service password reset — sends a reset link
  async sendPasswordResetEmail(
    to: { email: string; name: string },
    resetLink: string,
  ): Promise<boolean> {
    try {
      const provider = await this.sendEmail({
        to,
        subject: 'Reset Your Password - Child Vaccination Command Center',
        html: this.getPasswordResetEmailTemplate(to.name, resetLink),
      });
      this.logger.log(`Password reset email sent to ${to.email} via ${provider}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to.email}`, error);
      return false;
    }
  }

  async sendEmailChangeVerificationEmail(
    to: { email: string; name: string },
    verificationLink: string,
  ): Promise<boolean> {
    try {
      await this.sendEmail({
        to,
        subject: 'Verify Your New Email Address - Child Vaccination Command Center',
        html: this.getEmailChangeVerificationTemplate(to.name, verificationLink),
      });
      this.logger.log(`Email change verification sent to ${to.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email change verification to ${to.email}`, error);
      return false;
    }
  }

  // Admin-initiated password reset — sends a temporary password
  async sendPasswordResetEmailWithStatus(
    to: { email: string; name: string },
    tempPassword: string,
  ): Promise<EmailDispatchResult> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const provider = await this.sendEmail({
        to,
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
      this.logger.log(`Admin password reset email sent to ${to.email} via ${provider}`);
      return { success: true, provider };
    } catch (error: any) {
      const reason = this.getErrorMessage(error);
      this.logger.error(`Failed to send admin password reset email to ${to.email}`, error);
      return { success: false, errorMessage: String(reason) };
    }
  }

  async sendStaffInviteEmailWithStatus(
    to: { email: string; name: string; role: string },
    tempPassword: string,
  ): Promise<EmailDispatchResult> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const provider = await this.sendEmail({
        to: { email: to.email, name: to.name },
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
      this.logger.log(`Staff invite email sent to ${to.email} via ${provider}`);
      return { success: true, provider };
    } catch (error: any) {
      const reason = this.getErrorMessage(error);
      this.logger.error(`Failed to send staff invite email to ${to.email}`, error);
      return { success: false, errorMessage: String(reason) };
    }
  }

  async sendStaffInviteEmail(
    to: { email: string; name: string; role: string },
    tempPassword: string,
  ): Promise<boolean> {
    const dispatch = await this.sendStaffInviteEmailWithStatus(to, tempPassword);
    return dispatch.success;
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

  private getPasswordResetEmailTemplate(name: string, resetLink: string): string {
    const logoUrl = `${process.env.FRONTEND_URL || 'https://cvcc-iota.vercel.app'}/images/cvcc-logo.png`;
    const year = new Date().getFullYear();
    const requestTime = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra',
    });

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Password Reset – CVCC</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:36px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background-color:#0a6640;border-radius:6px 6px 0 0;padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" valign="middle">
                    <img src="${logoUrl}" alt="CVCC" width="48" height="48"
                         style="display:block;border-radius:6px;border:2px solid rgba(255,255,255,0.25);" />
                  </td>
                  <td width="14"></td>
                  <td valign="middle">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;line-height:1.2;">
                      Child Vaccination Command Center
                    </p>
                    <p style="margin:3px 0 0 0;font-size:11px;color:rgba(255,255,255,0.65);letter-spacing:0.5px;">
                      CVCC Digital Health Platform
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY CARD ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 32px 28px 32px;">

              <!-- Title -->
              <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#0a6640;text-transform:uppercase;letter-spacing:1.5px;">
                Password Reset
              </p>
              <p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#111827;">
                Hi, ${name}
              </p>
              <p style="margin:0 0 4px 0;font-size:11px;color:#9ca3af;">
                Requested on ${requestTime} (Ghana Time)
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

              <p style="margin:0 0 24px 0;font-size:14px;color:#374151;line-height:1.75;">
                We received a request to reset the password for your CVCC account. If you did not
                make this request, you can safely ignore this email — your account has not been changed.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="border-radius:5px;background-color:#0a6640;">
                    <a href="${resetLink}" target="_blank"
                       style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:5px;letter-spacing:0.3px;">
                      Reset My Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">
                This link expires in <strong>1 hour</strong> and can only be used once.
              </p>
              <p style="margin:0 0 24px 0;font-size:11px;color:#9ca3af;word-break:break-all;">
                Or copy this link: <span style="color:#0a6640;">${resetLink}</span>
              </p>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0;margin-bottom:8px;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                      <strong>Security tip:</strong> CVCC will never ask for your password by phone or email.
                      If you did not request this, contact your facility administrator immediately.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 6px 6px;padding:18px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.8;">
                &copy; ${year} Child Vaccination Command Center (CVCC) &nbsp;&middot;&nbsp; Ministry of Health, Ghana<br/>
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }

  private getEmailChangeVerificationTemplate(name: string, verificationLink: string): string {
    const year = new Date().getFullYear();
    const requestTime = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Email Change - CVCC</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td style="background-color:#0a6640;border-radius:6px 6px 0 0;padding:28px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">Child Vaccination Command Center</p>
              <p style="margin:6px 0 0 0;font-size:12px;color:rgba(255,255,255,0.75);">Email Verification</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:32px;">
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#111827;">Hi, ${name}</p>
              <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">Request time: ${requestTime} (Ghana Time)</p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

              <p style="margin:0 0 20px 0;font-size:14px;color:#374151;line-height:1.75;">
                We received a request to change your parent portal email address. Please confirm this update by clicking the button below.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
                <tr>
                  <td style="border-radius:5px;background-color:#0a6640;">
                    <a href="${verificationLink}" target="_blank"
                       style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:5px;letter-spacing:0.3px;">
                      Verify New Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">This verification link expires in <strong>30 minutes</strong>.</p>
              <p style="margin:0 0 22px 0;font-size:11px;color:#9ca3af;word-break:break-all;">If the button does not work, copy this link: <span style="color:#0a6640;">${verificationLink}</span></p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                      If you did not request this change, ignore this email. Your account email will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e5e7eb;border-radius:0 0 6px 6px;padding:18px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.8;">
                &copy; ${year} Child Vaccination Command Center (CVCC)<br/>
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
