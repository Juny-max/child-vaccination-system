"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Columns, Download, Filter, LayoutList, ListChecks, PlusCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const dataSources = [
  { id: "child-coverage", label: "Child coverage summary" },
  { id: "missed-vaccinations", label: "Missed vaccinations" },
  { id: "facility-performance", label: "Facility performance" },
]

const availableColumns = [
  "Child ID",
  "Child name",
  "Facility",
  "District",
  "Vaccine",
  "Dose number",
  "Due date",
  "Completion date",
  "CHW owner",
]

const filterPresets = [
  {
    id: "overdue",
    label: "Overdue doses",
    description: "Where completion date is empty and due date is older than today",
  },
  {
    id: "district",
    label: "Specific district",
    description: "Filter by district or catchment name",
  },
  {
    id: "vaccine",
    label: "By vaccine",
    description: "Focus on a single vaccine code (e.g. MR1, BCG)",
  },
]

const previewRows = [
  {
    childId: "CH-5531",
    name: "Esi Mensah",
    facility: "Accra Central",
    district: "Accra Metro",
    vaccine: "MR1",
    due: "2025-11-09",
    status: "Overdue",
  },
  {
    childId: "CH-5582",
    name: "Yaw Boateng",
    facility: "Tema Polyclinic",
    district: "Tema",
    vaccine: "Penta-2",
    due: "2025-11-12",
    status: "Scheduled",
  },
  {
    childId: "CH-5601",
    name: "Efua Sarpong",
    facility: "Ashaiman Clinic",
    district: "Ashaiman",
    vaccine: "BCG",
    due: "2025-11-01",
    status: "Completed",
  },
]

const savedReports = [
  {
    id: "accra-overdue",
    name: "Accra North · Measles backlog · Last 14 days",
    updated: "Updated 2 days ago",
  },
  {
    id: "northern-catchup",
    name: "Northern Region catch-up · Penta1",
    updated: "Updated 4 days ago",
  },
]

const exportFormats = [
  { id: "csv", label: "CSV", description: "Best for spreadsheets and quick QA." },
  { id: "xlsx", label: "Excel", description: "Preserve formatting for pivot analysis." },
  { id: "pdf", label: "PDF", description: "Static briefing packs for leadership." },
]

export default function Reports() {
  const [source, setSource] = useState(dataSources[0].id)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["Child ID", "Child name", "Facility", "Vaccine", "Due date"])
  const [customFilter, setCustomFilter] = useState("district = 'Accra Metro'")
  const [activePreset, setActivePreset] = useState(filterPresets[0].id)
  const [exportFormat, setExportFormat] = useState(exportFormats[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const columnCount = useMemo(() => selectedColumns.length, [selectedColumns])

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]))
  }

  const resetConfiguration = () => {
    setSource(dataSources[0].id)
    setSelectedColumns(["Child ID", "Child name", "Facility", "Vaccine", "Due date"])
    setActivePreset(filterPresets[0].id)
    setExportFormat(exportFormats[0].id)
    setCustomFilter("status = 'Overdue'")
  }

  const handleSaveConfiguration = async () => {
    setIsSaving(true)
    const payload = {
      source,
      columns: selectedColumns,
      filter: customFilter,
      preset: activePreset,
      exportFormat,
    }

  // TODO: Replace with API integration
    console.log("Staging configuration save", payload)

    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      toast.success(`Configuration ready for persistence · ${selectedColumns.length} columns · ${exportFormat.toUpperCase()} export`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    const payload = {
      source,
      columns: selectedColumns,
      filter: customFilter,
      format: exportFormat,
      rowCount: previewRows.length,
    }

  // TODO: Replace with real export trigger
    console.log("Preparing export", payload)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success(`Export job queued · ${exportFormat.toUpperCase()} · ${selectedColumns.length} fields`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft size={16} />
                Back to dashboard
              </Button>
            </Link>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Custom report generator</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveConfiguration} disabled={isSaving || isExporting}>
              <LayoutList size={14} /> {isSaving ? "Saving…" : "Save configuration"}
            </Button>
            <Button className="gap-2" onClick={handleExport} disabled={isExporting || isSaving}>
              <Download size={16} /> {isExporting ? "Exporting…" : `Export ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <section className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Columns className="h-5 w-5 text-primary" /> Build your extract
              </CardTitle>
              <CardDescription>Select the data set, visible fields, and filters before exporting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data source</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {dataSources.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSource(option.id)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        source === option.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Columns ({columnCount} selected)</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {availableColumns.map((column) => (
                    <button
                      key={column}
                      onClick={() => toggleColumn(column)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        selectedColumns.includes(column)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {column}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Filters</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {filterPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setActivePreset(preset.id)
                        if (preset.id === "overdue") setCustomFilter("status = 'Overdue'")
                        if (preset.id === "district") setCustomFilter("district = 'Accra Metro'")
                        if (preset.id === "vaccine") setCustomFilter("vaccine = 'MR1'")
                      }}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        activePreset === preset.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-medium">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-input" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Advanced filter (SQL-like syntax)
                  </Label>
                  <Input id="filter-input" value={customFilter} onChange={(event) => setCustomFilter(event.target.value)} placeholder="status = 'Overdue' AND district = 'Accra Metro'" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Export format</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {exportFormats.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        exportFormat === format.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <p className="font-medium uppercase">{format.label}</p>
                      <p className="text-xs text-muted-foreground">{format.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-primary" /> Saved report recipes
                </CardTitle>
                <CardDescription>Reuse common extracts shared across the data team.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {savedReports.map((report) => (
                  <div key={report.id} className="rounded-lg border border-border bg-background/80 p-3">
                    <p className="font-medium text-foreground">{report.name}</p>
                    <p className="text-xs text-muted-foreground">{report.updated}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={resetConfiguration} disabled={isSaving || isExporting}>
                  <PlusCircle className="h-4 w-4" /> New blank configuration
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-dashed border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4 text-primary" /> Export guidance
                </CardTitle>
                <CardDescription>Confirm filters and distribution before sending to HQ.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>• CSV for quick spreadsheet review (under 50k rows).</p>
                <p>• Excel for pivot-ready extracts with formatting.</p>
                <p>• PDF when sharing static coverage snapshots with leadership.</p>
                <p className="text-muted-foreground/80">All exports include timestamp, filter summary, and Data Officer ID.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutList className="h-5 w-5 text-primary" /> Preview ({previewRows.length} rows)
            </CardTitle>
            <CardDescription>The first few rows of your extract respecting current filters.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Child ID</th>
                  <th className="px-3 py-2 text-left">Child name</th>
                  <th className="px-3 py-2 text-left">Facility</th>
                  <th className="px-3 py-2 text-left">District</th>
                  <th className="px-3 py-2 text-left">Vaccine</th>
                  <th className="px-3 py-2 text-left">Due date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/60 text-foreground">
                {previewRows.map((row) => (
                  <tr key={row.childId}>
                    <td className="px-3 py-2 font-mono text-xs">{row.childId}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.facility}</td>
                    <td className="px-3 py-2">{row.district}</td>
                    <td className="px-3 py-2">{row.vaccine}</td>
                    <td className="px-3 py-2">{row.due}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
