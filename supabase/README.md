# Database Schema Documentation

## Overview

This is the complete database schema for the **Ghana Child Vaccination Command Center** system. The database is built on **PostgreSQL** (via Supabase) and contains **21 core tables** organized into logical groups.

## Database Structure

### 📊 Summary Statistics
- **Total Tables:** 21
- **Total Enums:** 15
- **Total Indexes:** 30+
- **Foreign Keys:** 25+
- **Database:** PostgreSQL 15+ (Supabase)

---

## Table Groups

### 1️⃣ Users & Authentication (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | All system users (HQ, Branch Manager, Nurse, CHW, Data Officer, PHA, Parents) | email, role, branch_id |
| **branches** | Health facilities/branches | name, code, region, manager_id |

### 2️⃣ Organizational Structure (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **catchment_areas** | Geographic territories for CHWs | name, branch_id, assigned_chw_id, polygon |

### 3️⃣ Mothers/Guardians (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **guardians** | Parents/caregivers information | full_name, phone_primary, user_id, catchment_area_id |

### 4️⃣ Children (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **children** | Child records with UUID & QR codes | cvcc_id, qr_code_payload, full_name, date_of_birth |
| **child_guardian** | Many-to-many relationship between children & guardians | child_id, guardian_id, relationship |

### 5️⃣ Vaccination System (3 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **vaccines** | Master vaccine catalog (BCG, Polio, Measles, etc.) | code, name, status |
| **vaccination_schedules** | National dosing rules (when vaccines are due) | vaccine_id, dose_number, due_days_from_birth |
| **vaccination_events** | Actual vaccine doses administered | child_id, vaccine_id, administered_date, batch_number |

### 6️⃣ Medical Safety (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **aefi_reports** | Adverse Event Following Immunization reports | vaccination_event_id, symptoms, severity, status |

### 7️⃣ Certificates & Appointments (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **certificates** | Digital vaccination certificates | certificate_id, child_id, qr_payload, completion_status |
| **appointments** | Scheduled vaccination appointments | child_id, vaccine_id, scheduled_date, status |

### 8️⃣ Notifications (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **notifications** | SMS/Email notification log | recipient_id, channel, message, status |
| **notification_templates** | Reusable message templates | id, sms_template, email_template, variables |

### 9️⃣ Field Operations (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **visit_logs** | CHW household visits | chw_id, child_id, gps_coordinates, visit_date |

### 🔟 Offline Sync (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **sync_queue** | Offline sync pending operations | user_id, entity_type, payload, status |

### 1️⃣1️⃣ Data Quality (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **duplicate_candidates** | Potential duplicate children | child_a_id, child_b_id, similarity_score, status |
| **sync_conflicts** | Merge conflicts requiring resolution | entity_type, local_data, server_data, status |

### 1️⃣2️⃣ System Administration (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **audit_logs** | Immutable change tracking | user_id, action, entity_type, before_data, after_data |
| **system_settings** | App configuration | id, category, value |

### 1️⃣3️⃣ Optional: Stock Management (1 table)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **stock_inventory** | Vaccine batch/lot tracking | vaccine_id, facility_id, batch_number, expiry_date |

---

## Enums (Custom Types)

```sql
user_role: 'hq-admin' | 'branch-manager' | 'facility-nurse' | 'chw' | 'data-officer' | 'pha' | 'parent'
user_status: 'active' | 'inactive' | 'suspended'
contact_method: 'sms' | 'email' | 'whatsapp'
gender_type: 'male' | 'female' | 'intersex' | 'undisclosed'
vaccine_status: 'active' | 'archived' | 'discontinued'
vaccination_site: 'left-arm-upper' | 'right-arm-upper' | 'left-thigh' | 'right-thigh' | 'oral' | 'intranasal' | 'other'
vaccination_event_status: 'completed' | 'missed' | 'refused' | 'contraindicated'
aefi_severity: 'mild' | 'moderate' | 'severe' | 'life-threatening'
aefi_status: 'reported' | 'under-review' | 'investigated' | 'resolved' | 'escalated'
certificate_status: 'draft' | 'issued' | 'revoked' | 'expired'
appointment_status: 'scheduled' | 'confirmed' | 'completed' | 'missed' | 'cancelled'
notification_channel: 'sms' | 'email' | 'whatsapp' | 'push'
notification_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
visit_status: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'rescheduled'
sync_status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
duplicate_status: 'pending' | 'merged' | 'dismissed' | 'under-review'
audit_action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'merge' | 'access'
```

---

## Key Relationships

### Parent-Child Relationships
- **users** → **branches** (branch_id)
- **branches** → **users** (manager_id)
- **catchment_areas** → **branches** (branch_id)
- **catchment_areas** → **users** (assigned_chw_id)
- **guardians** → **users** (user_id for parent portal)
- **guardians** → **catchment_areas** (catchment_area_id)
- **children** → **branches** (primary_facility_id)
- **child_guardian** → **children** + **guardians** (many-to-many)

