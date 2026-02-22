"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronLeft, Compass, Loader2, MapPin, Save } from "lucide-react"
import { queueChwOfflineRegistration, searchChwMothers, type ChwMotherSearchResult } from "@/lib/api/chw"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type RegistrationStep = 1 | 2

type RegistrationForm = {
  motherName: string
  motherPhone: string
  childName: string
  childDob: string
  childGender: "male" | "female" | ""
  latitude?: number
  longitude?: number
}

type MotherSuggestion = {
  name: string
  phone: string
}

const initialForm: RegistrationForm = {
  motherName: "",
  motherPhone: "",
  childName: "",
  childDob: "",
  childGender: "",
}

export default function ChwRegisterChildPage() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [userName, setUserName] = useState("")
  const [step, setStep] = useState<RegistrationStep>(1)
  const [form, setForm] = useState<RegistrationForm>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationForm, string>>>({})
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [motherSuggestions, setMotherSuggestions] = useState<MotherSuggestion[]>([])
  const [showMotherSuggestions, setShowMotherSuggestions] = useState(false)
  const [loadingMotherSuggestions, setLoadingMotherSuggestions] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "captured" | "error">("idle")
  const [gpsError, setGpsError] = useState<string | null>(null)

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
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  useEffect(() => {
    const query = form.motherName.trim()

    if (!isOnline || step !== 1 || query.length < 2) {
      setMotherSuggestions([])
      setShowMotherSuggestions(false)
      setLoadingMotherSuggestions(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        setLoadingMotherSuggestions(true)
        const results = await searchChwMothers(query)

        setMotherSuggestions(
          results
            .filter((entry: ChwMotherSearchResult) => !!entry.name && !!entry.phone)
            .map((entry: ChwMotherSearchResult) => ({
              name: entry.name,
              phone: entry.phone,
            }))
            .slice(0, 6),
        )
        setShowMotherSuggestions(true)
      } catch (error) {
        console.error("Failed to load mother suggestions", error)
        setMotherSuggestions([])
        setShowMotherSuggestions(false)
      } finally {
        setLoadingMotherSuggestions(false)
      }
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [form.motherName, isOnline, step])

  const updateForm = <Field extends keyof RegistrationForm>(field: Field, value: RegistrationForm[Field]) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    if (errors[field]) {
      setErrors((previous) => {
        const { [field]: _removed, ...rest } = previous
        return rest
      })
    }
  }

  const validateStep = (targetStep: RegistrationStep) => {
    const newErrors: Partial<Record<keyof RegistrationForm, string>> = {}
    if (targetStep === 1) {
      if (!form.motherName.trim()) {
        newErrors.motherName = "Mother's full name is required."
      }
      if (!form.motherPhone.trim()) {
        newErrors.motherPhone = "Phone number is required for SMS reminders."
      }
    }
    if (targetStep === 2) {
      if (!form.childName.trim()) {
        newErrors.childName = "Child's full name is required."
      }
      if (!form.childDob) {
        newErrors.childDob = "Date of birth is required to schedule vaccines."
      }
      if (!form.childGender) {
        newErrors.childGender = "Select the child's gender."
      }
      if (form.latitude === undefined || form.longitude === undefined) {
        newErrors.latitude = "Capture the household GPS before saving."
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep(1)) return
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
  }

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError("Device cannot capture GPS. Record coordinates manually later.")
      setGpsStatus("error")
      return
    }
    setGpsStatus("locating")
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateForm("latitude", Number(position.coords.latitude.toFixed(6)))
        updateForm("longitude", Number(position.coords.longitude.toFixed(6)))
        setGpsStatus("captured")
        setSystemMessage("GPS captured. Household pinned for branch heatmap.")
      },
      (error) => {
        console.error("GPS error", error)
        setGpsStatus("error")
        setGpsError("Unable to capture GPS. Try again outdoors or nearer to the sky.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateStep(2)) return
    setSaving(true)

    try {
      await queueChwOfflineRegistration({
        motherName: form.motherName,
        motherPhone: form.motherPhone,
        childName: form.childName,
        childDob: form.childDob,
        childGender: form.childGender,
        latitude: form.latitude,
        longitude: form.longitude,
        source: "chw-register-child",
        submittedAt: new Date().toISOString(),
      })

      setSystemMessage("Registration saved and queued to backend successfully.")
      setForm(initialForm)
      setStep(1)
      setGpsStatus("idle")
    } catch (error) {
      console.error("Failed to queue registration", error)
      setSystemMessage("Offline registration saved locally and will retry when connection improves.")
    } finally {
      setSaving(false)
    }
  }

  const selectMotherSuggestion = (suggestion: MotherSuggestion) => {
    updateForm("motherName", suggestion.name)
    updateForm("motherPhone", suggestion.phone)
    setMotherSuggestions([])
    setShowMotherSuggestions(false)
  }

  const gpsButtonLabel = () => {
    switch (gpsStatus) {
      case "locating":
        return "Capturing GPS…"
      case "captured":
        return "GPS captured"
      default:
        return "Record household GPS"
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <ButtonBack />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm">Register child · Offline form</p>
              <p className="truncate text-sm font-semibold text-foreground sm:text-lg">Door-to-door capture</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NetworkStatusIndicator />
            <ThemeToggle />
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Community Health Worker</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        {systemMessage ? (
          <Alert className="mb-4">
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}
        {gpsError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{gpsError}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Minimal registration</CardTitle>
            <CardDescription>Capture only what the field guideline requires. Additional details are completed at the clinic.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="mother-name">Mother&apos;s full name</Label>
                    <Input
                      id="mother-name"
                      value={form.motherName}
                      onChange={(event) => {
                        updateForm("motherName", event.target.value)
                        setShowMotherSuggestions(true)
                      }}
                      placeholder="e.g. Child Nyarko"
                      autoComplete="off"
                      aria-invalid={errors.motherName ? "true" : undefined}
                    />
                    {isOnline && showMotherSuggestions ? (
                      <div className="mt-2 rounded-md border border-border bg-background">
                        {loadingMotherSuggestions ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking existing mothers...
                          </div>
                        ) : motherSuggestions.length > 0 ? (
                          <div className="py-1">
                            {motherSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.name}-${suggestion.phone}`}
                                type="button"
                                onClick={() => selectMotherSuggestion(suggestion)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                              >
                                <span className="text-sm text-foreground">{suggestion.name}</span>
                                <span className="text-xs text-muted-foreground">{suggestion.phone}</span>
                              </button>
                            ))}
                          </div>
                        ) : form.motherName.trim().length >= 2 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No existing mother found.</p>
                        ) : null}
                      </div>
                    ) : null}
                    {errors.motherName ? (
                      <p className="text-xs text-destructive">{errors.motherName}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Match the name in the maternal record book if available.</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="mother-phone">Mother&apos;s phone number</Label>
                    <Input
                      id="mother-phone"
                      value={form.motherPhone}
                      onChange={(event) => updateForm("motherPhone", event.target.value)}
                      placeholder="e.g. +23324 123 4567"
                      aria-invalid={errors.motherPhone ? "true" : undefined}
                    />
                    {errors.motherPhone ? (
                      <p className="text-xs text-destructive">{errors.motherPhone}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Used for SMS reminders from the head office system.</p>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Step 1 of 2</span>
                    <Button type="button" onClick={handleNext}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="child-name">Child&apos;s full name</Label>
                    <Input
                      id="child-name"
                      value={form.childName}
                      onChange={(event) => updateForm("childName", event.target.value)}
                      placeholder="e.g. Kojo Mensima"
                      aria-invalid={errors.childName ? "true" : undefined}
                    />
                    {errors.childName ? (
                      <p className="text-xs text-destructive">{errors.childName}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Record the exact names spoken by the mother/caregiver.</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="child-dob">Date of birth</Label>
                    <Input
                      id="child-dob"
                      type="date"
                      value={form.childDob}
                      onChange={(event) => updateForm("childDob", event.target.value)}
                      aria-invalid={errors.childDob ? "true" : undefined}
                    />
                    {errors.childDob ? (
                      <p className="text-xs text-destructive">{errors.childDob}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Use the weighing card or ask the mother to confirm.</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm">Gender</Label>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="child-gender"
                          value="male"
                          checked={form.childGender === "male"}
                          onChange={() => updateForm("childGender", "male")}
                        />
                        Male
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="child-gender"
                          value="female"
                          checked={form.childGender === "female"}
                          onChange={() => updateForm("childGender", "female")}
                        />
                        Female
                      </label>
                    </div>
                    {errors.childGender ? <p className="text-xs text-destructive">{errors.childGender}</p> : null}
                  </div>

                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Household GPS</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Capture coordinates outdoors near the compound entrance. Keeps branch heatmaps accurate.
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <Button
                        type="button"
                        onClick={captureGps}
                        variant={gpsStatus === "captured" ? "default" : "outline"}
                        className="gap-2"
                        disabled={gpsStatus === "locating"}
                      >
                        {gpsStatus === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
                        {gpsButtonLabel()}
                      </Button>
                      {form.latitude !== undefined && form.longitude !== undefined ? (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {form.latitude}, {form.longitude}
                        </p>
                      ) : null}
                    </div>
                    {errors.latitude ? <p className="mt-2 text-xs text-destructive">{errors.latitude}</p> : null}
                  </div>

                  <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      Back
                    </Button>
                    <Button type="submit" className="gap-2" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save locally
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Alert className="mt-6 bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Once you reach network, the service worker posts pending registrations to head office automatically. No extra steps needed.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  )
}

function ButtonBack() {
  return (
    <Button asChild variant="ghost" size="sm" className="gap-2">
      <Link href="/chw/dashboard">
        <ChevronLeft className="h-4 w-4" /> My outreach
      </Link>
    </Button>
  )
}
