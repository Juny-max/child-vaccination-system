"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { QRCodeCanvas } from "qrcode.react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useParentDashboard } from "./dashboard-context"
import type { Certificate } from "@/lib/api/parent"
import { AlertTriangle, Award, CalendarDays, ChevronRight, Clock3, FileDown, QrCode, Syringe } from "lucide-react"
import { generateCertificatePdf } from "@/lib/certificate-pdf"

function toAppointmentDateTime(date: string, time?: string): Date {
  const normalizedTime = time && time !== "TBD" ? time : "00:00:00"
  return new Date(`${date}T${normalizedTime}`)
}

function formatAppointmentDate(date: string): string {
  if (!date) return "Not set"
  const parsed = toAppointmentDateTime(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatAppointmentTime(time?: string): string {
  if (!time || time === "TBD") return "Time TBD"
  const [hoursRaw, minutesRaw = "00"] = time.split(":")
  const hours = Number.parseInt(hoursRaw, 10)
  if (Number.isNaN(hours)) return time
  const ampm = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutesRaw} ${ampm}`
}

function getIssuedDateTimestamp(issuedDate?: string): number | null {
  if (!issuedDate) return null
  const normalized = issuedDate.trim().toLowerCase()
  if (!normalized || normalized === "not issued yet" || normalized === "n/a") return null
  const timestamp = new Date(issuedDate).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export default function ParentDashboardOverview() {
  const { userName, dashboard, appointments, certificates, missedVaccinations } = useParentDashboard()

  // Core dashboard data for overview cards
  const childrenData = dashboard?.children || []

  const nextAppointment = useMemo(() => {
    const activeAppointments = appointments.filter((appointment) =>
      ["scheduled", "confirmed"].includes(appointment.status),
    )

    return activeAppointments.sort((first, second) => {
      const firstDate = toAppointmentDateTime(first.scheduledDate, first.scheduledTime).getTime()
      const secondDate = toAppointmentDateTime(second.scheduledDate, second.scheduledTime).getTime()
      return firstDate - secondDate
    })[0]
  }, [appointments])

  const latestMissedAppointment = useMemo(() => {
    const missedAppointments = appointments.filter((appointment) => appointment.status === "missed")

    return missedAppointments.sort((first, second) => {
      const firstDate = toAppointmentDateTime(first.scheduledDate, first.scheduledTime).getTime()
      const secondDate = toAppointmentDateTime(second.scheduledDate, second.scheduledTime).getTime()
      return secondDate - firstDate
    })[0]
  }, [appointments])

  const nextAppointmentChild = useMemo(() => {
    if (!nextAppointment) return null
    return childrenData.find((child) => child.id === nextAppointment.childId) ?? null
  }, [childrenData, nextAppointment])

  const latestMissedAppointmentChild = useMemo(() => {
    if (!latestMissedAppointment) return null
    return childrenData.find((child) => child.id === latestMissedAppointment.childId) ?? null
  }, [childrenData, latestMissedAppointment])

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoDataUrlRef = useRef<string | null>(null)

  const completedCertificates = useMemo(() => {
    return [...certificates]
      .filter((record) => record.completionStatus === "Complete")
      .sort((a, b) => {
        const aIssuedAt = getIssuedDateTimestamp(a.issuedDate)
        const bIssuedAt = getIssuedDateTimestamp(b.issuedDate)

        // Always prioritize certificates with real issued dates over placeholders.
        if (aIssuedAt === null && bIssuedAt !== null) return 1
        if (aIssuedAt !== null && bIssuedAt === null) return -1

        if (aIssuedAt !== null && bIssuedAt !== null) {
          return bIssuedAt - aIssuedAt
        }

        return b.certificateId.localeCompare(a.certificateId)
      })
  }, [certificates])

  const latestCertificate = completedCertificates[0]
  const certificateDetails = latestCertificate
    ? [
        { label: "Certificate ID", value: latestCertificate.certificateId },
        { label: "Child", value: `${latestCertificate.childName} (${latestCertificate.childId})` },
        { label: "Issued", value: latestCertificate.issuedDate || "N/A" },
        { label: "Facility", value: latestCertificate.issuedByFacility || latestCertificate.issuedBy || "N/A" },
      ]
    : []


  const fetchLogoDataUrl = useCallback(async () => {
    if (logoDataUrlRef.current) return logoDataUrlRef.current
    try {
      const response = await fetch("/images/cvcc-logo.png")
      if (!response.ok) throw new Error("Logo fetch failed")
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read logo"))
        reader.readAsDataURL(blob)
      })
      logoDataUrlRef.current = dataUrl
      return dataUrl
    } catch (error) {
      console.error("Logo load error", error)
      return null
    }
  }, [])

  const handleDownloadCertificate = useCallback(async (record: Certificate) => {
    if (!record) return
    setIsGeneratingPdf(true)
    try {
      const logoDataUrl = await fetchLogoDataUrl()
      const qrDataUrl = qrCanvasRef.current?.toDataURL("image/png")
      // Convert API Certificate to the format expected by generateCertificatePdf
      const certRecord = {
        certificateId: record.certificateId,
        childId: record.childId,
        childName: record.childName,
        completionStatus: record.completionStatus as "Complete" | "Partial",
        issuedDate: record.issuedDate || "",
        validUntil: record.validUntil || "",
        issuedBy: record.issuedByFacility || record.issuedBy || "",
        vaccinesCompleted: record.vaccinesCompleted || record.vaccines || [],
        qrPayload: record.qrPayload || "",
        lastVerified: record.lastVerified || new Date().toLocaleDateString(),
      }
      await generateCertificatePdf(certRecord, { logoDataUrl, qrDataUrl })
      toast.success("Certificate PDF downloaded")
    } catch (error) {
      console.error("Certificate PDF error", error)
      toast.error("Unable to generate certificate PDF. Please try again.")
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [fetchLogoDataUrl])

  return (
    <div className="space-y-6 lg:space-y-8">
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" /> Next appointment
            </CardTitle>
            <CardDescription>Stay prepared for the next visit and track missed visits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Next</p>
                {nextAppointment ? (
                  <Badge variant={nextAppointment.status === "confirmed" ? "default" : "secondary"}>
                    {nextAppointment.status === "confirmed" ? "Confirmed" : "Pending review"}
                  </Badge>
                ) : null}
              </div>
              {nextAppointment ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Scheduled for</p>
                  <h3 className="text-lg font-semibold">{formatAppointmentDate(nextAppointment.scheduledDate)}</h3>
                  <p className="text-sm text-muted-foreground">{formatAppointmentTime(nextAppointment.scheduledTime)}</p>
                  <p className="text-sm text-muted-foreground">{nextAppointment.facilityName || "Facility pending assignment"}</p>
                  <p className="text-xs text-muted-foreground">
                    {nextAppointment.childName || nextAppointmentChild?.name || "Not specified"} • {nextAppointment.childCvccId || nextAppointment.childId}
                  </p>
                  <p className="text-xs text-muted-foreground">{nextAppointment.vaccineName || nextAppointment.purpose || "General health visit"}</p>
                  {nextAppointment.facilityPhone ? (
                    <p className="text-xs text-muted-foreground">Facility contact: {nextAppointment.facilityPhone}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming appointments scheduled.</p>
              )}
            </div>

            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Missed</p>
                {latestMissedAppointment ? (
                  <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 text-orange-500">
                    Missed
                  </Badge>
                ) : null}
              </div>
              {latestMissedAppointment ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Was scheduled for</p>
                  <h3 className="text-lg font-semibold">{formatAppointmentDate(latestMissedAppointment.scheduledDate)}</h3>
                  <p className="text-sm text-muted-foreground">{formatAppointmentTime(latestMissedAppointment.scheduledTime)}</p>
                  <p className="text-sm text-muted-foreground">{latestMissedAppointment.facilityName || "Facility pending assignment"}</p>
                  <p className="text-xs text-muted-foreground">
                    {latestMissedAppointment.childName || latestMissedAppointmentChild?.name || "Not specified"} • {latestMissedAppointment.childCvccId || latestMissedAppointment.childId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestMissedAppointment.vaccineName || latestMissedAppointment.purpose || "General health visit"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No missed appointments.</p>
              )}
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/parent/dashboard/appointments">
                Manage appointments
                <Clock3 className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[3fr,2fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Syringe className="size-5" /> Recent vaccinations
              </CardTitle>
              <CardDescription>Summary of your child&apos;s latest vaccine activity</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/parent/dashboard/vaccination-status">
                View full record
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {childrenData.length > 0 ? (
              childrenData.slice(0, 4).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{child.age}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{child.vaccinationProgress.completed}/{child.vaccinationProgress.total} vaccines</p>
                    <Badge variant={child.vaccinationProgress.percentage >= 80 ? "default" : child.vaccinationProgress.percentage >= 50 ? "secondary" : "outline"}>
                      {child.vaccinationProgress.percentage}% complete
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No vaccination records found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5" /> Missed reminders
            </CardTitle>
            <CardDescription>Action items that need your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {missedVaccinations.length > 0 ? (
              missedVaccinations.slice(0, 4).map((item, index) => (
                <div
                  key={`${item.childId}-${item.vaccine}-${index}`}
                  className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.vaccine}</p>
                      <p className="text-xs text-muted-foreground">{item.childName} • Due: {item.dueDate}</p>
                    </div>
                    <Badge variant="destructive">{item.daysOverdue} days overdue</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No missed vaccinations. Great job!</p>
            )}
            <Button asChild className="gap-2" variant="secondary">
              <Link href="/parent/dashboard/missed-vaccinations">
                Review all missed doses
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg">
          {latestCertificate ? (
            <>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <Badge variant="outline" className="inline-flex items-center gap-1 border-primary/40 text-primary">
                    <Award className="size-4" /> Latest completed certificate
                  </Badge>
                  <CardTitle className="text-2xl">Digital certificate for {latestCertificate.childName}</CardTitle>
                  <CardDescription>Show this on your phone or download a PDF copy for official checks.</CardDescription>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Issued</p>
                  <p>{latestCertificate.issuedDate || "N/A"}</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[3fr,2fr]">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                      ID: {latestCertificate.certificateId}
                    </Badge>
                    <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
                      {latestCertificate.completionStatus}
                    </Badge>
                  </div>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    {certificateDetails.map((detail) => (
                      <div key={detail.label}>
                        <dt className="text-muted-foreground">{detail.label}</dt>
                        <dd className="font-semibold text-foreground">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vaccines recorded</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(latestCertificate.vaccines ?? []).map((vaccine) => (
                        <Badge key={vaccine} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                          {vaccine}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => handleDownloadCertificate(latestCertificate)}
                      className="gap-2"
                      disabled={isGeneratingPdf}
                    >
                      <FileDown className="size-4" />
                      {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                      <Link href="/parent/dashboard/certificates">
                        View all certificates
                        <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-background/80 p-6 text-center">
                  <Badge variant="secondary" className="mb-3 gap-1 bg-primary/10 text-primary">
                    <QrCode className="size-4" /> Scan-ready QR
                  </Badge>
                  <div className="rounded-xl border border-border bg-white p-4 shadow-inner">
                    {latestCertificate.qrPayload ? (
                      <QRCodeCanvas
                        value={latestCertificate.qrPayload}
                        size={180}
                        includeMargin
                        ref={qrCanvasRef}
                        bgColor="#ffffff"
                        fgColor="#111318"
                      />
                    ) : (
                      <div className="flex h-[180px] w-[180px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                        QR unavailable
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Show this QR to schools, clinics or any institution to verify your child's vaccination.
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col gap-4">
              <Badge variant="outline" className="w-fit gap-1 border-amber-300 text-amber-700">
                <Award className="size-4" /> Certificates locked
              </Badge>
              <CardTitle className="text-2xl">Complete a schedule to unlock certificates</CardTitle>
              <CardDescription>
                Finish at least one child&apos;s vaccination journey to generate the official certificate. You can still see progress for
                each child below.
              </CardDescription>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="gap-2">
                  <Link href="/parent/dashboard/vaccination-status">
                    Go to vaccination status
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/parent/dashboard/certificates">
                    View certificate tracker
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </section>
    </div>
  )
}
