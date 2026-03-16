# CHAPTER THREE: METHODOLOGY AND SYSTEM DESIGN

---

## 3.0 Introduction

This chapter presents a detailed account of the methodology, system architecture, and technology choices that guided the development of the Child Vaccination Coordination Centre (CVCC) system. Building a reliable vaccination management platform for Ghana's primary healthcare environment demanded far more than simply selecting the most popular frameworks; it required a careful reconciliation of real-world clinical constraints—such as low Internet connectivity in rural communities, cross-facility child transfers, and strict patient data privacy—with the capabilities afforded by modern web technologies.

The chapter begins by describing how data was collected from nurses and how the insights uncovered during that process shaped the fundamental design decisions of the system. It then explains the Agile software development methodology adopted by the three-member team and how work was coordinated across seven distinct user roles. The chapter proceeds to describe the system's three-tier architecture, with particular attention to the offline-first Community Health Worker (CHW) module, which is perhaps the most technically demanding aspect of the entire project. The chapter closes with sections on the specific technology stack chosen for each layer of the system, the core modules and how they were implemented, and the testing and quality assurance strategies employed throughout development.

---

## 3.1 Research Methodology and Data Collection

### 3.1.1 Data Collection Methods

The CVCC system was not designed in isolation. From the very beginning, the team recognised that the most significant risk of failure was building a technically impressive system that failed to reflect how healthcare workers actually operate on the ground. To avoid this, primary data was collected through semi-structured interviews conducted with nurses and community health workers at selected healthcare facilities. This format was deliberately chosen over rigid structured questionnaires because it allowed conversations to flow naturally—nurses were encouraged to describe their day-to-day workflows, the frustrations they experience with the current paper-based system, and the specific scenarios that most often lead to errors or data loss.

Through these interviews, several recurring pain points were identified. First, nurses frequently had no way of confirming whether a child brought to their facility had already received certain vaccines at another facility. This problem was especially common in contexts where families had recently relocated or were receiving care across different healthcare centres. Second, the process of issuing and verifying vaccination certificates was entirely manual; there was no mechanism by which a certificate's authenticity could be independently confirmed. Third, parents and guardians were not routinely notified of upcoming vaccination appointments, meaning that missed doses were often discovered only after they had already passed.

To complement the interview findings, a thorough literature review was also conducted. This review covered published works on immunisation information systems in sub-Saharan Africa, WHO and UNICEF guidelines on digital health implementations, and existing vaccination registry platforms deployed in other developing countries. The synthesis of interview results and literature findings gave the team a well-rounded understanding of both the local operational context and the broader global landscape of child immunisation data management.

### 3.1.2 Analysis of Field Constraints

The field research surfaced three constraints that had a direct and lasting impact on the system's architecture. The first was **network unavailability**. A significant portion of the children served by community health workers live in areas where mobile data connectivity is either intermittent or entirely absent. Any system that relied on a constant Internet connection for the CHW would be practically unusable in these communities. This insight made an offline-first design not merely desirable but an absolute requirement.

The second constraint was **catchment area rules**. Ghana's primary healthcare delivery is organised around catchment areas—geographic zones assigned to specific healthcare facilities. A child is typically expected to receive vaccinations at the facility that serves their residential area. However, fieldwork revealed that this was not always followed in practice; families regularly moved between districts, visited relatives in other areas, or simply had more convenient access to a facility outside their assigned catchment. The system therefore had to support the concept of a child transferring between facilities in a structured, auditable way.

The third constraint was **patient transfer scenarios**. Connected to catchment rules, it was clear that the system needed explicit workflows to handle transfer-in (accepting a child from another healthcare facility's register) and transfer-out (releasing a child to another facility's register) operations. This had to be more than a simple data update; it needed to preserve the full vaccination history of the child regardless of which facility was managing their care at any given point in time.

---

## 3.2 Software Development Life Cycle (SDLC)

### 3.2.1 Agile Methodology Adoption

The development of the CVCC system followed an Agile software development methodology, specifically drawing from the principles of iterative and incremental delivery. Rather than attempting to design the complete system on paper before writing a single line of code, the team adopted a slice-by-slice approach in which each user role was treated as a vertical slice of functionality that would be built, tested, and demonstrated before moving on to the next.

This decision was especially well-suited to the nature of the project. The system serves seven distinct user roles—HQ Administrator, Branch Manager, Facility Nurse, Community Health Worker (CHW), Data Officer, Public Health Analyst (PHA), and Parent—and each role has a materially different set of responsibilities, views, and permissions. Attempting to design all of them simultaneously before any implementation was underway would have introduced significant confusion and wasted effort, particularly given that insights from building one role often revealed dependencies or shared components useful to another.

