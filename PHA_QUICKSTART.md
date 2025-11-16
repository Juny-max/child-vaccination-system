# 🚀 PHA Dashboard - Quick Start Guide

## Accessing the Dashboard

### 1. Navigate to PHA Dashboard
```
http://localhost:3000/pha/dashboard
```

### 2. Three Main Sections

#### 📊 National Health Dashboard
- **What:** Real-time national KPIs and visualizations
- **Who:** Senior health officials, policymakers
- **When:** Daily monitoring
- **Features:**
  - 4 KPI cards (children, doses, coverage, dropout)
  - Coverage trend line chart
  - Regional performance bar chart
  - AEFI surveillance charts

#### 📄 Reports & Exporter  
```
http://localhost:3000/pha/reports
```
- **What:** Generate official reports
- **Who:** Data analysts, WHO/UNICEF partners
- **When:** Monthly/quarterly reporting
- **Features:**
  - 8 report types
  - Region and date filters
  - CSV, Excel, PDF export
  - Live preview

#### 🛡️ Certificate Verification
```
http://localhost:3000/pha/verify-certificate
```
- **What:** Anti-fraud tool
- **Who:** School officials, border control, legal
- **When:** On-demand verification
- **Features:**
  - Manual ID entry
  - QR code scanning (planned)
  - Privacy-protected results
  - Verification log

---

## Testing the Dashboard

### Test Certificate IDs
Try these in Certificate Verification:

✅ **Valid (Complete):**
```
CERT-GH-2025-001234
CERT-GH-2024-099888
```

⚠️ **Valid (Partial):**
```
CERT-GH-2025-005678
```

❌ **Invalid:**
```
CERT-GH-2025-FAKE99
```

### Test Reports
1. Go to `/pha/reports`
2. Select "National Coverage Report"
3. Choose "Greater Accra" region
4. Select "Last 12 Months"
5. Choose CSV format
6. Click "Generate CSV Report"
7. Check browser console for payload

---

## Key Features to Demo

### 1. Interactive Charts (Recharts)
- Hover over line chart to see exact coverage %
- Hover over bar chart to see regional data
- Pie chart shows AEFI distribution

### 2. Color-Coded KPIs
- **Blue:** Children registered
- **Green:** Doses administered  
- **Purple:** Measles coverage
- **Amber:** Dropout rate (warning)

### 3. Regional Insights
- 🏆 **Top Performer:** Greater Accra (91.2%)
- ⚠️ **Needs Support:** Upper West (74.5%)
- 📊 **National Average:** 83.5%

### 4. Toast Notifications
- Report generation success
- Certificate verification results
- Error handling

---

## Next Steps (Backend Integration)

### Priority 1: Data APIs
```javascript
// Implement these endpoints first
GET /api/pha/dashboard/kpis
GET /api/pha/dashboard/coverage-trend
GET /api/pha/dashboard/regional-performance
GET /api/pha/dashboard/aefi-reports
```

### Priority 2: Report Generation
```javascript
POST /api/pha/reports/generate
// Should stream CSV/Excel/PDF file
```

### Priority 3: Certificate Verification
```javascript
POST /api/pha/certificates/verify
// Check certificate_id against database
```

---

## Common Tasks

### Generate a WHO Report
1. Go to Reports page
2. Select "WHO Monthly Report"
3. Choose "All Regions"
4. Select "Last Month"
5. Choose "Excel" format
6. Click Generate
7. Wait for download

### Verify a Certificate
1. Go to Verification page
2. Enter certificate ID
3. Click "Verify Certificate"
4. See green (valid) or red (invalid) result
5. Check details (date, facility, vaccines)

### Monitor National Trends
1. Go to Dashboard
2. Check KPI cards for key metrics
3. View line chart for monthly trends
4. Check regional bar chart for disparities
5. Review AEFI charts for safety surveillance

---

## Troubleshooting

### Charts Not Showing?
- Ensure Recharts is installed: `pnpm install recharts`
- Check browser console for errors
- Verify data format matches expected structure

### Toast Notifications Not Working?
- Check `app/layout.tsx` has `<Toaster />` component
- Ensure `sonner` is installed: `pnpm install sonner`

### Export Button Does Nothing?
- Currently logs to console (check DevTools)
- Backend API not yet implemented
- See PHA_DASHBOARD_DOCUMENTATION.md for integration guide

---

## Production Checklist

Before deploying to production:

- [ ] Implement backend APIs
- [ ] Add authentication/authorization
- [ ] Connect to real database
- [ ] Add rate limiting for verification
- [ ] Implement QR code scanning
- [ ] Enable file download for exports
- [ ] Add audit logging
- [ ] Test with real data
- [ ] Security review
- [ ] Performance testing

---

**Ready to explore!** Start at `/pha/dashboard` and navigate using the header buttons.
