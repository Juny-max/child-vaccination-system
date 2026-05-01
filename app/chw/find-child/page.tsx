"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Camera, ChevronLeft, Loader2, Phone, QrCode, Search, UserPlus } from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import { searchChwChildren, type ChwSearchResult } from "@/lib/api/chw"
import { getChildByCvccId, getChildren, upsertChildren } from "@/lib/chw-offline/db"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { TransferInModal } from "@/components/chw/transfer-in-modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

type LocalChildRecord = {
  id: string
  displayId: string
  childName: string
  motherName: string
  motherPhone: string
  nextVaccine: string
  village: string
}

type CameraState = "idle" | "starting" | "active" | "error"

type SearchMode = "name" | "phone"

type ScanLookupState = "idle" | "loading" | "found" | "not-found" | "error"

export default function ChwFindChildPage() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [searchMode, setSearchMode] = useState<SearchMode>("name")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LocalChildRecord[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([])
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const [showTransferInModal, setShowTransferInModal] = useState(false)
  const [showScanLookupModal, setShowScanLookupModal] = useState(false)
  const [scanLookupState, setScanLookupState] = useState<ScanLookupState>("idle")
  const [scanLookupMessage, setScanLookupMessage] = useState("")
  const [scanLookupChild, setScanLookupChild] = useState<LocalChildRecord | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingScan = useRef(false)
  const scannerId = "qr-scanner-chw"

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const hasAuthState = Boolean(userId || accessToken || legacyToken)

    if (!hasAuthState) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff" || detail !== "chw") {
      router.push("/chw/dashboard")
      return
    }

  }, [router])

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const filteredChildren = useMemo(() => results, [results])

  const mapSearchResult = (child: ChwSearchResult): LocalChildRecord => ({
    id: child.id,
    displayId: child.childId || child.id,
    childName: child.childName,
    motherName: child.motherName,
    motherPhone: child.motherPhone,
    nextVaccine: child.nextVaccine,
    village: child.village,
  })

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) {
      setSystemMessage("Type a child name or mother phone to search.")
      setResults([])
      return
    }

    setHasSearched(true)
    setIsSearching(true)

    try {
      // DUAL SEARCH STRATEGY
      if (isOnline) {
        // ONLINE MODE: Search only within the CHW's assigned catchment area
        const backendResults = await searchChwChildren(query)
        setResults(backendResults.map(mapSearchResult))

        // Background sync: Update IndexedDB with search results
        await upsertChildren(
          backendResults.map((item) => ({
            id: item.id,
            cvccId: item.childId,
            fullName: item.childName,
            dateOfBirth: item.dateOfBirth,
            gender: (item.gender || "unknown") as "male" | "female" | "intersex" | "undisclosed" | "unknown",
            guardianName: item.motherName,
            guardianPhone: item.motherPhone,
            updatedAt: new Date().toISOString(),
          })),
        )

        setSystemMessage(
          backendResults.length > 0
            ? `✅ ${backendResults.length} child${backendResults.length === 1 ? "" : "ren"} found in your catchment area.`
            : null,
        )

        if (backendResults.length === 0) {
          setErrorDialogMessage("No child found in your catchment area. Use Transfer In if this child belongs to another area.")
          setShowErrorDialog(true)
        }
        return
      }

      // OFFLINE MODE: Search only catchment-filtered IndexedDB
      // Shows only children synced for this CHW's area
      const normalized = query.trim().toLowerCase()
      const normalizedPhone = normalized.replace(/\s+/g, "")
      const localChildren = await getChildren()
      const local = localChildren.filter((child) => {
        if (searchMode === "name") {
          return child.fullName.toLowerCase().includes(normalized)
        }

        return (child.guardianPhone || "")
          .replace(/\s+/g, "")
          .includes(normalizedPhone)
      })

      const matches = local.map((child) => ({
        id: child.id,
        displayId: child.cvccId || child.id,
        childName: child.fullName,
        motherName: child.guardianName || "Unknown",
        motherPhone: child.guardianPhone || "N/A",
        nextVaccine: "Review chart",
        village: "Offline cache",
      }))

      setResults(matches)
      setSystemMessage(
        matches.length > 0
          ? `📱 Offline: ${matches.length} child${matches.length === 1 ? "" : "ren"} found in your catchment area.`
          : "No offline record found. Connect to internet for wider search.",
      )
    } catch (error) {
      console.error("CHW search failed", error)
      setSystemMessage("Search failed. Please try again.")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const startCamera = async () => {
    if (cameraState === "active" || cameraState === "starting") return
    setCameraError(null)
    setCameraState("starting")

    // Wait for DOM to update with the scanner div
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      // Request camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        // Stop the test stream immediately
        stream.getTracks().forEach((track) => track.stop())
      } catch (permError: any) {
        if (permError.name === "NotAllowedError") {
          throw new Error("Camera permission denied. Please allow camera access in your browser settings.")
        } else if (permError.name === "NotFoundError") {
          throw new Error("No camera found on this device.")
        } else if (permError.name === "NotReadableError") {
          throw new Error("Camera is already in use. Please close other apps using the camera.")
        } else {
          throw new Error(`Camera error: ${permError.message || "Unable to access camera"}`)
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
        throw new Error("No cameras detected. Please ensure your camera is connected.")
      }

      // Store available cameras for switching
      setAvailableCameras(cameras)

      // Use current camera or prefer back camera for mobile devices
      const cameraId =
        currentCameraId ||
        cameras.find(
          (cam) =>
            cam.label.toLowerCase().includes("back") ||
            cam.label.toLowerCase().includes("rear") ||
            cam.label.toLowerCase().includes("environment"),
        )?.id ||
        cameras[0].id

      setCurrentCameraId(cameraId)

      // Start scanning
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

          // Reset after a delay
          setTimeout(() => {
            isProcessingScan.current = false
          }, 2000)
        },
        (errorMessage) => {
          // Scanning error (happens frequently, not critical)
          if (!errorMessage.includes("NotFoundException")) {
            console.log("Scan error:", errorMessage)
          }
        },
      )

      setCameraState("active")
      setSystemMessage("Camera ready. Align the QR code within the frame to identify the child.")
    } catch (error) {
      console.error("Camera initialization failed:", error)
      const errorMsg = error instanceof Error ? error.message : "Unable to access camera"
      setCameraError(errorMsg)
      setCameraState("error")
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop()
        setCameraState("idle")
      } catch (error) {
        console.error("Failed to stop camera", error)
      }
    }
  }

  const switchCamera = async () => {
    if (!availableCameras || availableCameras.length < 2) return

    // Stop current scanner
    await stopCamera()

    // Find next camera
    const currentIndex = availableCameras.findIndex((cam) => cam.id === currentCameraId)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    setCurrentCameraId(availableCameras[nextIndex].id)

    // Restart with new camera
    await startCamera()
  }

  const handleOpenScannedChildChart = () => {
    if (!scanLookupChild) return
    setShowScanLookupModal(false)
    router.push(`/chw/child/${scanLookupChild.id}`)
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

      // Security: Validate the childId format
      // Must be alphanumeric, hyphens, underscores only (UUID or CVCC format)
      // Max length 100 chars to prevent abuse
      if (!childId || typeof childId !== "string") {
        setSystemMessage("Invalid QR code format. Please scan a valid weighing card QR code.")
        return
      }

      const sanitizedId = childId.trim().slice(0, 100)
      if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedId)) {
        setSystemMessage("Invalid QR code. This QR code does not contain a valid child ID.")
        return
      }

      const isOpaqueToken = /^QRC-(CH|CERT)-[A-Z0-9-]{10,64}$/i.test(sanitizedId)
      if (!isOnline && isOpaqueToken) {
        const offlineTokenMessage =
          "This QR code uses secure token format and needs internet access for verification. Please reconnect and scan again."
        setScanLookupChild(null)
        setScanLookupState("not-found")
        setScanLookupMessage(offlineTokenMessage)
        setSystemMessage(offlineTokenMessage)
        setShowScanLookupModal(true)
        return
      }

      setScanLookupChild(null)
      setScanLookupState("loading")
      setScanLookupMessage("Looking up child record from QR code...")
      setShowScanLookupModal(true)
      setSystemMessage("Looking up child record from QR code...")

      // DUAL SEARCH STRATEGY (same as manual search)
      if (isOnline) {
        // ONLINE MODE: Search only within the CHW's assigned catchment area
        const backendResults = await searchChwChildren(sanitizedId)
        if (backendResults.length > 0) {
          const mappedResults = backendResults.map(mapSearchResult)
          const selectedChild = mappedResults[0]
          setResults(mappedResults)
          setScanLookupChild(selectedChild)
          setScanLookupState("found")
          setScanLookupMessage(
            backendResults.length > 1
              ? `Found ${backendResults.length} matches. Review the child details and open the chart.`
              : "Child found. Review the details and open the chart."
          )
          setSystemMessage(`QR lookup successful for ${selectedChild.childName}.`)
          return
        }
      } else {
        // OFFLINE MODE: Search only catchment-filtered IndexedDB
        const localChild = await getChildByCvccId(sanitizedId)

        if (localChild) {
          const mappedLocalChild: LocalChildRecord = {
            id: localChild.id,
            displayId: localChild.cvccId || localChild.id,
            childName: localChild.fullName,
            motherName: localChild.guardianName || "Unknown",
            motherPhone: localChild.guardianPhone || "N/A",
            nextVaccine: "Review chart",
            village: "Offline cache",
          }

          setResults([mappedLocalChild])
          setScanLookupChild(mappedLocalChild)
          setScanLookupState("found")
          setScanLookupMessage("Child found in offline cache. Open the chart to continue.")
          setSystemMessage(`Offline QR lookup successful for ${mappedLocalChild.childName}.`)
          return
        }
      }

      // Not found in any mode
      const notFoundMessage =
        isOnline
          ? "No child found with this QR code in your catchment area. If this child has moved in, use Transfer In."
          : "No child found with this QR code in your offline cache. Connect to internet to search your catchment."

      setScanLookupChild(null)
      setScanLookupState("not-found")
      setScanLookupMessage(notFoundMessage)
      setSystemMessage(notFoundMessage)
    } catch (error) {
      console.error("QR scan failed", error)
      setScanLookupChild(null)
      setScanLookupState("error")
      setScanLookupMessage("QR lookup failed. Please try manual search instead.")
      setSystemMessage("QR lookup failed. Please try manual search instead.")
      setShowScanLookupModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <ButtonReturn />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground sm:text-lg">Find child</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTransferInModal(true)}
              disabled={!isOnline}
              className="hidden sm:flex"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Transfer In
            </Button>
            <NetworkStatusIndicator />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        {systemMessage ? (
          <Alert className="mb-4">
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}
        {cameraError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{cameraError}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" /> {isOnline ? "Search my catchment" : "Search cached children"}
            </CardTitle>
            <CardDescription>
              {isOnline
                ? "Search children in your assigned catchment area only. Results are saved for offline access."
                : "Search children previously synced to your device from your catchment area. Works without internet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleSearch}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <Label className="text-sm font-medium">Search by</Label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="radio"
                      name="search-mode"
                      value="name"
                      checked={searchMode === "name"}
                      onChange={() => setSearchMode("name")}
                    />
                    Child name
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="radio"
                      name="search-mode"
                      value="phone"
                      checked={searchMode === "phone"}
                      onChange={() => setSearchMode("phone")}
                    />
                    Mother phone
                  </label>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={searchMode === "name" ? "e.g. Kofi Mensah" : "e.g. +233240110221"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-14 rounded-lg border-primary/30 pl-11 text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearching}
                className={`h-14 w-full sm:w-auto sm:px-8 transition-all duration-200 ${isSearching ? "scale-[0.98] animate-pulse" : ""}`}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </form>

            {isSearching ? (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <div className="mx-auto h-24 w-24">
                  <DotLottieReact src="/Free%20Searching%20Animation.lottie" autoplay loop className="h-full w-full" />
                </div>
                <p className="mt-2 text-center text-sm text-muted-foreground">Searching child records...</p>
              </div>
            ) : null}

            {!hasSearched && !isSearching ? (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-5 text-center">
                <div className="mx-auto h-28 w-28">
                  <DotLottieReact src="/Free%20Searching%20Animation.lottie" autoplay loop className="h-full w-full" />
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Search by child name, CVCC ID, or mother&apos;s phone
                </p>
                <div className="mt-3 space-y-1.5 text-left">
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>
                      <strong>Online:</strong> searches only children in your assigned catchment area.
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>
                      <strong>Offline:</strong> searches children already synced to your device from your catchment area.
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>
                      <strong>Tip:</strong> scan the QR code on the weighing card below for instant lookup — no typing needed.
                    </span>
                  </p>
                </div>
              </div>
            ) : null}

            {hasSearched && !isSearching ? (
              <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tip from the field</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Work offline all day. As long as you synced at the clinic this morning, every child in your catchment is already
                  saved locally and searchable.
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Matches</h2>
                <Badge variant="outline" className="text-xs">
                  {results.length}
                </Badge>
              </div>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches yet. Try scanning the QR code on the weighing card.</p>
              ) : (
                <div className="space-y-2">
                  {results.map((child) => (
                    <div key={child.id} className="rounded-lg border border-border bg-background/80 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{child.childName}</p>
                          <p className="text-xs text-muted-foreground">Mother: {child.motherName}</p>
                          <p className="text-xs text-muted-foreground font-mono">CVCC ID: {child.displayId}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <Badge variant="secondary" className="text-xs">{child.nextVaccine}</Badge>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/chw/child/${child.id}`}>Open chart</Link>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`tel:${child.motherPhone.replace(/\s+/g, "")}`}>
                                <Phone className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Village: {child.village}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transfer In Button - Mobile Only */}
        <Card className="mt-6 border-primary/40 sm:hidden">
          <CardContent className="pt-6">
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => setShowTransferInModal(true)}
              disabled={!isOnline}
            >
              <UserPlus className="h-4 w-4" />
              Transfer In Child from Another Area
            </Button>
            <p className="mt-2 text-xs text-center text-muted-foreground">
              {isOnline ? "Search across all catchments and add child to your register" : "Internet required for transfer"}
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-primary" /> Scan weighing card
            </CardTitle>
            <CardDescription>Open the phone camera to read the CVCC QR code for faster lookup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="default" className="gap-2" onClick={startCamera} disabled={cameraState === "starting"}>
              <Camera className="h-4 w-4" /> {cameraState === "starting" ? "Opening camera" : "Start scanning"}
            </Button>
            {cameraState === "active" || cameraState === "starting" ? (
              <div className="space-y-2">
                <div id={scannerId} className="overflow-hidden rounded-lg border border-border" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={stopCamera} disabled={cameraState === "starting"}>
                    Stop camera
                  </Button>
                  {availableCameras.length > 1 && (
                    <Button size="sm" variant="secondary" onClick={switchCamera} disabled={cameraState === "starting"}>
                      <Camera className="h-3 w-3 mr-1" />
                      Switch camera
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
            {cameraState === "error" ? (
              <p className="text-xs text-muted-foreground">
                If your phone blocks camera access, allow permissions in settings or use the manual search above.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Once the QR is decoded, a lookup modal appears so you can confirm before opening the child chart.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto mb-2 h-28 w-28">
              <DotLottieReact src="/Sign%20for%20error%20_%20Flat%20style.lottie" autoplay loop className="h-full w-full" />
            </div>
            <DialogTitle className="text-center text-2xl sm:text-3xl">Child Not Found</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">{errorDialogMessage}</p>
            <Button className="h-12 w-full text-base" onClick={() => setShowErrorDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showScanLookupModal}
        onOpenChange={(open) => {
          if (scanLookupState === "loading" && !open) return
          setShowScanLookupModal(open)
          if (!open && scanLookupState !== "loading") {
            setScanLookupState("idle")
            setScanLookupChild(null)
            setScanLookupMessage("")
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl sm:text-3xl">
              {scanLookupState === "loading"
                ? "Checking QR code"
                : scanLookupState === "found"
                ? "Child Found"
                : scanLookupState === "not-found"
                ? "Child Not Found"
                : "QR Lookup Error"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanLookupState === "loading" ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">{scanLookupMessage}</p>
              </div>
            ) : null}

            {scanLookupState !== "loading" ? (
              <p className="text-base sm:text-lg leading-relaxed text-muted-foreground text-center">{scanLookupMessage}</p>
            ) : null}

            {scanLookupState === "found" && scanLookupChild ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-lg sm:text-xl font-semibold text-foreground">{scanLookupChild.childName}</p>
                <p className="mt-1 text-sm sm:text-base text-muted-foreground">Mother: {scanLookupChild.motherName}</p>
                <p className="text-sm sm:text-base text-muted-foreground">Phone: {scanLookupChild.motherPhone}</p>
                <p className="text-sm sm:text-base text-muted-foreground font-mono">CVCC ID: {scanLookupChild.displayId}</p>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">Village: {scanLookupChild.village}</p>
              </div>
            ) : null}

            {scanLookupState === "found" && scanLookupChild ? (
              <div className="flex flex-col gap-2">
                <Button className="h-12 w-full text-base" onClick={handleOpenScannedChildChart}>
                  Open child chart
                </Button>
                <Button variant="outline" className="h-12 w-full text-base" onClick={() => setShowScanLookupModal(false)}>
                  Continue scanning
                </Button>
              </div>
            ) : null}

            {scanLookupState === "not-found" ? (
              <div className="flex flex-col gap-2">
                {isOnline ? (
                  <Button
                    className="h-12 w-full text-base"
                    onClick={() => {
                      setShowScanLookupModal(false)
                      setShowTransferInModal(true)
                    }}
                  >
                    Transfer child in
                  </Button>
                ) : null}
                <Button variant="outline" className="h-12 w-full text-base" onClick={() => setShowScanLookupModal(false)}>
                  Close
                </Button>
              </div>
            ) : null}

            {scanLookupState === "error" ? (
              <Button className="h-12 w-full text-base" onClick={() => setShowScanLookupModal(false)}>
                Close
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer In Modal */}
      <TransferInModal
        open={showTransferInModal}
        onClose={() => setShowTransferInModal(false)}
        onSuccess={(childId) => {
          setSystemMessage(`Child transferred in successfully! Refreshing search...`)
          // Optionally refresh search results
        }}
      />
    </div>
  )
}

function ButtonReturn() {
  return (
    <Button asChild variant="ghost" size="sm" className="gap-2">
      <Link href="/chw/dashboard">
        <ChevronLeft className="h-4 w-4" /> My outreach
      </Link>
    </Button>
  )
}
