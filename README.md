<!-- markdownlint-disable -->

# Ghana Child Vaccination System

**Production-Ready Multi-Branch Vaccination Tracking System for Ghana Government**

## 🚀 Project Status

**Frontend:** ✅ Complete (Next.js 16 + React 19 + TypeScript + Tailwind CSS)  
**Database:** ✅ Schema designed and seeded in Supabase (PostgreSQL)  
**Backend:** ✅ Deployed (NestJS API running on Render)

---

## 🛠️ Quick Start

### Prerequisites

- **Node.js 18+** (with pnpm package manager)
- **Supabase Account** (project team access)
- **Git** for version control

### Installation

\`\`\`bash

# Install pnpm globally (if not installed)

npm install -g pnpm

# Install dependencies

pnpm install

# Start development server (frontend only)

pnpm dev
\`\`\`

Visit `http://localhost:3000`

---

## 🧰 Backend API (NestJS) Quick Start

### Local environment

1. `cd backend`
2. Copy `.env.example` to `.env` (or keep using the existing `.env`) and populate the following keys:

- `SUPABASE_URL=https://<your-project-ref>.supabase.co`
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

You should see `LOGIN SUCCESSFUL` output that includes the parent name and the JWT token. If you prefer a GUI, use Postman/Thunder Client with the same URL and JSON body.

### Resetting a user's password (terminal)

Anytime you need to change a demo/password entry:

```powershell
cd backend
npx ts-node scripts/reset-password.ts
```

The script lists all users, lets you pick an email, and updates the password hash in Supabase using the same SHA-256 routine as the backend.

### Viewing all users, roles and facilities (terminal)

To see every user in the system with their role, assigned facility, and login status:

```powershell
cd backend
npx ts-node scripts/list-users.ts
```

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
```

The script prints your active SMTP settings and sends a test message to the inbox you enter.

### Deleting a user safely (terminal)

If direct deletion fails with foreign key errors (for example from `audit_logs`), use:

```powershell
cd backend
npx ts-node scripts/delete-user.ts
```

The script prompts for an email, removes or nullifies dependent references, and then deletes the user record.

### Starting the backend for daily work

```powershell
cd backend
pnpm install    # first day only; skip if node_modules already exists
pnpm run start:dev
```

Leave that terminal running while you develop. Press `Ctrl + C` to stop the server when you are done.

### Where backend code lives

Yes—both developers add *all* NestJS code inside the `backend/` folder (controllers, services, modules, scripts, etc.). That keeps the API in one place while the Next.js frontend stays in the root `app/` folder.

### Production build commands

```bash
pnpm run build      # emits dist/src
pnpm run start:prod # runs node dist/src/main
```

### Deploying to Render (free tier)

1. Push code to GitHub (already done for this repo).
2. In Render, create a **Web Service** and point it to the `main` branch.
3. Set **Root Directory** to `backend` and use these commands:

- Build: `pnpm install && pnpm run build`
- Start: `pnpm run start:prod`
1. Add environment variables in Render → Settings → Environment:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (same as local `.env`, never commit) |
| `JWT_SECRET` | Same as local secret |
| `PORT` | `3001` |
| `CORS_ORIGIN` | Production frontend URL (e.g., `https://cvcc-iota.vercel.app`) |
| `NODE_ENV` | `production` |

1. After deploy completes, the API will be live. Update the frontend `NEXT_PUBLIC_API_URL` to match the Render-provided URL.

> ℹ️ The root route (`/`) returns 404 on purpose; test endpoints such as `/api/auth/login` or `/api/parent/dashboard` instead.

---

## 🗄️ Database Setup (Supabase)

### What You Need to Know

We're using **Supabase** (managed PostgreSQL) as our database. You've been invited to the project as a team member.

### Access Credentials

