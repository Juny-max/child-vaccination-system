"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { QRCodeCanvas } from "qrcode.react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { certificateRecords, type CertificateRecord } from "../data"
import { generateCertificatePdf } from "@/lib/certificate-pdf"
import { Award, FileDown, Lock, QrCode, Sparkles } from "lucide-react"

export default function CertificatesPage() {
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null)
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const logoDataUrlRef = useRef<string | null>(null)

  const counts = useMemo(() => {
    const total = certificateRecords.length
    const complete = certificateRecords.filter((record) => record.completionStatus === "Complete").length
    return {
      total,
      complete,
      pending: total - complete,
    }
  }, [])

  const assignQrRef = useCallback((childId: string, node: HTMLCanvasElement | null) => {
    qrRefs.current[childId] = node
  }, [])

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

  const handleDownload = useCallback(
    async (record: CertificateRecord) => {
      if (record.completionStatus !== "Complete") {
        toast.error("Complete this vaccination schedule to generate a certificate.")
        return
      }
      setIsGeneratingId(record.childId)
      try {
        const logoDataUrl = await fetchLogoDataUrl()
        const qrCanvas = qrRefs.current[record.childId]
        const qrDataUrl = qrCanvas?.toDataURL("image/png")
        await generateCertificatePdf(record, { logoDataUrl, qrDataUrl })
        toast.success(`${record.childName}'s certificate downloaded`)
      } catch (error) {
        console.error("Certificate PDF error", error)
        toast.error("Unable to generate this certificate. Please try again.")
      } finally {
        setIsGeneratingId(null)
      }
    },
    [fetchLogoDataUrl]
  )

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-background to-muted">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 inline-flex items-center gap-1">
              <Sparkles className="size-3" /> Certificate center
            </Badge>
            <CardTitle className="text-2xl">All child certificates</CardTitle>
            <CardDescription>Track completion status and download digital copies for every child on your account.</CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase text-muted-foreground">
            <Stat label="Total" value={counts.total} />
            <Stat label="Completed" value={counts.complete} />
            <Stat label="Pending" value={counts.pending} />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {certificateRecords.map((record) => (
          <Card key={record.certificateId} className="border border-border">
            <CardHeader className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{record.childName}</CardTitle>
                  <CardDescription>Child ID: {record.childId}</CardDescription>
                </div>
                <Badge
                  variant={record.completionStatus === "Complete" ? "secondary" : "outline"}
                  className={record.completionStatus === "Complete" ? "bg-emerald-600 text-white" : "border-amber-400 text-amber-700"}
                >
                  {record.completionStatus === "Complete" ? "Complete" : "Incomplete"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <strong>Issued:</strong> {record.issuedDate}
                </span>
                <span>
                  <strong>Facility:</strong> {record.issuedBy}
                </span>
                <span>
                  <strong>Last verified:</strong> {record.lastVerified}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vaccines recorded</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.vaccinesCompleted.map((vaccine) => (
                    <Badge key={`${record.certificateId}-${vaccine}`} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                      {vaccine}
                    </Badge>
                  ))}
                  {record.vaccinesCompleted.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No entries yet</span>
                  ) : null}
                </div>
              </div>

              {record.completionStatus === "Partial" ? (
                <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="size-4" /> Certificate pending
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    Complete the outstanding doses to unlock this digital certificate.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-border bg-white p-3 shadow-inner">
                    <QRCodeCanvas
                      value={record.qrPayload}
                      size={120}
                      includeMargin
                      ref={(node) => assignQrRef(record.childId, node)}
                      bgColor="#ffffff"
                      fgColor="#111318"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Scan-ready QR</p>
                    <p>Authorities can scan directly from your device.</p>
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit gap-1 bg-primary/10 text-primary">
                  <QrCode className="size-4" /> {record.certificateId}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleDownload(record)}
                  className="gap-2"
                  disabled={record.completionStatus !== "Complete" || isGeneratingId === record.childId}
                >
                  <FileDown className="size-4" />
                  {record.completionStatus !== "Complete"
                    ? "Finish schedule"
                    : isGeneratingId === record.childId
                    ? "Generating..."
                    : "Download PDF"}
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/parent/dashboard/vaccination-status">
                    View vaccination timeline
                    <Award className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

type StatProps = {
  label: string
  value: number
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  )
}
