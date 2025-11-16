# 🇬🇭 Public Health Authority (PHA) Dashboard Documentation

**Version:** 1.0  
**Date:** November 16, 2025  
**System:** Ghana Child Vaccination System  
**User Role:** Public Health Authority · National Level

---

## Executive Summary

The **Public Health Authority (PHA) Dashboard** is the national-level command center for Ghana's immunization program. It provides real-time surveillance, advanced analytics, and official reporting tools for senior health officials, policymakers, and international partners (WHO, UNICEF, GAVI).

Unlike facility or branch dashboards (which focus on operational tasks), the PHA Dashboard is **strategic and analytical**, designed for:
- 📊 National surveillance and trend analysis
- 📈 Regional performance benchmarking
- 🛡️ Anti-fraud certificate verification
- 📄 Official report generation for government and partners

---

## Table of Contents

1. [Dashboard Modules](#dashboard-modules)
2. [Module 1: National Health Dashboard](#module-1-national-health-dashboard)
3. [Module 2: Reports & Exporter](#module-2-reports--exporter)
4. [Module 3: Certificate Verification](#module-3-certificate-verification)
5. [Data Visualization Library](#data-visualization-library)
6. [Backend Integration Guide](#backend-integration-guide)
7. [Security & Privacy](#security--privacy)
8. [Future Enhancements](#future-enhancements)

---

## Dashboard Modules

### 🎯 Three Core Modules

| Module | Purpose | URL | Key Features |
|--------|---------|-----|--------------|
| **National Health Dashboard** | Real-time national KPIs and trends | `/pha/dashboard` | KPI cards, Recharts visualizations, AEFI surveillance |
| **Reports & Exporter** | Generate official reports | `/pha/reports` | 8 report types, CSV/Excel/PDF export, filters |
| **Certificate Verification** | Anti-fraud tool | `/pha/verify-certificate` | ID verification, QR scanning, privacy-protected |

---

## Module 1: National Health Dashboard

### 🌍 Overview
The landing page for PHA users. Displays national-level vaccination performance using interactive charts and real-time KPIs.

**URL:** `/pha/dashboard`

### 📊 KPI Cards (Top Section)

Four critical national indicators displayed as gradient cards:

#### 1. Total Children Registered
- **Metric:** 2,847,621 (formatted with commas)
- **Icon:** `Users`
- **Color:** Blue gradient
- **Description:** "Nationwide · All-time"
- **Purpose:** Track total enrollment in the national immunization registry

#### 2. Total Doses Administered
- **Metric:** 8,542,864
- **Icon:** `Activity`
- **Color:** Green gradient
- **Description:** "All vaccines · All-time"
- **Purpose:** Measure program output and vaccine utilization

#### 3. Measles Coverage (MR1)
- **Metric:** 87.4%
- **Icon:** `TrendingUp`
- **Color:** Purple gradient
- **Description:** "National · Current month"
- **Purpose:** Track the #1 WHO indicator (Measles Rubella dose 1)
- **Benchmark:** WHO target = 95%

#### 4. Dropout Rate (DPT1→DPT3)
- **Metric:** 12.3%
- **Icon:** `AlertTriangle`
- **Color:** Amber gradient (warning)
- **Description:** "Needs attention · Target: <10%"
- **Purpose:** Identify health system weakness (children who start but don't complete)
- **Calculation:** `((DPT1_count - DPT3_count) / DPT1_count) * 100`

### 📈 Coverage Over Time (Line Chart)

**Chart Type:** Recharts `<LineChart>`

**Data:** Monthly national coverage % for last 12 months

**Purpose:** Visualize trends to identify:
- Seasonal patterns (e.g., lower coverage during rainy season)
- Policy impacts (e.g., coverage spikes after outreach campaigns)
- Long-term improvement or decline

**Sample Data Structure:**
```javascript
{
  month: "Nov 2025",
  coverage: 87.4
}
```

**Key Insights Display:**
- Trend summary: "Steady improvement from 82.1% (Dec 2024) to 87.4% (Nov 2025)"

### 🗺️ Regional Performance Comparison (Bar Chart)

**Chart Type:** Recharts `<BarChart>`

**Data:** Coverage % for all 10+ regions of Ghana

**Purpose:** 
- Identify top performers (e.g., Greater Accra: 91.2%)
- Flag struggling regions (e.g., Upper West: 74.5%)
- Resource allocation decisions

**Sample Data Structure:**
```javascript
{
  region: "Greater Accra",
  coverage: 91.2,
  population: 520000
}
```

**Summary Cards Below Chart:**
- 🏆 **Top Performer:** Greater Accra · 91.2%
- 📊 **National Average:** 83.5%
- ⚠️ **Needs Support:** Upper West · 74.5%

### 🚨 AEFI Surveillance Charts

#### AEFI Reports by Type (Pie Chart)

**Chart Type:** Recharts `<PieChart>`

**Purpose:** Aggregate surveillance of adverse events following immunization

**Data Categories:**
- Fever (Mild) - 1,243 reports
- Injection Site Reaction (Mild) - 892
- Rash (Mild) - 456
- Swelling (Moderate) - 334
- Allergic Reaction (Moderate) - 89
- Severe Allergic (Severe) - 12

**Severity Badges:**
- Green: Mild events
- Amber: Moderate events
- Red: Severe events

#### AEFI by Region (Bar Chart)

**Chart Type:** Recharts `<BarChart>`

**Purpose:** Detect unusual clusters or anomalies (e.g., one region has 10x more fever reports than others)

**Insight Display:** "No unusual clusters detected. All regions reporting within expected ranges."

### 🚀 Quick Action Cards

Three clickable cards at bottom:
1. **Generate Reports** → Links to `/pha/reports`
2. **Verify Certificate** → Links to `/pha/verify-certificate`
3. **Data Exports** → Shows last export metadata

---

## Module 2: Reports & Exporter

### 📄 Overview
The most critical PHA tool. Generates official government reports for:
- Ministry of Health briefings
- WHO/UNICEF Joint Reporting Form (JRF)
- GAVI performance reports
- Parliamentary committees

**URL:** `/pha/reports`

### 📋 Available Reports (8 Types)

| Report ID | Name | Category | Description |
|-----------|------|----------|-------------|
| `national-coverage` | National Coverage Report | Coverage | Vaccination coverage by vaccine type and age group |
| `regional-coverage` | Regional Coverage Breakdown | Coverage | Coverage rates by region and vaccine |
| `dropout-analysis` | Dropout Rate Analysis | Dropout | DPT1-DPT3 dropout rates by region and facility |
| `vaccine-stock` | Vaccine Stock & Utilization | Stock | National stock levels, usage rates, and wastage |
| `aefi-surveillance` | AEFI Surveillance Report | Safety | Adverse events by type, severity, and region |
| `facility-performance` | Facility Performance Report | Performance | Facility-level coverage, staffing, and supply metrics |
| `who-monthly` | WHO Monthly Report | International | Standard WHO/UNICEF JRF format |
| `certificate-issuance` | Certificate Issuance Report | Certificates | Digital certificates issued by region and month |

### 🔧 Report Configuration

#### Filters Available:
1. **Report Type** (dropdown selection with description)
2. **Region Filter** (All Regions + 16 Ghana regions)
3. **Date Range:**
   - Current Month
   - Last Month
   - Current Quarter
   - Last Quarter
   - Last 6 Months
   - Last 12 Months
   - Current Year (2025)
   - Last Year (2024)
   - Custom Range (TODO: date picker)

4. **Export Format:**
   - **CSV:** Best for data analysis in Excel/R/Python
   - **Excel (XLSX):** Formatted tables with charts (WHO reports)
   - **PDF:** Official printable documents for leadership

### 📊 Report Preview

**Live Preview Features:**
- Report metadata card (type, category, region, date range, format)
- First 5 rows displayed in responsive HTML table
- Coverage % color-coded:
  - ≥90%: Green badge (excellent)
  - 80-89%: Amber badge (acceptable)
  - <80%: Red badge (needs improvement)

**Summary Statistics:**
- Total Rows: 247
- Avg Coverage: 89.9%
- Estimated File Size:
  - CSV: ~156 KB
  - Excel: ~890 KB
  - PDF: ~2.4 MB

### ⚙️ Backend Integration Payload

```javascript
{
  reportId: "national-coverage",
  reportName: "National Coverage Report",
  filters: {
    region: "All Regions",
    dateRange: "last-12-months"
  },
  exportFormat: "xlsx",
  generatedAt: "2025-11-16T10:30:00Z",
  generatedBy: "Public Health Authority"
}
```

**API Endpoint (TODO):**
```
POST /api/pha/reports/generate
```

**Response:**
- Stream file download (CSV/Excel/PDF)
- Set headers: `Content-Disposition: attachment; filename="national-coverage-2025-11-16.xlsx"`

### 🎨 Export Guidelines Card

Display best practices:
- CSV for data analysis
- Excel for pivot-ready extracts
- PDF for static snapshots
- All exports include timestamp, filter summary, and Data Officer ID

---

## Module 3: Certificate Verification

### 🛡️ Overview
**Anti-fraud and public utility tool** to verify that a digital vaccination certificate is authentic and valid.

**URL:** `/pha/verify-certificate`

**Use Cases:**
1. **School Enrollment:** Verify certificate before admitting child
2. **Border Control:** Confirm Yellow Fever vaccination
3. **Legal Proceedings:** Authenticate certificate in court
4. **Fraud Investigation:** Detect fake certificates

### 🔍 How It Works

#### Two Verification Methods:

1. **Manual Entry:**
   - User types certificate ID (e.g., `CERT-GH-2025-001234`)
   - System searches national database
   - Returns verification result

2. **QR Code Scanning:**
   - Click "Scan QR Code" button
   - Activates device camera
   - Reads QR code on certificate (contains ID)
   - Auto-populates ID field and verifies

### ✅ Verification Results

#### Valid Certificate (Green Screen)
```
✓ CERTIFICATE VERIFIED
This certificate is authentic and valid
```

**Displayed Information:**
- Certificate ID (e.g., `CERT-GH-2025-001234`)
- Issued Date
- Completion Status:
  - ✓ **Complete:** All mandatory vaccinations done
  - ⚠️ **Partial:** Vaccinations in progress
- Issued By (facility name)
- Region
- List of vaccines completed (as badges)

**Privacy Protection Notice:**
> 🔒 For privacy protection, this system does NOT display the child's name, date of birth, or parent contact information. This verification confirms only that the certificate itself is genuine.

#### Invalid Certificate (Red Screen)
```
✗ CERTIFICATE NOT FOUND
This certificate ID is not valid in our system
```

**Warning Message:**
> ⚠️ This certificate may be fraudulent
> - The certificate ID does not exist in the database
> - It may be fake, expired, or incorrectly entered
> - Double-check the ID and try again, or report suspicious certificates

### 🗄️ Mock Database (for Testing)

Test Certificate IDs:
- `CERT-GH-2025-001234` → Valid (Complete)
- `CERT-GH-2025-005678` → Valid (Partial)
- `CERT-GH-2024-099888` → Valid (Complete)
- `CERT-GH-2025-FAKE99` → Not Found (Invalid)

### 📜 Verification Log

Table displaying last 5 verification attempts:
- Time (e.g., "2 mins ago")
- Certificate ID
- Result (Valid/Not Found badge)
- Verified By (PHA Officer)

### 🔧 Backend Integration Payload

```javascript
{
  certificateId: "CERT-GH-2025-001234",
  verifiedAt: "2025-11-16T10:30:00Z",
  verifiedBy: "Public Health Authority",
  verificationMethod: "manual-entry" // or "qr-scan"
}
```

**API Endpoint (TODO):**
```
POST /api/pha/certificates/verify
```

**Response:**
```javascript
{
  status: "valid" | "not-found",
  data: {
    issuedDate: "2025-09-15",
    completionStatus: "Complete",
    vaccinesCompleted: ["BCG", "OPV1", "DPT1", "MR1"],
    issuedBy: "Korle Bu Teaching Hospital",
    region: "Greater Accra"
  }
}
```

---

## Data Visualization Library

### 📊 Recharts Integration

All charts use **Recharts** (specified in SYSTEM DESIGN.docx):

```javascript
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
```

### 🎨 Chart Styling

**Theme-Aware:**
- Light mode: Muted colors, white backgrounds
- Dark mode: Darker tones, high contrast

**Color Palette:**
```javascript
const COLORS = {
  primary: "#3b82f6",    // Blue
  success: "#22c55e",    // Green
  warning: "#f59e0b",    // Amber
  danger: "#ef4444",     // Red
  purple: "#a855f7",     // Purple
  teal: "#14b8a6",       // Teal
}
```

**Responsive Design:**
- All charts use `<ResponsiveContainer>` for mobile/tablet/desktop
- Height: 300-400px (adjustable)
- Text: `text-xs` for axis labels, `text-sm` for legends

---

## Backend Integration Guide

### 🔌 API Endpoints to Implement

#### 1. National Dashboard KPIs
```
GET /api/pha/dashboard/kpis
Response: {
  totalChildrenRegistered: 2847621,
  totalDosesAdministered: 8542864,
  measlesCoverage: 87.4,
  dropoutRate: 12.3
}
```

#### 2. Coverage Trend Data
```
GET /api/pha/dashboard/coverage-trend?months=12
Response: [
  { month: "Nov 2025", coverage: 87.4 },
  ...
]
```

#### 3. Regional Performance
```
GET /api/pha/dashboard/regional-performance
Response: [
  { region: "Greater Accra", coverage: 91.2, population: 520000 },
  ...
]
```

#### 4. AEFI Reports
```
GET /api/pha/dashboard/aefi-reports
Response: {
  byType: [...],
  byRegion: [...]
}
```

#### 5. Generate Report
```
POST /api/pha/reports/generate
Body: { reportId, filters, exportFormat }
Response: File stream (CSV/Excel/PDF)
```

#### 6. Verify Certificate
```
POST /api/pha/certificates/verify
Body: { certificateId, verificationMethod }
Response: { status, data }
```

### 🗄️ Database Queries

**For Coverage Calculation:**
```sql
SELECT 
  r.name AS region,
  v.vaccine_code,
  COUNT(DISTINCT c.id) AS target_population,
  COUNT(ve.id) AS vaccinated,
  (COUNT(ve.id) / COUNT(DISTINCT c.id)) * 100 AS coverage
FROM region r
JOIN child c ON c.region_id = r.id
LEFT JOIN vaccination_event ve ON ve.child_id = c.id AND ve.vaccine_code = 'MR1'
WHERE c.birth_date >= '2023-01-01'
GROUP BY r.name, v.vaccine_code
```

**For Dropout Rate:**
```sql
SELECT 
  (COUNT(DISTINCT dpt1.child_id) - COUNT(DISTINCT dpt3.child_id)) / 
  COUNT(DISTINCT dpt1.child_id) * 100 AS dropout_rate
FROM vaccination_event dpt1
LEFT JOIN vaccination_event dpt3 ON dpt3.child_id = dpt1.child_id AND dpt3.vaccine_code = 'DPT3'
WHERE dpt1.vaccine_code = 'DPT1'
```

---

## Security & Privacy

### 🔒 Data Protection

1. **Certificate Verification:**
   - NEVER returns child's name, DOB, or parent info
   - Only confirms certificate validity

2. **Role-Based Access:**
   - PHA dashboard accessible only to authorized national officials
   - Requires authentication (TODO: implement auth)

3. **Audit Logging:**
   - All verification attempts logged
   - Report generation tracked (who, when, what)

4. **GDPR/Ghana Data Protection Act Compliance:**
   - Aggregate data only (no individual child records)
   - Anonymized exports for international partners

### 🛡️ Anti-Fraud Measures

1. **Certificate Database:**
   - Centralized registry of all issued certificates
   - Unique IDs with checksums

2. **QR Code Encryption:**
   - QR codes contain encrypted certificate ID
   - Cannot be forged without private key

3. **Expiration Dates:**
   - Certificates valid for 10 years (TODO: implement expiry check)

---

## Future Enhancements

### 🚀 Phase 2 Features

1. **Real-Time Dashboard Updates:**
   - WebSocket connection for live KPI refresh
   - Auto-update charts every 5 minutes

2. **Advanced Filtering:**
   - Custom date range picker (react-datepicker)
   - Multi-region selection
   - Vaccine-specific reports

3. **QR Code Scanner:**
   - Integrate `html5-qrcode` library
   - Mobile camera access
   - Bulk certificate verification

4. **Export Scheduling:**
   - Weekly/monthly automated reports
   - Email delivery to stakeholders

5. **Geospatial Mapping:**
   - Leaflet.js map showing coverage by district
   - Heatmap of low-coverage areas

6. **Predictive Analytics:**
   - ML model to forecast dropout risk
   - Vaccine stock shortage predictions

7. **Multi-Language Support:**
   - English, French (for regional partners)
   - Local languages (Twi, Ga, Ewe)

8. **WHO/UNICEF API Integration:**
   - Direct JRF submission to WHO servers
   - GAVI API for donor reporting

---

## Deployment Notes

### 📦 Dependencies

Already installed in `package.json`:
- ✅ `recharts` (data visualization)
- ✅ `sonner` (toast notifications)
- ✅ `lucide-react` (icons)
- ✅ `shadcn/ui` (components)

### 🌐 URLs

- **Dashboard:** `http://localhost:3000/pha/dashboard`
- **Reports:** `http://localhost:3000/pha/reports`
- **Verification:** `http://localhost:3000/pha/verify-certificate`

### 🔗 Navigation

Add to main navigation menu (TODO):
```javascript
{
  role: "pha",
  label: "Public Health Authority",
  links: [
    { href: "/pha/dashboard", label: "National Dashboard" },
    { href: "/pha/reports", label: "Reports & Exports" },
    { href: "/pha/verify-certificate", label: "Verify Certificate" },
  ]
}
```

---

## Contact & Support

**Development Team:** Ghana Health Service · Digital Health Unit  
**Technical Lead:** [Your Name]  
**Documentation Date:** November 16, 2025  
**Version:** 1.0 (MVP)

---

**End of Documentation**
