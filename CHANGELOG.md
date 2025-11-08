# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