### Vaccination Flow
- **vaccination_schedules** → **vaccines**
- **vaccination_events** → **children** + **vaccines** + **users** (administered_by)
- **aefi_reports** → **vaccination_events** + **children**
- **certificates** → **children** + **users** (issued_by)
- **appointments** → **children** + **vaccines** + **branches**

### Data Quality & Sync
- **duplicate_candidates** → **children** (child_a_id, child_b_id)
- **sync_queue** → **users** (user_id)
- **sync_conflicts** → **sync_queue**
- **visit_logs** → **users** (chw_id) + **children**

---

## How to Set Up

### Step 1: Connect to Supabase

1. Open your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: **pvzatstzlvtaequsqhec**
3. Navigate to **SQL Editor**

### Step 2: Run Schema SQL

1. Copy the contents of `schema.sql`
2. Paste into Supabase SQL Editor
3. Click **Run** to execute

This will create:
- ✅ All 21 tables
- ✅ All enums
- ✅ All indexes
- ✅ All foreign keys
- ✅ All triggers (for auto-updating `updated_at`)
- ✅ Row Level Security (enabled, policies to be added later)

### Step 3: Run Seed Data (Optional)

1. Copy the contents of `seed.sql`
2. Paste into Supabase SQL Editor
3. Click **Run** to execute

This will populate:
- ✅ 4 branches (Accra, Tamale, Kumasi, Cape Coast)
- ✅ 10+ users (admins, nurses, CHWs, data officer, PHA)
- ✅ 3 catchment areas
- ✅ 4 guardians
- ✅ 5 children
- ✅ 17 vaccines (Ghana National Immunization Schedule)
- ✅ 17 vaccination schedules
- ✅ 4 notification templates
- ✅ 7 system settings

---

## Important Notes

### 🔐 Row Level Security (RLS)

RLS is **enabled** on all tables but **policies are NOT yet configured**. You'll need to add policies like:

```sql
-- Example: Parents can only see their own children
CREATE POLICY "Parents can view their children" ON children
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM child_guardian cg
      JOIN guardians g ON cg.guardian_id = g.id
      WHERE cg.child_id = children.id 
        AND g.user_id = auth.uid()
    )
  );
```

### 🗺️ PostGIS Extension

The schema uses **PostGIS** for geo-spatial features:
- `gps_coordinates` (POINT type) for facility locations, CHW visits
- `polygon` (GEOMETRY type) for catchment area boundaries

If you don't need geo features, you can:
1. Comment out `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Change `POINT` columns to `TEXT` (store as "lat,lon")
3. Change `GEOMETRY` columns to `JSONB` (store as GeoJSON)

### 🔄 Auto-Update Timestamps

All tables with `updated_at` have triggers that automatically update the timestamp on every UPDATE.

### 📊 Indexes

Performance indexes are created on:
- All foreign keys
- Frequently queried fields (email, phone, dates, status)
- Search fields (cvcc_id, certificate_id)

---

## Next Steps

After setting up the database:

1. **Configure RLS Policies** - Define who can access what data
2. **Create TypeScript Types** - Generate types from database schema
3. **Build NestJS Backend** - Create API endpoints
4. **Connect Next.js Frontend** - Update frontend to use real data

---

## Field Descriptions

### Children Table
- **cvcc_id**: Child Vaccination Command Center ID (e.g., CH-2025-001)
- **qr_code_payload**: QR code data for quick lookup (JWT or signed JSON)
- **allergies**: Array of allergies (PostgreSQL TEXT[])
- **critical_notes**: Important medical information

### Vaccination Events
- **batch_number**: Vaccine batch number for quality tracking
- **lot_number**: Manufacturer lot number
- **expiry_date**: Vaccine expiry date
- **is_synced**: FALSE for offline-captured records awaiting sync

### Guardians
- **ghana_card_number**: National ID number
- **nhis_number**: National Health Insurance Scheme number
- **preferred_contact**: Communication preference (sms/email/whatsapp)

### Notifications
- **template_id**: References notification_templates.id
- **metadata**: JSON field for additional context (child_id, vaccine_id, etc.)
- **retry_count**: Number of delivery retry attempts

---

## Ghana National Immunization Schedule

The seed data includes all vaccines from Ghana's schedule:

| Age | Vaccines |
|-----|----------|
| **At birth** | BCG, OPV-0 |
| **6 weeks** | OPV-1, Penta-1, PCV-1, Rotavirus-1 |
| **10 weeks** | OPV-2, Penta-2, PCV-2, Rotavirus-2 |
| **14 weeks** | OPV-3, Penta-3, PCV-3 |
| **9 months** | Measles-Rubella-1, Yellow Fever, Meningococcal A |
| **18 months** | Measles-Rubella-2 |

Where:
- **Penta** = DPT-HepB-Hib (5-in-1)
- **PCV** = Pneumococcal Conjugate Vaccine
- **OPV** = Oral Polio Vaccine
- **MR** = Measles-Rubella

---

## Support

For database schema questions or issues:
- Check Supabase logs in Dashboard → Database → Logs
- Review PostgreSQL error messages
- Ensure all foreign key references are valid

---

**Last Updated:** January 1, 2026  
**Database Version:** 1.0.0  
**PostgreSQL Version:** 15+