Working iteratively also made it easier to incorporate feedback at regular intervals. After completing a functional slice for one role, the team could review it, identify weaknesses, and carry those learnings into the next iteration. For example, the reusable `shadcn/ui` component library and the shared API configuration in `lib/api/config.ts` were both outcomes of decisions made after building the first few role dashboards, when the team recognised the need for consistency across the interface.

### 3.2.2 Team Coordination and Version Control

The project was built by a team of three developers. To prevent duplication of effort and conflicting code changes, the seven user roles were divided across the team members, with each developer taking primary responsibility for both the frontend dashboard and the backend module of the roles assigned to them. This division ensured that at any given point in time, no two developers were working on the same files simultaneously.

The codebase was maintained in a single Git repository, with the Next.js frontend at the root of the repository and the NestJS backend housed in a dedicated `backend/` subdirectory. This monorepo-style layout meant that both the frontend and the backend shared the same version history, making it straightforward to review any change to either layer. Developers worked on feature branches, submitted pull requests for review, and merged only after the changes had been examined by at least one other team member. This process enforced a minimum level of code review on every non-trivial change and made it possible to roll back any breaking change cleanly. A `CHANGELOG.md` file was maintained throughout development to document significant changes and the reasoning behind key decisions.

---

## 3.3 System Architecture

### 3.3.1 High-Level Architecture Overview

The CVCC system is built on a three-tier architecture consisting of a Progressive Web Application (PWA) frontend, a RESTful API backend, and a cloud-hosted relational database. At the frontend layer, a **Next.js 16** application built with the App Router paradigm serves as the user interface for all seven roles. At the backend layer, a **NestJS 10** application exposes a structured set of REST API endpoints that the frontend calls for all data operations. At the data layer, a **Supabase-hosted PostgreSQL** database stores all persistent records, with Row-Level Security (RLS) policies enforcing data access rules at the database level.

The flow of a typical interaction — for example, a facility nurse recording a vaccine administration — begins at the React component in the browser, which calls a typed API function in `lib/api/`. This function sends an authenticated HTTP request (with a JWT token carried in an HttpOnly cookie) to the relevant NestJS endpoint, such as `POST /api/facility/children/:id/vaccinations`. The NestJS controller validates the request body using class-validator DTOs, applies the `@Roles('facility-nurse')` guard to confirm authorization, and delegates to the corresponding service method. The service method then calls the `DatabaseService`, which uses the Supabase JavaScript client with a service-role key to perform the database write and return the result up the chain to the frontend.

This separation of concerns — frontend calls API, API calls database — was a deliberate architectural choice. It means the frontend never holds any privileged database credentials, all business logic lives in one authoritative location (the NestJS services), and the database access layer can be independently modified without touching the UI.

### 3.3.2 Offline-First Architecture (The CHW Module)

The CHW module is architecturally distinct from every other role in the system, and it represents the most technically complex component of the CVCC platform. Because community health workers conduct home visits and outreach sessions in areas with little or no Internet connectivity, the system must continue to function fully even when the device has no network access. This requirement demanded an offline-first design at every layer of the CHW module.

The offline data layer is built on **Dexie.js**, a typed wrapper around the browser's IndexedDB API, instantiated as the `cvcc_chw_offline_v2` database. This local database contains three logical tables: `children` (indexed by `cvccId` and `catchmentAreaId`), `vaccinationQueue` (the write-ahead action log), and `offlineMapStatus` (tracking the state of cached map tiles). When a CHW registers a child, records a vaccination, or initiates a transfer while offline, the action — along with all its data — is written into the `vaccinationQueue` as a `VaccinationQueueItem`. This item carries an `idempotencyKey` (generated from the child ID, vaccine ID, and timestamp) to guarantee that the same action is never processed twice on the server, even if the sync happens more than once.

Synchronisation is handled by the `ChwBackgroundSyncService` in `lib/chw-offline/background-sync.ts`. This singleton service runs on a five-minute polling interval and also listens for the browser's `window.online` event, so that when the device reconnects to a network, it immediately begins draining the pending queue. It calls the `POST /api/chw/vaccinations/sync` endpoint to deliver the batched actions to the NestJS backend, which processes each item and returns a confirmation.

