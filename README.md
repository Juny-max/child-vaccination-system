<!-- markdownlint-disable -->

# Child Vaccination Command Center (CVCC)

**Vaccination Tracking System for Ghana — currently piloting in Nungua and surrounding communities, Greater Accra**

## 🚀 Project Status

**Frontend:** ✅ Complete (Next.js 16 + React 19 + TypeScript + Tailwind CSS)  
**Database:** ✅ Schema designed and seeded in Supabase (PostgreSQL)  
**Backend:** ✅ Deployed (NestJS API running on Render → `https://child-vaccination-system-e18o.onrender.com/api`)

---

## 🗺️ Scope

The system is built to support **any number of facilities and communities** across Ghana. The current seed data covers the Nungua pilot in the Ledzokuku-Krowor district, Greater Accra. New facilities can be added through the HQ Admin dashboard without any code changes.

### Pilot Facilities (Seed Data)

| Facility | Code | Community |
|---|---|---|
| Nungua Health Centre | BR-NUN-01 | Nungua Barrier |
| Sakumono Polyclinic | BR-SAK-01 | Sakumono Estate |
| Teshie Community Clinic | BR-TES-01 | Teshie-Nungua |

### CHW Catchment Zones

| Zone | Community | Est. Population |
|---|---|---|
| Nungua Barrier Zone | Nungua Barrier | 12,000 |
| Sakumono Estate Zone | Sakumono Estate | 14,000 |
| Teshie-Nungua Zone | Teshie-Nungua | 16,000 |

---

## 👥 Team Collaboration

### Work Division

**Developer 1 (Juny):**
- Branch Manager Backend
- Facility Nurse Backend
- Parent Portal Backend
- Facility Nurse Backend  
- Community Health Worker (CHW) Backend
- Public certificate verification workflow

**Developer 2 (Julius):**
- HQ Admin Backend
- Branch Manager Backend
- Shared platform maintenance

### Git Workflow

**⚠️ JULIUS: DO NOT PUSH TO `main` BRANCH!**

All backend development happens on the `backend` branch:

```bash
git checkout backend
git pull origin backend

# Make your changes, then:
git add .
git commit -m "feat: your change description"
git push origin backend
```

---

## 🛠️ Quick Start

### Prerequisites

- **Node.js 18+** (with pnpm package manager)
- **Supabase Account** (project team access)
- **Git** for version control

### Run Both Servers

```bash
# Install dependencies
pnpm install
pnpm --dir backend install

# Start frontend (port 3000)
pnpm dev

# Start backend (port 3001) — in a second terminal
cd backend && pnpm run start:dev
```

Or use the combined script (pulls latest first):

```bash
pnpm run dev:all
```

Visit `http://localhost:3000`

### Frontend Environment Setup (Contact Form)

Create a root `.env.local` file for the landing-page contact form API route:

```env
BREVO_API_KEY=<Brevo API key used by Next.js contact route>
CONTACT_SUPPORT_EMAIL=support@cvcc.gov.gh
CONTACT_SENDER_EMAIL=noreply@cvcc.gov.gh
CONTACT_SENDER_NAME=CVCC Website
```

---

## 🧰 Backend API (NestJS)

### Local Environment Setup

1. `cd backend`
2. Create `.env` with the following keys:

- `SUPABASE_URL=https://pvzatstzlvtaequsqhec.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase → Settings → API>`
- `JWT_SECRET=<any strong string>`
- `PORT=3001`
- `CORS_ORIGIN=http://localhost:3000`
- `BREVO_API_KEY=<Brevo API key for transactional email>`
- `SMTP_FROM=<verified sender email in Brevo, e.g. no-reply@yourdomain.com>`
- `FRONTEND_URL=http://localhost:3000`
- `BACKUP_DIR=./backups`
- `BACKUP_ENCRYPTION_KEY=<64 hex chars>`
- `BACKUP_RETENTION_DAYS=30`

Generate a 64-character hex key for `BACKUP_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
1. Install dependencies once: `pnpm install`
2. Start the watcher: `pnpm run start:dev`
3. The API boots on `http://localhost:3001` (all routes are under `/api`).

### Quick verification (demo login)

