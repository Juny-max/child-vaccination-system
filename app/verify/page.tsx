"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  QrCode,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QRScanner } from "@/components/shared/qr-scanner"
import type { PHACertificateVerifyResult } from "@/lib/api/pha"

async function verifyCertificate(id: string, token: string): Promise<PHACertificateVerifyResult> {
  const res = await fetch(`/api/verify?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    if (res.status === 401) {
      throw new Error('Verification session expired. Please refresh the page and try again.')
    }
    throw new Error(error.error || 'Verification request failed')
  }
  return res.json()
}

type VerificationResult = {
  status: "valid" | "revoked" | "pending" | "not-found"
  certificateId: string
  data?: {
    issuedDate: string
    completionStatus: string
    vaccinesCompleted: string[]
    issuedBy: string
    region: string
  }
}

export default function PublicVerifyPage() {
  const [certificateId, setCertificateId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [verificationToken, setVerificationToken] = useState<string>("")
  const [tokenError, setTokenError] = useState<string>("")

  // Generate verification token on component mount
  useEffect(() => {
    const generateToken = async () => {
      try {
        const res = await fetch('/api/verify/token', { method: 'POST' })
        if (!res.ok) throw new Error('Failed to generate verification token')
        const data = await res.json()
        setVerificationToken(data.token)
        setTokenError("")
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize verification'
        setTokenError(message)
        toast.error(message)
      }
    }
    generateToken()
  }, [])

  const runVerify = async (id: string) => {
    if (!verificationToken) {
      toast.error("Verification session not initialized. Please refresh the page.")
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    try {
      const res: PHACertificateVerifyResult = await verifyCertificate(id.trim(), verificationToken)

      if (!res.found) {
        setVerificationResult({ status: "not-found", certificateId: id.trim() })
        toast.error("Certificate not found in system")
      } else if (res.isPending) {
        setVerificationResult({ status: "pending", certificateId: res.certificateId })
        toast.info("Child is registered — vaccination in progress")
      } else if (!res.isValid) {
        setVerificationResult({
          status: "revoked",
          certificateId: res.certificateId,
          data: {
            issuedDate: res.issuedDate ?? "",
            completionStatus: res.completionStatus ?? "",
            vaccinesCompleted: res.vaccinesCompleted ?? [],
            issuedBy: res.issuedBy ?? "",
            region: res.region ?? "",
          },
        })
        toast.warning("Certificate exists but is no longer valid")
      } else {
        setVerificationResult({
          status: "valid",
          certificateId: res.certificateId,
          data: {
            issuedDate: res.issuedDate ?? "",
            completionStatus: res.completionStatus ?? "",
            vaccinesCompleted: res.vaccinesCompleted ?? [],
            issuedBy: res.issuedBy ?? "",
            region: res.region ?? "",
          },
        })
        toast.success("Certificate verified successfully")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed. Check your connection and try again."
      toast.error(message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerify = () => {
    if (!verificationToken) {
      toast.error("Verification session not initialized. Please refresh the page.")
      return
    }
    if (!certificateId.trim()) {
      toast.error("Please enter a certificate ID")
      return
    }
    runVerify(certificateId)
  }

  const handleQRScanSuccess = (decodedText: string) => {
    if (!verificationToken) {
      toast.error("Verification session not initialized. Please refresh the page.")
      setShowQRScanner(false)
      return
    }
    let certId = decodedText.trim()
    try {
      const parsed = JSON.parse(decodedText)
      certId = parsed.certificateId || parsed.id || certId
    } catch {
      certId = decodedText.split("|")[0].trim()
    }
    setCertificateId(certId)
    setShowQRScanner(false)
    toast.success(`QR code scanned: ${certId}`)
    setTimeout(() => runVerify(certId), 500)
  }

  const handleReset = () => {
    setCertificateId("")
    setVerificationResult(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="CVCC logo" fill sizes="36px" className="object-cover" />
            </div>
            <span className="hidden text-sm font-semibold sm:block">Child Vaccination Command Center</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Page title */}
        <div className="text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Verify Vaccination Certificate</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Confirm that a child's vaccination certificate is authentic and issued by an authorised facility.
          </p>
        </div>

        {/* Token Error Alert */}
        {tokenError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="flex gap-3 pt-6">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{tokenError}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try refreshing the page or accessing this through the "Verify Certificate" link on the homepage.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" /> How verification works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>✅ This tool confirms a digital vaccination certificate is authentic and issued by an authorised CVCC facility.</p>
            <p>🔒 For privacy protection, the child's name, date of birth, and parent contact details are <strong>never displayed</strong>.</p>
            <p>📱 Enter the Certificate ID printed on the card, or use the QR scanner on this page.</p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" /> Enter certificate details
              </CardTitle>
              <CardDescription>Type the certificate ID or scan the QR code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cert-id">Certificate ID</Label>
                <Input
                  id="cert-id"
                  placeholder="e.g. CERT-GH-2025-001234"
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value.toUpperCase())}
                  className="font-mono text-sm"
                  disabled={isVerifying}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerify() }}
                />
                <p className="text-xs text-muted-foreground">
                  Found on the printed certificate and embedded in the QR code
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleVerify} disabled={isVerifying || !certificateId.trim() || !verificationToken} className="gap-2">
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isVerifying ? "Verifying…" : "Verify"}
                </Button>
                <Button
                  onClick={() => setShowQRScanner((v) => !v)}
                  variant={showQRScanner ? "destructive" : "outline"}
                  disabled={isVerifying || !verificationToken}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {showQRScanner ? "Close scanner" : "Scan QR code"}
                </Button>
              </div>

              {verificationResult && (
                <Button onClick={handleReset} variant="ghost" className="w-full gap-2">
                  <QrCode className="h-4 w-4" />
                  Verify another certificate
                </Button>
              )}

              <div className={showQRScanner ? "block" : "hidden"} aria-hidden={!showQRScanner}>
                <QRScanner
                  isActive={showQRScanner}
                  onScanSuccess={handleQRScanSuccess}
                  onScanError={(error) => toast.error(error)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Result */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" /> Verification result
              </CardTitle>
              <CardDescription>Certificate status and details</CardDescription>
            </CardHeader>
            <CardContent>
              {!verificationResult && !isVerifying && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="mb-4 h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Enter a certificate ID or scan a QR code to begin</p>
                </div>
              )}

              {isVerifying && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Checking database…</p>
                </div>
              )}

              {/* Valid */}
              {!isVerifying && verificationResult?.status === "valid" && verificationResult.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-green-300 bg-green-50 p-6 dark:bg-green-950/20">
                    <div className="text-center">
                      <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-green-600" />
                      <p className="text-lg font-bold text-green-900 dark:text-green-100">✓ CERTIFICATE VERIFIED</p>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-400">This certificate is authentic and valid</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold">Certificate ID</dt>
                        <dd className="font-mono text-xs text-muted-foreground">{verificationResult.certificateId}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold">Issued date</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.issuedDate}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold">Status</dt>
                        <dd>
                          <Badge
                            variant="outline"
                            className={
                              verificationResult.data.completionStatus === "Complete"
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "border-amber-300 bg-amber-50 text-amber-700"
                            }
                          >
                            {verificationResult.data.completionStatus === "Complete"
                              ? "✓ All mandatory vaccinations complete"
                              : "⚠ Partial — vaccinations in progress"}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold">Issued by</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.issuedBy}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-semibold">Region</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.region}</dd>
                      </div>
                    </dl>
                  </div>
                  {verificationResult.data.vaccinesCompleted.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vaccines recorded ({verificationResult.data.vaccinesCompleted.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {verificationResult.data.vaccinesCompleted.map((v) => (
                          <Badge key={v} variant="secondary" className="bg-primary/10 text-primary">{v}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      🔒 For privacy protection, this system does not display the child's name, date of birth, or parent contact information.
                    </p>
                  </div>
                </div>
              )}

              {/* Revoked */}
              {!isVerifying && verificationResult?.status === "revoked" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-amber-300 bg-amber-50 p-6 dark:bg-amber-950/20">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto mb-3 h-16 w-16 text-amber-600" />
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-100">⚠ CERTIFICATE REVOKED OR EXPIRED</p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">This certificate exists but is no longer valid</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Certificate ID</span>
                      <span className="font-mono text-xs text-muted-foreground">{verificationResult.certificateId}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending */}
              {!isVerifying && verificationResult?.status === "pending" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-blue-300 bg-blue-50 p-6 dark:bg-blue-950/20">
                    <div className="text-center">
                      <Clock className="mx-auto mb-3 h-16 w-16 text-blue-600" />
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">VACCINATION IN PROGRESS</p>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                        This child is registered in CVCC but has not yet completed their vaccination schedule
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Reference ID</span>
                      <span className="font-mono text-xs text-muted-foreground">{verificationResult.certificateId}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      This is a valid CVCC-registered child. A formal certificate will be issued once all mandatory vaccinations are complete. This ID is <strong>not fraudulent</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Not found */}
              {!isVerifying && verificationResult?.status === "not-found" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-red-300 bg-red-50 p-6 dark:bg-red-950/20">
                    <div className="text-center">
                      <XCircle className="mx-auto mb-3 h-16 w-16 text-red-600" />
                      <p className="text-lg font-bold text-red-900 dark:text-red-100">✗ CERTIFICATE NOT FOUND</p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">This ID is not in our system</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-semibold">This certificate may be fraudulent</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          <li>• The ID does not exist in the CVCC database</li>
                          <li>• It may be fake, expired, or incorrectly entered</li>
                          <li>• Double-check and try again, or report it to authorities</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="mt-16 border-t border-border bg-background py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Ghana Health Service · Child Vaccination Command Center</p>
        <p className="mt-1">
          <Link href="/" className="underline-offset-2 hover:underline">Back to home</Link>
          {" · "}
          <Link href="/auth/login" className="underline-offset-2 hover:underline">Portal login</Link>
        </p>
      </footer>
    </div>
  )
}
