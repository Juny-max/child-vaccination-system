# Data Officer Dashboard - Functional Documentation

**Last Updated:** November 15, 2025  
**Dashboard URL:** `http://localhost:3000/dashboard`  
**Role:** Data Officer (data-officer)

---

## 📋 Executive Summary

The **Data Quality Mission Control** dashboard is the central command interface for Data Officers responsible for maintaining the integrity, accuracy, and security of the Ghana Child Vaccination System. This dashboard provides real-time monitoring, actionable queues, and rapid-response tools to ensure clean data flows from field operations to national analytics.

---

## 🎯 Dashboard Overview

### Primary Responsibilities
- **Data Quality Assurance**: Identify and merge duplicate child records
- **Sync Conflict Resolution**: Resolve mobile offline sync collisions
- **Notification Monitoring**: Audit and troubleshoot failed SMS/email deliveries
- **Security Oversight**: Monitor breach attempts and system security incidents
- **Infrastructure Health**: Track service availability and downtime
- **Reporting**: Generate custom data extracts for stakeholders

---

## 📊 KPI Cards (Top Metrics Bar)

The dashboard displays six critical real-time metrics in the header section:

### 1. **Pending Duplicates** (Primary/Blue)
- **Metric:** Count of duplicate child records awaiting manual review
- **Current Value:** 12 records
- **Purpose:** Prevent duplicate vaccinations and maintain data integrity
- **Threshold:** Should remain below 5 items daily
- **Impact:** High duplicate counts block HQ analytics and automated SMS reminders
- **Icon:** Layers

### 2. **Sync Conflicts** (Amber)
- **Metric:** Offline batch uploads requiring manual intervention
- **Current Value:** 2 conflicts
- **Purpose:** Resolve collisions when field workers sync data after working offline
- **Typical Scenarios:**
  - Vaccination events referencing merged/deleted children
  - Conflicting updates to the same record
  - Orphaned references after record merges
- **Icon:** Link2

### 3. **Missing Data (Children)** (Orange)
- **Metric:** Percentage of child profiles with incomplete critical fields
- **Current Value:** 0.08%
- **Tracked Fields:**
  - Missing date of birth (DOB)
  - Missing mother/guardian linkage
  - Incomplete address information
- **Purpose:** Ensure data completeness for follow-up and analytics
- **Icon:** Database

### 4. **Notification Failures (24h)** (Rose/Red)
- **Metric:** Failed SMS and email deliveries in last 24 hours
- **Current Value:** 15 failures
- **Purpose:** Ensure caregivers receive timely vaccination reminders and certificates
- **Common Causes:**
  - Invalid phone numbers/email addresses
  - Gateway timeouts
  - Insufficient SMS credits
- **Icon:** TriangleAlert

### 5. **Security Alerts (24h)** (Destructive/Red)
- **Metric:** Detected breach attempts and abnormal access patterns
- **Current Value:** 1 alert
- **Monitored Events:**
  - Failed login bursts (brute force attempts)
  - Expired token usage
  - Unauthorized API access attempts
  - Unusual data access patterns
- **Icon:** ShieldAlert

### 6. **Downtime (Last 24h)** (Blue)
- **Metric:** Minutes of core service outage
- **Current Value:** 6 minutes
- **Tracked Services:**
  - Core API availability
  - Identity & MFA service
  - Offline sync broker
  - Database connectivity
- **Purpose:** Quantify system reliability and support SLA tracking
- **Icon:** ServerOff

---

## 🔄 Action Queues Section

Four primary action modules with direct navigation links:

### 1. **Deduplication Queue**
- **Entry Point:** "Go to Deduplication Queue"
- **URL:** `/dashboard/deduplication`
- **Current Queue:** 12 potential duplicates
- **Function:**
  - Review algorithmically-detected duplicate child records
  - Compare side-by-side profiles with similarity scoring
  - Merge confirmed duplicates or dismiss false positives
  - Preserve data from both records during merge
- **Similarity Signals:**
  - DOB + Mother Phone match
  - Name + CHW catchment area
  - Mother name similarity
  - Address/location overlap
