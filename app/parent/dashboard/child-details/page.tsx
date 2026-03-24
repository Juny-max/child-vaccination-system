"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Baby, CalendarDays, ClipboardList, Loader2, QrCode, Stethoscope, Users, X, ArrowDownToLine } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useParentDashboard } from "../dashboard-context"
import type { VaccinationRecord } from "@/lib/api/parent"

export default function ChildDetailsPage() {
  const { children, isLoading, getChildVaccinations } = useParentDashboard()
  const [activeChildId, setActiveChildId] = useState<string>("")
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([])
  const [allVaccinations, setAllVaccinations] = useState<VaccinationRecord[]>([])
  const [isLoadingVaccinations, setIsLoadingVaccinations] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [isExportingHistoryPdf, setIsExportingHistoryPdf] = useState(false)
  
  // Set active child when data loads
  useEffect(() => {
    if (children.length > 0 && !activeChildId) {
      setActiveChildId(children[0].id)
    }
  }, [children, activeChildId])

  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0]
  const [isQrOverlayOpen, setIsQrOverlayOpen] = useState(false)
  const [qrIsMounted, setQrIsMounted] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  // Load vaccinations when active child changes
  useEffect(() => {
    async function loadVaccinations() {
      if (!activeChild?.id) return
      setIsLoadingVaccinations(true)
      try {
        const data = await getChildVaccinations(activeChild.id)
        setAllVaccinations(data)
        setVaccinations(data.slice(0, 5)) // Get latest 5 vaccinations for journal
      } catch (error) {
        console.error('Failed to load vaccinations:', error)
        setAllVaccinations([])
        setVaccinations([])
      } finally {
        setIsLoadingVaccinations(false)
      }
    }
    loadVaccinations()
  }, [activeChild?.id, getChildVaccinations])

  const formattedAge = useMemo(() => {
    if (!activeChild) return "--"
    return formatAge(activeChild.dateOfBirth)
  }, [activeChild])

  const qrPayload = useMemo(() => {
    if (!activeChild) return ""
    return JSON.stringify({
      type: "cvcc-child",
      id: activeChild.childId || activeChild.id,
      name: activeChild.name,
      dob: activeChild.dateOfBirth,
    })
  }, [activeChild])

  const fullHistory = useMemo(() => {
    return [...allVaccinations].sort((a, b) => {
      const da = new Date(a.administeredDate).getTime()
      const db = new Date(b.administeredDate).getTime()
      return db - da
    })
  }, [allVaccinations])

  const handleOpenHistoryModal = () => {
    setHistoryModalOpen(true)
  }

  const handleExportHistoryPdf = async () => {
    if (!activeChild || fullHistory.length === 0) return

    setIsExportingHistoryPdf(true)
    try {
      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF({ unit: "pt", format: "a4" })

      const marginX = 48
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let cursorY = 56

      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text("Child Vaccination History", marginX, cursorY)
      cursorY += 22

      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.text(`Child: ${activeChild.name}`, marginX, cursorY)
      cursorY += 16
      doc.text(`Child ID: ${activeChild.childId || activeChild.id}`, marginX, cursorY)
      cursorY += 16
      doc.text(`Exported: ${new Date().toLocaleString()}`, marginX, cursorY)
      cursorY += 22

      doc.setDrawColor(220)
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
      cursorY += 16

      for (const record of fullHistory) {
        const entryLines = [
          `${record.vaccine} (Dose ${record.doseNumber})`,
          `Date: ${formatDate(record.administeredDate)}   Status: ${record.status}`,
          `Facility: ${record.facilityName}`,
          record.batchNumber ? `Batch: ${record.batchNumber}` : "",
          record.administeredBy ? `Administered by: ${record.administeredBy}` : "",
          record.nextDoseDate ? `Next dose date: ${formatDate(record.nextDoseDate)}` : "",
          record.sideEffects ? `Side effects: ${record.sideEffects}` : "",
        ].filter(Boolean)

        const wrapped = entryLines.flatMap((line) => doc.splitTextToSize(line, pageWidth - marginX * 2)) as string[]
        const blockHeight = wrapped.length * 14 + 8

        if (cursorY + blockHeight > pageHeight - 48) {
          doc.addPage()
          cursorY = 56
        }

        doc.setFont("helvetica", "bold")
        doc.text(wrapped[0], marginX, cursorY)
        cursorY += 14
        doc.setFont("helvetica", "normal")

        for (const line of wrapped.slice(1)) {
          doc.text(line, marginX, cursorY)
          cursorY += 14
        }

        cursorY += 8
      }

      const fileSafeName = activeChild.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "child"
      doc.save(`${fileSafeName}-vaccination-history.pdf`)
    } catch (error) {
      console.error("Failed to export vaccination history PDF", error)
    } finally {
      setIsExportingHistoryPdf(false)
    }
  }

  const openQrOverlay = () => {
    if (!activeChild) return
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsQrOverlayOpen(true)
    requestAnimationFrame(() => setQrIsMounted(true))
  }

  const closeQrOverlay = () => {
    setQrIsMounted(false)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsQrOverlayOpen(false)
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Health reminders - could be fetched from API in future
  const healthReminders = [
    "Keep up with tummy-time exercises (10–15 mins daily).",
    "Monitor hydration, especially on hot days.",
    "Introduce pureed fruit after the 6-month check-up.",
    "Book next check-up before 6 weeks pass.",
  ]

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading child details...</span>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>No children registered</CardTitle>
          <CardDescription>
            You don&apos;t have any children registered yet. Please contact your health facility to register your children.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="relative size-16 overflow-hidden rounded-full border border-primary/30">
              {activeChild?.profilePhoto ? (
                <Image
                  src={activeChild.profilePhoto}
                  alt={`${activeChild.name} profile photo`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-primary/10 text-sm text-primary">
                  {activeChild?.name?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Baby className="size-5" /> {activeChild?.name || "Child profile"}
              </CardTitle>
              <CardDescription>
                Review key information about {activeChild?.name?.split(" ")[0] || "your child"}&apos;s health record.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Child ID: {activeChild?.childId || "Not assigned"}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="size-3" /> {children.length} registered child{children.length > 1 ? "ren" : ""}
            </Badge>
            <Button variant="outline" size="sm" className="gap-2" onClick={openQrOverlay}>
              <QrCode className="size-4" /> Show clinic QR
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children.length > 1 ? (
            <div className="flex flex-wrap gap-3">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${child.id === activeChildId ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/40"}`}
                >
                  <div className="relative size-10 overflow-hidden rounded-full border border-border/60">
                    {child.profilePhoto ? (
                      <Image src={child.profilePhoto} alt={`${child.name} avatar`} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-muted text-xs font-semibold uppercase">
                        {child.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{child.age}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {activeChild ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Full name" value={activeChild.name} />
              <Detail label="Age" value={activeChild.age || formattedAge} />
              <Detail label="Height/Length" value={activeChild.length || "Not recorded"} />
              <Detail label="Date of birth" value={formatDate(activeChild.dateOfBirth)} />
              <Detail label="Weight" value={activeChild.weight || "Not recorded"} />
              <Detail label="Blood type" value={activeChild.bloodType || "Not recorded"} />
              <Detail label="Primary facility" value={activeChild.facilityName} />
              <Detail label="Gender" value={activeChild.gender} />
              <Detail label="Registration date" value={formatDate(activeChild.registrationDate)} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="size-5" /> Vaccination history
            </CardTitle>
            <CardDescription>Recent vaccinations from clinic visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {isLoadingVaccinations ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading vaccination records...</span>
              </div>
            ) : vaccinations.length > 0 ? (
              <>
                {vaccinations.map((vax) => (
                  <JournalEntry
                    key={vax.id}
                    date={formatDate(vax.administeredDate || vax.date)}
                    notes={`${vax.vaccine} (Dose ${vax.doseNumber || vax.dose}) administered at ${vax.facilityName || vax.facility}. ${vax.notes || ''}`}
                  />
                ))}
              </>
            ) : (
              <p className="py-4 text-muted-foreground">No vaccination records yet.</p>
            )}
            <Button variant="outline" className="gap-2" onClick={handleOpenHistoryModal}>
              View full vaccination history
              <CalendarDays className="size-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="size-5" /> Care reminders
            </CardTitle>
            <CardDescription>Shared by your nurse after recent visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {healthReminders.map((reminder) => (
              <div key={reminder} className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                {reminder}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {isQrOverlayOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md"
          onClick={closeQrOverlay}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border border-border bg-background/95 p-6 text-center shadow-2xl transition-all duration-200 ${
              qrIsMounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinic scan</p>
                <p className="text-sm font-semibold text-foreground">{activeChild?.name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeQrOverlay}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
                {qrPayload ? <QRCodeSVG value={qrPayload} size={224} /> : <PlaceholderQr />}
              </div>
              <p className="text-xs text-muted-foreground">
                Present this code at any participating clinic. Scanning opens the child record, upcoming vaccines, and visit log.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="size-5" /> Full vaccination history
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {activeChild?.name || "Selected child"} · Child ID: {activeChild?.childId || activeChild?.id || "N/A"}
            </p>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {isLoadingVaccinations ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading full history...
              </div>
            ) : fullHistory.length > 0 ? (
              fullHistory.map((record) => (
                <div key={record.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{record.vaccine} · Dose {record.doseNumber}</p>
                    <Badge variant={record.status === "Completed" ? "secondary" : record.status === "Missed" ? "destructive" : "outline"}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.administeredDate)} · {record.facilityName}</p>
                  {record.administeredBy ? <p className="mt-1 text-xs text-muted-foreground">By: {record.administeredBy}</p> : null}
                  {record.nextDoseDate ? <p className="mt-1 text-xs text-muted-foreground">Next dose: {formatDate(record.nextDoseDate)}</p> : null}
                  {record.batchNumber ? <p className="mt-1 text-xs text-muted-foreground">Batch: {record.batchNumber}</p> : null}
                  {record.sideEffects ? <p className="mt-1 text-xs text-muted-foreground">Side effects: {record.sideEffects}</p> : null}
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No vaccination records available for this child yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleExportHistoryPdf} disabled={isLoadingVaccinations || fullHistory.length === 0 || isExportingHistoryPdf} className="gap-2">
              {isExportingHistoryPdf ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              {isExportingHistoryPdf ? "Exporting PDF..." : "Export as PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type DetailProps = {
  label: string
  value: string
  hint?: string
}

function PlaceholderQr() {
  return (
    <div className="flex h-56 w-56 items-center justify-center bg-muted text-sm text-muted-foreground">
      QR unavailable
    </div>
  )
}

function Detail({ label, value, hint }: DetailProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

type JournalEntryProps = {
  date: string
  notes: string
}

function JournalEntry({ date, notes }: JournalEntryProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{date}</p>
      <p className="mt-2 leading-relaxed text-foreground">{notes}</p>
    </div>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatAge(dateString: string) {
  const dob = new Date(dateString)
  if (Number.isNaN(dob.getTime())) {
    return "--"
  }

  const now = new Date()
  const diffMs = now.getTime() - dob.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const years = Math.floor(diffDays / 365)
  const months = Math.floor((diffDays % 365) / 30)

  if (years >= 1) {
    if (months > 0) {
      return `${years} ${years === 1 ? "year" : "years"} ${months} month${months === 1 ? "" : "s"}`
    }
    return `${years} ${years === 1 ? "year" : "years"}`
  }

  return `${Math.max(months, 0)} month${months === 1 ? "" : "s"}`
}