The Supabase connection details are already configured in `.env.local`:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=<https://<your-project-ref>.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...truncated (see .env.local file)
\`\`\`

**🔒 Security Note:**

- The `.env.local` file contains the full anon key
- **DO NOT commit `.env.local` to Git!** (It's already in `.gitignore`)
- The anon key is safe for client-side use (protected by Row Level Security)
- The full anon key is in the `.env.local` file (not the truncated version shown above)

### Database Schema

The complete database schema is located in:

- **Schema:** `supabase/schema.sql` (21 tables, 15 enums)
- **Seed Data:** `supabase/seed.sql` (sample data for all tables)
- **Parent Demo Data:** `supabase/seed-parent-demo.sql` (Akosua Asante test account)
- **TypeScript Types:** `lib/database.types.ts` (use these in your backend!)

### Key Tables (for Backend Development)

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
| `notifications` | SMS/Email alerts sent to parents |
| `visit_logs` | CHW door-to-door activity |
| `sync_queue` | Offline sync tracking |
| `duplicate_candidates` | Legacy deduplication queue (not in active role workflows) |
| `audit_logs` | System activity tracking |

### Install Supabase Client Library

The Supabase JavaScript client is already installed:

\`\`\`bash

# Already done, but for reference

pnpm add @supabase/supabase-js
\`\`\`

The client is initialized in `lib/supabase.ts`:

\`\`\`typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
\`\`\`

### How to Query the Database

\`\`\`typescript
import { supabase } from '@/lib/supabase'

// Example: Fetch all branches
const { data: branches, error } = await supabase
  .from('branches')
  .select('*')
  
// Example: Get user by email
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', '<admin@health.gov.gh>')
  .single()

// Example: Insert new vaccination event
const { data, error } = await supabase
  .from('vaccination_events')
  .insert({
    child_id: 'c1000000-0000-0000-0000-000000000100',
    vaccine_id: 'b0000000-0000-0000-0000-000000000001',
    dose_number: 1,
    administered_date: '2025-01-01',
    status: 'completed'
  })
\`\`\`

### Accessing Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with your invited account
3. Select the **Ghana Vaccination System** project
4. Use the **SQL Editor** to run queries
5. Use **Table Editor** to view/edit data
6. Use **Database** → **Roles** to manage permissions

---

## 🏗️ Backend Development (NestJS)

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
│   ├── auth/                 # Authentication module
│   ├── hq-admin/             # HQ Admin endpoints
│   │   ├── hq-admin.controller.ts
│   │   ├── hq-admin.service.ts
│   │   ├── hq-admin.module.ts
│   │   └── dto/              # Data Transfer Objects
│   ├── branch-manager/       # Branch Manager endpoints
│   │   ├── branch-manager.controller.ts
│   │   ├── branch-manager.service.ts
│   │   └── branch-manager.module.ts
│   ├── common/               # Shared utilities, guards, decorators
│   │   ├── guards/           # Role-based auth guards
│   │   ├── decorators/       # Custom decorators
│   │   └── database.service.ts  # Supabase client wrapper
│   ├── parent/               # Parent portal endpoints
│   ├── facility-nurse/       # Facility Nurse endpoints
│   ├── chw/                  # Community Health Worker endpoints
│   └── main.ts
├── .env                      # Backend environment variables
└── package.json
\`\`\`

### Backend Environment Setup

Create `backend/.env` for active backend modules:

\`\`\`env
SUPABASE_URL=<https://<your-project-ref>.supabase.co>
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

**Test Parent Account (Seeded in Database):**

- **Email**: <akosua.asante@example.com> (password `password1234`)
- **Children**:
  - Esi Boadu (CHILD-001) - Complete vaccinations
  - Kojo Asante (CHILD-002) - Incomplete vaccinations
  - Zara Asante (CHILD-003) - Complete vaccinations

---

## 📁 Project Structure

\`\`\`
app/
├── page.tsx                    # Landing page
├── auth/
│   ├── login/                 # Unified role-aware login experience
│   ├── parent-login/          # Legacy redirect to unified login
│   └── staff-login/           # Legacy redirect to unified login
├── hq/
│   └── dashboard/             # HQ admin national command console
├── branch/
│   └── dashboard/             # Branch manager operations console
├── facility/
│   ├── dashboard/             # Facility nurse "Today's Clinic" mission control
│   ├── register-mother/       # Ghana CWC-aligned mother onboarding form
│   ├── register-child/        # Newborn registration with automated schedule
│   └── child/[childId]/       # Child patient chart and vaccination timeline
├── dashboard/
│   ├── page.tsx               # Staff dashboard
│   ├── register-child/        # Child registration form
│   ├── record-vaccination/    # Vaccination recording form
│   └── reports/               # Analytics reports
└── parent/
    └── dashboard/             # Parent view of child vaccines

components/                    # Reusable UI components
lib/                          # Utilities and configurations
  ├── supabase.ts             # Supabase client setup
  ├── database.types.ts       # TypeScript types for database
  └── utils.ts                # Helper functions
supabase/                     # Database files
  ├── schema.sql              # Complete database schema
  ├── seed.sql                # Sample data
  └── seed-parent-demo.sql    # Akosua Asante demo data
\`\`\`

---

## 🔐 Authentication & Security

**Current Status:** Frontend uses mock authentication  
**Backend Task:** Implement real JWT authentication

### Your Implementation Checklist

- [ ] Create `auth` module in NestJS
- [ ] Implement `/auth/login` endpoint (email + password)
- [ ] Generate JWT tokens with role information
- [ ] Create role-based guards (`@Roles('hq-admin')`)
- [ ] Hash passwords with bcrypt
- [ ] Validate requests with JWT strategy
- [ ] Implement refresh token mechanism (optional)

---

## 📡 API Contracts (What Frontend Expects)

### Authentication

- `POST /auth/login` - Login with email/password, returns JWT + user object
- `POST /auth/logout` - Invalidate token
- `GET /auth/me` - Get current user profile

### QR Code & Child Lookup

- `GET /facility/:facilityId/children?query=<search>` - Search children by name, CVCC ID, or guardian phone
- `POST /children` - Create new child, return child ID + QR payload
- `GET /children/:id/qr` - Generate QR code for child record

### Appointments

- `POST /appointments` - Parent books appointment
- `GET /appointments/:facilityId` - Facility views appointments
- `PUT /appointments/:id` - Update appointment status

---

## 🚀 Deployment

### Frontend (Vercel)

\`\`\`bash
git push origin main
vercel
\`\`\`

### Backend (Railway / Render / DigitalOcean)

\`\`\`bash
cd backend
git push origin backend

# Deploy using your chosen platform

\`\`\`

---

## ✅ Features Roadmap

- [x] Frontend dashboards for active operational roles
- [x] Database schema (21 tables)
- [x] Seed data with test accounts
- [x] Supabase setup and configuration
- [x] Backend API (NestJS)
  - [x] HQ Admin endpoints
  - [x] Branch Manager endpoints
  - [x] Parent Portal endpoints
  - [x] Facility Nurse endpoints
- [x] Public certificate scanner and verification endpoint (`/verify`)
- [x] Authentication with JWT
- [x] SMS notifications (registration, guardian invite)
- [x] PDF certificate generation and download
- [x] QR code scanning and verification
- [x] Auto-certificate issuance on vaccination completion
- [x] Rate limiting on public verify endpoint
- [ ] Offline sync with Service Workers

### 🔭 Future Implementations

- [ ] **USSD vaccination status check** — Allow guardians (including those without smartphones or internet access) to dial a shortcode such as `*XXX*ChildID#` to instantly retrieve their child's vaccination status and certificate ID on any basic feature phone. Requires integration with a Ghanaian telco (MTN, Vodafone/Telecel, AirtelTigo) via their USSD gateway API. This would be the most inclusive access channel for rural and low-income communities where smartphone penetration is low but mobile phone ownership is near-universal.

