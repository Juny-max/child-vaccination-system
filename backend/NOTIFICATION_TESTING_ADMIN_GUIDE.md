# CVCC Notification Testing - Admin Guide

## Overview

The notification testing system provides admins with terminal-based tools to test and verify email and SMS notification functionality. **No web interface needed** - everything runs from the command line.

## 📁 Files Created

1. **`scripts/test-notifications.ts`** - Main testing script with multiple templates
2. **`scripts/run-notification-tests.ts`** - Automated comprehensive test suite
3. **`scripts/quick-test-notifications.sh`** - Quick reference with ready-to-copy commands
4. **`TESTING_GUIDE.md`** - Detailed documentation with examples

## ⚡ Quick Start

### 1. Start Backend
```bash
cd backend
pnpm run start:dev
```

### 2. Run a Test (in a new terminal)
```bash
cd backend

# Test welcome email
npx ts-node scripts/test-notifications.ts --channel email --recipient your@email.com --template welcome

# Test SMS reminder
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template reminder

# Test both email and SMS
npx ts-node scripts/test-notifications.ts --channel both --recipient your@email.com --template reminder
```

### 3. View All Available Commands
```bash
bash scripts/quick-test-notifications.sh
```

## 🧪 Available Tests

### Email Templates
- **welcome** - New user onboarding email
- **password-reset** - Password reset link email
- **reminder** - Vaccination reminder email
- **custom** - Any custom email (provide subject & HTML)

### SMS Templates
- **reminder** - Vaccination reminder SMS
- **appointment** - Appointment confirmation SMS

### Channels
- **email** - Email only
- **sms** - SMS only
- **both** - Both email and SMS

## 📝 Examples

### Test 1: Welcome New Admin
```bash
npx ts-node scripts/test-notifications.ts --channel email --recipient admin@cvcc.com --template welcome
```

### Test 2: Send SMS Reminder to Parent
```bash
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template reminder
```

### Test 3: Custom Campaign Email
```bash
npx ts-node scripts/test-notifications.ts \
  --channel email \
  --recipient parent@example.com \
  --template custom \
  --subject "New Vaccine Available" \
  --html "<h2>Important Update</h2><p>Polio vaccine now available at your facility.</p>"
```

### Test 4: Run Full Test Suite
```bash
npx ts-node scripts/run-notification-tests.ts
```
This will run 7 tests and generate a report in `test-report-TIMESTAMP.txt`

## ✅ Expected Output

### Successful Test
```
============================================================
🧪 CVCC NOTIFICATION SYSTEM TEST
============================================================
Channel: email
Recipient: admin@cvcc.com
Template: welcome

📧 Sending welcome email to admin@cvcc.com...
   Subject: Welcome to Child Vaccination Command Center
   Recipient: admin@cvcc.com
   Status: ✅ Email service configured

------------------------------------------------------------
📊 TEST SUMMARY:
  Email: ✅ PASS
============================================================
```

### Full Test Suite Report
```
============================================================
📊 NOTIFICATION SYSTEM TEST REPORT
============================================================
Total Tests: 7
✅ Passed: 7
❌ Failed: 0
⏱️ Total Duration: 45ms
📈 Pass Rate: 100.0%
============================================================
```

## 🔧 Troubleshooting

### Error: Port 3001 not responding
```bash
# Make sure backend is running
cd backend
pnpm run start:dev
```

### Error: Script not found
```bash
# Make sure you're in the backend directory
cd backend
npx ts-node scripts/test-notifications.ts --help
```

### Error: Email test shows "endpoint unavailable"
- This is expected if Brevo API key is not configured
- The terminal script works independently of Brevo

## 📊 Test Options Reference

| Option | Example | Description |
|--------|---------|-------------|
| `--channel` | `email` \| `sms` \| `both` | Notification channel |
| `--recipient` | `user@email.com` or `+233501234567` | Who to send to |
| `--template` | `welcome` \| `reminder` \| `custom` | Template type |
| `--subject` | `"My Subject"` | Email subject (custom only) |
| `--html` | `"<p>Content</p>"` | Email HTML (custom only) |
| `--message` | `"Text message"` | SMS text (custom only) |

## 🎯 Admin Testing Checklist

- [ ] Backend running on port 3001
- [ ] Test welcome email
- [ ] Test password reset email
- [ ] Test vaccination reminder
- [ ] Test custom email
- [ ] Test SMS reminder
- [ ] Test SMS appointment notification
- [ ] Run comprehensive test suite
- [ ] Check test reports generated

## 📚 Full Documentation

For detailed information, see `backend/TESTING_GUIDE.md`

## 🚀 Use Cases

### Scenario 1: Verify System After Deployment
```bash
npx ts-node scripts/run-notification-tests.ts
```

### Scenario 2: Test New Email Campaign
```bash
npx ts-node scripts/test-notifications.ts \
  --channel email \
  --recipient test@example.com \
  --template custom \
  --subject "Campaign Title" \
  --html "<content>"
```

### Scenario 3: Test SMS Notifications
```bash
npx ts-node scripts/test-notifications.ts --channel sms --recipient +233501234567 --template reminder
```

### Scenario 4: Full System Health Check
```bash
npx ts-node scripts/run-notification-tests.ts
```

## 💡 Tips

1. **Save successful commands** - Use `--template custom` for recurring tests
2. **Check test reports** - Full suite generates timestamped reports
3. **Test both channels** - Always test `--channel both` before production
4. **Verify backend** - Ensure `pnpm run start:dev` shows no errors first

## 🆘 Support

For issues or questions:
1. Check `backend/TESTING_GUIDE.md` for detailed documentation
2. Verify backend is running: `lsof -i :3001`
3. Run help: `npx ts-node scripts/test-notifications.ts --help`
4. Check test reports for detailed logs

---

**Version:** 1.0  
**Date:** March 16, 2026  
**Status:** Production Ready
