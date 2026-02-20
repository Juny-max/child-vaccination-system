"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Camera, ChevronLeft, Phone, QrCode, Search } from "lucide-react"
import { searchChwChildren, type ChwSearchResult } from "@/lib/api/chw"
import { chwOfflineDb, upsertChildren } from "@/lib/chw-offline/db"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LocalChildRecord = {
  id: string
  childName: string
  motherName: string
  motherPhone: string
  nextVaccine: string
  village: string
}

type CameraState = "idle" | "starting" | "active" | "error"

type SearchMode = "name" | "phone"

export default function ChwFindChildPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [searchMode, setSearchMode] = useState<SearchMode>("name")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LocalChildRecord[]>([])
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    const hasAuthState = Boolean(userId || accessToken || legacyToken)

    if (!hasAuthState) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff" || detail !== "chw") {
      router.push("/chw/dashboard")
      return
    }

    setUserName(name || "Community Health Worker")
  }, [router])

  useEffect(() => {
    if (cameraState !== "active") return
    const videoElement = videoRef.current
    if (!videoElement) return
    videoElement.srcObject = streamRef.current
    return () => {
      if (videoElement) {
        videoElement.srcObject = null
      }
    }
  }, [cameraState])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const filteredChildren = useMemo(() => results, [results])

  const mapSearchResult = (child: ChwSearchResult): LocalChildRecord => ({
    id: child.id,
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

    try {
      if (navigator.onLine) {
        const backendResults = await searchChwChildren(query)
        setResults(backendResults.map(mapSearchResult))

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
            ? `${backendResults.length} record${backendResults.length === 1 ? "" : "s"} found.`
            : "No match found in your assigned catchment.",
        )
        return
      }

      const normalized = query.trim().toLowerCase()
      const local = await chwOfflineDb.children
        .filter((child) => {
          if (searchMode === "name") {
            return child.fullName.toLowerCase().includes(normalized)
          }
          return (child.guardianPhone || "")
            .replace(/\s+/g, "")
            .includes(normalized.replace(/\s+/g, ""))
        })
        .toArray()

      const matches = local.map((child) => ({
        id: child.id,
        childName: child.fullName,
        motherName: child.guardianName || "Unknown",
        motherPhone: child.guardianPhone || "N/A",
        nextVaccine: "Review chart",
        village: "Offline cache",
      }))

      setResults(matches)
      setSystemMessage(
        matches.length > 0
          ? `${matches.length} offline record${matches.length === 1 ? "" : "s"} found.`
          : "No offline record found.",
      )
    } catch (error) {
      console.error("CHW search failed", error)
      setSystemMessage("Search failed. Please try again.")
      setResults([])
    }
  }

  const startCamera = async () => {
    if (cameraState === "active" || cameraState === "starting") return
    setCameraError(null)
    setCameraState("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      setCameraState("active")
      setSystemMessage("Camera ready. Align the CVCC QR to retrieve the child offline.")
    } catch (error) {
      console.error("QR camera failed", error)
      setCameraError("Unable to access camera. Check permissions or switch device.")
      setCameraState("error")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraState("idle")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ButtonReturn />
            <div>
              <p className="text-sm text-muted-foreground">Find child · Offline search</p>
              <p className="text-lg font-semibold text-foreground">My catchment records</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Community Health Worker</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
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
              <Search className="h-5 w-5 text-primary" /> Search locally cached child
            </CardTitle>
            <CardDescription>Type the child name or mother phone exactly as recorded during outreach.</CardDescription>
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
              <Button type="submit" className="h-14 w-full sm:w-auto sm:px-8">
                Search
              </Button>
            </form>

            <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tip from the field</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Work offline all day. As long as you synced at the clinic this morning, every child in your catchment is already
                saved locally and searchable.
              </p>
            </div>

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
                          <p className="text-xs text-muted-foreground font-mono">{child.id}</p>
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
            {cameraState === "active" ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <video ref={videoRef} autoPlay playsInline className="h-56 w-full bg-black/80 object-cover" />
                  <div className="pointer-events-none absolute inset-0 border-4 border-dashed border-primary/80" />
                </div>
                <Button size="sm" variant="outline" onClick={stopCamera}>
                  Stop camera
                </Button>
              </div>
            ) : null}
            {cameraState === "error" ? (
              <p className="text-xs text-muted-foreground">
                If your phone blocks camera access, allow permissions in settings or use the manual search above.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Once the QR is decoded, the offline chart opens instantly. No internet needed on the field.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
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
