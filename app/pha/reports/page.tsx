"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Download, 
  FileText, 
  Filter,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileDown
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PHASidebar } from "@/components/pha/pha-sidebar"
import { getPHAReport, type PHAReportResponse } from "@/lib/api/pha"

// Available national reports
const availableReports = [
  {
    id: "national-coverage",
    name: "National Coverage Report",
    description: "Vaccination coverage by vaccine type and age group",
    category: "Coverage",
  },
  {
    id: "regional-coverage",
    name: "Regional Coverage Breakdown",
    description: "Coverage rates by region and vaccine",
    category: "Coverage",
  },
  {
    id: "dropout-analysis",
    name: "Dropout Rate Analysis",
    description: "DPT1-DPT3 dropout rates by region and facility",
    category: "Dropout",
  },
  {
    id: "vaccine-stock",
    name: "Vaccine Stock & Utilization",
    description: "National stock levels, usage rates, and wastage",
    category: "Stock",
  },
  {
    id: "aefi-surveillance",
    name: "AEFI Surveillance Report",
    description: "Adverse events by type, severity, and region",
    category: "Safety",
  },
  {
    id: "facility-performance",
    name: "Facility Performance Report",
    description: "Facility-level coverage, staffing, and supply metrics",
    category: "Performance",
  },
  {
    id: "who-monthly",
    name: "WHO Monthly Report",
    description: "Standard WHO/UNICEF Joint Reporting Form format",
    category: "International",
  },
  {
    id: "certificate-issuance",
    name: "Certificate Issuance Report",
    description: "Digital certificates issued by region and month",
    category: "Certificates",
  },
]

// Mock regions
const ghanaRegions = [
  "All Regions",
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Brong Ahafo",
  "Western North",
  "Savannah",
  "North East",
  "Oti",
  "Ahafo",
  "Bono East",
]

/**
 * Converts a date-range selector value into concrete from/to ISO date strings.
 * This calculation happens entirely client-side — no user input is passed raw to the DB.
 */
function getDateRangeDates(range: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)

  switch (range) {
    case "current-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: from.toISOString().slice(0, 10), to }
    }
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end  = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
    }
    case "current-quarter": {
      const q    = Math.floor(now.getMonth() / 3)
      const from = new Date(now.getFullYear(), q * 3, 1)
      return { from: from.toISOString().slice(0, 10), to }
    }
    case "last-quarter": {
      const q    = Math.floor(now.getMonth() / 3) - 1
      const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const qAdj = q < 0 ? 3 : q
      const from = new Date(year, qAdj * 3, 1)
      const end  = new Date(year, qAdj * 3 + 3, 0)
      return { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
    }
    case "last-6-months": {
      const from = new Date(now)
      from.setMonth(from.getMonth() - 6)
      return { from: from.toISOString().slice(0, 10), to }
    }
    case "current-year": {
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: from.toISOString().slice(0, 10), to }
    }
    case "last-year": {
      const from = new Date(now.getFullYear() - 1, 0, 1)
      const end  = new Date(now.getFullYear() - 1, 11, 31)
      return { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
    }
    case "all-time": {
      return { from: "2020-01-01", to }
    }
    default: { // last-12-months
      const from = new Date(now)
      from.setMonth(from.getMonth() - 12)
      return { from: from.toISOString().slice(0, 10), to }
    }
  }
}

