# Child Vaccination Command Centre (CVCC)

**A multi-role digital immunisation tracking system piloted for Nungua and its environs (Ledzokuku Municipal Assembly, Greater Accra Region, Ghana)**

---

## Project Status

| Layer | Status |
|---|---|
| Frontend | Complete — Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend API | Complete — NestJS, deployed on Render |
| Database | Complete — Supabase (PostgreSQL), 21 tables |
| Authentication | Complete — JWT-based, role-aware login |

**Live API:** `https://child-vaccination-system-e18o.onrender.com/api`

---

## System Overview

The CVCC digitises the child immunisation workflow across five local health facilities, replacing paper-based Child Welfare Clinic (CWC) cards with a connected, role-based platform. It covers clinic registration, community outreach (offline-capable), appointment management, vaccine stock tracking, adverse event reporting (AEFI), and digital certificate issuance with public QR verification.

The system is scoped as a **district-level pilot** for Nungua, Teshie, Spintex, Labadi, and Ashaiman — aligned with Ghana Health Service (GHS) CHPS zone structure — and is designed to scale to additional districts.

---

## User Roles

| Role | GHS Equivalent | Responsibilities |
|---|---|---|
| HQ Admin | District Director of Health Services (DDHS) | Manages branches, staff accounts, vaccine schedule rules, and system-wide analytics |
| Branch Manager | Officer-in-Charge (OIC) / Medical Superintendent | Oversees one facility — monitors overdue children, stock alerts, AEFI events, and staff performance |
| Facility Nurse | EPI / Vaccination Nurse | Registers mothers and children, records clinic vaccinations, manages appointment requests |
| Community Health Worker (CHW) | Community Health Officer (CHO) | Registers children during outreach, records visits and vaccines offline, syncs when online |
| Parent / Guardian | — | Books appointments, receives reminders, views child vaccination records and digital certificate |
| Public Verifier (no login) | Schools, employers, travel officers | Scans QR code or enters certificate token to verify authenticity at `/verify` |

---

## Quick Start (Frontend)

**Prerequisites:** Node.js 18+, pnpm

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`

---

## Quick Start (Backend API — NestJS)

```bash
cd backend
cp .env.example .env   # populate keys (see below)
pnpm install
pnpm run start:dev
```

The API runs on `http://localhost:3001`. All routes are prefixed with `/api`.

### Required Environment Variables (`backend/.env`)

| Key | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase → Settings → API |
| `JWT_SECRET` | Any strong secret string |
| `PORT` | `3001` |
| `CORS_ORIGIN` | Frontend origin (e.g. `http://localhost:3000`) |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `SMTP_FROM` | Verified sender email address |
| `FRONTEND_URL` | Frontend URL for email links |
| `BACKUP_DIR` | Path for system backups (e.g. `./backups`) |
| `BACKUP_ENCRYPTION_KEY` | 64-character hex key for backup encryption |
| `BACKUP_RETENTION_DAYS` | Number of days to keep backups |

Generate a backup encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Production Build

```bash
pnpm run build      # compiles to dist/
pnpm run start:prod # runs compiled output
```

---

## Backend Utility Scripts

All scripts run from the `backend/` directory using `npx ts-node scripts/<script>.ts`.

| Script | Purpose |
|---|---|
| `reset-password.ts` | Update a user's password hash in Supabase |
| `list-users.ts` | List all users grouped by role with facility and status |
| `manage-facilities.ts` | Create facilities, view them, assign branch managers |
| `test-email.ts` | Verify SMTP configuration and send a test message |
| `delete-user.ts` | Safely delete a user, handling foreign key dependencies |

---

## Database (Supabase)

**Schema:** `supabase/schema.sql` — 21 tables, 15 enums  
**Seed data:** `supabase/seed.sql`  
**Parent demo data:** `supabase/seed-parent-demo.sql`  
**TypeScript types:** `lib/database.types.ts`

### Key Tables

| Table | Purpose |
|---|---|
| `users` | All system users across all roles |
| `branches` | Health facilities and catchment area definitions |
| `guardians` | Parent / guardian profiles |
| `children` | Child records with CVCC IDs and QR codes |
| `vaccines` | Ghana National Immunization Schedule (17 vaccines) |
| `vaccination_events` | Individual dose records per child |
| `certificates` | Digital vaccination certificates |
| `appointments` | Scheduled clinic visits |
| `notifications` | SMS / Email alerts to parents |
| `visit_logs` | CHW door-to-door activity |
| `sync_queue` | Offline sync tracking |
| `audit_logs` | System-wide activity trail |

---

## Project Structure

```
app/
├── auth/login/                  # Unified role-aware login
├── hq/dashboard/                # HQ Admin command console
├── branch/dashboard/            # Branch Manager operations console
├── facility/
│   ├── dashboard/               # Facility Nurse clinic console
│   ├── register-mother/         # Ghana CWC-aligned mother onboarding
│   ├── register-child/          # Newborn registration with auto schedule
│   └── child/[childId]/         # Child patient chart and vaccination timeline
├── parent/dashboard/            # Parent portal
└── verify/                      # Public certificate verification (no login)

backend/src/
├── auth/                        # JWT authentication
├── hq-admin/                    # HQ Admin endpoints
├── branch-manager/              # Branch Manager endpoints
├── facility-nurse/              # Facility Nurse endpoints
├── chw/                         # Community Health Worker endpoints
├── parent/                      # Parent portal endpoints
└── common/                      # Guards, decorators, shared utilities

supabase/
├── schema.sql
├── seed.sql
└── seed-parent-demo.sql
```

---

## Demo Accounts

All demo accounts use the password `password1234`.

| Role | Email |
|---|---|
| HQ Admin | admin@health.gov.gh |
| Branch Manager | branch.manager@health.gov.gh |
| Facility Nurse | nurse@health.gov.gh |
| Community Health Worker | chw@health.gov.gh |
| Parent | parent@example.com |
| Public Verification | No login — visit `/verify` |

**Seeded test parent:** `akosua.asante@example.com` — three children with full vaccination histories.

---

## Deployment

### Frontend (Vercel)

Connect the repository to Vercel. Set `NEXT_PUBLIC_API_URL` to the live backend URL.

### Backend (Render)

1. Create a Web Service pointing to the `main` branch.
2. Set **Root Directory** to `backend`.
3. Build command: `pnpm install && pnpm run build`
4. Start command: `pnpm run start:prod`
5. Add all environment variables from the table above.

---

## Authentication Flow

- `POST /api/auth/login` — accepts `{ email, password, userType }`, returns JWT + user profile
- `GET /api/auth/me` — returns current authenticated user
- `POST /api/auth/logout` — invalidates session

All protected routes require a `Bearer <token>` header. Role-based guards enforce access at the controller level.

---

## Real-World Alignment

The system's role hierarchy mirrors the Ghana Health Service district structure:

- **HQ Admin** maps to the District Director of Health Services (DDHS) at Ledzokuku Municipal Assembly.
- **Branch Manager** maps to the Officer-in-Charge (OIC) at each health center.
- **CHW** maps to Community Health Officers (CHOs) operating within defined CHPS zones.
- **Catchment areas** correspond to CHPS zone boundaries, which GHS defines using GIS tools and DHIS2.

See [`docs/NUNGUA_DOWNSCOPE_ROLES_AND_FLOW.md`](docs/NUNGUA_DOWNSCOPE_ROLES_AND_FLOW.md) for full role mapping and scope definition.

---

## License

Ministry of Health, Republic of Ghana — Final Year Project Prototype, 2025.  
Not for production deployment without formal GHS approval.