1. Start the backend watcher: `pnpm run start:dev` (inside the `backend` folder).
2. Open a second PowerShell window and run:

```powershell
cd backend
$headers = @{"Content-Type"="application/json"}
$body = '{"email":"akosua.asante@example.com","password":"password1234","userType":"parent"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -Headers $headers
```

3. `pnpm install`
4. `pnpm run start:dev`

The API boots on `http://localhost:3001` (all routes under `/api`).

### Quick Verification (demo login)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nurse@health.gov.gh","password":"password1234","userType":"parent"}'
```

### Useful Scripts

```bash
# Reset a user's password
npx ts-node scripts/reset-password.ts

# List all users, roles and facilities
npx ts-node scripts/list-users.ts

The output groups users by role and shows their email, assigned facility (branch), status, and last login date. Useful for verifying which nurse belongs to which hospital.

### Managing hospitals/facilities and assigning branch managers (terminal)

To create hospitals first, view them, and assign a Branch Manager directly to a selected hospital:

```powershell
cd backend
npx ts-node scripts/manage-facilities.ts
```

The tool opens an interactive menu to:
- View all hospitals/facilities
- Create a facility with name and district
- Assign a Branch Manager to a selected facility
- Delete a facility (with dependency checks)

It updates both the facility record and manager assignment links so the Branch Manager is tied to the correct branch when they log in.
When deleting, if a facility only has catchment areas (and no staff/children), the tool can remove those catchment areas and delete the facility in one flow.

### Testing SMTP email delivery (terminal)

To verify the email service is working and messages can be delivered:

```powershell
cd backend
npx ts-node scripts/test-email.ts

# Safely delete a user (handles FK constraints)
npx ts-node scripts/delete-user.ts
```

---

## 🗄️ Database (Supabase)

**Project:** Ghana Vaccination System  
**URL:** `https://pvzatstzlvtaequsqhec.supabase.co`

### Schema Files

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Full database schema (21 tables, 15 enums) |
| `supabase/seed.sql` | Nungua-scoped seed data |
| `supabase/seed-parent-demo.sql` | Akosua Asante demo parent account |
| `lib/database.types.ts` | TypeScript types for all tables |

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | All system users (5 active roles: parent, hq-admin, branch-manager, facility-nurse, chw) |
| `branches` | Health facilities and catchment areas |
| `guardians` | Parent/guardian profiles |
| `children` | Child records with CVCC IDs and QR codes |
| `vaccines` | Ghana National Immunization Schedule (17 vaccines) |
| `vaccination_events` | Individual dose records |
| `certificates` | Digital vaccination certificates |
| `appointments` | Scheduled clinic visits |
| `notifications` | SMS/Email alerts |
| `visit_logs` | CHW door-to-door activity |
| `sync_queue` | Offline sync tracking |
| `duplicate_candidates` | Legacy deduplication queue (not in active role workflows) |
| `audit_logs` | System activity tracking |
| `catchment_areas` | CHW geographic zones |

---

## 👤 User Roles

### Core Active Modules

#### 1. **HQ Admin Module**

- Branch management (CRUD operations for facilities)
- User management (create/update/delete users across all non-HQ-admin roles)
- Vaccine configuration (manage master vaccine catalog)
- Catchment area management
- System settings and configurations
- Audit log viewing

**Key Endpoints:**

- `GET /branches` - List all branches
- `POST /branches` - Create new branch
- `PUT /branches/:id` - Update branch
- `DELETE /branches/:id` - Delete branch
- `GET /users` - List all users with filtering
- `POST /users` - Create new user (all roles except `hq-admin`)
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Deactivate user
- `GET /vaccines` - List all vaccines
- `POST /vaccines` - Add new vaccine to catalog
- `GET /audit-logs` - View system audit trail
- `GET /system-settings` - Get system configurations
- `PUT /system-settings` - Update system settings

#### 2. **Branch Manager Module**

- View branch-level analytics and KPIs
- Manage branch staff (nurses, CHWs assigned to their branch)
- View and approve CHW visit logs
- Generate branch performance reports
- Manage branch-specific appointments

**Key Endpoints:**