Two separate service workers augment the Dexie-based solution. The primary CHW service worker (`public/chw-service-worker.js`) uses a network-first strategy for all CHW pages and API routes, falling back to a cache named `chw-offline-cache-v1` when the network is unavailable. It also registers a `sync-chw-vaccinations` background sync tag so that the browser itself can attempt re-delivery when connectivity is restored. A second dedicated service worker (`public/chw-map-sw.js`) uses a cache-first strategy specifically for OpenStreetMap tile images, caching them under the name `cvcc-chw-osm-tiles-v1`. This means that once a CHW has explored a geographic area while online, the map tiles for that area remain available for subsequent offline visits.

Because the CHW local database stores personally identifiable information (PII) about children and their guardians, all sensitive fields — including `fullName`, `dateOfBirth`, `guardianName`, and `guardianPhone` — are encrypted before being committed to IndexedDB. The encryption system in `lib/chw-offline/encryption.ts` uses AES-GCM-256 via the browser's native Web Crypto API, with an encryption key derived from the authenticated user's ID and the first 32 characters of their access token. This key is held only in `sessionStorage` and is never persisted to disk. Additional security measures in the CHW module include an auto-logout timer at 15 minutes of inactivity (`lib/chw-offline/auto-logout.ts`) and an auto-clear policy that wipes all IndexedDB data after seven days of device inactivity (`lib/chw-offline/auto-clear.ts`). A client-side audit log in `localStorage` records all read and write operations for the current session, providing a tamper-evident trail of what the CHW accessed while offline.

### 3.3.3 Role-Based Access Control (RBAC) Architecture

The CVCC system manages seven distinct user roles: `hq-admin`, `branch-manager`, `facility-nurse`, `chw`, `data-officer`, `pha`, and `parent`. Each role has a fundamentally different scope of operations and must not be able to access data or functionality intended for another role. This isolation is enforced at three distinct layers of the architecture.

At the **transport layer**, all authenticated requests carry a JWT token issued by the NestJS `AuthService`. The token is stored in an HttpOnly cookie with a seven-day expiry, making it inaccessible to any JavaScript running on the page. The `JwtStrategy` in `backend/src/auth/strategies/jwt.strategy.ts` validates every incoming request and attaches the decoded user profile — including their role — to the request object.

At the **API layer**, every NestJS controller that serves role-specific data is protected by both the `JwtAuthGuard` (confirming that the request is authenticated) and the `RolesGuard` (confirming that the authenticated user holds the correct role). The `@Roles()` decorator is applied at the controller or handler level: for instance, the entire CHW controller is annotated with `@Roles('chw')`, the PHA controller with `@Roles('pha')`, and so on. Any request arriving at a guarded endpoint with an incorrect role receives a 403 Forbidden response before any business logic is executed.

At the **database layer**, Supabase Row-Level Security (RLS) policies provide a final defence-in-depth layer. Even if a request were to somehow bypass the API guards, the RLS policies on each table restrict which rows a given user can read or modify based on their role and their associated `branch_id`. The NestJS `DatabaseService` in `backend/src/common/database/database.service.ts` uses the Supabase service-role key, which is intentionally held only on the server and never exposed to the frontend, ensuring that all database interactions are mediated through the API's authorization logic.

---

## 3.4 Technology Stack Selection

### 3.4.1 Frontend Technologies

The frontend of the CVCC system was built using **Next.js 16** with the App Router, running on **React 19**. Next.js was selected because it provides a production-grade React framework with built-in routing, optimised asset bundling, and strong TypeScript support, all of which were necessary for a project of this complexity. The App Router's directory-based routing model made it straightforward to structure the seven role dashboards as distinct areas of the application under clear paths (`/app/hq/dashboard`, `/app/facility`, `/app/chw`, `/app/parent/dashboard`, and so on).

Styling is handled by **Tailwind CSS v4**, a utility-first CSS framework that allowed the team to compose component styles directly in JSX without managing separate stylesheet files. This significantly reduced the cognitive overhead of maintaining visual consistency. The UI component library used throughout the application is **shadcn/ui**, a collection of accessible, headless components built on Radix UI primitives. Because shadcn/ui components ship as source files rather than a dependency import, the team was able to customise every component to match the CVCC design language without fighting against an opinionated component API.

Data visualisation in the dashboards — coverage rates, dose completion trends, and facility performance metrics — is rendered using **Recharts**, which integrates naturally with React's component model and handled the dynamic, server-fetched chart data with minimal configuration.

### 3.4.2 Offline Storage and Mapping

