# CVCC Down-Scoped Roles and Flow (Nungua and Environs)

## 1) Down Scope We Agreed

Our system scope is now focused on:

- Nungua
- Teshie
- Spintex
- Labadi
- Ashaiman

This means we are no longer presenting it as a full Ghana-wide rollout. We are presenting it as a practical local deployment that can later scale.

---

## 2) The 5 Primary Users in This Local Scope

These are the 5 main people who use the system day-to-day:

1. HQ Admin (Local Program Admin)
2. Branch Manager
3. Facility Nurse
4. Community Health Worker (CHW)
5. Parent/Guardian

---

## 3) System Roles (Exactly 6 Roles)

To keep the structure complete and realistic, the system uses 6 roles:

1. HQ Admin
2. Branch Manager
3. Facility Nurse
4. CHW
5. Parent/Guardian
6. Public Verifier (No Login)

Note: We keep this at 6 roles for the project presentation to stay simple and clear.

---

## 4) What Each Role Does (Simple View)

### 1. HQ Admin
- Sets up the 5 branches (Nungua, Teshie, Spintex, Labadi, Ashaiman).
- Creates staff accounts and manages them.
- Sets vaccine timing rules (which vaccine is due at each child age).

### 2. Branch Manager
- Leads staff in one branch.
- Checks children who are overdue or missed visits.
- Assigns difficult follow-up cases to nurses/CHWs.
- Checks vaccine stock warning messages in that branch.

### 3. Facility Nurse
- Registers mothers and children at the clinic.
- Records vaccines given at the clinic.
- Reviews appointment requests from parents, can change the date, then approves.

### 4. CHW (Community Health Worker)
- Works in homes and communities.
- Registers children during outreach visits.
- Records visits and vaccines, even when offline.
- Syncs the records when internet comes back.

### 5. Parent/Guardian
- Books appointment requests for the child.
- Receives reminders.
- Checks the child's vaccine progress and certificate.

### 6. Public Verifier (No Login)
- Scans or types a certificate code.
- Checks if the certificate is real and valid.
- Helps schools, travel officers, or organizations verify quickly.

---

## 5) Simple Flow of the System (Down-Scoped)

1. HQ Admin sets up the 5 branches and creates branch staff accounts.
2. Branch Manager oversees operations in one branch only.
3. Nurse handles clinic vaccinations and updates records.
4. CHW handles community/outreach registration and follow-ups.
5. Parent books an appointment request for the child.
6. Nurse reviews the request, can adjust the date, then approves it.
7. Public Verifier checks certificate validity when needed.

This gives a clear local control model while still showing how the system can scale later.

---

## 6) Clear Answer to the Challenge: "Can Admin Schedule Vaccine?"

Short answer: **Yes, but in the right way.**

There are two different meanings of "schedule":

### A) Vaccine Schedule Rules (Admin responsibility)
- Admin defines the standard rules, for example:
  - BCG at birth
  - Penta-1 at 6 weeks
  - Penta-2 at 10 weeks
- This is policy setup in the system.

### B) Appointment Date for a Child (Clinic/Branch responsibility)
- Parent first books the appointment request.
- Nurse reviews it, can change the date, then approves.
- This is day-to-day appointment work.

So when someone says, "Admin can schedule vaccine like what?", your response is:

- **Admin sets the official timing rules for vaccines.**
- **Parent requests the appointment; nurse confirms the final date.**

Both are correct, but they are different levels of scheduling.

---

## 7) One-Line Presentation Summary

"Our pilot is down-scoped to Nungua and nearby areas, with 5 primary users and 6 practical roles, where admin sets vaccine timing rules while branch and clinic teams handle real child appointments and field follow-up."

---

## 8) Real-World GHS Mapping (Ledzokuku Municipal Assembly)

### Who is the Admin (HQ)?

In real life for this scope, the **District Director of Health Services (DDHS)** for **Ledzokuku Municipal Assembly** — which covers Nungua, Teshie, and the surrounding corridor — is the equivalent of the HQ Admin in our system. The DDHS sits above all facilities in the district, has visibility into all data, and makes decisions on staffing, vaccine supply, and national coverage targets. Our "HQ Admin" role maps directly to that district-level office.

---

### Are Branch Managers = Hospital/Clinic Managers?

Yes. In GHS terminology they are called the **Officer-in-Charge (OIC)** for health centers, or **Medical Superintendent** for hospitals. The mapping is:

| System Role | Real GHS Title | Example |
|---|---|---|
| HQ Admin | District Director of Health Services (DDHS) | Ledzokuku District Health Directorate |
| Branch Manager | Officer-in-Charge (OIC) / Medical Superintendent | Nungua Health Center OIC, Teshie Health Center OIC |
| Facility Nurse | EPI / Vaccination Nurse | Immunisation nurse at the health center |
| CHW | Community Health Officer (CHO) | Field officer attached to a CHPS compound |

---

### Do They Actually Draw Catchment Areas on a Map?

Yes — this is standard GHS practice. Specifically:

- Every **CHPS zone** (Community Health Planning and Services) has a defined geographic catchment area drawn on a map.
- The OIC and the district office define which communities, streets, and households fall under which CHPS compound.
- Modern districts use **DHIS2** (the national health information system adopted by Ghana) which has built-in GIS mapping for catchment boundaries.
- Field workers walk boundaries with GPS devices or use satellite imagery to define and update zones.
- The DDHS office holds the official catchment maps and uses them for resource allocation and coverage reporting.

Our system's concept of catchment areas is grounded in this real practice. The current implementation uses text-based catchment names (e.g., "Nungua Barrier", "Teshie New Town"); in a production GHS deployment those would be geographic polygons stored in DHIS2 or a GIS layer.

---

### Scoping to Nungua and Environs — Concrete Picture

| Layer | Detail |
|---|---|
| HQ Admin (1) | Ledzokuku District Health Directorate (DDHS office) |
| Branches (up to 5) | Nungua Health Center, Teshie Health Center, Spintex CHPS Compound, Labadi Health Center, Ashaiman Health Center |
| CHWs | Assigned to specific streets and communities within each CHPS zone |
| Catchment Area Examples | "Nungua Barrier", "Teshie New Town", "Spintex Road Community", "Labadi Beach Area" |

Our system architecture mirrors this structure exactly.
