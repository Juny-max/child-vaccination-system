# Chapter 4 Diagrams (Mermaid)

## Activity Diagram (Main System Workflow)

```mermaid
flowchart TD
  A([Start]) --> B[Open login page]
  B --> C[Enter credentials]
  C --> D{Valid?}
  D -- No --> E[Show error] --> B
  D -- Yes --> F[Identify role]
  F --> G{Role}
  G -- Parent --> H[Open parent dashboard]
  G -- Nurse --> I[Open facility dashboard]
  G -- CHW --> J[Open CHW dashboard]
  G -- Branch Manager --> BM[Open branch dashboard]
  G -- HQ Admin --> HQ[Open HQ dashboard]
  H --> K[View child records or certificate]
  I --> L[Register child or record vaccination]
  J --> M[Record visit or vaccination]
  BM --> BM2[View KPIs, approve CHW visits, manage staff]
  HQ --> HQ2[Manage users, branches, vaccines, audit logs]
  M --> N[Save locally if offline]
  N --> O[Sync when online]
  K --> P[Save updates]
  L --> P
  O --> P
  BM2 --> P
  HQ2 --> P
  P --> Q[Send notification if needed]
  Q --> R([End])
```

## Use Case Diagram (All 5 Roles)

```mermaid
flowchart LR
  Parent[Parent] --> UC1((Login))
  Parent --> UC2((View child records))
  Parent --> UC3((Download certificate))

  Nurse[Facility Nurse] --> UC1
  Nurse --> UC4((Register child))
  Nurse --> UC5((Record vaccination))
  Nurse --> UC6((Schedule appointment))

  CHW[CHW] --> UC1
  CHW --> UC7((Offline capture))
  CHW --> UC8((Sync data))

  BM[Branch Manager] --> UC1
  BM --> UC9((View branch KPIs))
  BM --> UC10((Approve CHW visits))
  BM --> UC11((Manage staff))

  HQA[HQ Admin] --> UC1
  HQA --> UC12((Manage users))
  HQA --> UC13((Manage branches))
  HQA --> UC14((View audit logs))

  Public[Public / Anyone] --> UC15((Verify certificate))

  subgraph CVCC System
    UC1
    UC2
    UC3
    UC4
    UC5
    UC6
    UC7
    UC8
    UC9
    UC10
    UC11
    UC12
    UC13
    UC14
    UC15
  end
```

## State Diagram (CHW Offline Capture and Sync)

```mermaid
stateDiagram-v2
  [*] --> Online
  Online --> Offline: network lost
  Offline --> Recording: capture visit
  Recording --> PendingSync: saved locally
  PendingSync --> Syncing: network restored
  Syncing --> Synced: upload success
  Syncing --> SyncFailed: error
  SyncFailed --> PendingSync: retry
  Synced --> Online
```

## Deployment Diagram

```mermaid
flowchart LR
  subgraph Client
    U[User Device\nBrowser]
  end

  subgraph Frontend
    FE[Next.js App\nVercel]
  end

  subgraph Backend
    API[NestJS API\nRender]
  end

  subgraph Data
    DB[(Supabase\nPostgreSQL)]
  end

  subgraph External Services
    SMS[Hubtel SMS]
    Email[Brevo SMTP]
    Maps[OpenStreetMap Tiles]
  end

  U --> FE
  FE --> API
  API --> DB
  API --> SMS
  API --> Email
  FE --> Maps
```

## Class Diagram (Small, 10 Classes)

```mermaid
classDiagram
  class User {
    +id
    +email
    +role
    +status
  }

  class Guardian {
    +id
    +fullName
    +phonePrimary
  }

  class Child {
    +id
    +cvccId
    +fullName
    +dateOfBirth
  }

  class Vaccine {
    +id
    +name
  }

  class VaccinationEvent {
    +id
    +date
    +batchNumber
  }

  class Appointment {
    +id
    +scheduledDate
    +status
  }

  class Certificate {
    +id
    +issuedDate
  }

  class Branch {
    +id
    +name
    +region
  }

  class CatchmentArea {
    +id
    +name
  }

  class Notification {
    +id
    +channel
    +status
  }

  User "1" --> "0..1" Guardian : profile
  Guardian "1" --> "0..*" Child : cares_for
  Child "1" --> "0..*" VaccinationEvent
  Vaccine "1" --> "0..*" VaccinationEvent
  Child "1" --> "0..*" Appointment
  Child "1" --> "0..1" Certificate
  Branch "1" --> "0..*" User
  Branch "1" --> "0..*" CatchmentArea
  CatchmentArea "1" --> "0..*" Child
  Guardian "1" --> "0..*" Notification
```

## Sequence Diagram (Unified Login and Role Routing)

