# Audit Log Export Enhancement

## Overview
Added dual-format export functionality to the System Audit Log in the HQ Dashboard. Admins can now export audit logs in both **CSV** and **PDF** formats.

## Features Implemented

### 1. CSV Export (`exportAuditLogCSV`)
- **Format**: Comma-separated values
- **Headers**: Timestamp, Action, Actor, Category
- **Filename**: `audit-log-YYYY-MM-DD.csv`
- **File Download**: Automatically triggers browser download
- **Use Case**: Importing into spreadsheet applications, data analysis tools

### 2. PDF Export (`exportAuditLogPDF`)

- **Format**: Portable Document Format
- **Content**: Professional formatted table with:
  - Report header with generation timestamp
  - Total record count
  - Formatted table with all audit entries
  - Auto-pagination for large logs
- **Filename**: `audit-log-YYYY-MM-DD.pdf`
- **Table Headers**: Repeats on each page for multi-page reports
- **Library**: jsPDF (already installed)

## UI Changes

### Old Button
```tsx
<Button variant="outline" className="gap-2" onClick={handleAuditExport}>
  <ArrowDownToLine className="h-4 w-4" /> Export audit log
</Button>
```

### New Buttons
```tsx
<div className="flex flex-wrap gap-2">
  <Button variant="outline" className="gap-2" onClick={exportAuditLogCSV}>
    <ArrowDownToLine className="h-4 w-4" /> Export as CSV
  </Button>
  <Button variant="outline" className="gap-2" onClick={exportAuditLogPDF}>
    <ArrowDownToLine className="h-4 w-4" /> Export as PDF
  </Button>
</div>
```

## Implementation Details

### CSV Export Logic
1. Prepare headers: `["Timestamp", "Action", "Actor", "Category"]`
2. Map each audit log entry to a CSV row
3. Escape quotes in cell values with double quotes
4. Combine headers and rows with newlines
5. Create Blob and trigger download

### PDF Export Logic
1. Create new jsPDF document
2. Add report title and metadata
3. Create formatted table with headers
4. Iterate through audit logs with:
   - Automatic page breaks when reaching bottom
   - Header repetition on new pages
   - Text wrapping for long action descriptions
5. Save PDF with timestamped filename

## Error Handling
Both functions include try-catch blocks with user feedback:
- Success messages: "✓ Audit log exported as CSV/PDF"
- Error messages with fallback
- System messages displayed in UI toast

## Audit Trail Integration
Both export actions are logged in the audit trail:
- "Exported audit log (CSV format)"
- "Exported audit log (PDF format)"

## File Naming Convention
Both exports use the format: `audit-log-YYYY-MM-DD.[csv|pdf]`

Example filenames:
- `audit-log-2026-03-16.csv`
- `audit-log-2026-03-16.pdf`

## Dependencies
- **jsPDF**: ^3.0.3 (already in package.json)

## Browser Compatibility
- Works in all modern browsers with blob/download support
- CSV: All browsers
- PDF: All browsers with jsPDF support

## Testing Checklist
- [ ] Click "Export as CSV" button
- [ ] Verify CSV downloads with correct filename
- [ ] Open CSV in Excel/Google Sheets
- [ ] Click "Export as PDF" button
- [ ] Verify PDF downloads with correct filename
- [ ] Open PDF and verify formatting
- [ ] Verify audit log entries appear in both exports
- [ ] Check system messages appear for both actions
- [ ] Verify exports are logged in audit trail

---

**Status**: ✅ Complete and Ready for Testing  
**Date**: March 16, 2026