- **Priority:** Sort by highest similarity percentage
- **Deadline:** Resolve before end of business day (EOD) to unblock HQ analytics

### 2. **Sync Conflict Resolver**
- **Entry Point:** "Go to Sync Conflict Resolver"
- **URL:** `/dashboard/sync-conflicts`
- **Current Queue:** 2 pending conflicts
- **Function:**
  - Review mobile sync collisions from field workers
  - Apply resolution templates:
    - Relink event to surviving child record
    - Discard event and notify CHW
    - Hold for HQ review (escalation)
  - Attach supporting documentation
  - Queue complex cases for HQ admin review
- **Use Cases:**
  - Vaccination event references merged child → Re-link to surviving record
  - Deleted child reference → Review and discard
  - Conflicting offline updates → Manual merge
- **Integration:** Queued items surface on HQ admin dashboard for escalation workflow

### 3. **Notification Log**
- **Entry Point:** "Go to Notification Log"
- **URL:** `/dashboard/notifications`
- **Current Issues:** 15 failed deliveries
- **Function:**
  - Audit all SMS and email notifications (sent, delivered, failed)
  - Filter by:
    - Status (Sent, Delivered, Failed)
    - Channel (SMS, Email)
    - Template type (Overdue reminder, Certificate, Appointment)
    - Date range
  - Troubleshoot delivery failures
  - Identify patterns (invalid contacts, gateway issues)
  - Trigger manual retries
- **Notification Types:**
  - Overdue vaccination reminders
  - Certificate download links
  - Clinic appointment confirmations
  - Schedule change alerts

### 4. **Security Watchboard**
- **Entry Point:** "Open Security Watchboard"
- **Internal Anchor:** `#security-watch` (scrolls to Security section on current page)
- **Current Alerts:** 1 active alert
- **Function:**
  - Monitor security incidents in real-time
  - Track breach attempt investigations
  - Escalate high-severity incidents to HQ security team
  - Review auto-blocked IPs and suspicious patterns
  - Close resolved incidents

---

## 📑 Dashboard Sections (Main Content Area)

### Section 1: Deduplication Fires Preview
**Location:** Top-left card  
**Icon:** Layers (Primary color)

**Display:**
- Top 3 highest-risk duplicate clusters
- Each entry shows:
  - Child name
  - Similarity percentage (92%, 88%, 83%)
  - Matching fields/signals
  - Direct "Review in merge tool" link

**Workflow:**
1. Preview high-priority duplicates without leaving dashboard
2. Click to open full merge interface
3. Queue sorted by similarity score (highest risk first)
4. Critical threshold: Resolve before 17:00 to unblock HQ analytics

---

### Section 2: Sync Conflicts Feed
**Location:** Top-right card  
**Icon:** Link2 (Amber color)

**Display:**
- Latest 2 mobile sync collisions
- Each conflict shows:
  - Headline (e.g., "Vaccination event orphaned")
  - Detailed description of collision
  - Conflict ID (SC-982, SC-976)
  - Recommended action

**Examples:**
- **Orphaned Event:** CHW recorded vaccination for merged child → Suggested: Re-link to CH-558
- **Deleted Reference:** Upload references removed child → Suggested: Review before discard

**Workflow:**
1. Identify conflict type from feed
2. Click "Resolve conflict" to open full resolver
3. Apply resolution template or escalate to HQ
4. Document decision and notify field worker if needed

---

### Section 3: Notification Spot Check
**Location:** Middle-left card  
**Icon:** BookOpen (Primary color)

**Display:**
- Failed notification count badge
- Last 3 notification events (mixed statuses)
- Each entry shows:
  - Template type (Overdue reminder, Certificate, Appointment)
  - Timestamp
  - Channel (SMS/Email)
  - Recipient contact
  - Status (Failed, Delivered, Sent)

**Workflow:**
1. Quick visual scan of recent notification activity
2. Identify failures at a glance (rose-colored badge)
3. Click "Open full audit log" for detailed investigation
4. Filter and troubleshoot before caregivers escalate issues

---

