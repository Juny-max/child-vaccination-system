# CVCC Notification Testing Guide

This guide explains how to test the notification system (Email & SMS) using the command line testing script.

## Prerequisites

- Backend running (`pnpm run start:dev`)
- Node.js and TypeScript configured
- Valid email address or phone number for testing

## Quick Start

### Test Welcome Email
```bash
npx ts-node scripts/test-notifications.ts --channel email --recipient your-email@example.com --template welcome
```

### Test SMS Reminder
```bash
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template reminder
```

### Test Both Email & SMS
```bash
npx ts-node scripts/test-notifications.ts --channel both --recipient your-email@example.com --template reminder
```

## Available Templates

### 1. **Welcome Email**
Sent when new users register to the system.
```bash
npx ts-node scripts/test-notifications.ts --channel email --recipient user@example.com --template welcome
```

### 2. **Password Reset Email**
Sent when users request password reset.
```bash
npx ts-node scripts/test-notifications.ts --channel email --recipient user@example.com --template password-reset
```

### 3. **Vaccination Reminder**
Sent to remind parents/guardians about upcoming vaccinations.
```bash
npx ts-node scripts/test-notifications.ts --channel email --recipient user@example.com --template reminder
```

### 4. **Appointment Notification (SMS)**
Sent to confirm scheduled appointments.
```bash
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template appointment
```

### 5. **Custom Email**
Send a custom email with your own subject and HTML content.
```bash
npx ts-node scripts/test-notifications.ts \
  --channel email \
  --recipient user@example.com \
  --template custom \
  --subject "Your Custom Subject" \
  --html "<h1>Hello!</h1><p>This is a custom notification.</p>"
```

## Command Options

| Option | Values | Description |
|--------|--------|-------------|
| `--channel` | `email`, `sms`, `both` | Which notification channel to test (default: email) |
| `--recipient` | Email or Phone | Recipient email address or phone number |
| `--template` | See above | Which template to use (default: welcome) |
| `--subject` | Any text | Subject line for custom emails |
| `--html` | HTML text | HTML content for custom emails |
| `--message` | Any text | Message text for custom SMS |

## Testing Workflow

### 1. Test Email Service
```bash
# Start backend
cd backend
pnpm run start:dev

# In a new terminal, test email
npx ts-node scripts/test-notifications.ts --channel email --recipient admin@cvcc.com --template welcome
```

### 2. Test SMS Service
```bash
# Test SMS (requires Hubtel API configured)
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template reminder
```

### 3. Test Custom Notification
```bash
npx ts-node scripts/test-notifications.ts \
  --channel email \
  --recipient test@example.com \
  --template custom \
  --subject "Campaign: New Vaccine Available" \
  --html "<p>A new vaccine is now available at your facility.</p>"
```

## Expected Output

When tests run successfully, you'll see:

```
============================================================
🧪 CVCC NOTIFICATION SYSTEM TEST
============================================================
Channel: email
Recipient: user@example.com
Template: welcome

📧 Sending welcome email to user@example.com...
   Subject: Welcome to Child Vaccination Command Center
   Recipient: user@example.com
   Status: ✅ Email service configured

------------------------------------------------------------
📊 TEST SUMMARY:
  Email: ✅ PASS
============================================================
```

## Troubleshooting

### Error: "BREVO_API_KEY is not set"
**Solution:** Update `backend/.env` with a valid Brevo API key for email delivery.

### Error: "Hubtel credentials not configured"
**Solution:** Update `backend/.env` with valid Hubtel SMS credentials.

### Port 3001 not responding
**Solution:** Ensure backend is running:
```bash
cd backend
pnpm run start:dev
```

### Script not found
**Solution:** Ensure you're in the backend directory:
```bash
cd backend
npx ts-node scripts/test-notifications.ts --help
```

## Admin Notification Test Checklist

Use this checklist to verify the notification system is working:

- [ ] Test welcome email to admin account
- [ ] Test password reset email
- [ ] Test vaccination reminder email
- [ ] Test appointment SMS notification
- [ ] Test custom email with campaign message
- [ ] Verify emails arrive in inbox (not spam)
- [ ] Verify SMS arrives on test phone
- [ ] Check email contains correct links/information
- [ ] Document any failures for debugging

## Environment Configuration

Ensure these variables are set in `backend/.env`:

```env
# Email (Brevo)
BREVO_API_KEY=your_api_key_here
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_FROM=noreply@cvcc.com

# SMS (Hubtel)
HUBTEL_CLIENT_ID=your_client_id
HUBTEL_CLIENT_SECRET=your_client_secret
HUBTEL_SENDER_NAME=CVCC

# Frontend
FRONTEND_URL=http://localhost:3000
```

## For Developers

To integrate new notification templates:

1. Add template type to `NotificationTestConfig` interface
2. Create handler method in `emailService` or `smsService`
3. Add case handling in test logic
4. Update this guide with usage example

---

**Last Updated:** March 16, 2026
**Status:** Production Ready
