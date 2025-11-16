# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - PHA Dashboard (November 16, 2025)

- **New Module:** Public Health Authority (PHA) National Dashboard (`/pha/dashboard`)
  - Real-time national KPI cards: Total Children Registered, Total Doses Administered, Measles Coverage %, Dropout Rate %
  - Interactive Recharts visualizations: Coverage trend (line chart), Regional performance (bar chart), AEFI surveillance (pie chart + bar chart)
  - Regional performance insights with top/bottom performers
  - Quick action cards for reports and certificate verification
  
- **New Module:** National Reports & Exporter (`/pha/reports`)
  - 8 official report types: National Coverage, Regional Coverage, Dropout Analysis, Vaccine Stock, AEFI Surveillance, Facility Performance, WHO Monthly, Certificate Issuance
  - Advanced filtering: Region selection, date ranges (monthly/quarterly/yearly), export formats (CSV/Excel/PDF)
  - Live report preview with sample data table
  - Backend-ready payload structures with console logging
  - Toast notifications for report generation status
  
- **New Module:** Certificate Verification Tool (`/pha/verify-certificate`)
  - Anti-fraud certificate validation by ID
  - Privacy-protected results (no child personal info displayed)
  - QR code scanning support (UI ready, camera integration pending)
  - Verification result screens: Valid (green), Invalid (red)
  - Verification audit log table
  - Mock certificate database for testing

- **Documentation:**
  - `PHA_DASHBOARD_DOCUMENTATION.md`: Comprehensive 500+ line guide covering all modules, data structures, backend integration, security, and future enhancements
  - `PHA_QUICKSTART.md`: Quick start guide for testing and demo purposes

### Technical Details - PHA Dashboard

- **Data Visualization:** All charts use Recharts library (specified in system design)
- **Responsive Design:** Mobile-first approach with ResponsiveContainer for all charts
- **Theme Support:** Full light/dark mode compatibility
- **State Management:** React hooks (useState, useMemo) for filters and loading states
- **Toast Notifications:** Sonner integration for user feedback
- **Backend Integration Ready:** 
  - API endpoints documented with payload structures
  - Console logging for development/debugging
  - Error handling with try/catch and toast notifications

### Backend Contract (PHA Dashboard)

The following endpoints must be implemented for full functionality:

#### 1. National Dashboard Data
```
GET /api/pha/dashboard/kpis
GET /api/pha/dashboard/coverage-trend?months=12
GET /api/pha/dashboard/regional-performance
GET /api/pha/dashboard/aefi-reports
```

#### 2. Report Generation
```
POST /api/pha/reports/generate
Body: { reportId, filters: { region, dateRange }, exportFormat }
Response: File stream (CSV/Excel/PDF with appropriate headers)
```

#### 3. Certificate Verification
```
POST /api/pha/certificates/verify
Body: { certificateId, verificationMethod, verifiedBy }
Response: { status: "valid" | "not-found", data: {...} }
```

### Database Queries Required

- **Coverage calculation:** Join child, vaccination_event tables by region/vaccine
- **Dropout rate:** Compare DPT1 vs DPT3 completion by child cohort
- **AEFI aggregation:** Group adverse events by type, severity, region
- **Certificate lookup:** Search certificate table by unique ID with validation

### Security & Privacy Considerations

- Certificate verification NEVER returns child personal data (name, DOB, parents)
- All PHA endpoints require authentication (role: "pha" or "national_admin")
- Audit logging for all verification attempts and report generations
- GDPR/Ghana Data Protection Act compliance: aggregate data only

---

- Frontend: Parent dashboard — added an in-page appointment booking form on `/parent/dashboard/vaccination-status` that lets a parent select preferred date/time, provide contact details and notes. The form currently simulates submission and displays a confirmation banner in the UI.
- Frontend: Support page — added a lightweight chatbot preview on `/parent/dashboard/support` that opens a mock chat session when the user taps "Launch chatbot". This is a front-end placeholder until the backend chat/notification service is available.

### Backend contract (Appointment booking)

The following describes the backend requirements and expected semantics for the appointment booking flow. Add these items to the backend implementation checklist to avoid integration mismatches.

- Endpoint: POST /api/appointments (or an equivalent facility-facing queue endpoint)
- Payload (JSON) example:

```json
{
  "childId": "CHILD-001",
  "parentId": "PARENT-123",
  "parentContact": "+233241234567",
  "preferredDate": "2025-03-05",
  "preferredTime": "10:00",
  "notes": "Child had mild fever last week",
  "facilityId": "FAC-ACC-01"
}
```

- Routing: The booking MUST be delivered to the facility where the child was born OR where the child was registered. If the parent selected a preferred facility, include `facilityId` and use that as routing priority.
- Acknowledgement semantics:
  - Return 200 OK with a confirmation object when the appointment is immediately scheduled (include `confirmationId`, `scheduledDate`, `scheduledTime`).
  - Return 202 Accepted when the request is accepted for asynchronous processing (include a `requestId` and estimated processing time). The backend must persist the request and retry on transient failures.
  - On errors return appropriate 4xx/5xx codes with human-readable error messages.
- Assignment flow: The receiving facility may either (a) confirm a scheduled appointment, or (b) assign a community health worker (CHW) for a home visit. When a CHW is assigned, return the CHW id and expected visit window in the acknowledgement.
- Delivery guarantees & auditing: Persist every booking request and its status for audit and retry. Implement idempotency keys for safe retries from the front-end.
- Security & validation: Authenticate/authorize requests (parent role), validate child-parent relationship, enforce TLS, and rate-limit booking endpoints. Validate dates/times against facility availability where possible.

### Notes for backend implementers

- The front-end currently simulates booking and displays a confirmation message; replace the simulation with a real POST request to the above endpoint when the backend is ready.
- Provide a webhook or notification mechanism so facilities can notify parents when appointments are confirmed or CHWs are assigned.
- Implement integration tests verifying routing logic (facility-of-birth vs selected facility) and CHW assignment flows.

## [2025-11-08] - UI updates

- Update: Added appointment form and chatbot preview UI components (front-end only).