### Section 4: Quick Export Reminder
**Location:** Middle-right card (Dashed primary border)  
**Icon:** Sparkles (Primary color)

**Function:**
- Promotes the custom report generator feature
- Describes capabilities:
  - Select data source (Children, Vaccinations, Mothers, etc.)
  - Choose columns to include
  - Apply filters (region, date range, vaccine type)
  - Export formats: CSV, Excel, PDF
- Shows example saved report: "Accra North · Measles 1 backlog · Last 14 days"
- Link to `/dashboard/reports`

**Use Cases:**
- Ad-hoc coverage extracts for branch managers
- Dropout analysis for specific vaccines
- Geographic vaccination gap reports
- Custom data requests from HQ

---

### Section 5: Security Incident Center
**Location:** Bottom-left card (Destructive border)  
**Icon:** ShieldAlert (Destructive/Red color)  
**Anchor:** `#security-watch`

**Display:**
- All active security incidents with:
  - Headline (e.g., "Blocked login burst")
  - Detailed description
  - Severity badge (High, Medium, Low)
  - Detection timestamp
  - Status (Investigating, Resolved)
  - Incident ID (SEC-771, SEC-768)

**Example Incidents:**
1. **Blocked Login Burst (High Severity)**
   - 15 failed attempts from IP auto-blocked
   - Target: Parent portal
   - Status: Investigating

2. **Unhandled API Token (Medium Severity)**
   - Expired staff token used against /hq endpoints
   - Access denied by system
   - Status: Resolved

**Workflow:**
1. Review new alerts flagged by security monitoring
2. Coordinate with HQ security team for investigations
3. Document findings and remediation steps
4. Close resolved items before close of business

---

### Section 6: Infrastructure Heartbeat
**Location:** Bottom-right card (Primary border)  
**Icon:** ShieldCheck (Primary color)

**Display:**
- Real-time status of critical services:
  - **Core API:** Latency metrics, error rates
  - **Identity & MFA:** Authentication service health
  - **Offline Sync Broker:** Field worker sync pipeline

**Status Indicators:**
- 🟢 **Operational:** Service healthy (green/secondary badge)
- 🟡 **Degraded:** Performance issues detected (default badge)
- 🔴 **Offline:** Service unreachable (destructive badge)

**Example Signals:**
- Core API: "Latency 230ms · No errors" → Operational
- Identity & MFA: "OTP vendor timeout spike (3 min)" → Degraded
- Offline Sync Broker: "Northern region broker unreachable since 08:22" → Offline

**Workflow:**
1. Monitor for degraded/offline services
2. If service is offline:
   - Sync with IT operations team
   - Post advisory to affected branches
   - Update status tracker
3. Track resolution and downtime duration

---

## 🚨 Alert & Warning System

### Critical Alert (Bottom of Dashboard)
**Type:** Warning banner with AlertTriangle icon

**Message:**
> "Keep the deduplication queue below five items daily. High duplicate counts block HQ analytics and SMS reminders."

**Implications:**
- **Analytics Impact:** Duplicate records skew national coverage statistics
- **Operational Impact:** Automated reminder system pauses for affected children to prevent double-messaging
- **Quality Impact:** Field workers may register same child multiple times
- **Reporting Impact:** Branch performance metrics become unreliable

**Action Required:**
- Process deduplication queue daily
- Maintain queue < 5 items threshold
- Escalate to HQ if backlog exceeds capacity

---

## 🔐 Authentication & Access Control

### Role Verification
The dashboard implements strict role-based access:

```typescript
// Access restricted to: "staff" role with "data-officer" detail
if (role !== "staff" || detail !== "data-officer") {
  // Redirects to appropriate dashboard for other roles:
  // - hq-admin → /hq/dashboard
  // - branch-manager → /branch/dashboard
  // - facility-nurse → /facility/dashboard
  // - chw → /chw/dashboard
  // - parent → /parent/dashboard
}
```

### Session Management
- **Token:** Stored in `localStorage.authToken`
- **Role:** Stored in `localStorage.userRole`
- **Detail:** Stored in `localStorage.userRoleDetail`
- **Name:** Stored in `localStorage.userName`
- **Logout:** Clears all session data and redirects to `/`

