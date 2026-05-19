"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Baby, Calendar, FileImage, MapPin, Search, X } from "lucide-react"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"
import { supabase } from "@/lib/supabase"

type GuardianOption = {
  id: string
  name: string
  phone: string
  community: string
}

type ChildFormState = {
  guardianId: string
  childName: string
  dateOfBirth: string
  gender: "male" | "female" | "intersex" | "undisclosed"
  birthWeight: string
  birthLength: string
  headCircumference: string
  placeOfBirth: string
  deliveryType: string
  birthOrder: string
  bloodType: string
  profileImageName: string | null
  profileImageFile: File | null
  notes: string
}

const initialState: ChildFormState = {
  guardianId: "",
  childName: "",
  dateOfBirth: "",
  gender: "male",
  birthWeight: "",
  birthLength: "",
  headCircumference: "",
  placeOfBirth: "",
  deliveryType: "",
  birthOrder: "",
  bloodType: "",
  profileImageName: null,
  profileImageFile: null,
  notes: "",
}

const MAX_CHILD_REGISTRATION_AGE_YEARS = 5

const toDateOnly = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())

function RegisterChildContent() {
  const GUARDIANS_PAGE_SIZE = 20
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userName, setUserName] = useState("")
  const [searchGuardian, setSearchGuardian] = useState("")
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianOption | null>(null)
  const [guardians, setGuardians] = useState<GuardianOption[]>([])
  const [guardiansOffset, setGuardiansOffset] = useState(0)
  const [hasMoreGuardians, setHasMoreGuardians] = useState(false)
  const [isLoadingMoreGuardians, setIsLoadingMoreGuardians] = useState(false)
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(false)
  const [guardianLoadError, setGuardianLoadError] = useState<string | null>(null)
  const [formData, setFormData] = useState<ChildFormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const childDetailsRef = useRef<HTMLDivElement>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [registeredChildId, setRegisteredChildId] = useState<string | null>(null)
  const maxDateOfBirth = useMemo(() => toDateOnly(new Date()), [])
  const minDateOfBirth = useMemo(() => {
    const minDate = new Date(maxDateOfBirth)
    minDate.setFullYear(minDate.getFullYear() - MAX_CHILD_REGISTRATION_AGE_YEARS)
    return minDate
  }, [maxDateOfBirth])

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/facility/dashboard")
      return
    }

    setUserName(name || "Facility Nurse")
  }, [router])

  // Load pre-filled mother from query parameter
  useEffect(() => {
    const motherId = searchParams.get("motherId")
    if (!motherId) return

    const loadPrefilledMother = async () => {
      setIsLoadingPrefilledMother(true)
      try {
        const { data, error } = await supabase
          .from("guardians")
          .select("id, full_name, phone_number, community")
          .eq("id", motherId)
          .single()

        if (error || !data) {
          setMotherLoadError("Could not load the selected mother. Please search and select again.")
          return
        }

        const motherOption: MotherOption = {
          id: data.id,
          name: data.full_name,
          phone: data.phone_number,
          community: data.community || "",
        }

        setSelectedMother(motherOption)
        setFormData((prev) => ({ ...prev, motherId: data.id }))
        setSystemMessage(`Linked to ${data.full_name}. Continue with child details.`)
      } catch (error) {
        console.error("Error loading prefilled mother:", error)
        setMotherLoadError("Error loading mother details. Please search manually.")
      } finally {
        setIsLoadingPrefilledMother(false)
      }
    }

    loadPrefilledMother()
  }, [searchParams])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  useEffect(() => {
    let isActive = true
    const trimmedQuery = searchGuardian.trim()

    if (!trimmedQuery) {
      setGuardians([])
      setGuardiansOffset(0)
      setHasMoreGuardians(false)
      setIsLoadingGuardians(false)
      setGuardianLoadError(null)
      return () => {
        isActive = false
      }
    }

    const timer = window.setTimeout(async () => {
      setIsLoadingGuardians(true)
      setGuardianLoadError(null)

      try {
        const data = await facilityApi.getGuardians({
          query: trimmedQuery,
          limit: GUARDIANS_PAGE_SIZE,
          offset: 0,
        })

        if (!isActive) return

        setGuardians(data || [])
        setGuardiansOffset((data || []).length)
        setHasMoreGuardians((data || []).length === GUARDIANS_PAGE_SIZE)
      } catch {
        if (!isActive) return
        setGuardianLoadError("Unable to load guardians. Please refresh or re-login.")
        setGuardians([])
        setGuardiansOffset(0)
        setHasMoreGuardians(false)
      } finally {
        if (isActive) setIsLoadingGuardians(false)
      }
    }, 300)

    return () => {
      isActive = false
      window.clearTimeout(timer)
    }
  }, [searchGuardian])

  const filteredGuardians = useMemo(() => guardians, [guardians])

  const loadMoreGuardians = async () => {
    if (isLoadingMoreGuardians || !hasMoreGuardians) return
    setIsLoadingMoreGuardians(true)
    try {
      const data = await facilityApi.getGuardians({
        query: searchGuardian,
        limit: GUARDIANS_PAGE_SIZE,
        offset: guardiansOffset,
      })

      setGuardians((previous) => [...previous, ...(data || [])])
      setGuardiansOffset((previous) => previous + (data || []).length)
      setHasMoreGuardians((data || []).length === GUARDIANS_PAGE_SIZE)
    } catch {
      setGuardianLoadError("Unable to load more guardians right now.")
    } finally {
      setIsLoadingMoreGuardians(false)
    }
  }

  const handleSelectGuardian = (guardian: GuardianOption) => {
    setSelectedGuardian(guardian)
    setFormData((previous) => ({ ...previous, guardianId: guardian.id }))
    setSystemMessage(`Linked to ${guardian.name}. Continue with child details.`)
  }

  const isGuardianSelected = (guardianId: string) => selectedGuardian?.id === guardianId

  const handleChange = <Field extends keyof ChildFormState>(field: Field, value: ChildFormState[Field]) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedGuardian) {
      setSystemMessage("Select an existing guardian before saving the child record.")
      toast.error("Please select a guardian first")
      return
    }

    if (!formData.childName || !formData.dateOfBirth) {
      setSystemMessage("Child name and date of birth are required.")
      toast.error("Please fill in all required fields")
      return
    }

    const parsedDateOfBirth = new Date(`${formData.dateOfBirth}T00:00:00`)
    if (Number.isNaN(parsedDateOfBirth.getTime())) {
      setSystemMessage("Invalid date of birth. Please pick a valid date.")
      toast.error("Please choose a valid date of birth")
      return
    }

    const normalizedDob = toDateOnly(parsedDateOfBirth)
    if (normalizedDob > maxDateOfBirth) {
      setSystemMessage("Date of birth cannot be in the future.")
      toast.error("Date of birth cannot be in the future")
      return
    }

    if (normalizedDob < minDateOfBirth) {
      setSystemMessage(
        `Only children aged ${MAX_CHILD_REGISTRATION_AGE_YEARS} years or below can be registered here.`,
      )
      toast.error(`Child age must be ${MAX_CHILD_REGISTRATION_AGE_YEARS} years or below`)
      return
    }

    setIsSubmitting(true)
    setSystemMessage(null)

    try {
      const branchId = localStorage.getItem("branchId") || null

      // Validate branchId exists (required for linking child to facility)
      if (!branchId) {
        setSystemMessage("❌ Session error: Facility information missing. Please log out and log in again.")
        setIsSubmitting(false)
        return
      }

      // Upload profile image to Supabase Storage if provided
      let profilePhotoUrl: string | null = null
      if (formData.profileImageFile) {
        const fileExt = formData.profileImageFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const filePath = `child-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from("child-photos")
          .upload(filePath, formData.profileImageFile, {
            cacheControl: "3600",
            upsert: true,
          })
        
        if (uploadError) {
          console.error("Image upload error:", uploadError)
          // Continue without image — don't block registration
          toast.warning("Photo upload failed — child will be registered without photo.")
        } else {
          const { data: urlData } = supabase.storage
            .from("child-photos")
            .getPublicUrl(filePath)
          profilePhotoUrl = urlData.publicUrl
        }
      }

      const result = await facilityApi.registerChild({
        guardianId: selectedGuardian.id,
        fullName: formData.childName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        birthWeight: formData.birthWeight ? parseFloat(formData.birthWeight) : undefined,
        birthLength: formData.birthLength ? parseFloat(formData.birthLength) : undefined,
        headCircumference: formData.headCircumference ? parseFloat(formData.headCircumference) : undefined,
        placeOfBirth: formData.placeOfBirth || undefined,
        deliveryType: formData.deliveryType || undefined,
        birthOrder: formData.birthOrder || undefined,
        bloodType: formData.bloodType || undefined,
        notes: formData.notes || undefined,
        profilePhotoUrl: profilePhotoUrl || undefined,
        branchId: branchId || undefined,
      })

      if (result.smsSent) {
        toast.success(`Child registered. SMS sent to ${result.guardianPhone}.`)
      } else {
        toast.warning("Child registered, but SMS delivery failed. Please verify guardian phone number.")
      }

      // Show success modal
      setRegisteredChildId(result.cvccId)
      setShowSuccessModal(true)
      setIsSubmitting(false)

    } catch (error) {
      console.error("Child registration failed:", error)
      const message = error instanceof Error ? error.message : "Failed to register child"
      setSystemMessage(`Registration failed: ${message}`)
      toast.error(`Registration failed: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/facility/dashboard">
                <ArrowLeft className="h-4 w-4" /> Today&apos;s clinic
              </Link>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Facility Nurse Workflow</p>
              <p className="text-lg font-semibold text-foreground">Register new child</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Facility Nurse</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {systemMessage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="mt-6 border-primary/40">
          <CardHeader className="space-y-2">
            <CardTitle>Link to guardian</CardTitle>
            <CardDescription>Select the guardian registered in the Guardian Register before capturing the child&apos;s details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="guardianSearch">Search guardian</Label>
                {!isLoadingGuardians && guardians.length > 0 && (
                  <span className="text-xs text-muted-foreground">{guardians.length} registered</span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="guardianSearch"
                  type="search"
                  placeholder="e.g. Akosua Mensah or +233 24 500 1100"
                  value={searchGuardian}
                  onChange={(event) => setSearchGuardian(event.target.value)}
                  className="pl-11"
                />
              </div>
            </div>
            {guardianLoadError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{guardianLoadError}</AlertDescription>
              </Alert>
            ) : null}
            {!searchGuardian.trim() ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Search for a guardian by name, phone, or community to display results.
              </div>
            ) : null}
            {isLoadingGuardians ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-3 py-2">
                  <DotLottieReact src="/Free%20Searching%20Animation.lottie" autoplay loop className="h-24 w-24" />
                  <p>Searching guardians in the Guardian Register...</p>
                </div>
              </div>
            ) : searchGuardian.trim() && guardians.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900">⚠️ No guardians available</p>
                <p className="text-xs text-amber-800">
                  No guardians matched your search. Try a different name, phone, or community.
                </p>
              </div>
            ) : searchGuardian.trim() && filteredGuardians.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                No guardians match &quot;{searchGuardian}&quot;. Try a different search or clear the search to see all {guardians.length} registered guardians.
              </div>
            ) : searchGuardian.trim() ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredGuardians.map((guardian) => (
                    <button
                      key={guardian.id}
                      type="button"
                      className={`rounded-lg border p-4 text-left transition ${
                        isGuardianSelected(guardian.id) ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                      onClick={() => handleSelectGuardian(guardian)}
                    >
                      <p className="text-sm font-semibold text-foreground">{guardian.name}</p>
                      <p className="text-xs text-muted-foreground">{guardian.phone}</p>
                      <p className="text-xs text-muted-foreground">Community: {guardian.community}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">ID: {guardian.id.slice(0, 8)}...</p>
                    </button>
                  ))}
                </div>
                {hasMoreGuardians ? (
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" onClick={loadMoreGuardians} disabled={isLoadingMoreGuardians}>
                      {isLoadingMoreGuardians ? "Loading more..." : "Load more guardians"}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="text-xs text-muted-foreground">
              Guardian missing? <Link href="/facility/register-mother" className="text-primary hover:underline">Register a new guardian</Link> first.
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-primary/40" ref={childDetailsRef}>
          <CardHeader className="space-y-2">
            <CardTitle>Child details</CardTitle>
            <CardDescription>
              Enter the details from the child&apos;s digital health record. These drive the automated vaccine schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="childName">Child&apos;s full name</Label>
                  <Input
                    id="childName"
                    required
                    placeholder="e.g. Kwame Boateng"
                    value={formData.childName}
                    onChange={(event) => handleChange("childName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthOrder">Birth order</Label>
                  <Input
                    id="birthOrder"
                    placeholder="e.g. 1st, 2nd"
                    value={formData.birthOrder}
                    onChange={(event) => handleChange("birthOrder", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of birth</Label>
                  <DatePicker
                    date={formData.dateOfBirth ? new Date(`${formData.dateOfBirth}T00:00:00`) : undefined}
                    onDateChange={(selectedDate) => {
                      if (!selectedDate) {
                        handleChange("dateOfBirth", "")
                        return
                      }
                      const year = selectedDate.getFullYear()
                      const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
                      const day = String(selectedDate.getDate()).padStart(2, "0")
                      handleChange("dateOfBirth", `${year}-${month}-${day}`)
                    }}
                    placeholder="Select date of birth"
                    minDate={minDateOfBirth}
                    maxDate={maxDateOfBirth}
                    fromYear={minDateOfBirth.getFullYear()}
                    toYear={new Date().getFullYear()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Register children from birth to {MAX_CHILD_REGISTRATION_AGE_YEARS} years old.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.gender}
                    onChange={(event) => handleChange("gender", event.target.value as ChildFormState["gender"])}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="intersex">Intersex</option>
                    <option value="undisclosed">Prefer not to say</option>
                  </select>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="birthWeight">Birth weight (kg)</Label>
                  <Input
                    id="birthWeight"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    placeholder="e.g. 3.2"
                    value={formData.birthWeight}
                    onChange={(event) => handleChange("birthWeight", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthLength">Birth length / height (cm)</Label>
                  <Input
                    id="birthLength"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 49"
                    value={formData.birthLength}
                    onChange={(event) => handleChange("birthLength", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headCircumference">Head circumference (cm)</Label>
                  <Input
                    id="headCircumference"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 34"
                    value={formData.headCircumference}
                    onChange={(event) => handleChange("headCircumference", event.target.value)}
                  />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Place of birth</Label>
                  <Input
                    id="placeOfBirth"
                    required
                    placeholder="e.g. Jakpa District Hospital"
                    value={formData.placeOfBirth}
                    onChange={(event) => handleChange("placeOfBirth", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryType">Mode of delivery</Label>
                  <select
                    id="deliveryType"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.deliveryType}
                    onChange={(event) => handleChange("deliveryType", event.target.value)}
                  >
                    <option value="">Select option</option>
                    <option value="spontaneous vaginal">Spontaneous vaginal</option>
                    <option value="assisted vaginal">Assisted vaginal</option>
                    <option value="cesarean section">Caesarean section</option>
                    <option value="breech">Breech</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloodType">Blood type</Label>
                  <select
                    id="bloodType"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.bloodType}
                    onChange={(event) => handleChange("bloodType", event.target.value)}
                  >
                    <option value="">Select blood type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A−</option>
                    <option value="B+">B+</option>
                    <option value="B-">B−</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB−</option>
                    <option value="O+">O+</option>
                    <option value="O-">O−</option>
                  </select>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profileImage">Profile image</Label>
                  {imagePreview ? (
                    <div className="relative w-full">
                      <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null)
                          handleChange("profileImageFile", null)
                          handleChange("profileImageName", null)
                          if (fileInputRef.current) fileInputRef.current.value = ""
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow-md hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{formData.profileImageName}</p>
                    </div>
                  ) : (
                    <label
                      htmlFor="profileImage"
                      className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground hover:border-primary"
                    >
                      <span>Capture photo or upload from device</span>
                      <FileImage className="h-4 w-4" />
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleChange("profileImageName", file.name)
                        handleChange("profileImageFile", file)
                        const reader = new FileReader()
                        reader.onloadend = () => setImagePreview(reader.result as string)
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Optional but recommended for quick identification during busy clinics.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Neonatal notes</Label>
                  <textarea
                    id="notes"
                    placeholder="e.g. Received Vitamin K at birth, early breastfeeding established."
                    className="min-h-[104px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                  />
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule will auto-populate all EPI doses using DOB once saved.
                </span>
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  <Baby className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save child record"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>After saving, proceed to the child&apos;s patient chart to record today&apos;s vaccines.</p>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/facility/dashboard">
              Back to Today&apos;s Clinic
              <MapPin className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {/* Success Animation */}
                <div className="mb-4 h-32 w-32">
                  <DotLottieReact
                    src="/Done.lottie"
                    loop={false}
                    autoplay
                  />
                </div>

                {/* Success Message */}
                <h2 className="mb-2 text-2xl font-bold text-green-600 dark:text-green-500">
                  Registration Successful!
                </h2>
                
                <p className="mb-4 text-lg font-medium">
                  Child ID: <span className="font-mono text-primary">{registeredChildId}</span>
                </p>

                {/* Important Messages */}
                <div className="mb-6 w-full space-y-3 rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-950/30">
                  <p className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-blue-600 dark:text-blue-400">✓</span>
                    <span>Child profile created and linked to guardian</span>
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-blue-600 dark:text-blue-400">✓</span>
                    <span>QR code generated for quick patient lookup</span>
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-blue-600 dark:text-blue-400">✓</span>
                    <span>Ready to record today&apos;s vaccination schedule</span>
                  </p>
                  <p className="flex items-start gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                    <span className="mt-0.5">⚠</span>
                    <span>Remember to administer birth vaccines (BCG, OPV-0, HepB) if applicable</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex w-full gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowSuccessModal(false)
                      setFormData(initialState)
                      setSelectedGuardian(null)
                      setSearchGuardian("")
                      setImagePreview(null)
                      setRegisteredChildId(null)
                    }}
                  >
                    Register Another
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setShowSuccessModal(false)
                      router.push('/facility/dashboard')
                    }}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function RegisterChildPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <RegisterChildContent />
    </Suspense>
  )
}
