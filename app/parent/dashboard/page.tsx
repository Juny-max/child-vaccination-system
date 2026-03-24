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
import { AlertTriangle, Award, CalendarDays, ChevronRight, Clock3, FileDown, QrCode, Sparkles, Syringe } from "lucide-react"
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

export default function ParentDashboardOverview() {
  const { userName, dashboard, appointments, certificates, missedVaccinations } = useParentDashboard()

  // Calculate stats from dashboard data
  const childrenData = dashboard?.children || []
  const totalCompleted = childrenData.reduce((sum, child) => sum + child.vaccinationProgress.completed, 0)
  const totalVaccines = childrenData.reduce((sum, child) => sum + child.vaccinationProgress.total, 0)
  const upcomingCount = childrenData.filter((child) => child.nextVaccination).length
  const onTrackCount = childrenData.filter((child) => !child.hasMissedVaccinations && child.vaccinationProgress.percentage > 0).length
  const completionPercentage = totalVaccines ? Math.round((totalCompleted / totalVaccines) * 100) : 0

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

  const nextAppointmentChild = useMemo(() => {
    if (!nextAppointment) return null
    return childrenData.find((child) => child.id === nextAppointment.childId) ?? null
  }, [childrenData, nextAppointment])

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoDataUrlRef = useRef<string | null>(null)

  const completedCertificates = useMemo(() => {
    return [...certificates]
      .filter((record) => record.completionStatus === "Complete")
      .sort((a, b) => new Date(b.issuedDate || 0).getTime() - new Date(a.issuedDate || 0).getTime())
  }, [certificates])

  const latestCertificate = completedCertificates[0]
  const certificateDetails = latestCertificate
    ? [
        { label: "Certificate ID", value: latestCertificate.certificateId },
        { label: "Child", value: `${latestCertificate.childName} (${latestCertificate.childId})` },
        { label: "Issued", value: latestCertificate.issuedDate || "N/A" },
        { label: "Facility", value: latestCertificate.issuedBy || "N/A" },
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
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/10 to-muted">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 inline-flex items-center gap-1">
                <Sparkles className="size-3" /> Personalized overview
              </Badge>
              <CardTitle className="text-2xl lg:text-3xl">Hello {userName}, here&apos;s your child&apos;s progress</CardTitle>
              <CardDescription className="mt-2 text-base">
                Keep track of completed vaccinations, upcoming appointments, and areas that need your attention.
              </CardDescription>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <OverviewStat label="Completed" value={totalCompleted} />
              <OverviewStat label="On track" value={onTrackCount} />
              <OverviewStat label="Upcoming" value={upcomingCount} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md bg-background/80 p-4 text-sm text-muted-foreground">
              <p>
                Your child has completed <span className="font-semibold text-foreground">{completionPercentage}%</span> of the
                recommended vaccine schedule. Review the full timeline or schedule make-up visits any time.
              </p>
            </div>
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
                    <QRCodeCanvas
                      value={latestCertificate.qrPayload || latestCertificate.certificateId}
                      size={180}
                      includeMargin
                      ref={qrCanvasRef}
                      bgColor="#ffffff"
                      fgColor="#111318"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Public Health Authorities can scan this QR directly from your device to confirm authenticity.
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
              missedVaccinations.map((item, index) => (
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" /> Next appointment
            </CardTitle>
            <CardDescription>Stay prepared for the next visit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextAppointment ? (
              <>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">Scheduled for</p>
                  <h3 className="text-lg font-semibold">{formatAppointmentDate(nextAppointment.scheduledDate)}</h3>
                  <p className="text-sm text-muted-foreground">{formatAppointmentTime(nextAppointment.scheduledTime)}</p>
                  <p className="text-sm text-muted-foreground">{nextAppointment.facilityName || "Facility pending assignment"}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Child:</span>{" "}
                    <span className="font-medium text-foreground">{nextAppointment.childName || nextAppointmentChild?.name || "Not specified"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Child ID:</span>{" "}
                    <span className="font-medium text-foreground">{nextAppointment.childCvccId || nextAppointment.childId}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Vaccine:</span>{" "}
                    <span className="font-medium text-foreground">{nextAppointment.vaccineName || "General health visit"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Purpose:</span>{" "}
                    <span className="font-medium text-foreground">{nextAppointment.purpose}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant={nextAppointment.status === "confirmed" ? "default" : "secondary"}>
                      {nextAppointment.status === "confirmed" ? "Confirmed" : "Pending review"}
                    </Badge>
                  </p>
                  {nextAppointment.facilityPhone ? (
                    <p>
                      <span className="text-muted-foreground">Facility contact:</span>{" "}
                      <span className="font-medium text-foreground">{nextAppointment.facilityPhone}</span>
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming appointments scheduled.</p>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link href="/parent/dashboard/appointments">
                Manage appointments
                <Clock3 className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function OverviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/80 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
