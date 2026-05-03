"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Camera,
  ChevronRight,
  FilePlus2,
  Heart,
  Info,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Search,
  Shield,
  Stethoscope,
  Syringe,
  User,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"
import * as offlineSync from "@/lib/offline-vaccination-sync"

type CameraState = "idle" | "starting" | "active" | "error"

export default function FacilityDashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [facilityInfo, setFacilityInfo] = useState<{ name: string; region: string; district: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<facilityApi.ChildSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSearchFailedModal, setShowSearchFailedModal] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingScan = useRef(false)
  const scannerId = "qr-scanner-facility"
  
  // Today's appointments and urgent follow-ups
  const [appointments, setAppointments] = useState<facilityApi.TodayAppointment[]>([])
  const [followUps, setFollowUps] = useState<facilityApi.UrgentFollowUp[]>([])
  const [missedAppointments, setMissedAppointments] = useState<facilityApi.MissedAppointmentReminder[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true)
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(true)
  const [isLoadingMissedAppointments, setIsLoadingMissedAppointments] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [contactDetail, setContactDetail] = useState<facilityApi.UrgentFollowUp | null>(null)
  const [followUpsModalOpen, setFollowUpsModalOpen] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [pendingAppointmentRequestsCount, setPendingAppointmentRequestsCount] = useState(0)

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    if (role !== "staff" || detail !== "facility-nurse") {
      if (role === "parent") {
        router.push("/parent/dashboard")
        return
      }
      if (detail === "branch-manager") {
        router.push("/branch/dashboard")
        return
      }
      if (detail === "hq-admin") {
        router.push("/hq/dashboard")
        return
      }
      router.push("/dashboard")
      return
    }

    setUserName(name || "Facility Nurse")
    
    // Fetch facility info
    const branchId = localStorage.getItem("branchId")
    if (branchId) {
      facilityApi.getBranchDetails(branchId)
        .then(details => {
          setFacilityInfo({ name: details.name, region: details.region, district: details.district })
        })
        .catch(error => {
          console.error("Failed to fetch facility details:", error)
        })
    }
    
    // Fetch today's appointments, urgent follow-ups, and missed appointment reminders (filtered by facility)
    const fetchDashboardData = async () => {
      try {
        const [appointmentsData, followUpsData, missedAppointmentsData, pendingRequests] = await Promise.all([
          facilityApi.getTodaysAppointments(branchId || undefined),
          facilityApi.getUrgentFollowUps(branchId || undefined),
          facilityApi.getMissedAppointments(branchId || undefined, 14),
          facilityApi.getAppointmentRequests(branchId || undefined, "scheduled"),
        ])
        setAppointments(appointmentsData)
        setFollowUps(followUpsData)
        setMissedAppointments(missedAppointmentsData)
        setPendingAppointmentRequestsCount(pendingRequests.length)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setIsLoadingAppointments(false)
        setIsLoadingFollowUps(false)
        setIsLoadingMissedAppointments(false)
      }
    }
    
    fetchDashboardData()
  }, [router])

  // Check for pending offline vaccinations
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await offlineSync.getPendingCount()
        setPendingSyncCount(count)
      } catch (error) {
        console.error("Failed to get pending count:", error)
      }
    }

    updatePendingCount()
    
    // Update count every 10 seconds
    const interval = setInterval(updatePendingCount, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = searchTerm.trim()
    
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([])
      setSystemMessage("Type at least 2 characters to search (child name, phone number, or CVCC ID).")
      return
    }

    setIsSearching(true)
    setSystemMessage(null)

    try {
      const results = await facilityApi.searchChildren(trimmed)
      setSearchResults(results)

      if (results.length === 0) {
        setShowErrorModal(true)
      } else {
        setSystemMessage(`${results.length} result${results.length > 1 ? "s" : ""} ready. Select a child to open their chart.`)
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSystemMessage(null)
      setShowSearchFailedModal(true)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const startCamera = async () => {
    if (cameraState === "active" || cameraState === "starting") return
    setCameraError(null)
    setCameraState("starting")
    
    // Wait for DOM to update with the scanner div
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      // Check if we're on HTTPS or localhost
      const isSecureContext = window.isSecureContext
      if (!isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error("Camera requires HTTPS connection. Please use https:// or localhost")
      }

      // Verify the element exists
      const element = document.getElementById(scannerId)
      if (!element) {
        throw new Error("Scanner container not found. Please try again.")
      }

      // Initialize scanner
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId)
      }

      // Get available cameras
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error("No cameras detected. Please ensure your camera is connected and not blocked.")
      }

      // Prefer back camera for mobile devices
      const cameraId = cameras.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear') ||
        cam.label.toLowerCase().includes('environment')
      )?.id || cameras[0].id

      // Start scanning with retry logic
      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Prevent duplicate scans
          if (isProcessingScan.current) return
          isProcessingScan.current = true
          
          // QR code scanned successfully
          await handleQRCodeScan(decodedText)
          await stopCamera()
          
          // Reset after a delay to allow re-scanning if needed
          setTimeout(() => {
            isProcessingScan.current = false
          }, 2000)
        },
        (errorMessage) => {
          // Scanning error (happens frequently, not critical)
          if (!errorMessage.includes("NotFoundException")) {
            console.log("Scan error:", errorMessage)
          }
        }
      )

      setCameraState("active")
      setSystemMessage("Camera ready. Align the QR code within the frame to identify the child.")
      toast.success("Camera started successfully")
    } catch (error) {
      console.error("Camera initialization failed:", error)
      const errorMsg = error instanceof Error ? error.message : "Unable to access camera"
      setCameraError(errorMsg)
      setCameraState("error")
      toast.error(errorMsg)
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop()
      } catch (error) {
        console.error("Error stopping camera:", error)
      }
    }
    setCameraState("idle")
  }

  const extractLookupIdentifier = (decodedText: string): string => {
    let value = (decodedText || "").trim()
    if (!value) return ""

    // Support legacy JSON payloads and any structured QR wrappers.
    try {
      const parsed = JSON.parse(value)
      const candidate =
        parsed?.childId ||
        parsed?.id ||
        parsed?.cvccId ||
        parsed?.qrPayload ||
        parsed?.certificateId ||
        parsed?.token

      if (typeof candidate === "string" && candidate.trim()) {
        value = candidate.trim()
      }
    } catch {
      // Not JSON; continue with raw string.
    }

    // Support URL payloads by extracting common id query params.
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value)
        const fromParams =
          url.searchParams.get("id") ||
          url.searchParams.get("childId") ||
          url.searchParams.get("certificateId") ||
          url.searchParams.get("token")

        if (fromParams && fromParams.trim()) {
          value = fromParams.trim()
        } else {
          const segments = url.pathname.split("/").filter(Boolean)
          const lastSegment = segments[segments.length - 1]
          if (lastSegment) {
            value = lastSegment
          }
        }
      } catch {
        // Keep existing value if URL parsing fails.
      }
    }

    // Support old pipe-delimited payloads by using the first segment.
    if (value.includes("|")) {
      value = value.split("|")[0].trim()
    }

    value = value.trim().slice(0, 100)

    // Normalize known uppercase identifiers.
    if (/^(qrc-(ch|cert)-|cert-gh-|ch-|cvcc-)/i.test(value)) {
      value = value.toUpperCase()
    }

    return value
  }

  const handleQRCodeScan = async (decodedText: string) => {
    try {
      const lookupId = extractLookupIdentifier(decodedText)
      if (!lookupId) {
        setSystemMessage("Invalid QR code format. Please scan a valid child or certificate QR code.")
        toast.error("Invalid QR code")
        return
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(lookupId)) {
        setSystemMessage("Invalid QR code content. Please scan a valid system-generated QR code.")
        toast.error("Invalid QR code")
        return
      }

      const isCertificateToken = /^QRC-CERT-[A-Z0-9-]{10,64}$/i.test(lookupId)

      setSystemMessage("Looking up child record...")
      toast.loading("Scanning QR code...")
      
      // Search for the child
      const results = await facilityApi.searchChildren(lookupId)
      
      toast.dismiss()
      
      if (results.length === 0) {
        setSystemMessage(
          isCertificateToken
            ? "Certificate QR scanned, but no linked child record was found for this facility lookup."
            : "No child found with this QR code. Please verify and try again."
        )
        toast.error("Child not found")
        return
      }

      // If single result, navigate directly
      if (results.length === 1) {
        toast.success(`Opening record for ${results[0].name}`)
        router.push(`/facility/child/${results[0].id}`)
        return
      }

      // Multiple results - show them
      setSearchResults(results)
      setSystemMessage(`${results.length} children found. Please select the correct one.`)
    } catch (error) {
      console.error("QR code lookup failed:", error)
      setSystemMessage("Failed to lookup child record. Please try manual search.")
      toast.error("Lookup failed")
    }
  }

  const todaysAppointments = useMemo(() => appointments, [appointments])
  const todaysAppointmentsPreview = useMemo(() => todaysAppointments.slice(0, 4), [todaysAppointments])
  const todaysFollowUps = useMemo(() => followUps, [followUps])
  const followUpsPreview = useMemo(() => todaysFollowUps.slice(0, 4), [todaysFollowUps])
  const recentMissedAppointments = useMemo(
    () => missedAppointments.filter((appointment) => appointment.daysSinceMissed <= 14),
    [missedAppointments],
  )
  const missedAppointmentsPreview = useMemo(
    () => recentMissedAppointments.slice(0, 4),
    [recentMissedAppointments],
  )

  const handleLogout = () => {
    setIsLoggingOut(true)
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    sessionStorage.removeItem("userName")
    localStorage.removeItem("branchId")
    localStorage.removeItem("userId")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today&apos;s Clinic · Facility Nurse Console</p>
              <p className="text-xl font-semibold text-foreground">{facilityInfo?.name || "Loading..."}</p>
              <p className="text-xs text-muted-foreground">
                {[facilityInfo?.district, facilityInfo?.region].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
              <span className="text-xs text-muted-foreground/80">Role: Facility Nurse</span>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {isLoggingOut ? "Signing out..." : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {systemMessage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}
        {cameraError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{cameraError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-6 lg:flex-row">
          <Card className="flex-1 border-primary/40">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">Patient lookup</CardTitle>
              <CardDescription>Search by child name, CVCC ID, or guardian phone number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="flex flex-col gap-3" onSubmit={handleSearch}>
                <Label htmlFor="search" className="text-sm font-medium">
                  Who are you attending to?
                </Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      type="search"
                      placeholder="e.g. Child Mensah, +233245001100, CH-2025-001"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-14 rounded-lg border-primary/30 pl-11 text-base"
                    />
                  </div>
                  <Button type="submit" disabled={isSearching} className="h-14 rounded-lg px-6 text-base">
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      'Find child'
                    )}
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="w-48 h-48">
                      <DotLottieReact
                        src="/Free Searching Animation.lottie"
                        loop
                        autoplay
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">Searching for child...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Matching records</p>
                    <div className="grid gap-2">
                      {searchResults.map((result, index) => (
                        <div
                          key={`${result.id}-${index}`}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{result.name}</p>
                              <Badge variant={
                                result.vaccinationStatus === 'Complete' ? 'default' : 
                                result.vaccinationStatus === 'Overdue' ? 'destructive' : 
                                'secondary'
                              }>
                                {result.vaccinationStatus}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Guardian: {result.guardianName} • {result.guardianPhone}</p>
                            <p className="text-xs text-muted-foreground font-mono">{result.childId} • {result.age}</p>
                            {result.lastVisit && (
                              <p className="text-xs text-muted-foreground">Last visit: {result.lastVisit}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            {result.overdueVaccines > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" />
                                {result.overdueVaccines} overdue
                              </Badge>
                            )}
                            {result.upcomingVaccines > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {result.upcomingVaccines} upcoming
                              </Badge>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/facility/child/${result.id}`} className="gap-2">
                                  Open chart
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-2" asChild>
                                <Link href={`tel:${result.guardianPhone.replace(/\s+/g, "")}`}>
                                  <Phone className="h-4 w-4" />
                                  Call guardian
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Search results will appear here once a match is found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex w-full flex-col gap-4 lg:w-80">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" /> Scan QR code
                </CardTitle>
                <CardDescription>Fastest look-up using the CVCC passbook or digital certificate.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button 
                  className="gap-2" 
                  variant="default" 
                  onClick={startCamera} 
                  disabled={cameraState === "starting" || cameraState === "active"}
                >
                  <Camera className="h-4 w-4" />
                  {cameraState === "starting" ? "Starting camera..." : cameraState === "active" ? "Scanning..." : "Start scanning"}
                </Button>
                {(cameraState === "starting" || cameraState === "active") ? (
                  <div className="space-y-2">
                    <div id={scannerId} className="relative overflow-hidden rounded-lg border-2 border-primary/50" />
                    {cameraState === "active" && (
                      <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
                        Stop camera
                      </Button>
                    )}
                  </div>
                ) : null}
                {cameraState === "error" || cameraError ? (
                  <div className="space-y-2">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {cameraError || "Camera error occurred"}
                      </AlertDescription>
                    </Alert>
                    <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                      <p className="font-semibold">Troubleshooting:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        <li>Check if another app is using your camera</li>
                        <li>Click the camera icon in your browser&apos;s address bar and allow access</li>
                        <li>Try refreshing the page (F5)</li>
                        <li>Restart your browser if the issue persists</li>
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setCameraError(null); setCameraState("idle"); }} className="w-full">
                      Try again
                    </Button>
                  </div>
                ) : cameraState !== "active" ? (
                  <p className="text-xs text-muted-foreground">
                    Position the QR code within the frame. The system will decode and open the child&apos;s record automatically.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
                <CardDescription>Kick off common clinic workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button asChild className="gap-2">
                  <Link href="/facility/register-mother">
                    <User className="h-4 w-4" /> Register new mother
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/facility/register-child">
                    <FilePlus2 className="h-4 w-4" /> Register new child
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/facility/dashboard/appointments">
                    <CalendarCheck className="h-4 w-4" />
                    Review appointment requests
                    {pendingAppointmentRequestsCount > 0 ? (
                      <Badge variant="default" className="ml-auto">
                        {pendingAppointmentRequestsCount}
                      </Badge>
                    ) : null}
                  </Link>
                </Button>
                {pendingSyncCount > 0 && (
                  <Button asChild variant="secondary" className="gap-2">
                    <Link href="/facility/offline-sync">
                      <Syringe className="h-4 w-4" /> 
                      Offline sync 
                      <Badge variant="default" className="ml-auto">{pendingSyncCount}</Badge>
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-[3fr,2fr]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarCheck className="h-5 w-5 text-primary" /> Today&apos;s appointments
              </CardTitle>
              <CardDescription>
                Prepare immunisation cards and vaccines before families arrive.{" "}
                <Link href="/facility/dashboard/appointments/today" className="text-primary hover:underline">
                  View all today&apos;s appointments &rarr;
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingAppointments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading appointments...</span>
                </div>
              ) : todaysAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No booked visits yet. Walk-in clients will appear once registered.</p>
              ) : (
                todaysAppointmentsPreview.map((appointment, index) => (
                  <div key={`${appointment.id}-${index}`} className="flex flex-col gap-2 rounded-lg border border-border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{appointment.childName}</p>
                      <p className="text-xs text-muted-foreground">Guardian: {appointment.caregiver}</p>
                      <p className="text-xs text-muted-foreground">{appointment.vaccine}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <Badge variant="outline" className="text-xs">
                        {appointment.scheduledTime}
                      </Badge>
                      <Link href={`tel:${appointment.contact.replace(/\s+/g, "")}`} className="text-xs text-primary hover:underline">
                        Call guardian
                      </Link>
                    </div>
                  </div>
                ))
              )}
              {!isLoadingAppointments && todaysAppointments.length > 4 ? (
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <Link href="/facility/dashboard/appointments/today">
                    View all today&apos;s appointments ({todaysAppointments.length})
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-amber-300/50">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> Missed appointment follow-ups
              </CardTitle>
              <CardDescription>
                Mothers who missed appointments in the last 14 days. Call and help them rebook quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingMissedAppointments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading missed appointments...</span>
                </div>
              ) : recentMissedAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missed appointments in the recent follow-up window.</p>
              ) : (
                missedAppointmentsPreview.map((item, index) => (
                  <div
                    key={`${item.id}-${item.childId}-${item.scheduledDate}-${index}`}
                    className="flex flex-col gap-3 rounded-lg border border-amber-200/70 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.childName}</p>
                      <p className="text-xs text-muted-foreground">Guardian: {item.caregiver}</p>
                      <p className="text-xs text-muted-foreground">
                        Missed on {item.scheduledDate || "Unknown date"} at {item.scheduledTime} • {item.vaccine}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
                        {item.daysSinceMissed} day{item.daysSinceMissed === 1 ? "" : "s"} ago
                      </Badge>
                      {item.contact && item.contact !== "N/A" ? (
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <Link href={`tel:${item.contact.replace(/\s+/g, "")}`}>
                            <Phone className="h-4 w-4" /> Call guardian
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-2" disabled>
                          <Phone className="h-4 w-4" /> No phone
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" asChild>
                        <Link href="/facility/dashboard/appointments">Manage requests</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
              {!isLoadingMissedAppointments && recentMissedAppointments.length > 4 ? (
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <Link href="/facility/dashboard/appointments/missed">
                    View all missed appointments ({recentMissedAppointments.length})
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-destructive/50">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <AlertTriangle className="h-5 w-5" /> Urgent follow-ups
                {!isLoadingFollowUps && todaysFollowUps.length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs">
                    {todaysFollowUps.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Prioritise these children if they attend clinic today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingFollowUps ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-destructive" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading follow-ups...</span>
                </div>
              ) : todaysFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No flagged children for today.</p>
              ) : (
                followUpsPreview.map((followUp, index) => (
                  <div key={`${followUp.id}-${index}`} className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{followUp.childName}</p>
                        <p className="text-xs text-muted-foreground">Guardian: {followUp.caregiver}{followUp.relationship ? ` (${followUp.relationship})` : ""}</p>
                      </div>
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        {followUp.daysOverdue} days overdue
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-destructive">{followUp.reason}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <Link href={`tel:${followUp.contact.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 transition-colors">
                        <Phone className="h-3 w-3" /> {followUp.contact !== "N/A" ? followUp.contact : "No phone"}
                      </Link>
                      <button
                        onClick={() => setContactDetail(followUp)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Info className="h-3 w-3" /> Contact info
                      </button>
                    </div>
                  </div>
                ))
              )}
              {!isLoadingFollowUps && todaysFollowUps.length > 4 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setFollowUpsModalOpen(true)}
                >
                  View all urgent follow-ups ({todaysFollowUps.length})
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="h-5 w-5 text-primary" /> Clinic checklist
            </CardTitle>
            <CardDescription>Ensure cold chain readiness, consent forms, and vaccine stock are in place before session starts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Review vaccine fridge log</p>
              <p className="mt-1 text-xs text-muted-foreground">Confirm morning temperature check and chart in the cold chain book.</p>
            </div>
            <div className="rounded-lg border border-border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Prepare consent cards</p>
              <p className="mt-1 text-xs text-muted-foreground">Lay out maternal health record books and ensure ink pads are available.</p>
            </div>
            <div className="rounded-lg border border-border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Sync digital registers</p>
              <p className="mt-1 text-xs text-muted-foreground">Confirm tablets are online and overnight data sync completed.</p>
            </div>
          </CardContent>
        </Card>

        {/* Offline Sync Management Button */}
        <div className="flex justify-center pb-4">
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/facility/offline-sync">
              <Syringe className="h-5 w-5" />
              Manage Offline Vaccinations
              {pendingSyncCount > 0 && (
                <Badge variant="default" className="ml-2">
                  {pendingSyncCount} pending
                </Badge>
              )}
            </Link>
          </Button>
        </div>
      </main>

      {/* Guardian Contact Details Modal */}
      {contactDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setContactDetail(null)}>
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Guardian Contact Details</h3>
                <p className="text-xs text-muted-foreground">for {contactDetail.childName}</p>
              </div>
              <button onClick={() => setContactDetail(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5 overflow-y-auto flex-1 min-h-0">
              {/* Guardian name & relationship */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{contactDetail.caregiver}</p>
                  <p className="text-xs text-muted-foreground capitalize">{contactDetail.relationship || "Guardian"}</p>
                </div>
              </div>

              <hr className="border-border" />

              {/* Contact channels */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact channels</p>

                {/* Primary phone */}
                <Link href={`tel:${contactDetail.contact.replace(/\s+/g, "")}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors">
                  <Phone className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{contactDetail.contact}</p>
                    <p className="text-[11px] text-muted-foreground">Primary phone {contactDetail.preferredContact === "sms" ? "· Prefers SMS" : ""}</p>
                  </div>
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full">Call</span>
                </Link>

                {/* Alternate phone */}
                {contactDetail.phoneAlternate && (
                  <Link href={`tel:${contactDetail.phoneAlternate.replace(/\s+/g, "")}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{contactDetail.phoneAlternate}</p>
                      <p className="text-[11px] text-muted-foreground">Alternate phone</p>
                    </div>
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">Call</span>
                  </Link>
                )}

                {/* Email */}
                {contactDetail.email && (
                  <Link href={`mailto:${contactDetail.email}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors">
                    <Mail className="h-4 w-4 text-violet-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{contactDetail.email}</p>
                      <p className="text-[11px] text-muted-foreground">Email address {contactDetail.preferredContact === "email" ? "· Preferred" : ""}</p>
                    </div>
                    <span className="text-[10px] font-medium text-violet-600 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded-full">Email</span>
                  </Link>
                )}
              </div>

              {/* Important info */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Important information</p>

                {/* Address */}
                {contactDetail.address && (
                  <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                    <MapPin className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{contactDetail.address}</p>
                      {contactDetail.community && <p className="text-[11px] text-muted-foreground mt-0.5">Community: {contactDetail.community}</p>}
                    </div>
                  </div>
                )}

                {/* NHIS */}
                {contactDetail.nhisNumber && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <Shield className="h-4 w-4 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{contactDetail.nhisNumber}</p>
                      <p className="text-[11px] text-muted-foreground">NHIS Number</p>
                    </div>
                  </div>
                )}

                {/* Emergency contact */}
                {contactDetail.emergencyContactName && (
                  <div className="flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-3">
                    <Heart className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{contactDetail.emergencyContactName}</p>
                      <p className="text-[11px] text-muted-foreground">Emergency contact</p>
                    </div>
                    {contactDetail.emergencyContactPhone && (
                      <Link href={`tel:${contactDetail.emergencyContactPhone.replace(/\s+/g, "")}`} className="text-[10px] font-medium text-red-600 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors">
                        {contactDetail.emergencyContactPhone}
                      </Link>
                    )}
                  </div>
                )}

                {/* No extra info fallback */}
                {!contactDetail.address && !contactDetail.nhisNumber && !contactDetail.emergencyContactName && !contactDetail.phoneAlternate && !contactDetail.email && (
                  <p className="text-xs text-muted-foreground italic py-2">No additional contact information on file for this guardian.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setContactDetail(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal - No Child Found */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-32 h-32">
                <DotLottieReact
                  src="/Sign for error _ Flat style.lottie"
                  loop
                  autoplay
                />
              </div>
              <DialogTitle className="text-center text-xl">No Child Found</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-center text-base py-4">
            No matching child found. Confirm spelling or scan the QR code on the health passbook.
          </DialogDescription>
          <div className="flex justify-center pt-2">
            <Button onClick={() => setShowErrorModal(false)} className="w-full sm:w-auto px-8">
              OK, Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* All Urgent Follow-ups Modal */}
      <Dialog open={followUpsModalOpen} onOpenChange={setFollowUpsModalOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Urgent follow-ups
              <Badge variant="destructive" className="ml-1">{todaysFollowUps.length}</Badge>
            </DialogTitle>
            <DialogDescription>
              All children with overdue vaccinations. Prioritise these if they attend clinic today.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {todaysFollowUps.map((followUp, index) => (
              <div key={`modal-${followUp.id}-${index}`} className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{followUp.childName}</p>
                    <p className="text-xs text-muted-foreground">
                      Guardian: {followUp.caregiver}{followUp.relationship ? ` (${followUp.relationship})` : ""}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    {followUp.daysOverdue} days overdue
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-destructive">{followUp.reason}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={`tel:${followUp.contact.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25"
                  >
                    <Phone className="h-3 w-3" /> {followUp.contact !== "N/A" ? followUp.contact : "No phone"}
                  </Link>
                  <button
                    onClick={() => {
                      setFollowUpsModalOpen(false)
                      setContactDetail(followUp)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Info className="h-3 w-3" /> Contact info
                  </button>
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" asChild>
                    <Link href={`/facility/child/${followUp.childId}`}>
                      Open chart <ChevronRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-6 py-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFollowUpsModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Modal - Search Failure */}
      <Dialog open={showSearchFailedModal} onOpenChange={setShowSearchFailedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-32 h-32">
                <DotLottieReact
                  src="/Sign for error _ Flat style.lottie"
                  loop
                  autoplay
                />
              </div>
              <DialogTitle className="text-center text-xl">Search Failed</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-center text-base py-4">
            Search failed. Please try again.
          </DialogDescription>
          <div className="flex justify-center pt-2">
            <Button onClick={() => setShowSearchFailedModal(false)} className="w-full sm:w-auto px-8">
              Try again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