- `GET /branch/:branchId/analytics` - Branch dashboard metrics
- `GET /branch/:branchId/staff` - List staff at branch
- `PUT /branch/:branchId/staff/:userId` - Update staff assignment
- `GET /branch/:branchId/visit-logs` - CHW activity logs
- `POST /branch/:branchId/visit-logs/:id/approve` - Approve CHW visit
- `GET /branch/:branchId/reports` - Generate branch reports
- `GET /branch/:branchId/appointments` - Branch appointments

#### 3. **Public Certificate Verification (Current Scope)**

- Public verification is now available to everyone via the Next.js route `/verify`.
- Verification APIs are exposed from `app/api/verify` and `app/api/verify/token`.
- The flow supports QR scan, manual token input, and seeded/generated certificate compatibility.

### NestJS Project Setup

\`\`\`bash

# Create NestJS backend (inside project root)

npx @nestjs/cli new backend

# Choose pnpm as package manager when prompted

cd backend

# Install required dependencies

pnpm add @supabase/supabase-js
pnpm add @nestjs/config
pnpm add @nestjs/jwt
pnpm add @nestjs/passport passport passport-jwt
pnpm add class-validator class-transformer

# Install dev dependencies

pnpm add -D @types/passport-jwt
\`\`\`

### Backend Folder Structure (Active Modules)

\`\`\`
backend/
├── src/
│   ├── auth/                 # Authentication module (Juny will handle)
│   ├── hq-admin/             # JULIUS: HQ Admin endpoints
│   │   ├── hq-admin.controller.ts
│   │   ├── hq-admin.service.ts
│   │   ├── hq-admin.module.ts
│   │   └── dto/              # Data Transfer Objects
│   ├── branch-manager/       # JULIUS: Branch Manager endpoints
│   │   ├── branch-manager.controller.ts
│   │   ├── branch-manager.service.ts
│   │   └── branch-manager.module.ts
│   ├── common/               # Shared utilities, guards, decorators
│   │   ├── guards/           # Role-based auth guards
│   │   ├── decorators/       # Custom decorators
│   │   └── database.service.ts  # Supabase client wrapper
│   ├── parent/               # Juny will create this
│   ├── facility-nurse/       # Juny will create this
│   ├── chw/                  # Juny will create this
│   └── main.ts
├── .env                      # Backend environment variables
└── package.json
\`\`\`

### Backend Environment Setup

Create `backend/.env` for active backend modules:

\`\`\`env
SUPABASE_URL=<https://pvzatstzlvtaequsqhec.supabase.co>
SUPABASE_ANON_KEY=<copy from .env.local in project root>
SUPABASE_SERVICE_ROLE_KEY=<ask project lead if needed>
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3001
\`\`\`

**Note:** Copy the full `NEXT_PUBLIC_SUPABASE_ANON_KEY` value from the `.env.local` file (not the truncated version shown above).

### Example: Creating Your First Module

\`\`\`bash
cd backend

# Generate HQ Admin module

nest g module hq-admin
nest g controller hq-admin
nest g service hq-admin
\`\`\`

### Example: HQ Admin Controller

\`\`\`typescript
// backend/src/hq-admin/hq-admin.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { HqAdminService } from './hq-admin.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../auth/decorators/roles.decorator'

@Controller('hq-admin')
@UseGuards(JwtAuthGuard)
@Roles('hq-admin')  // Only HQ admins can access
export class HqAdminController {
  constructor(private readonly hqAdminService: HqAdminService) {}

  @Get('branches')
  async getAllBranches() {
    return this.hqAdminService.getAllBranches()
  }

  @Post('branches')
  async createBranch(@Body() createBranchDto: any) {
    return this.hqAdminService.createBranch(createBranchDto)
  }

  @Get('users')
  async getAllUsers() {
    return this.hqAdminService.getAllUsers()
  }
}
\`\`\`

### Example: HQ Admin Service

\`\`\`typescript
// backend/src/hq-admin/hq-admin.service.ts
import { Injectable } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'

@Injectable()
export class HqAdminService {
  private supabase

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )
  }

  async getAllBranches() {
    const { data, error } = await this.supabase
      .from('branches')
      .select('*')
      .order('name')

    if (error) throw error
    return data
  }

  async createBranch(branchData: any) {
    const { data, error } = await this.supabase
      .from('branches')
      .insert(branchData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getAllUsers() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, full_name, role, status, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }
}
\`\`\`

### Running the Backend

\`\`\`bash
cd backend

# Development mode

pnpm run start:dev

# Backend will run on <http://localhost:3001>

\`\`\`

### Testing Your Endpoints

Use **Postman** or **Thunder Client** (VS Code extension):

\`\`\`bash

# Example: Get all branches

GET <http://localhost:3001/hq-admin/branches>

# Example: Create branch

POST <http://localhost:3001/hq-admin/branches>
Content-Type: application/json

{
  "name": "Kumasi Regional Hospital",
  "branch_type": "regional_hospital",
  "region": "Ashanti",
  "city": "Kumasi",
  "status": "active"
}
\`\`\`

---

---

## 📋 System Features

### For Health Teams (Portal Login)

- **Child Registration**: Register children with UUID and QR codes
- **Vaccination Recording**: Record vaccine doses with batch tracking
- **Dashboard Analytics**: Real-time coverage, dropout rate, and performance metrics
- **Offline Support**: Record data without internet, auto-sync when online
- **Report Generation**: Export coverage data and performance metrics

### For Parents (Portal Login)

- **View Records**: See a child&apos;s complete vaccination history
- **Digital Certificates**: Download official vaccination certificates with QR codes
- **Appointment Reminders**: Receive SMS/Email notifications for upcoming doses
- **Certificate Verification**: Share QR code for verification

### For HQ Admin (Portal Login)

- **National Command Console**: Monitor branches, coverage trends, and AEFI alerts across the country.
- **Branch & Catchment Management**: Create facilities, assign managers, and define service territories.
- **Role Provisioning**: Onboard and manage Branch Managers, Facility Nurses, CHWs, and Parents/Guardians (excluding HQ Admin).
- **Schedule Configuration**: Maintain the master vaccine catalogue and national dosing rules.
- **System Health & Audits**: Review infrastructure status, audit logs, and trigger backups on demand.

## Primary User Roles

- **Admin (HQ/Regional)**: Manages branches, users, configurations, and audit trails.
- **Branch Manager**: Supervises branch staff (including CHWs) and tracks branch-level KPIs.
- **Nurse / Clinician**: Handles in-clinic registration, vaccination capture, and follow-up scheduling. Facility console now
    includes QR-code patient lookup, Ghana CWC-aligned onboarding, and patient charting ready for backend wiring.
- **Community Health Worker (CHW)**: Runs door-to-door registration and vaccination via the offline-first PWA.
- **Parent / Guardian**: Reviews a child's vaccination journey, certificates, reminders, and emergency contacts.
- **Public Verifier (No Login)**: Uses `/verify` to validate certificates by QR scan or token.

---

## 🎭 Demo Accounts

All active portal roles authenticate through `/auth/login` using the shared demo password `password1234` (reset anytime via `backend/scripts/reset-password.ts`).

- **Parent**: <parent@example.com> (password `password1234`)
- **HQ Admin**: <admin@health.gov.gh> (password `password1234`)
- **Branch Manager**: <branch.manager@health.gov.gh> (password `password1234`)
- **Facility Nurse**: <nurse@health.gov.gh> (password `password1234`)
- **Community Health Worker**: <chw@health.gov.gh> (password `password1234`)
- **Public Certificate Verification**: No login required at `/verify`

**Test Parent Account (full demo data):**
- Email: `akosua.asante@example.com` / password: `password1234`
- Children: Esi Boadu (complete), Kojo Asante (incomplete), Zara Asante (complete)

---

## 🔐 Certificate Verification (Public)

Anyone can verify a vaccination certificate at:

```
http://localhost:3000/verify
```

No login required. Enter the Certificate ID printed on the card or scan the QR code using the in-page scanner. Regular phone cameras will not navigate anywhere — verification only works through this website.

The page is also linked from the landing page navbar and footer.

---

## 📁 Frontend Structure

```
app/
├── page.tsx                    # Landing page
├── verify/                     # Public certificate verification (no login)
├── auth/
│   └── login/                  # Unified login for all roles
├── hq/
│   └── dashboard/              # HQ Admin console
├── branch/
│   └── dashboard/              # Branch Manager console
├── facility/
│   ├── dashboard/              # Facility Nurse console
│   ├── register-mother/        # Mother onboarding
│   ├── register-child/         # Newborn registration
│   └── child/[childId]/        # Child patient chart
├── chw/
│   └── dashboard/              # CHW field operations
└── parent/
    └── dashboard/              # Parent portal
