# Ghana Child Vaccination System

**Production-Ready Multi-Branch Vaccination Tracking System for Ghana Government**

> Note: We are building and refining the front-end experience first. Once the UI is finalized, we will implement the backend services and database layer.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

Visit `http://localhost:3000`

## System Features

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
- **Role Provisioning**: Onboard and manage Branch Managers, CHWs, Data Officers, and PHAs.
- **Schedule Configuration**: Maintain the master vaccine catalogue and national dosing rules.
- **System Health & Audits**: Review infrastructure status, audit logs, and trigger backups on demand.

## Primary User Roles

- **Admin (HQ/Regional)**: Manages branches, users, configurations, and audit trails.
- **Branch Manager**: Supervises branch staff (including CHWs) and tracks branch-level KPIs.
- **Nurse / Clinician**: Handles in-clinic registration, vaccination capture, and follow-up scheduling. Facility console now
    includes QR-code patient lookup, Ghana CWC-aligned onboarding, and patient charting ready for backend wiring.
- **Community Health Worker (CHW)**: Runs door-to-door registration and vaccination via the offline-first PWA.
- **Data Officer**: Monitors data quality, resolves duplicates, curates reporting outputs, and triages security or availability alerts.
- **Public Health Authority (PHA)**: Read-only oversight of analytics, dashboards, and national reports.
- **Parent / Guardian**: Reviews a child&apos;s vaccination journey, certificates, reminders, and emergency contacts.

## Demo Accounts

All roles authenticate through `/auth/login`. Use any password with six or more characters.

- **Parent**: parent@example.com
- **HQ Admin**: admin@health.gov.gh
- **Branch Manager**: branch.manager@health.gov.gh
- **Facility Nurse**: nurse@health.gov.gh
- **Community Health Worker**: chw@health.gov.gh
- **Data Officer**: data.officer@health.gov.gh
- **Public Health Authority**: pha@health.gov.gh

## Project Structure

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
\`\`\`

## Security Implementation

### Authentication
- Mock JWT tokens for demo
- Email/password validation
- Role-based access control (Staff vs Parent)

### Data Protection
- LocalStorage for session management
- Protected routes redirect unauthorized users

### Production Ready
- Replace mock auth with real JWT implementation
- Use encrypted database for production
- Implement full audit logging
- Enable HTTPS/TLS enforcement

## API Integration

Current implementation uses mock data. To integrate with real backend:

1. Update `/auth/staff-login` to call actual authentication API
2. Replace `/dashboard` data fetching with real API calls
3. Implement offline sync with Service Workers
4. Add IndexedDB for offline storage

### Backend contract: QR identity + clinic lookup (TODO)

- Facility nurse flows currently search against mock arrays. Backend must expose `GET /facility/{facilityId}/children?query=` that matches by child name, CVCC ID, or guardian phone.
- When a mother or child record is created, backend issues canonical IDs (`motherId`, `childId`) plus a QR payload (JWT or signed JSON) and returns it to the UI.
- Parent dashboard stores the QR payload; the "Show clinic QR" button renders it so caregivers can present it on paper or mobile.
- Facility dashboard reads the same QR, decodes the payload, and routes directly to the child chart (`/facility/child/{childId}`) without manual search.
- Keep QR payload minimal (id, checksum, optional DOB) and sign it so clinics can trust scans even offline; regenerate or download on demand so all channels share one source of truth.

### Backend contract: Appointment booking (TODO)

- When a parent submits an appointment request from the front-end booking form, the backend MUST deliver that booking to the health facility where the child was born or where the child was registered.
- The booking payload should include: child id, parent id, parent contact, preferred date, preferred time, optional notes, and preferred facility id (if supplied).
- The receiving facility server should acknowledge receipt and either:
    - Confirm the appointment and return a confirmation id and scheduled time, or
    - Assign a community health worker (CHW) to perform a home visit (include CHW id) and return an assignment acknowledgement.
- Delivery guarantees: POST appointment endpoint should return 202 Accepted on async acceptance, 200 OK with confirmation when synchronously scheduled, and retry on transient errors. Persist the booking request on the backend for audit and retry.
- Security: bookings must be authenticated and authorized (parent role) and use TLS. Rate-limit booking endpoints to prevent abuse.

Add this to the backend implementation checklist so the appointment flow does not cause integration errors when the backend is started.

## Deployment

### Vercel (Recommended)

\`\`\`bash
# Push to GitHub
git push origin main

# Deploy with Vercel
vercel
\`\`\`

### Docker

\`\`\`bash
docker build -t vaccination-system .
docker run -p 3000:3000 vaccination-system
\`\`\`

## Features Roadmap

- [x] Dual login system (Staff/Parent)
- [x] Child registration
- [x] Vaccination recording
- [x] Analytics dashboard
- [ ] Offline sync with conflict resolution
- [ ] SMS/Email notifications
- [ ] Digital certificate generation
- [ ] QR code verification
- [ ] AEFI (adverse event) reporting
- [ ] Multi-language support (English/Twi/Hausa)

## Healthcare Compliance

- HIPAA-like data protection (ready for encryption)
- Immutable audit trails
- Role-based access control
- Government-grade security

## Support

For issues or questions, contact: support@vaccination.gov.gh

## License

Government of Ghana Ministry of Health © 2025
