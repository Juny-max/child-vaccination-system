# Chapter 4: System Architecture and Diagrams

This document contains all the diagrams needed for Chapter 4 of the project documentation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Flowcharts](#2-flowcharts)
   - 2.1 [Login with RBAC Flow](#21-login-with-rbac-flow)
   - 2.2 [Mother/Guardian Registration Flow](#22-motherguardian-registration-flow)
   - 2.3 [Child Registration Flow](#23-child-registration-flow)
   - 2.4 [Vaccination Administration Flow](#24-vaccination-administration-flow)
   - 2.5 [SMS Notification Flow](#25-sms-notification-flow)
   - 2.6 [CHW Offline Vaccination Flow](#26-chw-offline-vaccination-flow)
3. [Activity Diagrams](#3-activity-diagrams)
   - 3.1 [Vaccination Workflow Activity](#31-vaccination-workflow-activity)
   - 3.2 [CHW Outreach Activity](#32-chw-outreach-activity)
4. [Use Case Diagrams](#4-use-case-diagrams)
   - 4.1 [System Use Case Overview](#41-system-use-case-overview)
   - 4.2 [Parent Use Cases](#42-parent-use-cases)
   - 4.3 [Facility Nurse Use Cases](#43-facility-nurse-use-cases)
   - 4.4 [CHW Use Cases](#44-chw-use-cases)
   - 4.5 [Branch Manager Use Cases](#45-branch-manager-use-cases)
   - 4.6 [HQ Admin Use Cases](#46-hq-admin-use-cases)
   - 4.7 [PHA Use Cases](#47-pha-use-cases)
   - 4.8 [Data Officer Use Cases](#48-data-officer-use-cases)
5. [Sequence Diagrams](#5-sequence-diagrams)
   - 5.1 [User Login Sequence](#51-user-login-sequence)
   - 5.2 [Vaccination Recording Sequence](#52-vaccination-recording-sequence)
   - 5.3 [SMS Notification Sequence](#53-sms-notification-sequence)
   - 5.4 [CHW Offline Sync Sequence](#54-chw-offline-sync-sequence)
6. [Database Schema](#6-database-schema)
   - 6.1 [Entity Relationship Diagram](#61-entity-relationship-diagram)
   - 6.2 [Core Tables Overview](#62-core-tables-overview)
   - 6.3 [Table Relationships Explained](#63-table-relationships-explained)
   - 6.4 [Foreign Keys Explained](#64-foreign-keys-explained)
7. [Screenshots Checklist](#7-screenshots-checklist)

---

## 1. System Overview

The Child Vaccination Command Center (CVCC) is a multi-tenant health management system for tracking childhood vaccinations in Ghana. The system supports 7 user roles with role-based access control (RBAC).

### User Roles

| Role | Description |
|------|-------------|
| HQ Admin | National-level system administrator |
| Branch Manager | Regional/district facility manager |
| Facility Nurse | Healthcare facility nursing staff |
| CHW | Community Health Worker for field outreach |
| Data Officer | Data quality and deduplication |
| PHA | Public Health Authority (government) |
| Parent | Parents/Guardians of children |

---

## 2. Flowcharts

### 2.1 Login with RBAC Flow

This flowchart shows how the system authenticates users and redirects them to their respective dashboards based on their role.

```mermaid
flowchart TD
    A([Start]) --> B[/Enter Email and Password/]
    B --> C{Are Credentials Valid?}
    C -->|No| D[Show Error Message]
    D --> B
    C -->|Yes| E[Generate JWT Token]
    E --> F[Store Token in Cookie]
    F --> G{What is User Role?}
    G -->|Parent| H[Go to Parent Dashboard]
    G -->|HQ Admin| I[Go to HQ Dashboard]
    G -->|Branch Manager| J[Go to Branch Dashboard]
    G -->|Facility Nurse| K[Go to Facility Dashboard]
    G -->|CHW| L[Go to CHW Dashboard]
    G -->|Data Officer| M[Go to Data Officer Dashboard]
    G -->|PHA| N[Go to PHA Dashboard]
    H --> O([Stop])
    I --> O
    J --> O
    K --> O
    L --> O
    M --> O
    N --> O
```

---

### 2.2 Mother/Guardian Registration Flow

This flowchart shows how a mother/guardian is registered in the system by facility staff.

```mermaid
flowchart TD
    A([Start]) --> B[/Enter Mother Full Name/]
    B --> C[/Enter Phone Number/]
    C --> D[/Enter Address and Region/]
    D --> E[/Enter Ghana Card Number/]
    E --> F{Did Mother Provide Email?}
    F -->|Yes| G[Create User Account]
    G --> H[Generate Temporary Password]
    H --> I[Send Welcome SMS]
    I --> J[Save Guardian Record]
    F -->|No| J
    J --> K[Assign to Catchment Area]
    K --> L[Registration Complete]
    L --> M([Stop])
```

---

### 2.3 Child Registration Flow

This flowchart shows the complete child registration process.

```mermaid
flowchart TD
    A([Start]) --> B{Does Guardian Exist?}
    B -->|No| C[Register Mother First]
    C --> D[Complete Guardian Registration]
    D --> E[Select Guardian]
    B -->|Yes| E
    E --> F[/Enter Child Full Name/]
    F --> G[/Enter Date of Birth/]
    G --> H[/Enter Gender/]
    H --> I[/Enter Birth Weight/]
    I --> J[System Generates CVCC ID]
    J --> K[System Generates QR Code]
    K --> L[Save Child Record]
    L --> M[Create Vaccination Schedule]
    M --> N{Is SMS Enabled?}
    N -->|Yes| O[Send Confirmation SMS]
    N -->|No| P[Skip SMS]
    O --> Q[Display Child Card with QR]
    P --> Q
    Q --> R([Stop])
```

---

### 2.4 Vaccination Administration Flow

This flowchart shows how a vaccination is administered at a facility.

```mermaid
flowchart TD
    A([Start]) --> B{How to Find Child?}
    B -->|QR Code| C[Scan QR Code]
    B -->|Manual| D[/Enter Name or CVCC ID/]
    C --> E[Load Child Profile]
    D --> E
    E --> F[View Due Vaccinations]
    F --> G[Select Vaccine]
    G --> H[/Enter Batch Number/]
    H --> I[/Enter Expiry Date/]
    I --> J[/Enter Injection Site/]
    J --> K{Any Side Effects?}
    K -->|Yes| L[Record Side Effect]
    L --> M[/Enter Severity/]
    M --> N[Save Record]
    K -->|No| N
    N --> O[Update Stock]
    O --> P[Mark Complete]
    P --> Q([Stop])
```

---

### 2.5 SMS Notification Flow

This flowchart shows how SMS reminders are sent to parents.

```mermaid
flowchart TD
    A([Start - Daily 8AM]) --> B[Get All Active Children]
    B --> C[Check Each Child]
    C --> D{Vaccination Due Today?}
    D -->|No| E[Skip Child]
    D -->|Yes| F[Get Guardian Phone]
    F --> G{Phone Valid?}
    G -->|No| H[Log Failed]
    G -->|Yes| I[Format Phone Number]
    I --> J[Write SMS Message]
    J --> K[Send via Hubtel]
    K --> L{SMS Sent OK?}
    L -->|Yes| M[Log as Sent]
    L -->|No| N[Log Error]
    E --> O{More Children?}
    H --> O
    M --> O
    N --> O
    O -->|Yes| C
    O -->|No| P[Job Complete]
    P --> Q([Stop])
```

---

### 2.6 CHW Offline Vaccination Flow

This flowchart shows how CHWs record vaccinations offline and sync when connected.

```mermaid
flowchart TD
    A([Start - CHW in Field]) --> B[Open Child Record]
    B --> C[Select Vaccine]
    C --> D[/Enter Vaccination Details/]
    D --> E[Capture GPS Location]
    E --> F[Save to Phone Storage]
    F --> G[Mark as Pending Sync]
    G --> H{Internet Available?}
    H -->|No| I[Continue Offline]
    I --> B
    H -->|Yes| J[Start Background Sync]
    J --> K[Upload Records to Server]
    K --> L{Sync Successful?}
    L -->|Yes| M[Mark as Synced]
    M --> N[Clear Local Queue]
    L -->|No| O[Keep in Queue]
    O --> P[Retry Later]
    N --> Q[Download Updates]
    P --> Q
    Q --> R([Stop])
```

---

## 3. Activity Diagrams

### 3.1 Vaccination Workflow Activity

This activity diagram shows the complete vaccination workflow from scheduling to completion.

```mermaid
flowchart TD
    subgraph Scheduling
        A([Start - Child Registered]) --> B[Calculate Due Dates]
        B --> C[Create Vaccination Schedule]
    end

    subgraph Reminders
        C --> D{Due Date Coming?}
        D -->|Yes| E[Send SMS Reminder]
        E --> F[Parent Gets Notification]
    end

    subgraph FacilityVisit["Facility Visit"]
        F --> G[Parent Brings Child]
        G --> H[Nurse Finds Child]
        H --> I[Give Vaccine]
        I --> J[Record in System]
    end

    subgraph AfterVaccination["After Vaccination"]
        J --> K[Update Stock]
        K --> L{More Doses Due?}
        L -->|Yes| C
        L -->|No| M{All Vaccines Done?}
        M -->|Yes| N[Generate Certificate]
        M -->|No| O[Wait for Next Schedule]
        O --> C
    end

    N --> P([Stop])
```

---

### 3.2 CHW Outreach Activity

This activity diagram shows the CHW field outreach workflow.

```mermaid
flowchart TD
    subgraph Preparation
        A([Start Day]) --> B[Check Sync Status]
        B --> C[Download Register]
        C --> D[View Today Visits]
    end

    subgraph FieldWork["Field Work"]
        D --> E[Go to Household]
        E --> F{Child at Home?}
        F -->|No| G[Record Missed Visit]
        F -->|Yes| H[Check Due Vaccines]
        H --> I{Vaccines Due?}
        I -->|No| J[Give Health Education]
        I -->|Yes| K[Give Vaccine]
        K --> L[Record with GPS]
        L --> M[Save Offline]
        G --> N{More Visits?}
        J --> N
        M --> N
        N -->|Yes| E
    end

    subgraph EndOfDay["End of Day"]
        N -->|No| O[Return to Base]
        O --> P{Internet Available?}
        P -->|Yes| Q[Sync Records]
        P -->|No| R[Keep on Phone]
        Q --> S[View Summary]
        R --> S
    end

    S --> T([End Day])
```

---

## 4. Use Case Diagrams

### 4.1 System Use Case Overview

This diagram shows all actors and their high-level interactions with the system.

```mermaid
flowchart LR
    subgraph Actors
        Parent((Parent))
        Nurse((Facility Nurse))
        CHW((CHW))
        BM((Branch Manager))
        HQ((HQ Admin))
        PHA((PHA))
        DO((Data Officer))
    end

    subgraph System["CVCC System"]
        UC1[View Vaccination Status]
        UC2[Request Appointment]
        UC3[Download Certificate]
        UC4[Register Child]
        UC5[Give Vaccine]
        UC6[Record Side Effects]
        UC7[Offline Vaccination]
        UC8[Transfer Child]
        UC9[Manage Staff]
        UC10[Manage Stock]
        UC11[View Analytics]
        UC12[Manage Branches]
        UC13[Configure Vaccines]
        UC14[View National Reports]
        UC15[Verify Certificates]
        UC16[Fix Duplicate Records]
        UC17[Fix Sync Conflicts]
    end

    Parent --> UC1
    Parent --> UC2
    Parent --> UC3

    Nurse --> UC4
    Nurse --> UC5
    Nurse --> UC6

    CHW --> UC4
    CHW --> UC7
    CHW --> UC8

    BM --> UC9
    BM --> UC10
    BM --> UC11

    HQ --> UC12
    HQ --> UC13
    HQ --> UC11

    PHA --> UC14
    PHA --> UC15

    DO --> UC16
    DO --> UC17
```

---

### 4.2 Parent Use Cases

```mermaid
flowchart LR
    Parent((Parent))

    subgraph ParentUseCases["Parent Use Cases"]
        UC1[View Dashboard]
        UC2[Check Vaccination Status]
        UC3[View Upcoming Vaccines]
        UC4[See Missed Vaccines]
        UC5[Request Appointment]
        UC6[Cancel Appointment]
        UC7[Download Certificate]
        UC8[Update Profile]
        UC9[View Notifications]
        UC10[Chat with Support Bot]
    end

    Parent --> UC1
    Parent --> UC2
    Parent --> UC3
    Parent --> UC4
    Parent --> UC5
    Parent --> UC6
    Parent --> UC7
    Parent --> UC8
    Parent --> UC9
    Parent --> UC10
```

---

### 4.3 Facility Nurse Use Cases

```mermaid
flowchart LR
    Nurse((Facility Nurse))

    subgraph NurseUseCases["Facility Nurse Use Cases"]
        UC1[Search Child]
        UC2[Scan QR Code]
        UC3[Register Mother]
        UC4[Register Child]
        UC5[View Child Profile]
        UC6[Give Vaccine]
        UC7[Record Side Effects]
        UC8[Record Growth Data]
        UC9[Add Session Notes]
        UC10[View Today Appointments]
        UC11[View Urgent Follow-ups]
        UC12[Manage Offline Sync]
    end

    Nurse --> UC1
    Nurse --> UC2
    Nurse --> UC3
    Nurse --> UC4
    Nurse --> UC5
    Nurse --> UC6
    Nurse --> UC7
    Nurse --> UC8
    Nurse --> UC9
    Nurse --> UC10
    Nurse --> UC11
    Nurse --> UC12
```

---

### 4.4 CHW Use Cases

```mermaid
flowchart LR
    CHW((CHW))

    subgraph CHWUseCases["CHW Use Cases"]
        UC1[View Dashboard]
        UC2[View Local Register]
        UC3[Find Child]
        UC4[Register Child Offline]
        UC5[Give Vaccine Offline]
        UC6[Record GPS Location]
        UC7[Transfer Child Out]
        UC8[Transfer Child In]
        UC9[Sync Offline Data]
        UC10[View Activity Log]
        UC11[View Outreach Map]
    end

    CHW --> UC1
    CHW --> UC2
    CHW --> UC3
    CHW --> UC4
    CHW --> UC5
    CHW --> UC6
    CHW --> UC7
    CHW --> UC8
    CHW --> UC9
    CHW --> UC10
    CHW --> UC11
```

---

### 4.5 Branch Manager Use Cases

```mermaid
flowchart LR
    BM((Branch Manager))

    subgraph BMUseCases["Branch Manager Use Cases"]
        UC1[View Branch Dashboard]
        UC2[Register Staff]
        UC3[Manage Staff Status]
        UC4[Log Vaccine Delivery]
        UC5[Reset Expiring Stock]
        UC6[View Stock Alerts]
        UC7[Manage Catchment Areas]
        UC8[Assign CHWs to Areas]
        UC9[View Coverage Analytics]
        UC10[Monitor Overdue Cases]
    end

    BM --> UC1
    BM --> UC2
    BM --> UC3
    BM --> UC4
    BM --> UC5
    BM --> UC6
    BM --> UC7
    BM --> UC8
    BM --> UC9
    BM --> UC10
```

---

### 4.6 HQ Admin Use Cases

```mermaid
flowchart LR
    HQ((HQ Admin))

    subgraph HQUseCases["HQ Admin Use Cases"]
        UC1[View National Dashboard]
        UC2[Manage Branches]
        UC3[Create New Branch]
        UC4[Manage All Users]
        UC5[Reset User Passwords]
        UC6[Configure Vaccines]
        UC7[Set Vaccination Schedule]
        UC8[View National Analytics]
        UC9[Monitor SMS Notifications]
        UC10[View Audit Logs]
        UC11[Check System Health]
    end

    HQ --> UC1
    HQ --> UC2
    HQ --> UC3
    HQ --> UC4
    HQ --> UC5
    HQ --> UC6
    HQ --> UC7
    HQ --> UC8
    HQ --> UC9
    HQ --> UC10
    HQ --> UC11
```

---

### 4.7 PHA Use Cases

```mermaid
flowchart LR
    PHA((PHA))

    subgraph PHAUseCases["Public Health Authority Use Cases"]
        UC1[View National Dashboard]
        UC2[View Coverage Statistics]
        UC3[View Regional Breakdown]
        UC4[Monitor Side Effects]
        UC5[Generate Reports]
        UC6[Export Report to Excel]
        UC7[Verify Certificate]
        UC8[Check Certificate is Real]
        UC9[View Dropout Analysis]
        UC10[View Zero-Dose Children Stats]
    end

    PHA --> UC1
    PHA --> UC2
    PHA --> UC3
    PHA --> UC4
    PHA --> UC5
    PHA --> UC6
    PHA --> UC7
    PHA --> UC8
    PHA --> UC9
    PHA --> UC10
```

---

### 4.8 Data Officer Use Cases

```mermaid
flowchart LR
    DO((Data Officer))

    subgraph DOUseCases["Data Officer Use Cases"]
        UC1[View Dashboard]
        UC2[View Duplicate Records Queue]
        UC3[Review Duplicate Children]
        UC4[Merge Duplicate Records]
        UC5[Dismiss False Matches]
        UC6[View Sync Conflicts]
        UC7[Resolve Sync Conflicts]
        UC8[View Notification Log]
        UC9[Retry Failed SMS]
        UC10[Generate Data Quality Reports]
    end

    DO --> UC1
    DO --> UC2
    DO --> UC3
    DO --> UC4
    DO --> UC5
    DO --> UC6
    DO --> UC7
    DO --> UC8
    DO --> UC9
    DO --> UC10
```

---

## 5. Sequence Diagrams

### 5.1 User Login Sequence

This diagram shows the step-by-step process when a user logs into the system.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Server
    participant Database

    User->>Browser: Enter email and password
    Browser->>Server: Send login request
    Server->>Database: Find user by email
    Database-->>Server: Return user record

    alt Password is correct
        Server->>Server: Create login token
        Server-->>Browser: Return token in cookie
        Browser->>Browser: Check user role
        Browser->>Browser: Redirect to correct dashboard
        Browser-->>User: Show dashboard
    else Password is wrong
        Server-->>Browser: Return error message
        Browser-->>User: Show login failed
    end
```

---

### 5.2 Vaccination Recording Sequence

This diagram shows how a vaccination is recorded in the system.

```mermaid
sequenceDiagram
    actor Nurse
    participant System
    participant Database
    participant StockSystem as Stock System
    participant SMSGateway as SMS Gateway

    Nurse->>System: Search for child
    System->>Database: Find child by name or ID
    Database-->>System: Return child record
    System-->>Nurse: Show child profile

    Nurse->>System: Select vaccine to give
    System-->>Nurse: Show vaccination form

    Nurse->>System: Enter batch number and details
    Nurse->>System: Click save button

    System->>Database: Save vaccination record
    Database-->>System: Confirm saved

    System->>StockSystem: Remove 1 dose from stock
    StockSystem-->>System: Stock updated

    System->>SMSGateway: Send confirmation to parent
    SMSGateway-->>System: SMS sent

    System-->>Nurse: Show success message
```

---

### 5.3 SMS Notification Sequence

This diagram shows how SMS reminders are sent to parents.

```mermaid
sequenceDiagram
    participant Scheduler as Daily Scheduler
    participant Server
    participant Database
    participant Hubtel as Hubtel SMS

    Scheduler->>Server: Start daily reminder job at 8AM
    Server->>Database: Get all children with due vaccines
    Database-->>Server: Return list of children

    loop For each child
        Server->>Database: Get guardian phone number
        Database-->>Server: Return phone number

        alt Phone number is valid
            Server->>Server: Write message with child name and vaccine
            Server->>Hubtel: Send SMS
            Hubtel-->>Server: SMS delivered
            Server->>Database: Save notification as sent
        else Phone number is invalid
            Server->>Database: Save notification as failed
        end
    end

    Server->>Scheduler: Job complete
```

---

### 5.4 CHW Offline Sync Sequence

This diagram shows how CHW phones sync data with the server.

```mermaid
sequenceDiagram
    actor CHW
    participant Phone
    participant LocalDB as Phone Storage
    participant Server
    participant Database

    CHW->>Phone: Record vaccination offline
    Phone->>LocalDB: Save with waiting status
    LocalDB-->>Phone: Saved on phone
    Phone-->>CHW: Show as waiting to sync

    Note over Phone: Later when internet is available

    Phone->>Phone: Detect internet connection
    Phone->>LocalDB: Get all waiting records
    LocalDB-->>Phone: Return waiting vaccinations

    Phone->>Server: Upload batch of records
    Server->>Database: Save each vaccination
    Database-->>Server: All saved
    Server-->>Phone: Return success for each record

    Phone->>LocalDB: Mark records as synced
    LocalDB-->>Phone: Updated

    Phone->>Server: Request new data
    Server->>Database: Get latest changes
    Database-->>Server: Return new data
    Server-->>Phone: Send updates
    Phone->>LocalDB: Save new data

    Phone-->>CHW: Show sync complete badge
```

---

## 6. Database Schema

### 6.1 Entity Relationship Diagram

This diagram shows the main entities and their relationships.

```mermaid
erDiagram
    USERS ||--o{ BRANCHES : manages
    USERS ||--o{ GUARDIANS : creates
    USERS ||--o{ CHILDREN : registers
    USERS ||--o{ VACCINATION_EVENTS : administers
    USERS ||--o{ CATCHMENT_AREAS : assigned_to

    BRANCHES ||--o{ USERS : employs
    BRANCHES ||--o{ CATCHMENT_AREAS : contains
    BRANCHES ||--o{ CHILDREN : primary_facility
    BRANCHES ||--o{ STOCK_INVENTORY : stores

    CATCHMENT_AREAS ||--o{ GUARDIANS : residence
    CATCHMENT_AREAS ||--o{ CHILDREN : current_area

    GUARDIANS ||--o{ CHILD_GUARDIAN : has
    CHILDREN ||--o{ CHILD_GUARDIAN : has

    CHILDREN ||--o{ VACCINATION_EVENTS : receives
    CHILDREN ||--o{ APPOINTMENTS : scheduled
    CHILDREN ||--o{ CERTIFICATES : issued
    CHILDREN ||--o{ GROWTH_MONITORING : measured
    CHILDREN ||--o{ AEFI_REPORTS : experiences

    VACCINES ||--o{ VACCINATION_SCHEDULES : defines
    VACCINES ||--o{ VACCINATION_EVENTS : administered
    VACCINES ||--o{ APPOINTMENTS : for
    VACCINES ||--o{ STOCK_INVENTORY : tracked

    VACCINATION_EVENTS ||--o| AEFI_REPORTS : triggers

    USERS {
        uuid id PK
        string email UK
        string full_name
        enum role
        uuid branch_id FK
        enum status
    }

    BRANCHES {
        uuid id PK
        string name
        string code UK
        string region
        point gps_coordinates
        uuid manager_id FK
    }

    CATCHMENT_AREAS {
        uuid id PK
        string name
        string code UK
        uuid branch_id FK
        uuid assigned_chw_id FK
        polygon boundary
    }

    GUARDIANS {
        uuid id PK
        string full_name
        string phone_primary
        uuid user_id FK
        uuid catchment_area_id FK
    }

    CHILDREN {
        uuid id PK
        string cvcc_id UK
        string qr_code_payload UK
        string full_name
        date date_of_birth
        enum gender
        uuid primary_facility_id FK
        uuid current_catchment_area_id FK
    }

    CHILD_GUARDIAN {
        uuid id PK
        uuid child_id FK
        uuid guardian_id FK
        string relationship
        boolean is_primary
    }

    VACCINES {
        uuid id PK
        string code UK
        string name
        enum status
    }

    VACCINATION_SCHEDULES {
        uuid id PK
        uuid vaccine_id FK
        int dose_number
        string schedule_name
        int due_days_from_birth
    }

    VACCINATION_EVENTS {
        uuid id PK
        uuid child_id FK
        uuid vaccine_id FK
        int dose_number
        date administered_date
        uuid administered_by_user_id FK
        uuid facility_id FK
        string batch_number
        enum status
        point gps_coordinates
    }

    APPOINTMENTS {
        uuid id PK
        uuid child_id FK
        uuid guardian_id FK
        uuid vaccine_id FK
        uuid facility_id FK
        date scheduled_date
        enum status
    }

    CERTIFICATES {
        uuid id PK
        string certificate_id UK
        uuid child_id FK
        string qr_payload UK
        enum status
    }

    AEFI_REPORTS {
        uuid id PK
        uuid vaccination_event_id FK
        uuid child_id FK
        array symptoms
        enum severity
        enum status
    }

    STOCK_INVENTORY {
        uuid id PK
        uuid vaccine_id FK
        uuid facility_id FK
        string batch_number
        date expiry_date
        int quantity_remaining
    }

    GROWTH_MONITORING {
        uuid id PK
        uuid child_id FK
        date measurement_date
        decimal weight_kg
        decimal height_cm
    }

    NOTIFICATIONS {
        uuid id PK
        string template_id
        uuid recipient_id
        enum channel
        string message
        enum status
    }
```

---

### 6.2 Core Tables Overview

| Table | What It Stores | Important Fields |
|-------|----------------|------------------|
| `users` | All people who use the system (nurses, CHWs, parents, admins) | id, email, role, branch_id, status |
| `branches` | Health facilities (hospitals, clinics) | id, name, code, region, manager_id |
| `catchment_areas` | Geographic zones that CHWs are assigned to | id, name, branch_id, assigned_chw_id |
| `guardians` | Parents and caretakers of children | id, full_name, phone_primary |
| `children` | Children registered for vaccination | id, cvcc_id, qr_code_payload, date_of_birth |
| `child_guardian` | Links children to their parents | child_id, guardian_id, is_primary |
| `vaccines` | List of available vaccines (BCG, Penta, etc.) | id, code, name, status |
| `vaccination_schedules` | When each vaccine should be given | vaccine_id, dose_number, due_days_from_birth |
| `vaccination_events` | Records of vaccines that were given | child_id, vaccine_id, administered_date |
| `appointments` | Scheduled vaccination visits | child_id, vaccine_id, scheduled_date |
| `certificates` | Vaccination completion certificates | certificate_id, child_id, qr_payload |
| `aefi_reports` | Reports of side effects after vaccination | vaccination_event_id, symptoms, severity |
| `stock_inventory` | How many vaccines each facility has | vaccine_id, facility_id, quantity_remaining |
| `notifications` | SMS and email messages sent | recipient_id, message, status |
| `audit_logs` | Record of all actions in the system | user_id, action, entity_type |

---

### 6.3 Table Relationships Explained

This section explains how the tables are connected to each other in simple terms.

#### Users and Branches
- A **user** (like a nurse or CHW) works at one **branch** (health facility)
- A **branch** can have many **users** working there
- One user can be the **manager** of a branch

**Example:** Nurse Akosua works at Korle-Bu Clinic. Korle-Bu Clinic has 5 nurses and 3 CHWs. Dr. Mensah is the manager of Korle-Bu.

#### Branches and Catchment Areas
- A **branch** covers multiple **catchment areas** (neighborhoods or villages)
- Each **catchment area** belongs to only one **branch**
- Each **catchment area** is assigned to one **CHW** who visits homes there

**Example:** Korle-Bu Clinic covers 3 catchment areas: Osu, Labadi, and Teshie. CHW Kofi is assigned to Osu.

#### Guardians and Children
- A **guardian** (mother/father) can have many **children**
- A **child** can have multiple **guardians** (mother, father, grandparent)
- The **child_guardian** table connects children to their guardians
- One guardian is marked as the **primary** contact (who receives SMS)

**Example:** Mama Ama has 3 children: Kwame, Yaa, and Kofi. Papa Kweku is also a guardian for the same children. Mama Ama is the primary contact.

#### Children and Vaccinations
- A **child** receives many **vaccination events** over time
- Each **vaccination event** records one dose of one vaccine given
- The **vaccination_schedules** table says when each vaccine is due

**Example:** Baby Kwame: BCG at birth, Penta 1 at 6 weeks, Penta 2 at 10 weeks, etc.

#### Vaccines and Stock
- Each **vaccine** is tracked in the **stock_inventory** table
- Each **branch** keeps its own stock of each vaccine
- When a vaccine is given, the stock goes down by 1

**Example:** Korle-Bu has 500 doses of BCG and 300 doses of Penta. When one BCG is given, it becomes 499.

#### Side Effects (AEFI)
- A **vaccination event** can sometimes cause side effects
- The **aefi_reports** table records what symptoms happened and how serious

**Example:** After Penta vaccine, baby had fever and crying. Nurse records: symptoms = "fever, irritability", severity = "mild"

#### Appointments
- A **child** can have many **appointments** scheduled
- Each **appointment** is for a specific **vaccine** at a specific **facility**
- The **guardian** gets an SMS reminder

**Example:** Baby Yaa has appointment on Monday at Korle-Bu for Measles vaccine.

---

### 6.4 Foreign Keys Explained

A **foreign key** is like a pointer or reference. It says "this record belongs to that record in another table."

Think of it like a phone number - when you save someone's number in your phone, you can call them anytime. Foreign keys work the same way - they let tables "call" each other.

#### USERS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `branch_id` | branches.id | Which health facility does this user work at? |

**Example:** If Nurse Akosua's `branch_id` is "abc-123", and Korle-Bu's `id` is "abc-123", then Nurse Akosua works at Korle-Bu.

#### BRANCHES Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `manager_id` | users.id | Who is the manager of this facility? |

**Example:** Korle-Bu's `manager_id` points to Dr. Mensah's user record.

#### CATCHMENT_AREAS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `branch_id` | branches.id | Which facility is responsible for this area? |
| `assigned_chw_id` | users.id | Which CHW visits homes in this area? |

**Example:** Osu catchment area's `branch_id` points to Korle-Bu, and `assigned_chw_id` points to CHW Kofi.

#### GUARDIANS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `user_id` | users.id | If the parent has a login account, this links to it |
| `catchment_area_id` | catchment_areas.id | Which neighborhood does this parent live in? |

**Example:** Mama Ama lives in Osu, so her `catchment_area_id` points to Osu catchment record.

#### CHILDREN Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `primary_facility_id` | branches.id | Which facility is this child registered at? |
| `current_catchment_area_id` | catchment_areas.id | Which CHW area does this child belong to? |

**Example:** Baby Kwame is registered at Korle-Bu and lives in the Osu catchment area.

#### CHILD_GUARDIAN Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `child_id` | children.id | Which child is this about? |
| `guardian_id` | guardians.id | Which parent/guardian is this about? |

**Example:** One record links Baby Kwame to Mama Ama (primary), another links Baby Kwame to Papa Kweku.

#### VACCINATION_SCHEDULES Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `vaccine_id` | vaccines.id | Which vaccine is this schedule for? |

**Example:** Schedule record says "Penta vaccine, dose 1, due at 42 days old"

#### VACCINATION_EVENTS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `child_id` | children.id | Which child got this vaccine? |
| `vaccine_id` | vaccines.id | Which vaccine was given? |
| `administered_by_user_id` | users.id | Which nurse/CHW gave it? |
| `facility_id` | branches.id | Where was it given? |

**Example:** Baby Kwame got Penta 1 from Nurse Akosua at Korle-Bu on March 15.

#### APPOINTMENTS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `child_id` | children.id | Which child is the appointment for? |
| `guardian_id` | guardians.id | Which parent made the appointment? |
| `vaccine_id` | vaccines.id | Which vaccine is the appointment for? |
| `facility_id` | branches.id | Where is the appointment? |

**Example:** Mama Ama booked Baby Yaa for Measles vaccine at Korle-Bu on Monday.

#### CERTIFICATES Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `child_id` | children.id | Which child does this certificate belong to? |

**Example:** Certificate #GH-2024-001 belongs to Baby Kwame who completed all vaccines.

#### AEFI_REPORTS Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `vaccination_event_id` | vaccination_events.id | Which vaccination caused this side effect? |
| `child_id` | children.id | Which child had the side effect? |

**Example:** Baby Kofi had fever after his Penta 2 vaccination.

#### STOCK_INVENTORY Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `vaccine_id` | vaccines.id | Which vaccine is this stock for? |
| `facility_id` | branches.id | Which facility has this stock? |

**Example:** Korle-Bu has 500 doses of BCG vaccine, batch #BCG-2024-A, expires Dec 2024.

#### GROWTH_MONITORING Table Foreign Keys

| Field | Points To | What It Means |
|-------|-----------|---------------|
| `child_id` | children.id | Which child was measured? |

**Example:** Baby Kwame weighed 4.5kg on March 15.

---

### Key Terms Explained

| Term | Simple Explanation |
|------|-------------------|
| **PK** (Primary Key) | A unique ID for each row. Like a Ghana Card number - no two people can have the same one. |
| **FK** (Foreign Key) | A reference to another table. Like writing someone's phone number to contact them later. |
| **UK** (Unique Key) | A field that must be different for each row, but is not the main ID. Like email addresses. |
| **uuid** | A special ID that looks like: `550e8400-e29b-41d4-a716-446655440000`. It's randomly generated and guaranteed unique. |
| **enum** | A field with only certain allowed values. Like "gender" can only be "male" or "female". |

---

## 7. Screenshots Checklist

Use this checklist to capture screenshots for Chapter 4.

### Authentication Pages
- [ ] Login Page
- [ ] Password Reset Page
- [ ] First Login - Change Password Page

### Parent Dashboard
- [ ] Parent Dashboard - Overview
- [ ] Vaccination Status Page
- [ ] Upcoming Vaccinations
- [ ] Missed Vaccinations
- [ ] Appointments Page
- [ ] Request Appointment Modal
- [ ] Certificates Page
- [ ] Download Certificate
- [ ] Profile Page
- [ ] Support/Chat Page

### Facility Nurse Dashboard
- [ ] Facility Dashboard - Overview
- [ ] Child Search Page
- [ ] QR Code Scanner
- [ ] Child Profile Page
- [ ] Vaccination History Tab
- [ ] Give Vaccine Form
- [ ] Side Effect Report Form
- [ ] Growth Monitoring Form
- [ ] Session Notes
- [ ] Register Mother Page
- [ ] Register Child Page
- [ ] Today's Appointments
- [ ] Urgent Follow-ups List
- [ ] Offline Sync Page

### CHW Dashboard
- [ ] CHW Dashboard - Overview
- [ ] Network Status Indicator (Online)
- [ ] Network Status Indicator (Offline)
- [ ] Sync Status Banner
- [ ] Find Child Page
- [ ] Local Register Page
- [ ] Register Child Page (Offline)
- [ ] Child Vaccination Chart
- [ ] Give Vaccine (Offline)
- [ ] Transfer Out Modal
- [ ] Transfer In Modal
- [ ] Activity Log Page
- [ ] Outreach Map View

### Branch Manager Dashboard
- [ ] Branch Dashboard - Overview
- [ ] Staff Management Page
- [ ] Register Staff Form
- [ ] Stock Management Page
- [ ] Log Delivery Form
- [ ] Stock Alerts
- [ ] Catchment Area Management
- [ ] Catchment Map Editor
- [ ] Coverage Analytics
- [ ] Action Items List

### HQ Admin Dashboard
- [ ] HQ Dashboard - Overview
- [ ] National Statistics Cards
- [ ] Branch Management Page
- [ ] Create Branch Form
- [ ] User Management Page
- [ ] Create User Form
- [ ] Reset Password Modal
- [ ] Vaccine Configuration Page
- [ ] Vaccination Schedule Editor
- [ ] Analytics Dashboard
- [ ] Notification Monitoring
- [ ] System Health Page
- [ ] Audit Logs Page

### Data Officer Dashboard
- [ ] Data Officer Dashboard - Overview
- [ ] Deduplication Queue
- [ ] Duplicate Review Modal
- [ ] Merge Duplicates Action
- [ ] Sync Conflicts List
- [ ] Resolve Conflict Modal
- [ ] Notification Audit Log
- [ ] Reports Page

### PHA Dashboard
- [ ] PHA Dashboard - Overview
- [ ] National Coverage Statistics
- [ ] Regional Breakdown
- [ ] Reports Generation Page
- [ ] Certificate Verification Page
- [ ] Verification Result

### Mobile/Responsive Views
- [ ] Login Page (Mobile)
- [ ] Parent Dashboard (Mobile)
- [ ] CHW Dashboard (Mobile)
- [ ] Vaccination Form (Mobile)

---

## Notes for Documentation

### Diagram Rendering

To render these Mermaid diagrams:

1. **Online Editors:**
   - [Mermaid Live Editor](https://mermaid.live)
   - Copy each diagram code block and paste to generate PNG/SVG

2. **VS Code:**
   - Install "Markdown Preview Mermaid Support" extension
   - Preview this file to see rendered diagrams

3. **GitHub:**
   - GitHub automatically renders Mermaid in markdown files

4. **Export Options:**
   - PNG for Word documents
   - SVG for scalable graphics
   - PDF for print-ready output

### Shape Legend

| Shape | Meaning | Mermaid Code |
|-------|---------|--------------|
| Oval (rounded) | Start/Stop | `([Start])` or `([Stop])` |
| Parallelogram | Input | `[/Enter Name/]` |
| Rectangle | Process | `[Save to Database]` |
| Diamond | Decision | `{Is Valid?}` |

---

*Generated for Chapter 4: System Architecture and Diagrams*
*Ghana Child Vaccination Command Center (CVCC)*
