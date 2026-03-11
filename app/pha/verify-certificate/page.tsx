"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Camera,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  QrCode,
  FileCheck,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PHASidebar } from "@/components/pha/pha-sidebar"
import { QRScanner } from "@/components/pha/qr-scanner"
import { verifyPHACertificate, type PHACertificateVerifyResult } from "@/lib/api/pha"

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

type LogEntry = {
  time: string
  certificateId: string
  result: "Valid" | "Not Found" | "Revoked" | "Pending"
}

export default function VerifyCertificatePage() {
  const router = useRouter()
  const [certificateId, setCertificateId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    const hasAuth = Boolean(userId || accessToken || legacyToken)
    if (!hasAuth || role !== "staff" || detail !== "pha") {
      router.replace("/auth/login")
    }
  }, [router])

  const runVerify = async (id: string) => {
    setIsVerifying(true)
    setVerificationResult(null)

    try {
      const res: PHACertificateVerifyResult = await verifyPHACertificate(id.trim())

      if (!res.found) {
        setVerificationResult({ status: "not-found", certificateId: id.trim() })
        setLog((prev) => [{ time: "Just now", certificateId: id.trim(), result: "Not Found" }, ...prev.slice(0, 4)])
        toast.error("Certificate not found in system")
      } else if (res.isPending) {
        setVerificationResult({ status: "pending", certificateId: res.certificateId })
        setLog((prev) => [{ time: "Just now", certificateId: id.trim(), result: "Pending" }, ...prev.slice(0, 4)])
        toast.info("Child is registered — vaccination in progress, no certificate issued yet")
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
        setLog((prev) => [{ time: "Just now", certificateId: id.trim(), result: "Revoked" }, ...prev.slice(0, 4)])
        toast.warning("Certificate found but is no longer valid")
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
        setLog((prev) => [{ time: "Just now", certificateId: id.trim(), result: "Valid" }, ...prev.slice(0, 4)])
        toast.success("Certificate verified successfully")
      }
    } catch {
      toast.error("Verification failed. Check your connection and try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerify = () => {
    if (!certificateId.trim()) {
      toast.error("Please enter a certificate ID")
      return
    }
    runVerify(certificateId)
  }

  const handleScanQR = () => {
    setShowQRScanner(!showQRScanner)
    if (!showQRScanner) {
      toast.info("QR Scanner activated. Position the QR code in the camera frame")
    }
  }

  const handleQRScanSuccess = (decodedText: string) => {
    // QR payload format is "certificateId|childId|childName" — extract just the first part
    let certId = decodedText.trim()
    try {
      const parsed = JSON.parse(decodedText)
      certId = parsed.certificateId || parsed.id || certId
    } catch {
      // Not JSON — split on pipe and take first segment
      certId = decodedText.split("|")[0].trim()
    }
    setCertificateId(certId)
    setShowQRScanner(false)
    toast.success(`QR Code detected: ${certId}`)
    setTimeout(() => runVerify(certId), 500)
  }

  const handleReset = () => {
    setCertificateId("")
    setVerificationResult(null)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <PHASidebar />

      <div className="flex-1 overflow-y-auto bg-muted/20">
      <main className="space-y-6 px-6 py-8">
        {/* How It Works */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" /> How Certificate Verification Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>✅ This tool confirms that a digital vaccination certificate is authentic and issued by an authorized facility.</p>
            <p>🔒 For privacy protection, the system only verifies the certificate&apos;s validity - it does NOT display the child&apos;s personal information (name, date of birth, etc.).</p>
            <p>📱 You can verify by entering the Certificate ID manually or by scanning the certificate&apos;s QR code.</p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Verification Input */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" /> Verify Certificate
              </CardTitle>
              <CardDescription>Enter certificate ID or scan QR code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manual Entry */}
              <div className="space-y-3">
                <Label htmlFor="cert-id" className="text-sm font-medium">
                  Certificate ID
                </Label>
                <Input
                  id="cert-id"
                  placeholder="e.g. CERT-GH-2025-001234"
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value.toUpperCase())}
                  className="font-mono text-sm"
                  disabled={isVerifying}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify()
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The certificate ID is printed on the certificate and embedded in the QR code
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  onClick={handleVerify}
                  disabled={isVerifying || !certificateId.trim()}
                  className="gap-2"
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isVerifying ? "Verifying..." : "Verify Certificate"}
                </Button>
                <Button
                  onClick={handleScanQR}
                  variant={showQRScanner ? "destructive" : "outline"}
                  disabled={isVerifying}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {showQRScanner ? "Close Scanner" : "Scan QR Code"}
                </Button>
              </div>

              {verificationResult && (
                <Button onClick={handleReset} variant="ghost" className="w-full gap-2">
                  <QrCode className="h-4 w-4" />
                  Verify Another Certificate
                </Button>
              )}

              {/* QR Scanner Component */}
              <div className="mt-4">
                <div className={showQRScanner ? "block" : "hidden"} aria-hidden={!showQRScanner}>
                  <QRScanner 
                    isActive={showQRScanner}
                    onScanSuccess={handleQRScanSuccess}
                    onScanError={(error) => toast.error(error)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Result */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" /> Verification Result
              </CardTitle>
              <CardDescription>Certificate status and details</CardDescription>
            </CardHeader>
            <CardContent>
              {!verificationResult && !isVerifying && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="mb-4 h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Enter a certificate ID or scan a QR code to verify
                  </p>
                </div>
              )}

              {isVerifying && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Checking database…</p>
                </div>
              )}

              {/* Valid Certificate */}
              {!isVerifying && verificationResult?.status === "valid" && verificationResult.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-green-300 bg-green-50 p-6 dark:bg-green-950/20">
                    <div className="text-center">
                      <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-green-600" />
                      <p className="text-lg font-bold text-green-900 dark:text-green-100">
                        ✓ CERTIFICATE VERIFIED
                      </p>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                        This certificate is authentic and valid
                      </p>
                    </div>
                  </div>

                  {/* Certificate Details */}
                  <div className="rounded-lg border bg-background p-4">
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold text-foreground">Certificate ID</dt>
                        <dd className="font-mono text-sm text-muted-foreground">{verificationResult.certificateId}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold text-foreground">Issued Date</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.issuedDate}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold text-foreground">Completion Status</dt>
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
                              ? "✓ All Mandatory Vaccinations Complete"
                              : "⚠ Partial - Vaccinations In Progress"}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <dt className="font-semibold text-foreground">Issued By</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.issuedBy}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="font-semibold text-foreground">Region</dt>
                        <dd className="text-muted-foreground">{verificationResult.data.region}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Vaccines Completed */}
                  {verificationResult.data.vaccinesCompleted.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vaccines Recorded ({verificationResult.data.vaccinesCompleted.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {verificationResult.data.vaccinesCompleted.map((vaccine) => (
                          <Badge key={vaccine} variant="secondary" className="bg-primary/10 text-primary">
                            {vaccine}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy Notice */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      🔒 For privacy protection, this system does NOT display the child&apos;s name, date of birth, or parent contact information. This verification confirms only that the certificate itself is genuine.
                    </p>
                  </div>
                </div>
              )}

              {/* Revoked Certificate */}
              {!isVerifying && verificationResult?.status === "revoked" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-amber-300 bg-amber-50 p-6 dark:bg-amber-950/20">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto mb-3 h-16 w-16 text-amber-600" />
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                        ⚠ CERTIFICATE REVOKED OR EXPIRED
                      </p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                        This certificate exists but is no longer valid
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <dl className="text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="font-semibold text-foreground">Certificate ID</dt>
                        <dd className="font-mono text-sm text-muted-foreground">{verificationResult.certificateId}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {/* Vaccination In Progress (TEMP- certificate ID) */}
              {!isVerifying && verificationResult?.status === "pending" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-blue-300 bg-blue-50 p-6 dark:bg-blue-950/20">
                    <div className="text-center">
                      <Clock className="mx-auto mb-3 h-16 w-16 text-blue-600" />
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        VACCINATION IN PROGRESS
                      </p>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                        This child is registered in CVCC but has not yet completed their vaccination schedule
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <dl className="text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="font-semibold text-foreground">Reference ID</dt>
                        <dd className="font-mono text-sm text-muted-foreground">{verificationResult.certificateId}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      This is a valid CVCC-registered child. A formal certificate will be issued once all mandatory vaccinations are complete. This ID is <strong>not fraudulent</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Not Found Certificate */}
              {!isVerifying && verificationResult?.status === "not-found" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-red-300 bg-red-50 p-6 dark:bg-red-950/20">
                    <div className="text-center">
                      <XCircle className="mx-auto mb-3 h-16 w-16 text-red-600" />
                      <p className="text-lg font-bold text-red-900 dark:text-red-100">
                        ✗ CERTIFICATE NOT FOUND
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                        This certificate ID is not in our system
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="font-semibold text-foreground">Certificate ID Searched</dt>
                        <dd className="font-mono text-sm text-muted-foreground">{verificationResult.certificateId}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-semibold">This certificate may be fraudulent</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          <li>• The certificate ID does not exist in the Child Vaccination Command Center database</li>
                          <li>• It may be fake, expired, or incorrectly entered</li>
                          <li>• Double-check the ID and try again, or report suspicious certificates to authorities</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Verification Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-4 w-4 text-primary" /> Recent Verifications
            </CardTitle>
            <CardDescription>Certificate verification attempts this session</CardDescription>
          </CardHeader>
          <CardContent>
            {log.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No verifications yet this session.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Certificate ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {log.map((entry, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">{entry.time}</td>
                        <td className="px-4 py-3 font-mono">{entry.certificateId}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              entry.result === "Valid"
                                ? "border-green-300 bg-green-50 text-green-700"
                                : entry.result === "Revoked"
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : entry.result === "Pending"
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-red-300 bg-red-50 text-red-700"
                            }
                          >
                            {entry.result}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
    </div>
  )
}
