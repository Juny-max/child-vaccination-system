"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Filter, 
  Calendar,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  FileDown
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

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

// Mock preview data
const previewData = [
  {
    region: "Greater Accra",
    vaccine: "BCG",
    targetPopulation: 52000,
    vaccinated: 47840,
    coverage: 92.0,
  },
  {
    region: "Greater Accra",
    vaccine: "OPV1",
    targetPopulation: 52000,
    vaccinated: 48360,
    coverage: 93.0,
  },
  {
    region: "Greater Accra",
    vaccine: "DPT1",
    targetPopulation: 52000,
    vaccinated: 47320,
    coverage: 91.0,
  },
  {
    region: "Greater Accra",
    vaccine: "DPT3",
    targetPopulation: 52000,
    vaccinated: 44200,
    coverage: 85.0,
  },
  {
    region: "Ashanti",
    vaccine: "BCG",
    targetPopulation: 68000,
    vaccinated: 60860,
    coverage: 89.5,
  },
]

export default function PHAReportsPage() {
  const [selectedReport, setSelectedReport] = useState(availableReports[0].id)
  const [selectedRegion, setSelectedRegion] = useState("All Regions")
  const [dateRange, setDateRange] = useState("last-12-months")
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv")

  const currentReport = availableReports.find((r) => r.id === selectedReport) || availableReports[0]

  const handleGenerateReport = async () => {
    setIsGenerating(true)

    const reportPayload = {
      reportId: selectedReport,
      reportName: currentReport.name,
      filters: {
        region: selectedRegion,
        dateRange: dateRange,
      },
      exportFormat: exportFormat,
      generatedAt: new Date().toISOString(),
      generatedBy: "Public Health Authority",
    }

    // TODO: Replace with API call to generate and download report
    // Example: POST /api/pha/reports/generate with reportPayload
    
    console.log("Generating report", reportPayload)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      toast.success(
        `${currentReport.name} generated successfully · ${exportFormat.toUpperCase()} · ${selectedRegion}`
      )
      
      // In production, trigger file download here
      // const blob = await response.blob()
      // const url = window.URL.createObjectURL(blob)
      // const a = document.createElement('a')
      // a.href = url
      // a.download = `${selectedReport}-${Date.now()}.${exportFormat}`
      // a.click()
      
    } catch (error) {
      toast.error("Failed to generate report. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/pha/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
                  <Image src="/images/cvcc-logo.png" alt="System logo" fill sizes="40px" className="object-cover" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">National Reports & Exporter</h1>
                  <p className="text-sm text-muted-foreground">Generate official reports for government, WHO, and partners</p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
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
                  <option value="current-year">Current Year (2025)</option>
                  <option value="last-year">Last Year (2024)</option>
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
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Region
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vaccine
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Target Pop.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vaccinated
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Coverage %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {previewData.map((row, index) => (
                      <tr key={index} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm text-foreground">{row.region}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{row.vaccine}</td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {row.targetPopulation.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {row.vaccinated.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <Badge
                            variant="outline"
                            className={
                              row.coverage >= 90
                                ? "border-green-300 bg-green-50 text-green-700"
                                : row.coverage >= 80
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : "border-red-300 bg-red-50 text-red-700"
                            }
                          >
                            {row.coverage.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                📄 Preview shows first 5 rows. Full report will include all data for selected filters.
              </p>

              {/* Summary Stats */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                  <p className="text-lg font-bold text-foreground">247</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Avg Coverage</p>
                  <p className="text-lg font-bold text-foreground">89.9%</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">File Size (Est.)</p>
                  <p className="text-lg font-bold text-foreground">
                    {exportFormat === "pdf" ? "~2.4 MB" : exportFormat === "xlsx" ? "~890 KB" : "~156 KB"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
