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