The offline storage backbone of the CHW module is **Dexie.js v4**, a TypeScript-friendly wrapper around the browser's IndexedDB API. Dexie was chosen over raw IndexedDB because it provides a clean, promise-based API that supports typed schemas, index-based queries, and bulk operations, all of which were needed to efficiently manage the `children` and `vaccinationQueue` tables while the device is offline.

Geographical mapping for CHW outreach scheduling is powered by **Leaflet** and its React wrapper **React-Leaflet**, using **OpenStreetMap** as the tile source. Leaflet was selected over heavier alternatives such as Google Maps because it is open source, requires no API key, and most importantly, its tile images are plain cacheable HTTP resources that can be intercepted and stored by the `chw-map-sw.js` service worker. The `components/chw/outreach-map.tsx` component renders the map within CHW outreach sessions, showing the catchment area and the child's household GPS coordinates. The database also uses Supabase's PostGIS extension to store catchment area boundaries as `POLYGON` geometry types, enabling spatial queries on the server side.

### 3.4.3 Backend Framework

The server-side application is built with **NestJS 10**, a progressive Node.js framework built on TypeScript that imposes a structured, opinionated architecture of modules, controllers, services, and providers. NestJS was chosen because its architecture closely mirrors the role-based structure needed by this project: each user role maps naturally to a dedicated NestJS module (`AuthModule`, `FacilityModule`, `ChwModule`, `ParentModule`, `PhaModule`, `BranchManagerModule`), keeping the backend codebase organised and easy to navigate. TypeScript is used throughout the backend, with strict typing applied to all DTOs (Data Transfer Objects), service inputs, and database query return types.

The API follows RESTful design conventions with predictable resource-oriented endpoints. All incoming request bodies are validated using `class-validator` decorators on DTO classes, ensuring that malformed input is rejected at the boundary of the application before reaching any business logic. Security headers are applied globally via the `helmet` middleware, and authentication is implemented using `@nestjs/passport` with a JWT strategy.

### 3.4.4 Database and Background Job Management

The persistent data store for the CVCC system is a **PostgreSQL** database hosted and managed through **Supabase**. The schema was designed as a fully relational model with explicitly defined foreign key constraints, enum types, and indexes. The database contains nineteen core tables, covering user accounts, healthcare facility branches, catchment areas, guardian records, child records, vaccination events, vaccine schedules, AEFI (Adverse Event Following Immunisation) reports, certificates, appointments, notifications, visit logs, offline sync queues, and data deduplication candidates. The spatial extension **PostGIS** was enabled to support the storage of catchment-area polygons as `POLYGON` geometry values and GPS coordinates as `POINT` values, enabling precise geospatial assignment of children and CHWs to their respective service areas.

Background job scheduling does not use an external queue server. Instead, it is handled by the **`@nestjs/schedule`** module, which provides `@Cron` decorator-based scheduling within the NestJS application process. The primary scheduled job is in `VaccinationSchedulerService` (`backend/src/common/vaccination-scheduler.service.ts`), which runs daily at 08:00 West Africa Time (configured for the `Africa/Accra` timezone). On each trigger, it queries the database for all children with vaccination doses due on that calendar date, retrieves the associated guardian phone numbers, and dispatches an SMS reminder for each one via the Hubtel SMS API. Every sent notification is recorded in the `notifications` table, creating a durable log of all outbound communications.

### 3.4.5 Utility Libraries

Several utility libraries were integrated to support specific functional requirements. **html5-qrcode v2.3.8** underpins the QR code scanning mechanism in the PHA certificate verification portal. The library's `Html5Qrcode` class is wrapped in a custom `QrScanner` React component (`components/pha/qr-scanner.tsx`) that manages camera lifecycle, prefers the device's rear-facing camera, and handles teardown cleanly on component unmount to avoid holding the camera open unnecessarily.

Certificate generation relies on **jsPDF v3.0.3**, a client-side PDF generation library. The `generateCertificatePdf()` function in `lib/certificate-pdf.ts` programmatically constructs an A4-sized vaccination certificate document, drawing the Ministry of Health branding, the child's full details, a list of all completed vaccines, the certificate ID (formatted as `CERT-GH-YYYY-XXXXXX`), and an embedded QR code image that encodes a URL to the PHA verification endpoint. The completed PDF is then offered to the user as a browser download. For QR code generation on the frontend, **qrcode.react v4.2.0** is used to render a scannable QR image that is first converted to a data URL before being passed to jsPDF for embedding.

---

## 3.5 Core System Modules and Implementation

