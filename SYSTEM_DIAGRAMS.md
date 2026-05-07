# System Architecture Diagrams

All 10 system diagrams for the Child Vaccination Command Center (CVCC) system.
**Scope: 5 active user roles only** (parent, hq-admin, branch-manager, facility-nurse, chw).
Public certificate verification is a public page, not a user role.

---

## 1. Sequence Diagram (Facility Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Nurse as Facility Nurse
    participant FE as Frontend (Next.js)
    participant API as Backend (NestJS)
    participant DB as Supabase DB
    participant SMS as SmsService
    participant QR as QrTokenService

    Nurse->>FE: Sign in
    FE->>API: POST /auth/login
    API->>DB: Validate user + role + password
    DB-->>API: User record
    API-->>FE: JWT + role + branchId

    Nurse->>FE: Register guardian
    FE->>API: POST /facility/guardians
    API->>DB: Insert guardian (+ optional parent user account)
    API->>SMS: Send registration/welcome SMS (if configured)
    API-->>FE: guardianId + status message

    Nurse->>FE: Register child
    FE->>API: POST /facility/children
    API->>QR: generateChildToken()
    API->>DB: Insert children
    API->>DB: Insert child_guardian (primary)
    API->>SMS: Send child registration SMS
    API-->>FE: childId + cvccId

    Nurse->>FE: Record vaccination
    FE->>API: POST /facility/children/:childId/vaccinations
    API->>DB: Insert vaccination_events
    alt AEFI flagged
        API->>DB: Insert aefi_reports
    end
    API->>DB: Update stock_inventory

    API->>DB: Check completion status
    alt All mandatory doses complete and no certificate exists
        API->>QR: generateCertificateToken()
        API->>DB: Insert certificates
        API->>SMS: Notify guardian (no-email flow)
    end

    API-->>FE: Vaccination recorded
```

---

## 2. Use Case Diagram (5 README Roles Only)

```mermaid
flowchart LR
    subgraph CVS["Child Vaccination System"]
      UC1((Authenticate/Login))
      UC2((Register Guardian))
      UC3((Register Child))
      UC4((Record Vaccination))
      UC5((Record Growth & Session Notes))
      UC6((Manage Appointments))
      UC7((Offline Capture & Sync))
      UC8((Report/Review AEFI))
      UC9((Manage Branches/Users/Catchments/Vaccines))
      UC10((View Analytics & Reports))
      UC11((Verify Certificate/QR - public page))
    end

    Parent([Parent]) --> UC1
    Parent --> UC6
    Parent --> UC11

    Nurse([Facility Nurse]) --> UC1
    Nurse --> UC2
    Nurse --> UC3
    Nurse --> UC4
    Nurse --> UC5
    Nurse --> UC6
    Nurse --> UC8

    CHW([CHW]) --> UC1
    CHW --> UC4
    CHW --> UC7

    BM([Branch Manager]) --> UC1
    BM --> UC8
    BM --> UC9

    HQ([HQ Admin]) --> UC1
    HQ --> UC9
    HQ --> UC10
```

---

## 3. Flowchart (Core Vaccination Lifecycle)

```mermaid
flowchart TD
    A[User logs in] --> B{Role check}
    B -->|Facility Nurse| C[Register guardian]
    C --> D[Register child]
    D --> E[Child linked to guardian + CVCC ID + QR payload]
    E --> F[Load due schedule from vaccination_schedules]
    F --> G[Book/confirm appointment]
    G --> H[Administer vaccine]
    H --> I{AEFI observed?}
    I -->|Yes| J[Create AEFI report]
    I -->|No| K[Continue]
    J --> L[Update stock inventory]
    K --> L
    L --> M{All mandatory vaccines completed?}
    M -->|Yes| N[Issue certificate + QR payload]
    M -->|No| O[Set next appointment]
    N --> P[Notify guardian]
    O --> P
    P --> Q[Scheduler handles reminders + missed follow-up]
    Q --> R[End]
