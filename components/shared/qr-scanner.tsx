"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError?: (error: string) => void
  isActive?: boolean
}

export function QRScanner({ onScanSuccess, onScanError, isActive = true }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isMountedRef = useRef(true)
  const reactId = useId()
  const scannerDivId = useRef(`qr-reader-${reactId.replace(/:/g, "-")}`).current

  const startScanning = async () => {
    try {
      setCameraError(null)
      
      if (!isActive) {
        toast.info("Scanner is currently disabled")
        return
      }

      await teardownScanner()

      // Check if already scanning
      if (scannerRef.current?.isScanning) {
        toast.info("Scanner is already running")
        return
      }

      // Initialize scanner only once
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerDivId)
      }

      // Get cameras
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        const error = "No cameras found on this device"
        setCameraError(error)
        toast.error(error)
        return
      }

      // Prefer back camera on mobile, otherwise use first available
      const cameraId = cameras.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear')
      )?.id || cameras[0].id

      // Start scanning
      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback
          if (isMountedRef.current) {
            toast.success("QR Code scanned successfully")
            onScanSuccess(decodedText)
            stopScanning()
          }
        },
        (errorMessage) => {
          // Error callback (scanning errors, not critical)
          // This fires frequently while scanning, so we don't show toast
          if (onScanError && !errorMessage.includes("NotFoundException")) {
            console.log("Scan error:", errorMessage)
          }
        }
      )

      if (isMountedRef.current) {
        setIsScanning(true)
        toast.info("Camera activated. Position QR code within the frame")
      }
    } catch (error) {
      const abortError = error instanceof DOMException && error.name === "AbortError"
      const errorMsg = abortError
        ? "Camera start was interrupted. Please try again and ensure no other app is using the camera."
        : error instanceof Error
          ? error.message
          : String(error ?? "Failed to start camera")

      if (isMountedRef.current) {
        setCameraError(errorMsg)
        toast.error(`Camera error: ${errorMsg}`)
        setIsScanning(false)
      }
    }
  }

  const teardownScanner = useCallback(async () => {
    if (!scannerRef.current) return

    try {
      const state = scannerRef.current.getState()
      if (state === 2) { // SCANNING
        await scannerRef.current.stop()
      }
    } catch (error) {
      console.warn("Scanner stop warning:", error)
    }

    try {
      if (typeof document !== "undefined") {
        const container = document.getElementById(scannerDivId)
        if (container) {
          container.innerHTML = ""
        }
      }
    } catch (error) {
      console.warn("Scanner container cleanup warning:", error)
    }

    scannerRef.current = null
  }, [scannerDivId])

  const stopScanning = useCallback(async () => {
    try {
      await teardownScanner()
    } finally {
      if (isMountedRef.current) {
        setIsScanning(false)
      }
    }
  }, [teardownScanner])

  useEffect(() => {
    if (!isActive) {
      stopScanning()
    }
  }, [isActive, stopScanning])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      teardownScanner()
    }
  }, [teardownScanner])

  return (
    <Card className="border-primary/30">
      <CardContent className="p-6 space-y-4">
        {/* Scanner Display Area */}
        <div className="relative">
          <div 
            id={scannerDivId} 
            className={`w-full rounded-lg overflow-hidden min-h-[300px] ${
              isScanning ? "border-2 border-primary" : "border border-dashed border-muted-foreground/30 bg-muted/30"
            }`}
          />

          {!isScanning && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/70 text-center">
              <Camera className="mb-4 h-16 w-16 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Click the button below to activate the camera
              </p>
            </div>
          )}

          {cameraError && !isScanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/80 text-center">
              <CameraOff className="mb-4 h-16 w-16 text-red-500/40" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                Camera Access Error
              </p>
              <p className="text-xs text-muted-foreground px-6">
                {cameraError}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {!isScanning ? (
            <Button 
              onClick={startScanning} 
              className="flex-1 gap-2"
              size="lg"
            >
              <Camera className="h-4 w-4" />
              Start Camera Scanner
            </Button>
          ) : (
            <Button 
              onClick={stopScanning} 
              variant="destructive"
              className="flex-1 gap-2"
              size="lg"
            >
              <CameraOff className="h-4 w-4" />
              Stop Scanner
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">
            📱 How to scan QR codes:
          </p>
          <ul className="space-y-1 text-xs text-blue-600 dark:text-blue-300">
            <li>• Click &ldquo;Start Camera Scanner&rdquo; to activate your device camera</li>
            <li>• Hold the certificate QR code within the scanning frame</li>
            <li>• Keep the code steady until it&apos;s automatically detected</li>
            <li>• The system will verify the certificate immediately after scanning</li>
          </ul>
        </div>

        {/* Browser Permissions Notice */}
        {cameraError?.includes("permission") && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
              ⚠️ Camera Permission Required
            </p>
            <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-300">
              <li>• Your browser is blocking camera access</li>
              <li>• Click the camera icon in your browser&apos;s address bar</li>
              <li>• Select &ldquo;Allow&rdquo; to grant camera permission</li>
              <li>• Then click &ldquo;Start Camera Scanner&rdquo; again</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
