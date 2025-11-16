"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowLeft, 
  Camera,
  CheckCircle2,
  Search,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  QrCode,
  FileCheck
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { QRScanner } from "@/components/pha/qr-scanner"

// Mock certificate database (in production, this would be an API call)
const mockCertificateDatabase = {
  "CERT-GH-2025-001234": {
    isValid: true,
    issuedDate: "2025-09-15",
    completionStatus: "Complete",
    vaccinesCompleted: ["BCG", "OPV0", "OPV1", "OPV2", "OPV3", "DPT1", "DPT2", "DPT3", "MR1"],
    issuedBy: "Korle Bu Teaching Hospital",
    region: "Greater Accra",
  },
  "CERT-GH-2025-005678": {
    isValid: true,
    issuedDate: "2025-10-22",
    completionStatus: "Partial",
    vaccinesCompleted: ["BCG", "OPV0", "OPV1", "DPT1"],
    issuedBy: "Komfo Anokye Teaching Hospital",
    region: "Ashanti",
  },
  "CERT-GH-2024-099888": {
    isValid: true,
    issuedDate: "2024-12-10",
    completionStatus: "Complete",
    vaccinesCompleted: ["BCG", "OPV0", "OPV1", "OPV2", "OPV3", "DPT1", "DPT2", "DPT3", "MR1", "Yellow Fever"],
    issuedBy: "Ridge Hospital",
    region: "Greater Accra",
  },
}

type VerificationResult = {
  status: "valid" | "invalid" | "not-found"
  certificateId: string
  data?: {
    issuedDate: string
    completionStatus: string
    vaccinesCompleted: string[]
    issuedBy: string
    region: string
  }
}

export default function VerifyCertificatePage() {
  const [certificateId, setCertificateId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)

  const handleVerify = async () => {
    if (!certificateId.trim()) {
      toast.error("Please enter a certificate ID")
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    const verifyPayload = {
      certificateId: certificateId.trim(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: "Public Health Authority",
      verificationMethod: "manual-entry",
    }

  // TODO: Replace with API call to verify certificate
  // Example: POST /api/pha/certificates/verify with verifyPayload
    console.log("Verifying certificate", verifyPayload)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Mock verification logic
      const certData = mockCertificateDatabase[certificateId.trim() as keyof typeof mockCertificateDatabase]

      if (certData) {
        setVerificationResult({
          status: "valid",
          certificateId: certificateId.trim(),
          data: certData,
        })
        toast.success("Certificate verified successfully")
      } else {
        setVerificationResult({
          status: "not-found",
          certificateId: certificateId.trim(),
        })
        toast.error("Certificate not found in system")
      }
    } catch (error) {
      toast.error("Verification failed. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleScanQR = () => {
    setShowQRScanner(!showQRScanner)
    if (!showQRScanner) {
      toast.info("QR Scanner activated. Position the QR code in the camera frame")
    }
  }

  const handleQRScanSuccess = (decodedText: string) => {
    setCertificateId(decodedText)
    setShowQRScanner(false)
    toast.success(`QR Code detected: ${decodedText}`)
    // Auto-verify after successful scan
    setTimeout(() => {
      const verifyWithScannedId = async () => {
        setIsVerifying(true)
        setVerificationResult(null)

        const verifyPayload = {
          certificateId: decodedText.trim(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: "Public Health Authority",
          verificationMethod: "qr-scan",
        }

        console.log("Verifying certificate", verifyPayload)

        try {
          await new Promise((resolve) => setTimeout(resolve, 800))

          const certData = mockCertificateDatabase[decodedText.trim() as keyof typeof mockCertificateDatabase]

          if (certData) {
            setVerificationResult({
              status: "valid",
              certificateId: decodedText.trim(),
              data: certData,
            })
            toast.success("Certificate verified successfully")
          } else {
            setVerificationResult({
              status: "not-found",
              certificateId: decodedText.trim(),
            })
            toast.error("Certificate not found in system")
          }
        } catch (error) {
          toast.error("Verification failed. Please try again.")
        } finally {
          setIsVerifying(false)
        }
      }
      verifyWithScannedId()
    }, 500)
  }

  const handleReset = () => {
    setCertificateId("")
    setVerificationResult(null)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
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
                  <h1 className="text-xl font-bold text-foreground">Certificate Verification</h1>
                  <p className="text-sm text-muted-foreground">Anti-fraud tool · Verify digital vaccination certificates</p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
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
                    if (e.key === "Enter") {
                      handleVerify()
                    }
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
                  <Search className="h-4 w-4" />
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

              {/* Sample Certificate IDs for Testing */}
              {!showQRScanner && (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
                  <p className="text-xs font-semibold text-muted-foreground">🧪 Test Certificate IDs</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="font-mono">• CERT-GH-2025-001234 (Complete)</li>
                    <li className="font-mono">• CERT-GH-2025-005678 (Partial)</li>
                    <li className="font-mono">• CERT-GH-2024-099888 (Complete)</li>
                    <li className="font-mono">• CERT-GH-2025-FAKE99 (Invalid)</li>
                  </ul>
                </div>
              )}
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
              {!verificationResult && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="mb-4 h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Enter a certificate ID or scan a QR code to verify
                  </p>
                </div>
              )}

              {/* Valid Certificate */}
              {verificationResult?.status === "valid" && verificationResult.data && (
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
                            {verificationResult.data.completionStatus === "Complete" ? "✓ All Mandatory Vaccinations Complete" : "⚠️ Partial - Vaccinations In Progress"}
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

                  {/* Privacy Notice */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      🔒 For privacy protection, this system does NOT display the child&apos;s name, date of birth, or parent contact information. This verification confirms only that the certificate itself is genuine.
                    </p>
                  </div>
                </div>
              )}

              {/* Invalid/Not Found Certificate */}
              {verificationResult?.status === "not-found" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center rounded-lg border-2 border-red-300 bg-red-50 p-6 dark:bg-red-950/20">
                    <div className="text-center">
                      <XCircle className="mx-auto mb-3 h-16 w-16 text-red-600" />
                      <p className="text-lg font-bold text-red-900 dark:text-red-100">
                        ✗ CERTIFICATE NOT FOUND
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                        This certificate ID is not valid in our system
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

        {/* Verification Log (Optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-4 w-4 text-primary" /> Recent Verifications
            </CardTitle>
            <CardDescription>Last 5 certificate verification attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Certificate ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Result
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Verified By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  <tr className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">2 mins ago</td>
                    <td className="px-4 py-3 font-mono">CERT-GH-2025-001234</td>
                    <td className="px-4 py-3">
                      <Badge className="border-green-300 bg-green-50 text-green-700">Valid</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">PHA Officer</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">15 mins ago</td>
                    <td className="px-4 py-3 font-mono">CERT-GH-2025-FAKE99</td>
                    <td className="px-4 py-3">
                      <Badge className="border-red-300 bg-red-50 text-red-700">Not Found</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">PHA Officer</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