```mermaid
sequenceDiagram
  actor U as User
  participant UI as Web App
  participant API as Auth API
  participant DB as Database

  U->>UI: Enter email and password
  UI->>API: POST /auth/login
  API->>DB: Validate user and password
  DB-->>API: User record + role
  API-->>UI: JWT cookie + profile
  alt mustChangePassword
    UI-->>U: Redirect to change password
  else
    UI-->>U: Redirect to role dashboard
  end
```

---

## Sequence Diagram (Record Vaccination — Facility Nurse)

```mermaid
sequenceDiagram
  actor N as Facility Nurse
  participant UI as Web App
  participant API as NestJS API
  participant DB as Supabase DB
  participant SMS as SMS Gateway

  N->>UI: Open child patient chart
  UI->>API: GET /facility/children/:id
  API->>DB: Fetch child + vaccination schedule
  DB-->>API: Child record + due vaccines
  API-->>UI: Child data
  UI-->>N: Display vaccination schedule

  N->>UI: Select vaccine, enter batch number and site
  UI->>API: POST /facility/children/:id/vaccinations
  API->>DB: Insert vaccination_event record
  DB-->>API: Saved event

  API->>DB: Check if all schedule doses completed
  alt All doses complete
    DB-->>API: Schedule complete
    API->>DB: Create or update certificate record
    DB-->>API: Certificate issued
  else More doses pending
    DB-->>API: Schedule incomplete
  end

  API->>SMS: Send appointment reminder to guardian
  SMS-->>API: Sent confirmation
  API-->>UI: Success response
  UI-->>N: Show success — vaccination recorded
```

---

## Sequence Diagram (CHW Offline Registration and Sync)

```mermaid
sequenceDiagram
  actor C as CHW
  participant UI as Mobile Web App
  participant IDB as IndexedDB (Device)
  participant SW as Service Worker
  participant API as NestJS API
  participant DB as Supabase DB

  C->>UI: Open register child form (offline)
  UI-->>C: Form loads from cache

  C->>UI: Fill mother and child details, capture GPS
  UI->>IDB: Save record locally with status=pending
  IDB-->>UI: Saved
  UI-->>C: Show — Saved offline, will sync when online

  Note over SW,API: Later — when network is restored

  SW->>IDB: Check for pending sync items
  IDB-->>SW: Return pending records

  loop For each pending record
    SW->>API: POST /chw/register-child
    API->>DB: Insert guardian + child records
    DB-->>API: Return new CVCC ID and QR code payload
    API-->>SW: 201 Created with server IDs
    SW->>IDB: Update local record — status=synced, add server ID
  end

  SW-->>UI: Sync complete notification
  UI-->>C: Show — All records synced
```

---

## Sequence Diagram (Public Certificate Verification)

```mermaid
sequenceDiagram
  actor P as Public User
  participant LP as Landing Page
  participant VP as Verify Page (/verify)
  participant NR as Next.js Route Handler (/api/verify)
  participant DB as Supabase DB

  P->>LP: Click Verify Certificate button
  LP-->>P: Navigate to /verify

  alt Scan QR Code
    P->>VP: Click Scan QR Code
    VP-->>P: Open device camera
    P->>VP: Point camera at certificate QR code
    VP-->>P: QR payload detected — extract certificate ID
  else Manual Entry
    P->>VP: Type certificate ID manually
  end

  VP->>NR: GET /api/verify?id=CERT-GH-2025-001234
  NR->>DB: Query certificates table by certificate_id
  DB-->>NR: Certificate row or empty

  alt Certificate found and issued
    NR-->>VP: found=true, isValid=true, child name, vaccines
    VP-->>P: Show VALID CERTIFICATE — child name, DOB, vaccines completed
  else Certificate found but revoked
    NR-->>VP: found=true, isValid=false, status=revoked
    VP-->>P: Show CERTIFICATE REVOKED
  else Child registered but vaccines incomplete
    NR-->>VP: found=false — fallback to children table
    NR->>DB: Query children by cvcc_id
    DB-->>NR: Child record with partial vaccines
    NR-->>VP: isPending=true, vaccinesCompleted list
    VP-->>P: Show VACCINATION INCOMPLETE — progress shown
  else Not found
    NR-->>VP: found=false
    VP-->>P: Show CERTIFICATE NOT FOUND
  end
```

---

## Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
  users {
    uuid id PK
    string email
    string role
    string status
    uuid branch_id FK
  }
  branches {
    uuid id PK
    string name
    string code
    string region
    uuid manager_id FK
  }
  catchment_areas {
    uuid id PK
    string name
    uuid branch_id FK
    uuid assigned_chw_id FK
  }
  guardians {
    uuid id PK
    uuid user_id FK
    string full_name
    string phone_primary
    uuid catchment_area_id FK
  }
  children {
    uuid id PK
    string cvcc_id
    string full_name
    date date_of_birth
    string gender
    uuid primary_facility_id FK
  }
  child_guardian {
    uuid id PK
    uuid child_id FK
    uuid guardian_id FK
    string relationship
    bool is_primary
  }
  vaccines {
    uuid id PK
    string code
    string name
    string status
  }
  vaccination_schedules {
    uuid id PK
    uuid vaccine_id FK
    int dose_number
    string schedule_name
    int due_days_from_birth
  }
  vaccination_events {
    uuid id PK
    uuid child_id FK
    uuid vaccine_id FK
    date administered_date
    uuid administered_by_user_id FK
    uuid facility_id FK
    string batch_number
    bool is_synced
  }
  aefi_reports {
    uuid id PK
    uuid vaccination_event_id FK
    uuid child_id FK
    string severity
    string status
  }
  certificates {
    uuid id PK
    string certificate_id
    uuid child_id FK
    uuid issued_by_facility_id FK
    string completion_status
    string status
  }
  appointments {
    uuid id PK
    uuid child_id FK
    uuid guardian_id FK
    uuid vaccine_id FK
    uuid facility_id FK
    date scheduled_date
    string status
  }
  visit_logs {
    uuid id PK
    uuid chw_id FK
    uuid child_id FK
    uuid catchment_area_id FK
    date visit_date
    string status
  }
  sync_queue {
    uuid id PK
    uuid user_id FK
    string entity_type
    string operation
    string status
  }
  audit_logs {
    uuid id PK
    uuid user_id FK
    string action
    string entity_type
    timestamp created_at
  }

  branches ||--o{ users : "employs"
  branches ||--o| users : "managed by"
  branches ||--o{ catchment_areas : "has zones"
  users ||--o{ catchment_areas : "CHW assigned to"
  users ||--o| guardians : "parent login"
  guardians ||--o{ child_guardian : "linked via"
  children ||--o{ child_guardian : "linked via"
  children ||--o{ vaccination_events : "receives"
  vaccines ||--o{ vaccination_events : "administered as"
  vaccines ||--o{ vaccination_schedules : "scheduled in"
  vaccination_events ||--o| aefi_reports : "may trigger"
  children ||--o| certificates : "issued"
  children ||--o{ appointments : "scheduled for"
  guardians ||--o{ appointments : "booked by"
  vaccines ||--o{ appointments : "for vaccine"
  branches ||--o{ appointments : "at facility"
  users ||--o{ visit_logs : "CHW records"
  children ||--o{ visit_logs : "visited during"
  catchment_areas ||--o{ visit_logs : "in zone"
  users ||--o{ sync_queue : "queues offline data"
  users ||--o{ audit_logs : "actions logged"
```

---

## System Architecture Diagram

```mermaid
flowchart TD
  subgraph Client["Client Layer — Browser / Mobile"]
    ReactUI["React UI\n5 Role Dashboards + Public /verify"]
    IndexedDB["IndexedDB\nOffline Storage"]
    ServiceWorker["Service Worker\nBackground Sync"]
  end

  subgraph NextJS["Frontend — Next.js 16 on Vercel"]
    AppRouter["App Router\n/app/** pages"]
    NextAPIRoutes["Next.js API Routes\n/api/verify  /api/chatbot"]
    AuthMiddleware["Auth Middleware\nJWT route protection"]
    LibAPI["lib/api/ helpers\nauto-attach Bearer token"]
  end

  subgraph NestJS["Backend — NestJS on Render (port 3001)"]
    AuthMod["Auth Module\nJWT login, Guards, Roles"]
    ParentMod["Parent Module"]
    FacilityMod["Facility Module"]
    CHWMod["CHW Module"]
    BranchMod["Branch Manager Module"]
    HQMod["HQ Admin Module"]
    Common["Common Services\nEmail  SMS  Scheduler  Backup"]
  end

  subgraph DataLayer["Data Layer — Supabase (PostgreSQL)"]
    SupabaseDB[("21 Tables\nusers · children · vaccines\nvaccination_events · certificates\nappointments · visit_logs\naudit_logs · sync_queue ...")]
  end

  subgraph External["External Services"]
    Brevo["Brevo\nTransactional Email"]
    Hubtel["Hubtel\nSMS Gateway"]
    Gemini["Google Gemini\nAI Chatbot"]
  end

  ReactUI --> AppRouter
  ReactUI <--> IndexedDB
  ServiceWorker <--> IndexedDB
  AppRouter --> AuthMiddleware
  AppRouter --> LibAPI
  AppRouter --> NextAPIRoutes
  AuthMiddleware --> LibAPI

  NextAPIRoutes -->|"Direct query\n(no auth needed)"| SupabaseDB
  LibAPI --> AuthMod

  AuthMod --> ParentMod
  AuthMod --> FacilityMod
  AuthMod --> CHWMod
  AuthMod --> BranchMod
  AuthMod --> HQMod

  ParentMod --> SupabaseDB
  FacilityMod --> SupabaseDB
  CHWMod --> SupabaseDB
  BranchMod --> SupabaseDB
  HQMod --> SupabaseDB

  Common --> Brevo
  Common --> Hubtel
  ServiceWorker --> AuthMod
  AppRouter --> Gemini
```