```

---

## 4. Database Schema (ERD)

```mermaid
erDiagram
    USERS {
      uuid id PK
      string email
      string role
      string status
      uuid branch_id FK
      string password_hash
      bool must_change_password
    }

    BRANCHES {
      uuid id PK
      string code
      string name
      string region
      uuid manager_id FK
    }

    CATCHMENT_AREAS {
      uuid id PK
      string code
      uuid branch_id FK
      uuid assigned_chw_id FK
    }

    GUARDIANS {
      uuid id PK
      uuid user_id FK
      string full_name
      string phone_primary
      string email
      uuid catchment_area_id FK
      string preferred_contact
    }

    CHILDREN {
      uuid id PK
      string cvcc_id
      string qr_code_payload
      string full_name
      date date_of_birth
      uuid primary_facility_id FK
      uuid current_catchment_area_id FK
      bool is_active
    }

    CHILD_GUARDIAN {
      uuid id PK
      uuid child_id FK
      uuid guardian_id FK
      bool is_primary
      string relationship
    }

    VACCINES {
      uuid id PK
      string code
      string name
      string status
    }

    VACCINATION_SCHEDULES {
      uuid id PK
      uuid vaccine_id FK
      int dose_number
      int due_days_from_birth
      bool is_mandatory
    }

    VACCINATION_EVENTS {
      uuid id PK
      uuid child_id FK
      uuid vaccine_id FK
      uuid administered_by_user_id FK
      uuid facility_id FK
      int dose_number
      date administered_date
      string status
      bool is_synced
    }

    AEFI_REPORTS {
      uuid id PK
      uuid vaccination_event_id FK
      uuid child_id FK
      uuid reported_by_user_id FK
      string severity
      string status
    }

    CERTIFICATES {
      uuid id PK
      string certificate_id
      uuid child_id FK
      string qr_payload
      date issued_date
      uuid issued_by_user_id FK
      uuid issued_by_facility_id FK
      string status
    }

    APPOINTMENTS {
      uuid id PK
      uuid child_id FK
      uuid guardian_id FK
      uuid vaccine_id FK
      uuid facility_id FK
      date scheduled_date
      string status
    }

    NOTIFICATIONS {
      uuid id PK
      string template_id
      string recipient_type
      uuid recipient_id
      string channel
      string status
    }

    SYNC_QUEUE {
      uuid id PK
      uuid user_id FK
      string entity_type
      string operation
      string status
    }

    SYNC_CONFLICTS {
      uuid id PK
      uuid sync_queue_id FK
      string conflict_type
      uuid resolved_by_user_id FK
      string status
    }

    DUPLICATE_CANDIDATES {
      uuid id PK
      uuid child_a_id FK
      uuid child_b_id FK
      uuid survivor_id FK
      uuid merged_by_user_id FK
      string status
    }

    GROWTH_MONITORING {
      uuid id PK
      uuid child_id FK
      uuid recorded_by_user_id FK
      uuid facility_id FK
      date measurement_date
    }

    CLINIC_SESSION_NOTES {
      uuid id PK
      uuid child_id FK
      uuid facility_id FK
      uuid recorded_by_user_id FK
      date visit_date
    }

    PASSWORD_RESET_TOKENS {
      uuid id PK
      uuid user_id FK
      string token
      datetime expires_at
    }

    BRANCHES ||--o{ USERS : has_staff
    USERS ||--o{ BRANCHES : manages
    BRANCHES ||--o{ CATCHMENT_AREAS : has
    CATCHMENT_AREAS ||--o{ GUARDIANS : includes
    CATCHMENT_AREAS ||--o{ CHILDREN : current_area
    BRANCHES ||--o{ CHILDREN : primary_facility
    USERS ||--o| GUARDIANS : parent_account
    CHILDREN ||--o{ CHILD_GUARDIAN : linked
    GUARDIANS ||--o{ CHILD_GUARDIAN : linked
    VACCINES ||--o{ VACCINATION_SCHEDULES : defines
    CHILDREN ||--o{ VACCINATION_EVENTS : receives
    VACCINES ||--o{ VACCINATION_EVENTS : administered
    USERS ||--o{ VACCINATION_EVENTS : records
    BRANCHES ||--o{ VACCINATION_EVENTS : facility
    VACCINATION_EVENTS ||--o{ AEFI_REPORTS : triggers
    CHILDREN ||--o{ CERTIFICATES : certified
    CHILDREN ||--o{ APPOINTMENTS : has
    GUARDIANS ||--o{ APPOINTMENTS : books
    VACCINES ||--o{ APPOINTMENTS : for_vaccine
    BRANCHES ||--o{ APPOINTMENTS : at_facility
    USERS ||--o{ SYNC_QUEUE : creates
    SYNC_QUEUE ||--o{ SYNC_CONFLICTS : causes
    CHILDREN ||--o{ GROWTH_MONITORING : measured
    CHILDREN ||--o{ CLINIC_SESSION_NOTES : has_notes
    USERS ||--o{ PASSWORD_RESET_TOKENS : owns
```

---

## 5. Activity Diagram (Facility Nurse Session - UML Format)

```mermaid
activity
  start
  :Facility Nurse Logs In|
  :Search Child in Dashboard|
  if (Child Exists?) then (Yes)
    :Open Child Chart|
  else (No)
    :Register Guardian\n(POST /facility/guardians)|
    :Register Child\n(POST /facility/children)|
    :Receive childId + CVCC ID|
    :Open Child Chart|
  endif
  :Review Vaccination History\n+ Scheduled Doses|
  :Administer Vaccine\n(POST /facility/children/:childId/vaccinations)|
  if (AEFI Observed?) then (Yes)
    :Create AEFI Report|
  else (No)
  endif
  :Update Stock Inventory|
  :Check Completion Status|
  if (All Mandatory Vaccines\nCompleted + No Certificate?) then (Yes)
    :Auto-Issue Certificate\n+ QR Payload|
    :Send SMS Notification\nto Guardian|
  else (No)
    :Set/Confirm\nNext Appointment|
  endif
  stop
```

---

## 6. System Architecture Diagram (5 Roles Only)

```mermaid
flowchart LR
  subgraph Users
    HQ[HQ Admin]
    BM[Branch Manager]
    FN[Facility Nurse]
    CHW[CHW]
    P[Parent]
  end

  subgraph Frontend["Frontend Layer (Next.js)"]
    WEB[Web UI]
    PWA[PWA + Local Offline Store]
    VERIFYAPI["Next API Routes\n(/api/verify, /api/verify/token)"]
  end

  subgraph Backend["Backend Layer (NestJS)"]
    API[REST API]
    AUTH[JWT Auth + RolesGuard]
    SCHED[Scheduler Jobs Cron]
    SERVICES[Email/SMS/QR Services]
  end

  subgraph Data["Data Layer Supabase"]
    DB[(PostgreSQL)]
    ST[(Storage)]
  end

  subgraph External["External Gateways"]
    SMSGW[SMS Provider]
    EMAILGW[Brevo/SMTP]
  end

  Users --> WEB
  WEB <--> API
  WEB --> VERIFYAPI
  VERIFYAPI --> DB
  WEB <--> PWA
  PWA --> API

  API --> AUTH
  API <--> DB
  API <--> ST
  API --> SERVICES
  SCHED --> DB
  SCHED --> SMSGW
  SCHED --> EMAILGW
  SERVICES --> SMSGW
  SERVICES --> EMAILGW
```

---

## 7. Authentication & Authorization Flow

```mermaid
activity
  start
  :User enters email + password|
  :Submit login form|
  if (Credentials Valid?) then (No)
    :Show error message|
    :User retries|
  else (Yes)
  endif
  :System validates user status + role|
  :Issue access token|
  :User successfully logged in|
  :Route to appropriate dashboard\n(based on role)|
  stop
```

---

## 8. Offline Sync Flow (CHW)

```mermaid
activity
  start
  :CHW captures registration/vaccination offline|
  :Save in local device store|
  if (Data Type) then (Registration)
    :Queue for POST /chw/offline-registrations|
  else (Vaccination)
    :Queue for POST /chw/vaccinations/sync|
  endif
  if (Network Available?) then (No)
    :Keep pending locally|
    note right: Wait for connectivity
  else (Yes)
  endif
  :Send queued payload to backend|
  if (Sync Success?) then (Yes)
    :Mark local item as synced|
  else (Conflict/Error)
    :Record conflict/failure|
    :Add to sync_conflicts for review|
    :Resolve conflict + apply final state|
  endif
  stop
```

---

## 9. Notification Flow

```mermaid
activity
  start
  :Scheduler checks for due vaccinations\nand missed appointments|
  if (Found?) then (Yes)
  else (No)
    :No action needed|
  endif
  :Build SMS/Email notification message|
  :Send notification to guardian/parent|
  if (Delivery Success?) then (Yes)
    :Mark notification as delivered|
  else (Failed)
    :Mark notification as failed|
    :Add to retry queue|
  endif
  if (Manual Retry Needed?) then (Yes)
    :HQ Admin can manually resend|
  else (No)
  endif
  stop
```

---

## 10. Deployment Diagram

```mermaid
flowchart LR
  U[Users / Browsers] --> FE[Vercel: Next.js Frontend]
  FE --> FEAPI[Next API Routes\n/api/verify]
  FE --> BE[Render: NestJS Backend API]

  FEAPI --> DB[(Supabase PostgreSQL)]
  BE --> DB
  BE --> ST[(Supabase Storage)]
  BE --> EMAIL[Brevo/SMTP Gateway]
  BE --> SMS[SMS Gateway]
```

---

## Summary

✅ **All 10 diagrams aligned with README scope:**
- 5 active user roles: parent, hq-admin, branch-manager, facility-nurse, chw
- Data Officer & PHA modules excluded (not in active scope)
- Public certificate verification is a public page, not a user role
- Activity Diagram follows proper UML format with decision diamonds and fork/join bars