```

---

## 🏗️ Backend Structure

```
backend/src/
├── auth/                       # JWT auth, role guards
├── hq-admin/                   # Julius: HQ Admin endpoints
├── chw/                        # Julius: CHW endpoints
├── branch-manager/             # Juny: Branch Manager + shared HQ endpoints
├── facility/                   # Juny: Facility Nurse endpoints
├── parent/                     # Juny: Parent portal endpoints
└── common/                     # Shared services, guards, database
```

### Auth Endpoints

- `POST /auth/login` — Login, returns JWT + user profile
- `POST /auth/register` — Register new user
- `GET /auth/profile` — Current user profile
- `POST /auth/change-password` — Change password
- `POST /auth/forgot-password` — Request password reset email
- `POST /auth/reset-password` — Reset password with token

### HQ Admin Endpoints (Julius)

- `GET /hq-admin/roles` — List all system roles
- `GET /hq-admin/roles/permissions` — List available permissions
- `GET /hq-admin/notifications/delivery-status` — Notification delivery log
- `GET /hq-admin/notifications/stats` — Notification statistics
- `POST /hq-admin/notifications/:id/retry` — Retry failed notification
- `GET /hq-admin/system/metrics` — System health metrics
- `GET /hq-admin/system/database-stats` — Database statistics
- `GET /hq-admin/system/audit-activity` — Audit activity log

### Branch Manager Endpoints (Juny)

- `GET /branch-manager/dashboard` — Branch dashboard metrics
- `GET /branch-manager/vaccines` — Vaccine list for branch
- `POST /branch-manager/stock` — Add vaccine stock
- `GET /branch-manager/staff` — Staff list
- `POST /branch-manager/staff` — Create staff member
- `PATCH /branch-manager/staff/:id` — Update staff
- `PATCH /branch-manager/staff/:id/status` — Activate/deactivate staff
- `GET /branch-manager/catchment-areas` — List catchment zones
- `POST /branch-manager/catchment-areas` — Create zone
- `PATCH /branch-manager/catchment-areas/:id/assign` — Assign CHW to zone

### Facility Nurse Endpoints (Juny)

- `GET /facility/search` — Search children
- `GET /facility/children/:childId` — Child patient chart
- `GET /facility/children/:childId/vaccinations` — Vaccination history
- `GET /facility/children/:childId/scheduled` — Due vaccinations
- `POST /facility/children/:childId/vaccinations` — Record dose
- `POST /facility/children/:childId/measurements` — Record measurements
- `POST /facility/guardians` — Register guardian
- `POST /facility/children` — Register child
- `GET /facility/appointments/today` — Today's appointments
- `PATCH /facility/appointments/:id/status` — Update appointment status

### CHW Endpoints (Julius)

- `GET /chw/dashboard/summary` — CHW dashboard
- `GET /chw/children/search` — Search children in catchment
- `GET /chw/mothers/search` — Search guardians
- `POST /chw/offline-registrations` — Submit offline registration
- `POST /chw/vaccinations/sync` — Sync offline vaccination records
- `GET /chw/children/:childId/chart` — Child chart

### Parent Endpoints (Juny)

- `GET /parent/dashboard` — Parent dashboard
- `GET /parent/children` — List children
- `GET /parent/children/:childId` — Child details
- `GET /parent/children/:childId/vaccinations` — Vaccination records
- `GET /parent/children/:childId/certificates` — Child certificates
- `GET /parent/appointments` — Upcoming appointments
- `POST /parent/appointments` — Book appointment
- `DELETE /parent/appointments/:id` — Cancel appointment
- `GET /parent/missed-vaccinations` — Overdue vaccines
- `GET /parent/notifications` — Notification history

---

## 📡 Public API

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | None | Login, returns JWT + user |
| `GET /api/auth/me` | JWT | Current user profile |
| `GET /app/api/verify?id=` | None | Public certificate verification (Next.js route) |

---

## 🚀 Deployment

### Frontend (Vercel)

```bash
git push origin main
```

Set these environment variables in Vercel for the contact form:

| Key | Value |
|---|---|
| `BREVO_API_KEY` | Brevo API key for sending contact emails |
| `CONTACT_SUPPORT_EMAIL` | Support inbox (e.g. `support@cvcc.gov.gh`) |
| `CONTACT_SENDER_EMAIL` | Verified sender address in Brevo |
| `CONTACT_SENDER_NAME` | Sender name shown to support team |

### Backend (Render)

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pnpm install && pnpm run build` |
| Start Command | `pnpm run start:prod` |