- [ ] **Auto-SMS on certificate issuance** — When a child completes all mandatory vaccines and a certificate is auto-generated, send an SMS to the registered guardian's phone with the Certificate ID and a short verification link. Removes dependence on the parent portal for guardians who registered with a phone number only.

- [ ] **Guardian registration without email** — Currently the parent portal requires an email address to create an account. Future work should support phone-number-only registration with OTP login, so guardians in rural areas who do not have email can still access their child's digital records.

---

## 📚 Additional Resources

### Supabase Documentation

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime subscriptions](https://supabase.com/docs/guides/realtime)

### NestJS Documentation

- [NestJS Fundamentals](https://docs.nestjs.com/first-steps)
- [JWT Authentication](https://docs.nestjs.com/security/authentication)
- [Guards & Role-based access](https://docs.nestjs.com/guards)

### Testing Tools

- **Postman** - API testing
- **Thunder Client** (VS Code extension) - Quick API requests
- **Supabase Studio** - Database management UI

---

## 🧩 Diagram Creation Prompts (Eraser.io)

Use these prompts to generate 9 simple diagrams (3 per prompt). Each prompt is aligned with the current system state.

### Prompt 1 (Architecture + ERD + Use Case)

```
Create 3 simple diagrams (not too complex):

1) System Architecture Diagram
- Layers: Users, Frontend, Backend, Database, External Services.
- Users: Parent, Facility Nurse, CHW, Branch Manager, HQ Admin, Public Verifier.
- Frontend: Next.js web app with role-based portals + PWA offline support (service worker + IndexedDB).
- Backend: NestJS API with auth + feature modules.
- Database: Supabase Postgres.
- External services: SMS gateway (Hubtel) and Email (Brevo SMTP).
- Show arrows from users -> frontend -> backend -> database; backend -> SMS/Email.

2) Database Schema (ERD)
- Keep core tables only: users, branches, catchment_areas, guardians, children, child_guardian, vaccines, vaccination_events, vaccination_schedules, appointments, certificates, stock_inventory, audit_logs, notifications, aefi_reports.
- Key relationships:
  users -> branches (staff belong to branches)
  branches -> catchment_areas
  guardians + children linked via child_guardian
  children -> vaccination_events, appointments, certificates, aefi_reports
  vaccines -> vaccination_events, vaccination_schedules, stock_inventory
  users -> vaccination_events (administered_by)
  audit_logs -> users
- Simple crow’s foot notation.

3) System Use Case Overview
- Actors: Parent, Facility Nurse, CHW, Branch Manager, HQ Admin, Public Verifier.
- Use cases (simple):
  Parent: view child status, request appointment, download certificate.
  Nurse: register child, record vaccination, record side effects.
  CHW: register child, offline capture/sync, transfer child.
  Branch Manager: manage stock, view analytics, monitor transfers.
  HQ Admin: manage branches/users, view analytics.
  Public Verifier: verify certificate.

```

### Prompt 2 (Flowcharts)

```
Create 3 simple flowcharts:

1) Child Registration Flowchart (Facility Nurse)
- Start -> search existing guardian -> decision (exists?)
- If no: register guardian -> save guardian
- Enter child details (name, DOB, gender, birth weight) -> generate CVCC ID + QR -> save child -> create vaccination schedule -> optional SMS -> End.

2) CHW Offline Vaccination Flowchart
- Start in field -> open child record -> select vaccine -> enter details + GPS -> save to IndexedDB -> mark pending sync
- Decision: internet available?
  No -> continue offline
  Yes -> background sync -> upload to server -> mark synced -> clear local queue -> end.

3) Nurse Vaccination Administration Flowchart
- Start -> open child chart (today's clinic) -> select due/overdue dose -> click Administer
- Administer modal opens with date set to today and site auto-selected; batch number + expiry date auto-filled from stock inventory
- Nurse confirms administered by and optionally flags AEFI with notes -> save dose
- Online: save + refresh timeline; Offline: queue for sync and show saved offline message
- Keep it straightforward, no extra branches.
```

### Prompt 3 (Activity + Activity + Sequence)

```
Create 3 simple diagrams:

1) CHW Transfer Out Activity Diagram
- Swimlanes: CHW, Frontend, Backend, Database.
- Steps: open child chart -> click Transfer Out -> enter reason -> confirm.
- If offline: queue transfer_out, remove child from local register.
- If online: POST transfer-out -> backend validates catchment -> database sets children.catchment_area_id = NULL -> write audit_log -> response -> success message -> redirect to search.
- Keep it short and clear.

2) Vaccination Workflow Activity Diagram
- Start (child registered) -> create schedule -> send reminder -> parent visits facility -> nurse vaccinates -> record in system -> update stock -> decide if more doses due -> loop or generate certificate -> end.

3) User Login Sequence Diagram
- Actors: User, Web App, Auth API, Database.
- Steps: User enters credentials -> Web App sends login -> API validates user in DB -> API returns JWT/profile -> Web App routes by role (Parent/Nurse/CHW/Branch/HQ).
- No chatbot, no Gemini.
```

## 🆘 Need Help?

### Common Issues

**Issue:** "Cannot connect to Supabase"  
**Solution:** Check `.env.local` file exists with correct credentials

**Issue:** "Module not found @supabase/supabase-js"  
**Solution:** Run `pnpm install` in project root

**Issue:** "Port 3001 already in use"  
**Solution:** Kill the process using port 3001 or change `PORT` in `backend/.env`

### Contact

- **GitHub Issues**: Create an issue in the repository

---

## 📄 License

Government of Ghana Ministry of Health © 2025