---

## 🎨 User Interface Components

### Header
- **Logo:** CVCC (Child Vaccination Command Center) branding
- **Title:** "Data Quality Mission Control"
- **User Info:** Welcome message with name and formatted role label
- **Theme Toggle:** Light/dark mode switcher
- **Logout Button:** Session termination

### Navigation Pattern
- **No sidebar:** Single-page dashboard with sectioned content
- **Anchor links:** Security section accessible via `#security-watch`
- **External links:** Dedicated pages for each action queue
- **Breadcrumbs:** Sub-pages provide "Back to dashboard" navigation

### Visual Design System
**Color Coding:**
- 🔵 **Primary (Blue):** Deduplication, general system health
- 🟠 **Amber:** Sync conflicts, warnings
- 🔴 **Rose/Destructive:** Failures, security alerts, offline services
- 🟢 **Green:** Operational status, success states
- 🟡 **Orange:** Missing data, minor issues

**Typography:**
- **KPI Values:** 3xl font, bold, color-coded
- **Section Titles:** lg font with icon
- **Card Descriptions:** xs/sm muted foreground
- **Status Badges:** Rounded, color-variant pills

### Responsive Layout
- **Mobile:** Single column, stacked cards
- **Tablet (md):** 2-column grid for action queues, side-by-side sections
- **Desktop (lg):** 6-column KPI grid, asymmetric section layouts (1.1fr / 0.9fr ratios)

---

## 🔗 Related Pages & Workflows

### Deduplication Module (`/dashboard/deduplication`)
**Purpose:** Full merge interface for duplicate child records

**Features:**
- Side-by-side profile comparison
- Field-level selection (choose which data to keep)
- Merge confirmation workflow
- False positive dismissal
- Audit trail of merge operations

---

### Sync Conflict Resolver (`/dashboard/sync-conflicts`)
**Purpose:** Resolve mobile offline sync collisions

**Features:**
- Conflict list with originator and location
- Resolution templates dropdown
- Linked child ID input (for relink operations)
- Follow-up action notes
- File attachment support
- "Queue for HQ Review" escalation button
- Apply resolution workflow

**Integration:**
- Queued conflicts write to `localStorage.hqReviewQueue`
- HQ admin dashboard ingests queue and displays escalations
- Cross-dashboard workflow enables complex case handling

---

### Notification Audit Log (`/dashboard/notifications`)
**Purpose:** Comprehensive notification tracking and troubleshooting

**Features:**
- Filterable log table (status, channel, template, date)
- Delivery status indicators
- Recipient contact display
- Template type categorization
- Retry mechanism (when implemented)
- Export log for external analysis
- Jump to deduplication module (for data cleanup)

---

### Report Generator (`/dashboard/reports`)
**Purpose:** Custom data extract builder

**Features:**
- **Data Source Selector:**
  - Children profiles
  - Vaccination records
  - Mother/guardian data
  - Facility performance
  - Coverage statistics

- **Column Chooser:**
  - Toggle visibility of fields
  - Reorder columns
  - Select all/none shortcuts

- **Filter Builder:**
  - Pre-built filter presets (Overdue doses, Recent registrations, etc.)
  - Advanced filter input (custom SQL-like conditions)
  - Date range picker
  - Geographic filters (region, district, facility)

- **Export Options:**
  - CSV (comma-separated values)
  - Excel (XLSX with formatting)
  - PDF (formatted report with headers)

- **Saved Reports:**
  - Store frequently-used configurations
  - Load saved reports by name
  - Share report definitions with colleagues
  - Schedule automated generation (future)

---

## 📈 Performance & Monitoring

### Real-Time Data
All KPIs and feeds refresh on page load. Future enhancements will include:
- WebSocket-based live updates
- Auto-refresh intervals (every 60 seconds)
- "New item" badges when queue grows
- Browser notifications for high-priority alerts