### 3.5.1 Identity Verification and QR Code Engine

Each child registered in the CVCC system is assigned a unique human-readable identifier formatted as `CH-YYYY-NNN` (for example, `CH-2025-001`), stored in the `cvcc_id` field of the `children` table. In addition to this identifier, each child record carries a `qr_code_payload` field that holds a signed token linking the QR image directly and unambiguously to that child's record in the database. This QR payload is generated at the time of child registration and remains immutable unless explicitly reissued.

On the scanning side, the `Html5Qrcode` component in the PHA portal captures the QR code using the device camera and extracts the embedded certificate ID or child identifier. This value is then submitted to the `GET /api/pha/certificates/verify` endpoint on the backend. Before the server processes the query, the certificate ID parameter is sanitised with a strict regular expression that allows only alphanumeric characters and hyphens, with a maximum length of one hundred characters, preventing any injection via the query string. The backend then looks up the corresponding record and returns the verification result, which the PHA officer can read on screen.

### 3.5.2 Catchment Area Management and Child Transfer

The transfer system allows a child to be moved from the register of one healthcare facility to another in a controlled and auditable way. Two endpoints in the CHW controller handle this flow: `POST /api/chw/children/:childId/transfer-out` and `POST /api/chw/children/:childId/transfer-in`. The data contracts for these operations are defined in `backend/src/chw/dto/transfer.dto.ts` as `TransferOutDto` and `TransferInDto`. When a transfer-out is initiated, the child's `primary_facility_id` in the database is updated to reflect their new destination facility and an audit record is created. The child's complete vaccination history travels with the record; nothing is erased or archived.

In the offline CHW context, transfers are queued as `VaccinationQueueItem` entries in the Dexie `vaccinationQueue` table with action types of `transfer_in` or `transfer_out`. The queue item is processed the next time the device has network access and the `ChwBackgroundSyncService` runs. The `removeChildFromLocalRegister()` function in `lib/chw-offline/db.ts` removes the child from the local device register once the transfer-out has been confirmed by the server, preventing any further offline actions on a record the CHW no longer holds. The corresponding `queueTransferIn()` and `queueTransferOut()` functions provide the symmetric operations, ensuring that no transfer is lost even when performed entirely without Internet access.

### 3.5.3 Automated Notification System

The CVCC system dispatches notifications through two independent channels: SMS for immediate mobile delivery and email for formal written communication. These two channels are served by separate services in the NestJS backend. The `SmsService` in `backend/src/common/sms.service.ts` communicates with the **Hubtel SMS API**, a Ghanaian SMS gateway. It automatically normalises phone numbers into the international format expected by Hubtel (converting leading zero numbers to the `233xx` country code format). The service provides four distinct message types: welcome SMS (sent when a new parent account is created), registration SMS (confirming a child registration), vaccination reminder (daily outgoing from the cron scheduler), and appointment confirmation.

The `EmailService` in `backend/src/common/email.service.ts` uses the **Brevo HTTP API** (`https://api.brevo.com/v3/smtp/email`), called directly via `axios`. Email is used for two workflows: a welcome email that delivers a parent's system credentials upon registration, and a password-reset email that delivers a time-limited reset link. Both email templates are constructed as full HTML documents with Ghana Ministry of Health branding embedded directly in the template string.

The daily vaccination reminder cycle is managed by the `VaccinationSchedulerService`, which fires at 08:00 Ghana time each day, queries for children with vaccinations due that day, and calls `SmsService.sendVaccinationReminder()` for each guardian phone number found. A record of every dispatched notification is written to the `notifications` table, with fields for the channel used, the delivery status, and a reference to the originating template.

### 3.5.4 Cryptographic Certificate Generation

When a child completes all scheduled vaccinations in the CVCC system, the platform generates a tamper-evident PDF vaccination certificate. This process is implemented in `lib/certificate-pdf.ts` using the **jsPDF** library and is triggered from the parent portal's certificates page. The `generateCertificatePdf()` function compiles a structured A4 document that includes the child's full name, date of birth, and assigned CVCC identifier; the issuing facility's name; the date issued; a complete list of vaccines administered and their respective dates; the certificate's unique ID (formatted as `CERT-GH-YYYY-XXXXXX`); and an embedded QR code image.

The embedded QR code is generated from the `certificates.qr_payload` value stored in the database, which encodes a URL to the PHA certificate verification endpoint. This means that any party — a school admissions officer, a travel health clinic, or another healthcare provider — can independently verify the certificate's authenticity by scanning the QR code on the printed document, without relying on the issuing facility's paper records. The completed PDF is offered as a direct browser download named using the certificate ID.