**Required environment variables on Render:**

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://pvzatstzlvtaequsqhec.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase settings) |
| `JWT_SECRET` | Strong random string |
| `PORT` | `3001` |
| `CORS_ORIGIN` | Production frontend URL |
| `NODE_ENV` | `production` |

---

## ✅ Features Roadmap

- [x] Frontend dashboards for active operational roles
- [x] Database schema (21 tables)
- [x] Seed data for Nungua pilot (new facilities added via HQ Admin — no code changes needed)
- [x] Supabase setup and configuration
- [ ] **Backend API (NestJS) - IN PROGRESS**
  - [ ] HQ Admin endpoints
  - [ ] Branch Manager endpoints
  - [ ] Parent Portal endpoints
  - [ ] Facility Nurse endpoints
  - [ ] CHW endpoints
- [x] Public certificate scanner and verification endpoint (`/verify`)
- [ ] Authentication with JWT
- [ ] SMS/Email notifications (Twilio/SendGrid)
- [ ] PDF certificate generation
- [ ] QR code scanning and verification
- [ ] Offline sync with Service Workers

---

## 🆘 Common Issues

**"Cannot connect to Supabase"** → Check `.env.local` has correct credentials

**"Port 3001 already in use"** → `lsof -ti:3001 | xargs kill` then restart backend

