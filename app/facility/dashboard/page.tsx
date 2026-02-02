"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Camera,
  ChevronRight,
  FilePlus2,
  Loader2,
  Phone,
  QrCode,
  Search,
  Stethoscope,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"

type CameraState = "idle" | "starting" | "active" | "error"

export default function FacilityDashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<facilityApi.ChildSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingScan = useRef(false)
  const scannerId = "qr-scanner-facility"
  
  // Today's appointments and urgent follow-ups
  const [appointments, setAppointments] = useState<facilityApi.TodayAppointment[]>([])
  const [followUps, setFollowUps] = useState<facilityApi.UrgentFollowUp[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true)
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = localStorage.getItem("userName")

    if (!token) {
      router.push("/auth/login")
      return
    }

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
    
    // Fetch today's appointments and urgent follow-ups
    const fetchDashboardData = async () => {
      try {
        const [appointmentsData, followUpsData] = await Promise.all([
          facilityApi.getTodaysAppointments(),
          facilityApi.getUrgentFollowUps()
        ])
        setAppointments(appointmentsData)
        setFollowUps(followUpsData)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setIsLoadingAppointments(false)
        setIsLoadingFollowUps(false)
      }
    }
    
    fetchDashboardData()
  }, [router])

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
        setSystemMessage("No matching child found. Confirm spelling or scan the QR code on the health passbook.")
      } else {
        setSystemMessage(`${results.length} result${results.length > 1 ? "s" : ""} ready. Select a child to open their chart.`)
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSystemMessage("Search failed. Please try again.")
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

      // Request camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        })
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop())
      } catch (permError: any) {
        if (permError.name === 'NotAllowedError') {
          throw new Error("Camera permission denied. Please allow camera access in your browser settings.")
        } else if (permError.name === 'NotFoundError') {
          throw new Error("No camera found on this device.")
        } else if (permError.name === 'NotReadableError') {
          throw new Error("Camera is already in use by another application. Please close other apps using the camera.")
        } else {
          throw new Error(`Camera error: ${permError.message || 'Unable to access camera'}`)
        }
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

  const handleQRCodeScan = async (decodedText: string) => {
    try {
      // The QR code should contain the child's ID or CVCC ID
      // Try to parse it as JSON first, otherwise use as direct ID
      let childId = decodedText
      
      try {
        const parsed = JSON.parse(decodedText)
        childId = parsed.childId || parsed.id || parsed.cvccId || decodedText
      } catch {
        // Not JSON, use as is
      }

      setSystemMessage("Looking up child record...")
      toast.loading("Scanning QR code...")
      
      // Search for the child
      const results = await facilityApi.searchChildren(childId)
      
      toast.dismiss()
      
      if (results.length === 0) {
        setSystemMessage("No child found with this QR code. Please verify and try again.")
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
  const todaysFollowUps = useMemo(() => followUps, [followUps])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
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
              <p className="text-xl font-semibold text-foreground">Jakpa District Health Centre</p>
              <p className="text-xs text-muted-foreground">Savannah Region</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
              <span className="text-xs text-muted-foreground/80">Role: Facility Nurse</span>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
              Logout
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
                {searchResults.length > 0 ? (
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
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarCheck className="h-5 w-5 text-primary" /> Today&apos;s appointments
              </CardTitle>
              <CardDescription>Prepare immunisation cards and vaccines before families arrive.</CardDescription>
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
                todaysAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <AlertTriangle className="h-5 w-5" /> Urgent follow-ups
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
                todaysFollowUps.map((followUp) => (
                  <div key={followUp.id} className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{followUp.childName}</p>
                        <p className="text-xs text-muted-foreground">Guardian: {followUp.caregiver}</p>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">
                        {followUp.daysOverdue} days overdue
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-destructive">{followUp.reason}</p>
                    <Link href={`tel:${followUp.contact.replace(/\s+/g, "")}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
                      <Phone className="h-3 w-3" /> Call guardian
                    </Link>
                  </div>
                ))
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
      </main>
    </div>
  )
}