---

## 3.6 System Testing, Debugging, and Quality Assurance

### 3.6.1 Testing Strategies

The quality assurance strategy for the CVCC system was primarily composed of manual functional testing, endpoint-level integration testing, and structured role-by-role walkthroughs. Each time a new feature was added during an iteration, the responsible developer performed a full walkthrough of the feature from the frontend UI down to the database, verifying that data entered in the browser appeared correctly in the Supabase dashboard and that API responses matched the expected schemas.

For the backend, integration testing of the NestJS API endpoints was performed using HTTP client tools that allowed the team to send crafted requests to each endpoint with different payloads, authentication tokens, and edge-case inputs. This was particularly important for endpoints that involve multiple database tables, such as the child registration flow, which creates or links records in the `users`, `guardians`, `children`, and `child_guardian` tables in a single operation. DTO-level validation was also verified by deliberately sending malformed request bodies and confirming that `class-validator` responded with the correct 400 Bad Request errors before any database write was attempted.

The NestJS test infrastructure (`@nestjs/testing`, `jest`, `ts-jest`) is installed as a development dependency, providing the scaffolding needed to add unit and end-to-end tests in future iterations of the project.

### 3.6.2 Offline Synchronisation Testing

Testing the CHW offline module required a different approach from the rest of the system, because the failure mode being tested — losing network connectivity mid-session — cannot be replicated by simply submitting a bad form value. The team used the browser's DevTools Network panel to simulate offline conditions by setting the network throttling preset to "Offline" while the CHW dashboard was active.

With the device simulated as offline, test scenarios were executed: registering a new child, recording a vaccination event, and initiating a child transfer. After each action, the contents of the `cvcc_chw_offline_v2` IndexedDB were inspected directly in the browser's Application panel to confirm that the records were correctly written and that the `vaccinationQueue` table contained the corresponding pending items with the correct `idempotencyKey` values. The device was then returned to "Online" status to simulate network restoration. The `ChwBackgroundSyncService` was observed to drain the queue within its five-minute polling window, and the Supabase database was checked to confirm that all queued records had been reconciled accurately on the server. Edge cases tested included: power-cycling the browser before sync (verifying that IndexedDB records persist across sessions), deliberately repeating a sync call (verifying that idempotency keys prevented duplicate insertions), and simulating a failed sync for individual items (verifying that `retryCount` and `lastError` were updated correctly in the queue).

### 3.6.3 Bug Tracking and Resolution

Bugs identified during the development process were tracked as issues in the project's version control repository and documented in the `CHANGELOG.md` file. This provided a chronological record of what was discovered, what the root cause was, and what change resolved it.

Several notable bugs were encountered and resolved during the iterative cycles. The password reset flow initially returned a generic authentication failure when a user submitted a valid reset token that had expired, because the expiry check was performed on the database timestamp without accounting for timezone differences between the server process and the Supabase database. This was resolved by normalising all timestamp comparisons to UTC within the `AuthService`. The email service was originally configured to use an SMTP-based transporter, but integration testing revealed that the SMTP credentials for the Brevo service were not accepted reliably in the deployment environment; the service was subsequently rewritten to use Brevo's HTTP API directly via `axios`, which was more stable. The `reset-password` page also triggered a React hydration error in production builds because it called the `useSearchParams` hook from the Next.js App Router at the top level of the component tree; this was resolved by wrapping the component in a `Suspense` boundary, as logged in the commit history.

---

## 3.7 Conclusion

This chapter has documented the methodology and design decisions that underpin the CVCC system. The semi-structured interview process surfaced the field constraints — network unavailability, catchment area rules, and cross-facility transfers — that directly shaped the architecture. The Agile methodology allowed the three-person team to deliver functional role slices incrementally and to incorporate discoveries from each iteration into the next. The three-tier architecture (Next.js PWA, NestJS API, Supabase PostgreSQL) provides a clean and maintainable separation of concerns, while the offline-first CHW module — built on Dexie.js, two purpose-built service workers, and AES-GCM-256 field encryption — ensures that data collection continues reliably even in the most resource-constrained environments. The role-based access control system, enforced at the JWT, API guard, and RLS levels simultaneously, guarantees that the seven user roles remain securely isolated from one another. Together, the technology stack and architectural choices described here provided a solid and well-evidenced foundation for the implementation phase described in Chapter Four.
