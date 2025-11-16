"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { QRCodeCanvas } from "qrcode.react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useParentDashboard } from "./dashboard-context"
import { appointments, certificateRecords, missedVaccinations, vaccinationRecords } from "./data"
import type { VaccinationStatus, CertificateRecord } from "./data"
import { AlertTriangle, Award, CalendarDays, ChevronRight, Clock3, FileDown, QrCode, MessageCircle, Sparkles, Syringe } from "lucide-react"
import { generateCertificatePdf } from "@/lib/certificate-pdf"

export default function ParentDashboardOverview() {
  const { userName } = useParentDashboard()

  const nextAppointment = appointments[0]
  const completedVaccines = vaccinationRecords.filter((record) => record.status === "Complete").length
  const totalVaccines = vaccinationRecords.length
  const upcomingVaccines = vaccinationRecords.filter((record) => record.status === "Upcoming").length
  const onTrackVaccines = vaccinationRecords.filter((record) => record.status === "On Track").length
  const completionPercentage = totalVaccines ? Math.round((completedVaccines / totalVaccines) * 100) : 0
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoDataUrlRef = useRef<string | null>(null)

  const completedCertificates = useMemo(() => {
    return [...certificateRecords]
      .filter((record) => record.completionStatus === "Complete")
      .sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime())
  }, [])

  const latestCertificate = completedCertificates[0]
  const certificateDetails = latestCertificate
    ? [
        { label: "Certificate ID", value: latestCertificate.certificateId },
        { label: "Child", value: `${latestCertificate.childName} (${latestCertificate.childId})` },
        { label: "Issued", value: latestCertificate.issuedDate },
        { label: "Facility", value: latestCertificate.issuedBy },
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

  const handleDownloadCertificate = useCallback(async (record: CertificateRecord) => {
    if (!record) return
    setIsGeneratingPdf(true)
    try {
      const logoDataUrl = await fetchLogoDataUrl()
      const qrDataUrl = qrCanvasRef.current?.toDataURL("image/png")
      await generateCertificatePdf(record, { logoDataUrl, qrDataUrl })
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
              <OverviewStat label="Completed" value={completedVaccines} />
              <OverviewStat label="On track" value={onTrackVaccines} />
              <OverviewStat label="Upcoming" value={upcomingVaccines} />
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
                  <p className="font-medium text-foreground">Last verified</p>
                  <p>{latestCertificate.lastVerified}</p>
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
                      {latestCertificate.vaccinesCompleted.map((vaccine) => (
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
                      value={latestCertificate.qrPayload}
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
            {vaccinationRecords.slice(0, 4).map((record) => (
              <div
                key={`${record.vaccine}-${record.dose}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{record.vaccine}</p>
                  <p className="text-xs text-muted-foreground">Dose {record.dose}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{record.date}</p>
                  <Badge variant={getStatusVariant(record.status)}>{record.status}</Badge>
                </div>
              </div>
            ))}
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
            {missedVaccinations.map((item) => (
              <div
                key={item.vaccine}
                className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.vaccine}</p>
                    <p className="text-xs text-muted-foreground">Due: {item.due}</p>
                  </div>
                  <Badge variant="destructive">{item.daysOverdue} days overdue</Badge>
                </div>
              </div>
            ))}
            <Button asChild className="gap-2" variant="secondary">
              <Link href="/parent/dashboard/missed-vaccinations">
                Review all missed doses
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" /> Next appointment
            </CardTitle>
            <CardDescription>Stay prepared for the next visit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Scheduled for</p>
              <h3 className="text-lg font-semibold">{nextAppointment.date}</h3>
              <p className="text-sm text-muted-foreground">{nextAppointment.time}</p>
              <p className="text-sm text-muted-foreground">{nextAppointment.location}</p>
            </div>
            <p className="text-sm text-muted-foreground">{nextAppointment.notes}</p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/parent/dashboard/appointments">
                Manage appointments
                <Clock3 className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="size-5" /> Need assistance?
            </CardTitle>
            <CardDescription>Chat with our virtual nurse at any time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Get quick answers about post-vaccination care, fever management, upcoming appointments, and how to update your child&apos;s
              information.
            </p>
            <div className="space-y-2 rounded-lg bg-muted/60 p-4">
              <p>• &ldquo;What should I expect after the MMR shot?&rdquo;</p>
              <p>• &ldquo;Send me a reminder three days before the next vaccine.&rdquo;</p>
              <p>• &ldquo;How do I update my child&apos;s allergy information?&rdquo;</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/parent/dashboard/support">
                Open chatbot
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
              <Clock3 className="size-5" /> Service quick links
            </CardTitle>
            <CardDescription>Jump directly to the section you need.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Vaccination record", href: "/parent/dashboard/vaccination-status" },
              { label: "Missed vaccinations", href: "/parent/dashboard/missed-vaccinations" },
              { label: "Child profile", href: "/parent/dashboard/child-details" },
              { label: "Mother profile", href: "/parent/dashboard/mother-details" },
              { label: "Appointments", href: "/parent/dashboard/appointments" },
              { label: "Support center", href: "/parent/dashboard/support" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 hover:border-primary/40 hover:shadow-sm"
              >
                <span>{link.label}</span>
                <ChevronRight className="size-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

type StatusVariant = "default" | "secondary" | "outline"

function OverviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/80 px-4 py-3 shadow-sm">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function getStatusVariant(status: VaccinationStatus): StatusVariant {
  if (status === "Complete") return "default"
  if (status === "On Track") return "secondary"
  return "outline"
}