### Thresholds & Alerts
**Critical Thresholds:**
- Deduplication queue: > 5 items → Dashboard warning banner
- Security alerts: > 0 → Immediate attention required
- Notification failures: > 10% failure rate → Investigation needed
- Downtime: > 30 minutes → Escalate to IT operations

---

## 🛠️ Technical Implementation

### State Management
- **React Hooks:** `useState`, `useEffect`, `useMemo`
- **Routing:** Next.js App Router with `useRouter`
- **Local Storage:** Session persistence and cross-tab communication

### Component Architecture
- **Server Component:** Page shell (no "use client" at page level)
- **Client Components:** Interactive elements (buttons, links, theme toggle)
- **Memoized Data:** `useMemo` for computed lists (prevents re-renders)

### Styling
- **Framework:** Tailwind CSS with custom design tokens
- **Components:** shadcn/ui primitives (Card, Badge, Button, Alert)
- **Responsive:** Mobile-first breakpoints (sm, md, lg, xl)
- **Theme:** Dark mode support via ThemeToggle component

### Icons
- **Library:** lucide-react
- **Usage:** Semantic icons matching functionality (Layers for duplicates, ShieldAlert for security, etc.)

---

## 🔮 Future Enhancements

### Planned Features
1. **Live Notifications:**
   - Push alerts for new security incidents
   - Toast notifications for queue updates
   - Email digests for daily summary

2. **Advanced Analytics:**
   - Trend charts for KPI history
   - Predictive duplicate detection
   - Anomaly detection for notification failures

3. **Automation:**
   - Auto-merge high-confidence duplicates (> 95% similarity)
   - Scheduled report generation and email delivery
   - Auto-escalation of aged queue items

4. **Collaboration:**
   - Comments on conflicts/duplicates
   - Assignment workflow (distribute queue among team)
   - Activity feed showing colleague actions

5. **Mobile Optimization:**
   - Progressive Web App (PWA) support
   - Offline capability for review tasks
   - Push notifications on mobile devices

---

## 📞 Support & Escalation

### When to Escalate to HQ Admin
- Security alerts marked "High Severity"
- Sync conflicts requiring policy decision
- Infrastructure offline > 1 hour
- Deduplication queue exceeds processing capacity
- Notification gateway failures affecting multiple regions

### Support Contacts
- **HQ Security Team:** For security incident investigations
- **IT Operations:** For infrastructure downtime and degraded services
- **Data Quality Lead:** For complex deduplication cases
- **Notification Team:** For SMS/email gateway issues

---

## 📝 Quick Reference Guide

### Daily Checklist
- [ ] Review KPI dashboard (all metrics green/acceptable)
- [ ] Process deduplication queue to < 5 items
- [ ] Resolve all sync conflicts from previous day
- [ ] Check notification failures and retry where possible
- [ ] Review new security alerts and update status
- [ ] Monitor infrastructure heartbeat for offline services
- [ ] Generate any requested custom reports
- [ ] Document unusual patterns or issues for weekly review

### Keyboard Shortcuts (Future)
- `D` → Jump to deduplication
- `C` → Jump to conflicts
- `N` → Jump to notifications
- `R` → Open report generator
- `S` → Scroll to security section
- `/` → Focus search/filter

---

## 🏁 Conclusion

The Data Officer Dashboard serves as the **operational nerve center** for maintaining data quality and system security in the Ghana Child Vaccination System. By consolidating critical metrics, actionable queues, and monitoring tools into a single interface, it enables data officers to:

- ✅ Prevent duplicate records from corrupting analytics
- ✅ Resolve field sync conflicts before they impact operations
- ✅ Ensure caregivers receive timely vaccination reminders
- ✅ Detect and respond to security threats proactively
- ✅ Monitor system health and coordinate incident response
- ✅ Generate custom reports for data-driven decision making

**Remember:** Clean data flows enable accurate national coverage tracking, timely caregiver notifications, and informed policy decisions. Your role as Data Officer is critical to the success of Ghana's immunization program.

---

**Dashboard Access:** `http://localhost:3000/dashboard`  
**Documentation Version:** 1.0  
**Last Updated:** November 15, 2025