**"Module not found"** → Run `pnpm install` in both root and `backend/`

---

## 🆘 Need Help?

### Common Issues

**Issue:** "Cannot connect to Supabase"  
**Solution:** Check `.env.local` file exists with correct credentials

**Issue:** "Module not found @supabase/supabase-js"  
**Solution:** Run `pnpm install` in project root

**Issue:** "Port 3001 already in use"  
**Solution:** Kill the process using port 3001 or change `PORT` in `backend/.env`

### Contact

- **Project Lead**: [Your contact info]
- **Team Member**: [Team member contact info]
- **GitHub Issues**: Create issue in repository

---

## 📄 License

Government of Ghana Ministry of Health © 2025

---

## 🎯 Quick Reference for Team Member

### First Time Setup

\`\`\`bash

# 1. Clone and switch to backend branch

git clone <repo-url>
cd child-vaccination-system
git checkout backend

# 2. Install frontend dependencies

pnpm install

# 3. Create backend

npx @nestjs/cli new backend
cd backend
pnpm add @supabase/supabase-js @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt class-validator class-transformer

# 4. Copy .env.local to backend/.env and update for backend use

# 5. Start coding

\`\`\`

### Daily Workflow

\`\`\`bash

# Pull latest changes

git pull origin backend

# Make changes

# Commit and push

git add .
git commit -m "feat: added HQ admin branch management endpoints"
git push origin backend
\`\`\`

### Active Staff Modules

1. **HQ Admin** (`backend/src/hq-admin/`)
2. **Branch Manager** (`backend/src/branch-manager/`)

### Active Operations Modules

1. **Parent Portal** (`backend/src/parent/`)
2. **Facility Nurse** (`backend/src/facility-nurse/`)
3. **Community Health Worker** (`backend/src/chw/`)
4. **Public Verification** (`app/verify/` and `app/api/verify/`)

Good luck! 🚀
