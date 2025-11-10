"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Baby, Calendar, FileImage, MapPin, Search } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MotherOption = {
  id: string
  name: string
  phone: string
  community: string
}

const mockMothers: MotherOption[] = [
  { id: "MTH-001", name: "Akosua Mensah", phone: "+233 24 500 1100", community: "Jakpa North" },
  { id: "MTH-002", name: "Abena Boateng", phone: "+233 27 330 8899", community: "Jakpa South" },
  { id: "MTH-003", name: "Mabel Owusu", phone: "+233 20 111 4532", community: "Sanza" },
]

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
  profileImageName: string | null
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
  profileImageName: null,
  notes: "",
}

export default function RegisterChildPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [searchMother, setSearchMother] = useState("")
  const [selectedMother, setSelectedMother] = useState<MotherOption | null>(null)
  const [formData, setFormData] = useState<ChildFormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)

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

  const filteredMothers = useMemo(() => {
    if (!searchMother) return mockMothers
    const haystack = searchMother.trim().toLowerCase()
    return mockMothers.filter((mother) => `${mother.name} ${mother.phone} ${mother.community}`.toLowerCase().includes(haystack))
  }, [searchMother])

  const handleSelectMother = (mother: MotherOption) => {
    setSelectedMother(mother)
    setFormData((previous) => ({ ...previous, motherId: mother.id }))
    setSystemMessage(`Linked to ${mother.name}. Continue with child details.`)
  }

  const handleChange = <Field extends keyof ChildFormState>(field: Field, value: ChildFormState[Field]) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedMother) {
      setSystemMessage("Select an existing mother before saving the child record.")
      return
    }

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      const generatedId = `CH-${Date.now().toString().slice(-6)}`
      setSystemMessage(
        `Child registered successfully. The full immunisation schedule has been generated. Redirecting to chart ${generatedId}.`
      )
      setTimeout(() => {
        router.push(`/facility/child/${generatedId}`)
      }, 1000)
      setFormData(initialState)
      setSelectedMother(null)
      setSearchMother("")
    }, 900)
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
              <Label htmlFor="motherSearch">Search mother</Label>
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
            <div className="grid gap-3 md:grid-cols-2">
              {filteredMothers.map((mother) => {
                const isSelected = selectedMother?.id === mother.id
                return (
                  <button
                    key={mother.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      isSelected ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                    onClick={() => handleSelectMother(mother)}
                  >
                    <p className="text-sm font-semibold text-foreground">{mother.name}</p>
                    <p className="text-xs text-muted-foreground">{mother.phone}</p>
                    <p className="text-xs text-muted-foreground">Community: {mother.community}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">ID: {mother.id}</p>
                  </button>
                )
              })}
            </div>
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
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profileImage">Profile image</Label>
                  <label
                    htmlFor="profileImage"
                    className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground hover:border-primary"
                  >
                    <span>{formData.profileImageName ?? "Capture photo or upload from device"}</span>
                    <FileImage className="h-4 w-4" />
                  </label>
                  <input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      handleChange("profileImageName", file ? file.name : null)
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
