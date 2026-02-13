# Automated Vaccination Reminders

## Overview

The system now automatically sends SMS reminders to parents/guardians when their child's vaccination is **DUE TODAY**.

## How It Works

### 1. **Automated Daily Schedule**
- **Trigger Time**: Every day at **8:00 AM Ghana Time (Africa/Accra timezone)**
- **Cron Expression**: `0 8 * * *`
- **Service**: `VaccinationSchedulerService`

### 2. **Process Flow**

1. **Check All Active Children**
   - Queries all children with `status = 'active'`
   - Gets their date of birth and guardian information

2. **Calculate Due Vaccinations**
   - For each child, calculates upcoming vaccinations based on:
     - Child's date of birth
     - Vaccination schedules (e.g., "6 weeks", "10 weeks", "14 weeks")
     - Completed vaccinations (to avoid duplicates)

3. **Filter Vaccinations Due Today**
   - Only sends SMS for vaccinations due on the current date
   - Skips vaccinations that are overdue or due in the future

4. **Send SMS Notifications**
   - Uses Hubtel SMS API
   - Format: `"REMINDER: [Child Name]'s [Vaccine Name] vaccination is DUE TODAY ([Schedule Name]). Please visit your health facility today. - CVCC Ghana"`
   - Example: `"REMINDER: Esi Boadu's BCG vaccination is DUE TODAY (At birth). Please visit your health facility today. - CVCC Ghana"`

5. **Log Notifications**
   - Records each SMS in the `notifications` table
   - Tracks: recipient, channel (SMS), status, timestamp, and metadata

## Testing

### Manual Trigger (For Testing)

You can manually trigger the vaccination reminder check without waiting for 8 AM:

**Endpoint**: `POST /api/chatbot/test-vaccination-reminders`

**PowerShell Example**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/chatbot/test-vaccination-reminders" -Method POST
```

**Response**:
```json
{
  "success": true,
  "message": "Vaccination reminders sent. Check logs for details."
}
```

### Check Backend Logs

After triggering (manually or automatically), check the backend terminal for logs like:

```
[VaccinationSchedulerService] Starting daily vaccination reminder check...
[VaccinationSchedulerService] Checking 150 children for due vaccinations...
[VaccinationSchedulerService] ✓ Sent reminder to Akosua Asante for Esi Boadu - BCG
[VaccinationSchedulerService] ✓ Sent reminder to Mary Mensah for Kojo Owusu - OPV
[VaccinationSchedulerService] Vaccination reminder check complete. Sent: 2, Skipped: 0
```

## SMS Message Format

```
REMINDER: [Child's Name]'s [Vaccine Name] vaccination is DUE TODAY ([Schedule Name]).
Please visit your health facility today. - CVCC Ghana
```

**Real Example**:
```
REMINDER: Esi Boadu's Pentavalent vaccination is DUE TODAY (6 weeks).
Please visit your health facility today. - CVCC Ghana
```

## Database Tables Used

### 1. **children**
- Fields: `id`, `full_name`, `date_of_birth`, `guardian_id`, `status`
- Used to get active children

### 2. **vaccination_schedules**
- Fields: `vaccine_id`, `dose_number`, `schedule_name`, `due_days_from_birth`
- Defines when each vaccine dose is due (e.g., BCG at birth, OPV at 6 weeks)

### 3. **vaccination_events**
- Fields: `child_id`, `vaccine_id`, `dose_number`, `status`
- Tracks completed vaccinations to avoid sending reminders for already-given doses

### 4. **guardians**
- Fields: `id`, `full_name`, `phone_primary`, `preferred_contact`
- Contains parent/guardian phone numbers for SMS

### 5. **notifications**
- Fields: `template_id`, `recipient_id`, `channel`, `status`, `content`, `sent_at`
- Logs all sent notifications for tracking and audit

## Environment Variables Required

Make sure these are set in `backend/.env`:

```env
# Hubtel SMS Configuration
HUBTEL_CLIENT_ID=your_client_id
HUBTEL_CLIENT_SECRET=your_client_secret
HUBTEL_SENDER_NAME=CVCC
HUBTEL_API_URL=https://smsc.hubtel.com/v1/messages/send

# Frontend URL (for links in messages)
FRONTEND_URL=http://localhost:3000
```

## Production Deployment

### On Render (or other hosting):

1. **Set Environment Variables**:
   - Add `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_SENDER_NAME`
   - Ensure timezone is set to `Africa/Accra` or equivalent

2. **Verify Cron Schedule**:
   - The cron job runs automatically once deployed
   - No additional configuration needed

3. **Monitor Logs**:
   - Check Render logs daily around 8 AM Ghana time
   - Look for "Starting daily vaccination reminder check..."

## Customization

### Change Schedule Time

Edit `backend/src/common/vaccination-scheduler.service.ts`:

```typescript
@Cron('0 8 * * *', {  // <-- Change this line
  name: 'vaccination-due-today-reminders',
  timeZone: 'Africa/Accra',
})
```

**Examples**:
- `0 9 * * *` - 9:00 AM daily
- `0 8 * * 1-5` - 8:00 AM Monday to Friday only
- `0 8,14 * * *` - 8:00 AM and 2:00 PM daily

### Change SMS Message

Edit the `message` variable in `sendVaccinationDueTodayReminders()`:

```typescript
const message = `REMINDER: ${child.full_name}'s ${vaccineName} vaccination is DUE TODAY (${vaccination.schedule_name}). Please visit your health facility today. - CVCC Ghana`;
```

## Troubleshooting

### No SMS Sent

1. **Check Hubtel Credentials**: Verify `HUBTEL_CLIENT_ID` and `HUBTEL_CLIENT_SECRET` are correct
2. **Check Phone Numbers**: Ensure guardians have valid `phone_primary` in the database
3. **Check Vaccination Schedules**: Verify children have upcoming vaccinations due today

### SMS Sent But Not Received

1. **Phone Number Format**: Must be in format `233XXXXXXXXX` (Ghana)
2. **Hubtel Account**: Ensure account has SMS credits
3. **Check Notifications Table**: Query database to see if SMS was logged as 'sent'

### Cron Not Running

1. **Check Logs**: Look for "Starting daily vaccination reminder check..." at 8 AM
2. **Restart Backend**: Sometimes deploying new code requires a restart
3. **Timezone**: Verify server timezone is correct

## Future Enhancements

- [ ] SMS reminders 1 day before vaccination due date
- [ ] Email reminders (in addition to SMS)
- [ ] SMS for overdue vaccinations (e.g., "Your child missed a vaccination!")
- [ ] WhatsApp integration
- [ ] Configurable reminder times per guardian preference
- [ ] Multi-language support (English, Twi, Ga, etc.)

## Related Files

- `backend/src/common/vaccination-scheduler.service.ts` - Main scheduler logic
- `backend/src/common/sms.service.ts` - SMS sending service
- `backend/src/common/database/database.service.ts` - Database queries
- `backend/src/app.module.ts` - Module configuration
