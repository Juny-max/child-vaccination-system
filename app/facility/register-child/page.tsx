"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Baby, Calendar, FileImage, MapPin, Search, X } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

type MotherOption = {
  id: string
  name: string
  phone: string
  community: string
}

type ChildFormState = {
  motherId: string
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
  motherId: "",
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

export default function RegisterChildPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [searchMother, setSearchMother] = useState("")
  const [selectedMother, setSelectedMother] = useState<MotherOption | null>(null)
  const [mothers, setMothers] = useState<MotherOption[]>([])
  const [isLoadingMothers, setIsLoadingMothers] = useState(true)
  const [motherLoadError, setMotherLoadError] = useState<string | null>(null)
  const [formData, setFormData] = useState<ChildFormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      router.push("/facility/dashboard")
      return
    }

    setUserName(name || "Facility Nurse")
  }, [router])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  useEffect(() => {
    let isActive = true
    const fetchMothers = async () => {
      setIsLoadingMothers(true)
      setMotherLoadError(null)
      
      try {
        // Query guardians table for mother/caregiver details
        const { data, error, count } = await supabase
          .from("guardians")
          .select("id, full_name, phone_primary, community", { count: 'exact' })
          .order("full_name", { ascending: true })

        if (!isActive) return

        console.log("Guardians query result:", { data, error, count, dataLength: data?.length })

        if (error) {
          console.error("Supabase error loading guardians:", error)
          setMotherLoadError(`Database query failed: ${error.message}. Check RLS policies on guardians table.`)
          setMothers([])
        } else if (!data || data.length === 0) {
          console.warn("Query succeeded but returned 0 rows. Count:", count)
          console.warn("This might be a Row Level Security (RLS) issue. Check if guardians table has RLS enabled.")
          setMothers([])
        } else {
          console.log(`Successfully loaded ${data.length} mothers from guardians table`)
          const mapped = data.map((guardian) => ({
            id: guardian.id,
            name: guardian.full_name,
            phone: guardian.phone_primary,
            community: guardian.community || "Unknown community",
          }))
          setMothers(mapped)
        }
      } catch (err) {
        console.error("Exception while fetching mothers:", err)
        setMotherLoadError("Unexpected error loading mothers. Check console for details.")
        setMothers([])
      } finally {
        setIsLoadingMothers(false)
      }
    }

    fetchMothers()
    return () => {
      isActive = false
    }
  }, [])

  const filteredMothers = useMemo(() => {
    if (!searchMother) return mothers
    const haystack = searchMother.trim().toLowerCase()
    return mothers.filter((mother) => `${mother.name} ${mother.phone} ${mother.community}`.toLowerCase().includes(haystack))
  }, [mothers, searchMother])

  const handleSelectMother = (mother: MotherOption) => {
    setSelectedMother(mother)
    setFormData((previous) => ({ ...previous, motherId: mother.id }))
    setSystemMessage(`Linked to ${mother.name}. Continue with child details.`)
  }

  const isMotherSelected = (motherId: string) => selectedMother?.id === motherId

  const handleChange = <Field extends keyof ChildFormState>(field: Field, value: ChildFormState[Field]) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedMother) {
      setSystemMessage("Select an existing mother before saving the child record.")
      toast.error("Please select a mother first")
      return
    }

    if (!formData.childName || !formData.dateOfBirth) {
      setSystemMessage("Child name and date of birth are required.")
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    setSystemMessage(null)

    try {
      // Generate unique CVCC ID (format: CVCC-YYYYMMDD-XXXX)
      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const cvccId = `CVCC-${dateStr}-${randomSuffix}`
      const qrPayload = JSON.stringify({ cvccId, name: formData.childName, dob: formData.dateOfBirth })

      // Get current user ID from localStorage
      const userId = localStorage.getItem("userId") || null
      const branchId = localStorage.getItem("branchId") || null

      // Upload profile image to Supabase Storage if provided
      let profilePhotoUrl: string | null = null
      if (formData.profileImageFile) {
        const fileExt = formData.profileImageFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const filePath = `${cvccId}.${fileExt}`
        
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

      console.log("Attempting to insert child with data:", {
        cvccId,
        fullName: formData.childName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        userId,
      })

      // Check Supabase client auth status
      const { data: { session } } = await supabase.auth.getSession()
      console.log("Current Supabase session:", session ? "Authenticated" : "Anonymous (using anon key)")

      // Insert child record
      const { data: childData, error: childError } = await supabase
        .from("children")
        .insert({
          cvcc_id: cvccId,
          qr_code_payload: qrPayload,
          full_name: formData.childName,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          birth_weight: formData.birthWeight ? parseFloat(formData.birthWeight) : null,
          birth_length: formData.birthLength ? parseFloat(formData.birthLength) : null,
          head_circumference: formData.headCircumference ? parseFloat(formData.headCircumference) : null,
          place_of_birth: formData.placeOfBirth || null,
          delivery_type: formData.deliveryType || null,
          birth_order: formData.birthOrder || null,
          blood_type: formData.bloodType || null,
          critical_notes: formData.notes || null,
          profile_photo_url: profilePhotoUrl,
          primary_facility_id: branchId,
          created_by_user_id: userId,
          is_active: true,
        })
        .select()
        .single()

      if (childError) {
        console.error("Detailed child insertion error:", {
          message: childError.message,
          details: childError.details,
          hint: childError.hint,
          code: childError.code,
        })
        throw new Error(`Child insertion failed: ${childError.message}. Details: ${childError.details || 'none'}. Hint: ${childError.hint || 'none'}`)
      }

      console.log("Child inserted:", childData)

      // Link child to guardian
      const { error: linkError } = await supabase
        .from("child_guardian")
        .insert({
          child_id: childData.id,
          guardian_id: selectedMother.id,
          relationship: "mother",
          is_primary: true,
        })

      if (linkError) {
        console.error("Error linking child to guardian:", linkError)
        // Child was created but linking failed - show partial success
        toast.warning(`Child ${cvccId} created but guardian link failed. Please update manually.`)
      } else {
        toast.success(`Child ${cvccId} registered successfully!`)
      }

      setSystemMessage(
        `Child registered successfully (${cvccId}). Record saved and linked to ${selectedMother.name}.`
      )

      // Reset form and redirect after short delay
      setTimeout(() => {
        setFormData(initialState)
        setSelectedMother(null)
        setSearchMother("")
        setImagePreview(null)
        router.push('/facility/dashboard')
      }, 1500)

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
            <CardTitle>Link to mother</CardTitle>
            <CardDescription>Select the caregiver registered in the Maternal Register before capturing the child&apos;s details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="motherSearch">Search mother</Label>
                {!isLoadingMothers && mothers.length > 0 && (
                  <span className="text-xs text-muted-foreground">{mothers.length} registered</span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="motherSearch"
                  type="search"
                  placeholder="e.g. Akosua Mensah or +233 24 500 1100"
                  value={searchMother}
                  onChange={(event) => setSearchMother(event.target.value)}
                  className="pl-11"
                />
              </div>
            </div>
            {motherLoadError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{motherLoadError}</AlertDescription>
              </Alert>
            ) : null}
            {isLoadingMothers ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Loading mothers from the Maternal Register...
              </div>
            ) : mothers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900">⚠️ No mothers loaded from database</p>
                <p className="text-xs text-amber-800">
                  The query returned 0 rows even though the <code className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">guardians</code> table 
                  has {motherLoadError ? 'data' : '6 records'}.
                </p>
                <p className="text-xs text-amber-800 font-medium">Possible causes:</p>
                <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
                  <li><strong>Row Level Security (RLS)</strong> is blocking the query. Check Supabase → guardians table → RLS policies.</li>
                  <li>Your user role doesn't have SELECT permission on the guardians table.</li>
                  <li>You need to disable RLS or add a policy allowing facility nurses to read guardians.</li>
                </ul>
                <p className="text-xs text-amber-800">
                  Check browser console (F12) for detailed error messages.
                </p>
              </div>
            ) : filteredMothers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                No mothers match &quot;{searchMother}&quot;. Try a different search or clear the search to see all {mothers.length} registered mothers.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredMothers.map((mother) => (
                  <button
                    key={mother.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      isMotherSelected(mother.id) ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                    onClick={() => handleSelectMother(mother)}
                  >
                    <p className="text-sm font-semibold text-foreground">{mother.name}</p>
                    <p className="text-xs text-muted-foreground">{mother.phone}</p>
                    <p className="text-xs text-muted-foreground">Community: {mother.community}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">ID: {mother.id.slice(0, 8)}...</p>
                  </button>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Mother missing? <Link href="/facility/register-mother" className="text-primary hover:underline">Register a new caregiver</Link> first.
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-primary/40">
          <CardHeader className="space-y-2">
            <CardTitle>Child details</CardTitle>
            <CardDescription>
              Enter the details recorded on the Ghana Child Health Record Book birth page. These drive the automated vaccine schedule.
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
                  <Input
                    id="dateOfBirth"
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(event) => handleChange("dateOfBirth", event.target.value)}
                  />
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
    </div>
  )
}