export default function PHAReportsPage() {
  const router = useRouter()
  const [selectedReport, setSelectedReport] = useState(availableReports[0].id)
  const [selectedRegion, setSelectedRegion] = useState("All Regions")
  const [dateRange, setDateRange] = useState("all-time")
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv")
  const [reportData, setReportData] = useState<PHAReportResponse | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    const hasAuth = Boolean(userId || accessToken || legacyToken)
    if (!hasAuth || role !== "staff" || detail !== "pha") {
      router.replace("/auth/login")
      return
    }
  }, [router])

  // Fetch report data whenever the report type, region, or date range changes
  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) return

    setIsPreviewLoading(true)
    setPreviewError(null)
    const { from, to } = getDateRangeDates(dateRange)

    getPHAReport(selectedReport, selectedRegion, from, to)
      .then((data) => setReportData(data))
      .catch(() => setPreviewError("Could not load report data. Check your connection and try again."))
      .finally(() => setIsPreviewLoading(false))
  }, [selectedReport, selectedRegion, dateRange])

  const currentReport = availableReports.find((r) => r.id === selectedReport) || availableReports[0]

  /**
   * Generates and downloads the report in the selected format.
   * Uses the already-fetched reportData so no extra network call is required.
   * For PDF, opens a print-ready HTML page in a new tab.
   */
  const handleGenerateReport = async () => {
    if (!reportData || reportData.rows.length === 0) {
      toast.error("No data to export. Adjust your filters and wait for the preview to load.")
      return
    }

    setIsGenerating(true)
    try {
      const { from, to } = getDateRangeDates(dateRange)
      const safeRegion = selectedRegion.replace(/ /g, "_")
      const filename = `${selectedReport}_${safeRegion}_${from}_${to}`

      if (exportFormat === "pdf") {
        // ── Fetch logo as base64 ──────────────────────────────────────────
        let logoBase64 = ""
        try {
          const res = await fetch("/images/cvcc-logo.png")
          const buf = await res.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let binary = ""
          bytes.forEach((b) => (binary += String.fromCharCode(b)))
          logoBase64 = `data:image/png;base64,${btoa(binary)}`
        } catch { /* graceful — text fallback used below */ }

        // ── Build PDF with jsPDF — direct download, no print dialog ─────
        const { jsPDF } = await import("jspdf")
        const doc = new jsPDF({ unit: "pt", format: "a4" })
        const PW = doc.internal.pageSize.getWidth()   // 595.28
        const PH = doc.internal.pageSize.getHeight()  // 841.89
        const margin = 42
        const innerW = PW - margin * 2

        // Category palette (RGB tuples)
        const catPalette: Record<string, [number,number,number]> = {
          Coverage:     [29, 78, 216],
          Dropout:      [124, 58, 237],
          Stock:        [3, 105, 161],
          Safety:       [185, 28, 28],
          Performance:  [4, 120, 87],
          International:[146, 64, 14],
          Certificates: [15, 118, 110],
        }
        const [cr, cg, cb] = catPalette[currentReport.category] ?? [29, 78, 216]

        // ══════════════════════════ PAGE 1 — COVER ══════════════════════
        // Background — dark navy with a lighter mid-band
        doc.setFillColor(15, 23, 42)
        doc.rect(0, 0, PW, PH, "F")
        doc.setFillColor(22, 45, 80)
        doc.rect(0, PH * 0.28, PW, PH * 0.44, "F")
        doc.setFillColor(15, 23, 42)
        doc.rect(0, PH * 0.65, PW, PH * 0.35, "F")

        // Top accent bar (three-segment gradient simulation)
        doc.setFillColor(59, 130, 246)
        doc.rect(0, 0, PW * 0.34, 7, "F")
        doc.setFillColor(6, 182, 212)
        doc.rect(PW * 0.34, 0, PW * 0.33, 7, "F")
        doc.setFillColor(16, 185, 129)
        doc.rect(PW * 0.67, 0, PW * 0.33, 7, "F")

        // ── BIG centred logo ──────────────────────────────────────────────
        const LOGO_SIZE = 220  // tall + wide — dominates the centre
        const logoX = (PW - LOGO_SIZE) / 2
        const logoY = PH / 2 - LOGO_SIZE / 2 - 20   // centred slightly above mid
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", logoX, logoY, LOGO_SIZE, LOGO_SIZE)
        } else {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(72)
          doc.setTextColor(147, 197, 253)
          doc.text("CVCC", PW / 2, PH / 2 + 20, { align: "center" })
        }

        // Org branding — top right
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text("Child Vaccination Command Centre", PW - 52, 32, { align: "right" })

        // Bottom section — category badge + title + meta
        const bottomStart = logoY + LOGO_SIZE + 30

        // Category pill badge
        const badgeLabel = `${currentReport.category.toUpperCase()} REPORT`
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.5)
        const badgeW = doc.getTextWidth(badgeLabel) + 28
        const badgeX = (PW - badgeW) / 2
        doc.setFillColor(cr, cg, cb)
        doc.roundedRect(badgeX, bottomStart, badgeW, 18, 5, 5, "F")
        doc.setTextColor(255, 255, 255)
        doc.text(badgeLabel, PW / 2, bottomStart + 12, { align: "center" })

        // Report title
        doc.setFont("helvetica", "bold")
        doc.setFontSize(24)
        doc.setTextColor(241, 245, 249)
        const titleY = bottomStart + 38
        const titleLines = doc.splitTextToSize(currentReport.name, PW - 100)
        doc.text(titleLines, PW / 2, titleY, { align: "center" })

        // Description
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10.5)
        doc.setTextColor(148, 163, 184)
        const descY = titleY + titleLines.length * 26 + 8
        const descLines = doc.splitTextToSize(currentReport.description, PW - 140)
        doc.text(descLines, PW / 2, descY, { align: "center" })

        // Divider
        const divY = descY + descLines.length * 14 + 18
        doc.setDrawColor(59, 130, 246)
        doc.setLineWidth(0.6)
        doc.line(PW * 0.2, divY, PW * 0.8, divY)

        // Meta grid (3 columns) — each item in its own box
        const metaY = divY + 16
        const metaItems = [
          { label: "SCOPE / REGION", value: selectedRegion },
          { label: "REPORTING PERIOD", value: `${from} to ${to}` },
          { label: "TOTAL RECORDS", value: `${reportData.totalRows.toLocaleString()} rows` },
        ]
        const metaGap = 12
        const metaBoxW = (PW - 120 - metaGap * 2) / 3
        const metaBoxH = 42
        metaItems.forEach((m, i) => {
          const mx = 60 + i * (metaBoxW + metaGap)
          // Box background
          doc.setFillColor(18, 32, 58)
          doc.setDrawColor(59, 130, 246)
          doc.setLineWidth(0.4)
          doc.roundedRect(mx, metaY, metaBoxW, metaBoxH, 4, 4, "FD")
          // Label
          doc.setFont("helvetica", "bold")
          doc.setFontSize(7)
          doc.setTextColor(100, 116, 139)
          doc.text(m.label, mx + metaBoxW / 2, metaY + 13, { align: "center" })
          // Value — wrap if too long
          doc.setFont("helvetica", "bold")
          doc.setFontSize(9.5)
          doc.setTextColor(226, 232, 240)
          const valLines = doc.splitTextToSize(m.value, metaBoxW - 10)
          doc.text(valLines[0], mx + metaBoxW / 2, metaY + 28, { align: "center" })
          if (valLines[1]) {
            doc.text(valLines[1], mx + metaBoxW / 2, metaY + 39, { align: "center" })
          }
        })

        // Bottom strip — Official Use Only + doc ID
        const btmY = PH - 46
        doc.setDrawColor(239, 68, 68)
        doc.setLineWidth(0.7)
        doc.rect(60, btmY - 13, 116, 17, "S")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(7.5)
        doc.setTextColor(239, 68, 68)
        doc.text("OFFICIAL USE ONLY", 118, btmY - 2, { align: "center" })

        doc.setFont("helvetica", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(71, 85, 105)
        const docId = `Generated: ${new Date().toLocaleString("en-GH")}   ·   PHA-RPT-${Date.now().toString(36).toUpperCase()}`
        doc.text(docId, PW - 60, btmY - 2, { align: "right" })

        // ═════════════════════════ PAGE 2+ — DATA ═══════════════════════
        doc.addPage()
        let y = margin

        // ── Page header ───────────────────────────────────────────────────
        // Small logo top-right
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", PW - margin - 44, y - 4, 44, 44)
        }
        doc.setFont("helvetica", "bold")
        doc.setFontSize(16)
        doc.setTextColor(15, 23, 42)
        doc.text(currentReport.name, margin, y + 14)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(
          `Public Health Authority  ·  ${selectedRegion}  ·  ${from} to ${to}`,
          margin, y + 28
        )
        doc.setDrawColor(30, 58, 95)
        doc.setLineWidth(2)
        doc.line(margin, y + 36, PW - margin, y + 36)
        y += 52

        // ── KPI summary boxes ─────────────────────────────────────────────
        const summaryEntries = Object.entries(reportData.summary ?? {})
        if (summaryEntries.length > 0) {
          const boxCount = summaryEntries.length
          const boxW = Math.min(130, (innerW - (boxCount - 1) * 10) / boxCount)
          summaryEntries.forEach(([key, val], i) => {
            const bx = margin + i * (boxW + 10)
            doc.setFillColor(240, 249, 255)
            doc.setDrawColor(186, 230, 253)
            doc.setLineWidth(0.5)
            doc.roundedRect(bx, y, boxW, 46, 4, 4, "FD")
            const display =
              typeof val === "number" && String(val).includes(".")
                ? `${val}%`
                : String(val)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(19)
            doc.setTextColor(3, 105, 161)
            doc.text(display, bx + boxW / 2, y + 24, { align: "center" })
            const label = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase())
              .trim()
            doc.setFont("helvetica", "bold")
            doc.setFontSize(6.5)
            doc.setTextColor(100, 116, 139)
            doc.text(label.toUpperCase(), bx + boxW / 2, y + 38, { align: "center" })
          })
          y += 58
        }

        // ── Filter strip ──────────────────────────────────────────────────
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.roundedRect(margin, y, innerW, 20, 3, 3, "FD")
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(71, 85, 105)
        const filterText = `Report: ${currentReport.name}   |   Region: ${selectedRegion}   |   Period: ${from} to ${to}   |   Rows: ${reportData.totalRows.toLocaleString()}   |   Generated: ${new Date().toLocaleString("en-GH")}`
        doc.text(filterText, margin + 8, y + 13)
        y += 30

        // ── Table ─────────────────────────────────────────────────────────
        const colCount = reportData.columns.length
        const colWidths = reportData.columns.map(() => innerW / colCount)
        const ROW_H = 19
        const HDR_H = 22

        const drawTableHeader = (startY: number) => {
          doc.setFillColor(30, 58, 95)
          doc.rect(margin, startY, innerW, HDR_H, "F")
          doc.setFont("helvetica", "bold")
          doc.setFontSize(7.5)
          doc.setTextColor(255, 255, 255)
          let cx = margin
          reportData.columns.forEach((col, i) => {
            doc.text(col.label.toUpperCase(), cx + 5, startY + 15)
            cx += colWidths[i]
          })
        }

        const drawPageFooter = () => {
          doc.setDrawColor(226, 232, 240)
          doc.setLineWidth(0.4)
          doc.line(margin, PH - 28, PW - margin, PH - 28)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(7.5)
          doc.setTextColor(148, 163, 184)
          doc.text(
            "Ghana Child Vaccination Command Centre — Public Health Authority Confidential Report",
            margin, PH - 16
          )
          doc.text(
            `CVCC  ·  Page ${(doc as any).internal.getNumberOfPages()}`,
            PW - margin, PH - 16, { align: "right" }
          )
        }

        drawTableHeader(y)
        y += HDR_H

        reportData.rows.forEach((row, ri) => {
          // Page overflow — close current, open fresh with header
          if (y + ROW_H > PH - margin - 36) {
            drawPageFooter()
            doc.addPage()
            y = margin
            drawTableHeader(y)
            y += HDR_H
          }

          // Alt row shading
          if (ri % 2 === 1) {
            doc.setFillColor(248, 250, 252)
            doc.rect(margin, y, innerW, ROW_H, "F")
          }
          // Bottom cell border
          doc.setDrawColor(241, 245, 249)
          doc.setLineWidth(0.3)
          doc.line(margin, y + ROW_H, margin + innerW, y + ROW_H)

          let cx = margin
          reportData.columns.forEach((col, _ci) => {
            const v = row[col.key] ?? ""
            const isRate =
              col.key.toLowerCase().includes("coverage") ||
              col.key.toLowerCase().includes("rate") ||
              col.key.toLowerCase().includes("dropout")

            if (isRate && typeof v === "number") {
              const [tr, tg, tb] =
                v >= 90 ? [21, 128, 61] : v >= 75 ? [180, 83, 9] : [185, 28, 28]
              const [br, bg2, bb] =
                v >= 90 ? [220, 252, 231] : v >= 75 ? [254, 243, 199] : [254, 226, 226]
              const bText = `${v}%`
              const bw = doc.getTextWidth(bText) + 12
              doc.setFillColor(br, bg2, bb)
              doc.roundedRect(cx + 4, y + 4, bw, 12, 3, 3, "F")
              doc.setFont("helvetica", "bold")
              doc.setFontSize(8)
              doc.setTextColor(tr, tg, tb)
              doc.text(bText, cx + 10, y + 13)
              doc.setFont("helvetica", "normal")
            } else {
              doc.setFont("helvetica", "normal")
              doc.setFontSize(8.5)
              doc.setTextColor(51, 65, 85)
              const maxW = colWidths[_ci] - 10
              const s = String(v)
              const truncated =
                doc.getTextWidth(s) > maxW
                  ? doc.splitTextToSize(s, maxW)[0] + "…"
                  : s
              doc.text(truncated, cx + 5, y + 13)
            }
            cx += colWidths[_ci]
          })
          y += ROW_H
        })

        drawPageFooter()

        // ─── Direct download — no print dialog ────────────────────────────
        doc.save(`${filename}.pdf`)
      } else {
        // CSV / Excel — generate client-side from live data (Excel opens CSV natively)
        const header = reportData.columns.map((c) => `"${c.label}"`).join(",")
        const body   = reportData.rows
          .map((row) =>
            reportData.columns
              .map((c) => {
                const v = row[c.key] ?? ""
                return typeof v === "string" && v.includes(",") ? `"${v}"` : v
              })
              .join(",")
          )
          .join("\n")

        const csv  = `${header}\n${body}`
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = `${filename}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      toast.success(`${currentReport.name} exported · ${exportFormat.toUpperCase()} · ${reportData.totalRows} rows`)
    } catch {
      toast.error("Export failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <PHASidebar />

      <div className="flex-1 overflow-y-auto bg-muted/20">
      <main className="space-y-6 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr,1.3fr]">
          {/* Report Configuration */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" /> Report Configuration
              </CardTitle>
              <CardDescription>Select report type, filters, and export format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Report Type Selection */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Report Type
                </Label>
                <div className="space-y-2">
                  {availableReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedReport === report.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{report.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {report.category}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Region Filter */}
              <div className="space-y-3">
                <Label htmlFor="region-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Region Filter
                </Label>
                <select
                  id="region-filter"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {ghanaRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-3">
                <Label htmlFor="date-range" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Date Range
                </Label>
                <select
                  id="date-range"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="current-month">Current Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="current-quarter">Current Quarter</option>
                  <option value="last-quarter">Last Quarter</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="last-12-months">Last 12 Months</option>
                  <option value="current-year">Current Year ({new Date().getFullYear()})</option>
                  <option value="last-year">Last Year ({new Date().getFullYear() - 1})</option>
                  <option value="all-time">All Time</option>
                  <option value="custom">Custom Range...</option>
                </select>
              </div>

              {/* Export Format */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Export Format
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setExportFormat("csv")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
                      exportFormat === "csv"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-xs font-medium">CSV</span>
                  </button>
                  <button
                    onClick={() => setExportFormat("xlsx")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
                      exportFormat === "xlsx"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="text-xs font-medium">Excel</span>
                  </button>
                  <button
                    onClick={() => setExportFormat("pdf")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
                      exportFormat === "pdf"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <FileDown className="h-5 w-5" />
                    <span className="text-xs font-medium">PDF</span>
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full gap-2"
                size="lg"
              >
                <Download className="h-4 w-4" />
                {isGenerating ? "Generating Report..." : `Generate ${exportFormat.toUpperCase()} Report`}
              </Button>

              {/* Export Guidelines */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium text-primary">📋 Export Guidelines</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>• CSV: Best for data analysis in Excel/R/Python</li>
                  <li>• Excel: Formatted tables with charts (WHO reports)</li>
                  <li>• PDF: Official printable documents for leadership</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Report Preview */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Report Preview
              </CardTitle>
              <CardDescription>
                {currentReport.name} · {selectedRegion} · {dateRange.replace(/-/g, " ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Preview Metadata */}
              <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <dl className="grid gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold text-foreground">Report Type</dt>
                    <dd className="text-muted-foreground">{currentReport.name}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold text-foreground">Category</dt>
                    <dd>
                      <Badge variant="outline">{currentReport.category}</Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold text-foreground">Region</dt>
                    <dd className="text-muted-foreground">{selectedRegion}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold text-foreground">Date Range</dt>
                    <dd className="text-muted-foreground">{dateRange.replace(/-/g, " ")}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold text-foreground">Export Format</dt>
                    <dd className="text-muted-foreground uppercase">{exportFormat}</dd>
                  </div>
                </dl>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-lg border">
                {isPreviewLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading report data…</span>
                  </div>
                ) : previewError ? (
                  <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {previewError}
                  </div>
                ) : reportData && reportData.rows.length > 0 ? (
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/60">
                      <tr>
                        {reportData.columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {reportData.rows.slice(0, 50).map((row, index) => (
                        <tr key={index} className="hover:bg-muted/30">
                          {reportData.columns.map((col) => {
                            const val    = row[col.key]
                            const isPct  =
                              col.key.toLowerCase().includes("coverage") ||
                              col.key.toLowerCase().includes("rate")
                            const isNum  = typeof val === "number"
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 text-sm ${
                                  isPct ? "text-right" : "text-foreground"
                                }`}
                              >
                                {isPct && isNum ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      (val as number) >= 90
                                        ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                                        : (val as number) >= 80
                                        ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                                        : "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                                    }
                                  >
                                    {(val as number).toFixed(1)}%
                                  </Badge>
                                ) : isNum ? (
                                  (val as number).toLocaleString()
                                ) : (
                                  String(val ?? "")
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  !isPreviewLoading && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No data found for the selected filters.
                    </p>
                  )
                )}
              </div>

              {reportData && reportData.rows.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  📄 Previewing first {Math.min(50, reportData.totalRows)} of {reportData.totalRows.toLocaleString()} total rows. Export (PDF/CSV) includes all rows.
                </p>
              )}

              {/* Summary Stats */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                  <p className="text-lg font-bold text-foreground">
                    {isPreviewLoading ? "–" : (reportData?.totalRows ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  {(() => {
                    const entry = reportData?.summary
                      ? Object.entries(reportData.summary).find(([, v]) => typeof v === "number")
                      : null
                    const label = entry
                      ? entry[0]
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (s) => s.toUpperCase())
                          .trim()
                      : "Metric"
                    const value = entry?.[1] as number | undefined
                    const isPercent =
                      !!entry &&
                      (entry[0].toLowerCase().includes("coverage") ||
                        entry[0].toLowerCase().includes("rate"))
                    return (
                      <>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold text-foreground">
                          {isPreviewLoading
                            ? "–"
                            : value !== undefined
                            ? isPercent
                              ? `${value}%`
                              : value.toLocaleString()
                            : "–"}
                        </p>
                      </>
                    )
                  })()}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">File Size (Est.)</p>
                  <p className="text-lg font-bold text-foreground">
                    {(() => {
                      if (isPreviewLoading || !reportData) return "–"
                      // Estimate bytes: each row × columns × avg 8 chars per cell
                      const rows = reportData.totalRows
                      const cols = reportData.columns.length
                      const bytesPerRow = cols * 8
                      const csvBytes = rows * bytesPerRow
                      if (exportFormat === "pdf") {
                        // PDF overhead ~3× a CSV
                        const bytes = csvBytes * 3
                        return bytes > 1_048_576
                          ? `~${(bytes / 1_048_576).toFixed(1)} MB`
                          : `~${Math.max(1, Math.round(bytes / 1024))} KB`
                      }
                      if (exportFormat === "xlsx") {
                        // Excel is roughly 2× CSV
                        const bytes = csvBytes * 2
                        return bytes > 1_048_576
                          ? `~${(bytes / 1_048_576).toFixed(1)} MB`
                          : `~${Math.max(1, Math.round(bytes / 1024))} KB`
                      }
                      // CSV
                      return csvBytes > 1_048_576
                        ? `~${(csvBytes / 1_048_576).toFixed(1)} MB`
                        : `~${Math.max(1, Math.round(csvBytes / 1024))} KB`
                    })()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </div>
  )
}
