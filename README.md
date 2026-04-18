<!-- markdownlint-disable -->

# Child Vaccination Command Center (CVCC)

**Vaccination Tracking System for Nungua and Surrounding Communities, Greater Accra**

## 🚀 Project Status

**Frontend:** ✅ Complete (Next.js 16 + React 19 + TypeScript + Tailwind CSS)  
**Database:** ✅ Schema designed and seeded in Supabase (PostgreSQL)  
**Backend:** ✅ Deployed (NestJS API running on Render → `https://child-vaccination-system-e18o.onrender.com/api`)

---

## 🗺️ Scope

This system is scoped to **Nungua and its surrounding communities** in the Ledzokuku-Krowor district, Greater Accra.

### Facilities (Branches)

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

**Developer 2 (Julius):**
- HQ Admin Backend
- CHW Backend

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

- **Node.js 18+** with pnpm
- **Supabase Account** (invited as team member)
- **Git**

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

---

## 🧰 Backend API (NestJS)

### Local Environment Setup

1. `cd backend`
2. Create `.env` with the following keys:

```env
SUPABASE_URL=https://pvzatstzlvtaequsqhec.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase → Settings → API>
JWT_SECRET=<any strong string>
PORT=3001
CORS_ORIGIN=http://localhost:3000
BREVO_API_KEY=<Brevo API key for transactional email>
SMTP_FROM=<verified sender email>
FRONTEND_URL=http://localhost:3000
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

# Test email delivery
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
|---|---|
| `users` | All system users (5 roles) |
| `branches` | Health facilities (3 Nungua facilities) |
| `guardians` | Parent/guardian profiles |
| `children` | Child records with CVCC IDs and QR codes |
| `vaccines` | Ghana National Immunization Schedule (17 vaccines) |
| `vaccination_events` | Individual dose records |
| `certificates` | Digital vaccination certificates |
| `appointments` | Scheduled clinic visits |
| `notifications` | SMS/Email alerts |
| `visit_logs` | CHW door-to-door activity |
| `sync_queue` | Offline sync tracking |
| `audit_logs` | System activity tracking |
| `catchment_areas` | CHW geographic zones |

---

## 👤 User Roles

The system has **5 active roles**:

| Role | Portal | Responsibility |
|---|---|---|
| **Parent** | `/parent/dashboard` | View child records, appointments, certificates |
| **Facility Nurse** | `/facility/dashboard` | Register children, record vaccinations |
| **CHW** | `/chw/dashboard` | Door-to-door visits, offline registration |
| **Branch Manager** | `/branch/dashboard` | Staff management, KPIs, CHW visit approvals |
| **HQ Admin** | `/hq/dashboard` | System-wide admin, users, branches, vaccines |

---

## 🎭 Demo Accounts

All accounts use password `password1234`.

| Role | Email |
|---|---|
| Parent | `parent@example.com` |
| HQ Admin | `admin@health.gov.gh` |
| Branch Manager | `branch.manager@health.gov.gh` |
| Facility Nurse | `nurse@health.gov.gh` |
| CHW | `chw@health.gov.gh` |

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

- [x] Frontend dashboards (5 roles)
- [x] Database schema (21 tables)
- [x] Seed data scoped to Nungua (pilot deployment)
- [x] Supabase setup and configuration
- [x] JWT Authentication with role-based guards
- [x] Email notifications (Brevo)
- [x] Public certificate verification page (`/verify`)
- [x] QR code scanning on `/verify` page
- [x] HQ Admin backend endpoints
- [x] Branch Manager backend endpoints
- [x] Parent Portal backend endpoints
- [x] Facility Nurse backend endpoints
- [x] CHW backend endpoints (offline registration + sync)
- [ ] PDF certificate generation
- [ ] Offline sync via Service Workers
- [ ] SMS notifications

---

## 🆘 Common Issues

**"Cannot connect to Supabase"** → Check `.env.local` has correct credentials

**"Port 3001 already in use"** → `lsof -ti:3001 | xargs kill` then restart backend

**"Module not found"** → Run `pnpm install` in both root and `backend/`

---

© 2025 Ghana Health Service · Ledzokuku-Krowor District
