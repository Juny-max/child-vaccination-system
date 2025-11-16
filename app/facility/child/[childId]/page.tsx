"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Droplet,
  Edit3,
  FileText,
  Flame,
  Ruler,
  Scale,
  ShieldAlert,
  Syringe,
  Thermometer,
  User,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VaccineStatus = "overdue" | "dueToday" | "upcoming" | "completed"

type VaccineEntry = {
  id: string
  vaccine: string
  scheduledDate: string
  status: VaccineStatus
  notes?: string
  batchNumber?: string
  administeredDate?: string
}

type ChildRecord = {
  id: string
  name: string
  dateOfBirth: string
  age: string
  gender: string
  photoUrl?: string
  criticalNotes?: string
  guardian: {
    name: string
    phone: string
    address: string
    preferredContact: "sms" | "email"
  }
  birthDetails: {
    weight: string
    length: string
    place: string
    deliveryType: string
  }
  allergies: string[]
  lastVisit: string
}

const sampleChildren: Record<string, ChildRecord> = {
  "CH-2025-001": {
    id: "CH-2025-001",
    name: "Kwame Boateng",
    dateOfBirth: "2025-07-18",
    age: "3 months 2 days",
    gender: "Male",
    criticalNotes: "Allergy: Penicillin",
    guardian: {
      name: "Abena Boateng",
      phone: "+233 247 889 221",
      address: "House 10, Jakpa North",
      preferredContact: "sms",
    },
    birthDetails: {
      weight: "3.2 kg",
      length: "49 cm",
      place: "Jakpa District Hospital",
      deliveryType: "Spontaneous vaginal",
    },
    allergies: ["Penicillin"],
    lastVisit: "03 Nov 2025",
  },
  "CH-2025-002": {
    id: "CH-2025-002",
    name: "Efua Agyeman",
    dateOfBirth: "2025-02-02",
    age: "9 months 8 days",
    gender: "Female",
    guardian: {
      name: "Ama Agyeman",
      phone: "+233 201 114 532",
      address: "Compound 8, Jakpa South",
      preferredContact: "email",
    },
    birthDetails: {
      weight: "2.8 kg",
      length: "48 cm",
      place: "Jakpa District Hospital",
      deliveryType: "Caesarean section",
    },
    allergies: [],
    lastVisit: "27 Oct 2025",
  },
}

const defaultSchedule: VaccineEntry[] = [
  { id: "BCG", vaccine: "BCG", scheduledDate: "2025-07-20", status: "completed", administeredDate: "2025-07-20", batchNumber: "BCG-44721" },
  { id: "OPV-0", vaccine: "OPV 0", scheduledDate: "2025-07-20", status: "completed", administeredDate: "2025-07-20", batchNumber: "OPV-55019" },
  { id: "PENTA-1", vaccine: "Pentavalent 1", scheduledDate: "2025-08-18", status: "completed", administeredDate: "2025-08-18", batchNumber: "PEN-33011" },
  { id: "PCV-1", vaccine: "Pneumococcal 1", scheduledDate: "2025-08-18", status: "completed", administeredDate: "2025-08-18" },
  { id: "ROTA-1", vaccine: "Rotavirus 1", scheduledDate: "2025-08-18", status: "completed", administeredDate: "2025-08-18" },
  { id: "PENTA-2", vaccine: "Pentavalent 2", scheduledDate: "2025-09-18", status: "completed", administeredDate: "2025-09-18" },
  { id: "PCV-2", vaccine: "Pneumococcal 2", scheduledDate: "2025-09-18", status: "completed", administeredDate: "2025-09-18" },
  { id: "ROTA-2", vaccine: "Rotavirus 2", scheduledDate: "2025-09-18", status: "completed", administeredDate: "2025-09-18" },
  { id: "PENTA-3", vaccine: "Pentavalent 3", scheduledDate: "2025-10-18", status: "dueToday", notes: "Prepare vaccine and review cold chain log." },
  { id: "PCV-3", vaccine: "Pneumococcal 3", scheduledDate: "2025-10-18", status: "dueToday" },
  { id: "ROTA-3", vaccine: "Rotavirus 3", scheduledDate: "2025-10-18", status: "overdue", notes: "Child missed last clinic day." },
  { id: "MEASLES-1", vaccine: "Measles-Rubella 1", scheduledDate: "2025-12-18", status: "upcoming" },
  { id: "YF", vaccine: "Yellow Fever", scheduledDate: "2025-12-18", status: "upcoming" },
]

type AnthropometricMeasurement = {
  id: string
  date: string
  weightKg: number
  lengthCm?: number
  headCircumferenceCm?: number
  muacCm?: number
  temperatureC?: number
  recordedBy: string
  notes?: string
}

type MeasurementFormState = {
  date: string
  recordedBy: string
  weightKg: string
  lengthCm: string
  headCircumferenceCm: string
  muacCm: string
  temperatureC: string
  notes: string
}

type MeasurementFormErrors = Partial<Record<keyof MeasurementFormState, string>>

const sampleMeasurements: Record<string, AnthropometricMeasurement[]> = {
  "CH-2025-001": [
    {
      id: "MEAS-20251103",
      date: "2025-11-03",
      weightKg: 7.8,
      lengthCm: 68.2,
      headCircumferenceCm: 44.1,
      muacCm: 14.2,
      temperatureC: 36.7,
      recordedBy: "Nurse Ama Mensah",
      notes: "Stable growth curve. Mild cough reported overnight.",
    },
    {
      id: "MEAS-20251018",
      date: "2025-10-18",
      weightKg: 7.5,
      lengthCm: 66.8,
      headCircumferenceCm: 43.8,
      muacCm: 14,
      temperatureC: 36.6,
      recordedBy: "Nurse Yaw Mensah",
    },
  ],
  "CH-2025-002": [
    {
      id: "MEAS-20251102",
      date: "2025-11-02",
      weightKg: 8.9,
      lengthCm: 70.1,
      headCircumferenceCm: 45.3,
      muacCm: 14.5,
      temperatureC: 36.8,
      recordedBy: "Nurse Ama Mensah",
      notes: "Slight weight gain post illness recovery.",
    },
    {
      id: "MEAS-20251012",
      date: "2025-10-12",
      weightKg: 8.6,
      lengthCm: 69.4,
      headCircumferenceCm: 45,
      muacCm: 14.2,
      temperatureC: 36.5,
      recordedBy: "Nurse Ama Mensah",
    },
  ],
}

const createEmptyMeasurementForm = (recordedBy = ""): MeasurementFormState => ({
  date: new Date().toISOString().split("T")[0],
  recordedBy,
  weightKg: "",
  lengthCm: "",
  headCircumferenceCm: "",
  muacCm: "",
  temperatureC: "",
  notes: "",
})

type AdministerFormState = {
  batchNumber: string
  dateAdministered: string
  expiryDate: string
  site: string
  administeredBy: string
  aefiFlag: boolean
  aefiNotes: string
}

const initialAdministerState: AdministerFormState = {
  batchNumber: "",
  dateAdministered: new Date().toISOString().split("T")[0],
  expiryDate: "",
  site: "",
  administeredBy: "",
  aefiFlag: false,
  aefiNotes: "",
}

export default function ChildPatientChartPage() {
  const router = useRouter()
  const params = useParams<{ childId: string }>()
  const childId = params?.childId ?? "new-child"
  const [userName, setUserName] = useState("")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [selectedDose, setSelectedDose] = useState<VaccineEntry | null>(null)
  const [administerForm, setAdministerForm] = useState<AdministerFormState>(initialAdministerState)
  const [measurements, setMeasurements] = useState<AnthropometricMeasurement[]>(() => sampleMeasurements[childId] ?? [])
  const [measurementForm, setMeasurementForm] = useState<MeasurementFormState>(() => createEmptyMeasurementForm())
  const [measurementErrors, setMeasurementErrors] = useState<MeasurementFormErrors>({})
  const [measurementStatus, setMeasurementStatus] = useState<string | null>(null)

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
    setMeasurements(sampleMeasurements[childId] ?? [])
    setMeasurementForm(createEmptyMeasurementForm(userName))
    setMeasurementErrors({})
  }, [childId, userName])

  useEffect(() => {
    if (!userName) return
    setMeasurementForm((previous) => {
      if (previous.recordedBy) {
        return previous
      }
      return { ...previous, recordedBy: userName }
    })
  }, [userName])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  useEffect(() => {
    if (!measurementStatus) return
    const timeout = window.setTimeout(() => setMeasurementStatus(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [measurementStatus])

  const childRecord = useMemo<ChildRecord>(() => {
    return (
      sampleChildren[childId] ?? {
        id: childId,
        name: "Newly Registered Child",
        dateOfBirth: "",
        age: "Pending",
        gender: "Pending",
        guardian: {
          name: "Linked guardian",
          phone: "",
          address: "To be confirmed",
          preferredContact: "sms",
        },
        birthDetails: {
          weight: "",
          length: "",
          place: "",
          deliveryType: "",
        },
        allergies: [],
        lastVisit: "Not yet",
      }
    )
  }, [childId])

  const schedule = useMemo(() => defaultSchedule, [])

  const groupedSchedule = useMemo(() => {
    return {
      overdue: schedule.filter((entry) => entry.status === "overdue"),
      dueToday: schedule.filter((entry) => entry.status === "dueToday"),
      upcoming: schedule.filter((entry) => entry.status === "upcoming"),
      completed: schedule.filter((entry) => entry.status === "completed"),
    }
  }, [schedule])

  const latestMeasurement = measurements[0] ?? null

  const handleMeasurementChange = <Field extends keyof MeasurementFormState>(
    field: Field,
    value: MeasurementFormState[Field],
  ) => {
    setMeasurementForm((previous) => ({ ...previous, [field]: value }))
    if (measurementErrors[field]) {
      setMeasurementErrors((previous) => {
        const { [field]: _removed, ...rest } = previous
        return rest
      })
    }
  }

  const resetMeasurementForm = () => {
    setMeasurementForm(createEmptyMeasurementForm(userName))
    setMeasurementErrors({})
  }

  const handleMeasurementSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: MeasurementFormErrors = {}

    const recordedByName = measurementForm.recordedBy.trim()
    if (!recordedByName) {
      errors.recordedBy = "Enter the name of the staff recording the measurement."
    }

    const parsedWeight = Number.parseFloat(measurementForm.weightKg)
    if (!measurementForm.weightKg || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      errors.weightKg = "Enter the child’s weight in kilograms."
    }

    const parsedLength = measurementForm.lengthCm ? Number.parseFloat(measurementForm.lengthCm) : undefined
    if (measurementForm.lengthCm && (parsedLength === undefined || Number.isNaN(parsedLength) || parsedLength <= 0)) {
      errors.lengthCm = "Enter a valid length or height in centimetres."
    }

    const parsedHead = measurementForm.headCircumferenceCm
      ? Number.parseFloat(measurementForm.headCircumferenceCm)
      : undefined
    if (measurementForm.headCircumferenceCm && (parsedHead === undefined || Number.isNaN(parsedHead) || parsedHead <= 0)) {
      errors.headCircumferenceCm = "Enter a valid head circumference in centimetres."
    }

    const parsedMuac = measurementForm.muacCm ? Number.parseFloat(measurementForm.muacCm) : undefined
    if (measurementForm.muacCm && (parsedMuac === undefined || Number.isNaN(parsedMuac) || parsedMuac <= 0)) {
      errors.muacCm = "Enter MUAC in centimetres using the colour-coded tape."
    }

    const parsedTemp = measurementForm.temperatureC ? Number.parseFloat(measurementForm.temperatureC) : undefined
    if (measurementForm.temperatureC && (parsedTemp === undefined || Number.isNaN(parsedTemp) || parsedTemp < 30 || parsedTemp > 43)) {
      errors.temperatureC = "Enter an axillary temperature between 30°C and 43°C."
    }

    const selectedDate = measurementForm.date ? new Date(measurementForm.date) : null
    if (!measurementForm.date || !selectedDate || Number.isNaN(selectedDate.getTime())) {
      errors.date = "Select the measurement date."
    } else {
      const now = new Date()
      if (selectedDate > now) {
        errors.date = "Measurement date cannot be in the future."
      }
    }

    if (Object.keys(errors).length > 0) {
      setMeasurementErrors(errors)
      return
    }

    const newMeasurement: AnthropometricMeasurement = {
      id: generateMeasurementId(),
      date: measurementForm.date,
      weightKg: roundTo(parsedWeight, 2),
      lengthCm: parsedLength !== undefined ? roundTo(parsedLength, 1) : undefined,
      headCircumferenceCm: parsedHead !== undefined ? roundTo(parsedHead, 1) : undefined,
      muacCm: parsedMuac !== undefined ? roundTo(parsedMuac, 1) : undefined,
      temperatureC: parsedTemp !== undefined ? roundTo(parsedTemp, 1) : undefined,
      recordedBy: recordedByName,
      notes: measurementForm.notes.trim() ? measurementForm.notes.trim() : undefined,
    }

    setMeasurements((previous) => [newMeasurement, ...previous])
    setMeasurementStatus("Growth monitoring saved. Update the Child Health Record Book and growth chart.")
    resetMeasurementForm()
  }

  const openAdministerModal = (entry: VaccineEntry) => {
    setSelectedDose(entry)
    setAdministerForm({
      batchNumber: entry.batchNumber ?? "",
      dateAdministered: new Date().toISOString().split("T")[0],
      expiryDate: "",
      site: "",
      administeredBy: userName || "Facility Nurse",
      aefiFlag: false,
      aefiNotes: "",
    })
  }

  const closeAdministerModal = () => {
    setSelectedDose(null)
    setAdministerForm(initialAdministerState)
  }

  const handleAdministerChange = (field: keyof AdministerFormState, value: string | boolean) => {
    setAdministerForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleAdministerSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDose) return

    closeAdministerModal()
    setSystemMessage(
      administerForm.aefiFlag
        ? `Dose recorded and AEFI alert sent to branch manager for ${selectedDose.vaccine}.`
        : `${selectedDose.vaccine} recorded as administered. Vaccination history updated.`
    )
  }

  const renderScheduleGroup = (title: string, entries: VaccineEntry[], accent: string, empty: string) => (
    <Card className={accent}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{entries.length} item{entries.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-background/80 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
                  <p className="text-xs text-muted-foreground">Scheduled: {entry.scheduledDate}</p>
                  {entry.administeredDate ? (
                    <p className="text-xs text-muted-foreground">Administered: {entry.administeredDate}</p>
                  ) : null}
                  {entry.notes ? <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p> : null}
                </div>
                {entry.status === "completed" ? (
                  <Badge variant="secondary" className="w-fit">Completed</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={entry.status === "overdue" ? "destructive" : "default"}
                    className="gap-2"
                    onClick={() => openAdministerModal(entry)}
                  >
                    <Syringe className="h-4 w-4" /> Administer
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/facility/dashboard">
                <ArrowLeft className="h-4 w-4" /> Today&apos;s clinic
              </Link>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Child patient chart</p>
              <p className="text-lg font-semibold text-foreground">{childRecord.name}</p>
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

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {systemMessage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="border-primary/40">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BadgeCheck className="h-5 w-5 text-primary" /> Child overview
              </CardTitle>
              <CardDescription>ID: {childRecord.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/70 p-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {childRecord.name
                    .split(" ")
                    .map((segment) => segment[0])
                    .join("" )
                    .slice(0, 2)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-base font-semibold text-foreground">{childRecord.name}</p>
                  <p className="text-sm text-muted-foreground">DOB: {childRecord.dateOfBirth || "Pending"}</p>
                  <p className="text-sm text-muted-foreground">Age: {childRecord.age}</p>
                  {childRecord.criticalNotes ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                      <ShieldAlert className="h-3 w-3" /> {childRecord.criticalNotes}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Birth details</p>
                  <p className="mt-2 text-xs text-muted-foreground">Weight: {childRecord.birthDetails.weight || "Pending"}</p>
                  <p className="text-xs text-muted-foreground">Length: {childRecord.birthDetails.length || "Pending"}</p>
                  <p className="text-xs text-muted-foreground">Place: {childRecord.birthDetails.place || "Pending"}</p>
                  <p className="text-xs text-muted-foreground">Delivery: {childRecord.birthDetails.deliveryType || "Pending"}</p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Clinic notes</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last visit: {childRecord.lastVisit}. Record anthropometry and Vitamin A once the child is 6 months.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Allergies: {childRecord.allergies.length > 0 ? childRecord.allergies.join(", ") : "None recorded"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> Guardian details
              </CardTitle>
              <CardDescription>Preferred contact for reminders and follow-ups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="text-foreground">{childRecord.guardian.name}</p>
              <p>Phone: {childRecord.guardian.phone || "Not captured"}</p>
              <p>Address: {childRecord.guardian.address}</p>
              <p>Preferred contact: {childRecord.guardian.preferredContact.toUpperCase()}</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`tel:${childRecord.guardian.phone.replace(/\s+/g, "")}`}>
                    Call guardian
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="gap-2" asChild>
                  <Link href="#">
                    <ClipboardList className="h-4 w-4" /> Update details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Vaccination timeline</h2>
              <p className="text-sm text-muted-foreground">
                Review overdue doses first, then capture today&apos;s vaccines before the child leaves.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="#">
                <FileText className="h-4 w-4" /> Print child register summary
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {renderScheduleGroup(
              "Overdue",
              groupedSchedule.overdue,
              "border-destructive/40",
              "No overdue vaccines. Maintain adherence to the EPI schedule."
            )}
            {renderScheduleGroup(
              "Due today",
              groupedSchedule.dueToday,
              "border-amber-300/50",
              "No vaccines scheduled for today."
            )}
            {renderScheduleGroup(
              "Upcoming",
              groupedSchedule.upcoming,
              "border-sky-300/60",
              "Upcoming vaccines will appear here."
            )}
            {renderScheduleGroup(
              "Completed",
              groupedSchedule.completed,
              "border-emerald-300/60",
              "Completed vaccinations will display once recorded."
            )}
          </div>
        </section>

        <section className="mt-8">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5 text-primary" /> Growth monitoring
              </CardTitle>
              <CardDescription>Capture anthropometry before today&apos;s vaccines to keep the growth chart accurate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {measurementStatus ? (
                <Alert role="status" className="border-primary/40 bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-foreground/80">{measurementStatus}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest measurement</p>
                  <p className="text-sm font-semibold text-foreground">
                    {latestMeasurement ? formatDate(latestMeasurement.date) : "No record yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestMeasurement ? `Recorded by ${latestMeasurement.recordedBy}` : "Weigh and measure the child before administering vaccines."}
                  </p>
                </div>
                {latestMeasurement ? (
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Scale className="h-4 w-4 text-primary" /> {formatMeasurement(latestMeasurement.weightKg, 2)} kg
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-4 w-4 text-primary" /> {formatMeasurement(latestMeasurement.lengthCm)} cm
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-4 w-4 text-primary" /> HC {formatMeasurement(latestMeasurement.headCircumferenceCm)} cm
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-4 w-4 text-primary" /> MUAC {formatMeasurement(latestMeasurement.muacCm)} cm
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Thermometer className="h-4 w-4 text-primary" /> {formatTemperature(latestMeasurement.temperatureC)}
                    </span>
                  </div>
                ) : null}
              </div>

              <form className="grid gap-4 md:grid-cols-3" onSubmit={handleMeasurementSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="measurement-date">Measurement date</Label>
                  <Input
                    id="measurement-date"
                    type="date"
                    value={measurementForm.date}
                    onChange={(event) => handleMeasurementChange("date", event.target.value)}
                    aria-invalid={measurementErrors.date ? "true" : undefined}
                  />
                  {measurementErrors.date ? (
                    <p className="text-xs text-destructive">{measurementErrors.date}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Use the clinic date the child was weighed.</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="measurement-recorded-by">Recorded by</Label>
                  <Input
                    id="measurement-recorded-by"
                    placeholder="Enter your full name"
                    value={measurementForm.recordedBy}
                    onChange={(event) => handleMeasurementChange("recordedBy", event.target.value)}
                    aria-invalid={measurementErrors.recordedBy ? "true" : undefined}
                    required
                  />
                  {measurementErrors.recordedBy ? (
                    <p className="text-xs text-destructive">{measurementErrors.recordedBy}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">The name will appear in the measurement history.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-weight">Weight (kg)</Label>
                  <Input
                    id="measurement-weight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={measurementForm.weightKg}
                    onChange={(event) => handleMeasurementChange("weightKg", event.target.value)}
                    aria-invalid={measurementErrors.weightKg ? "true" : undefined}
                    required
                  />
                  {measurementErrors.weightKg ? (
                    <p className="text-xs text-destructive">{measurementErrors.weightKg}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Record from the calibrated infant scale.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-length">Length / height (cm)</Label>
                  <Input
                    id="measurement-length"
                    type="number"
                    step="0.1"
                    min="0"
                    value={measurementForm.lengthCm}
                    onChange={(event) => handleMeasurementChange("lengthCm", event.target.value)}
                    aria-invalid={measurementErrors.lengthCm ? "true" : undefined}
                  />
                  {measurementErrors.lengthCm ? (
                    <p className="text-xs text-destructive">{measurementErrors.lengthCm}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Measure length under 2 years, height thereafter.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-hc">Head circumference (cm)</Label>
                  <Input
                    id="measurement-hc"
                    type="number"
                    step="0.1"
                    min="0"
                    value={measurementForm.headCircumferenceCm}
                    onChange={(event) => handleMeasurementChange("headCircumferenceCm", event.target.value)}
                    aria-invalid={measurementErrors.headCircumferenceCm ? "true" : undefined}
                  />
                  {measurementErrors.headCircumferenceCm ? (
                    <p className="text-xs text-destructive">{measurementErrors.headCircumferenceCm}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Optional but recommended for infants under 1 year.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-muac">MUAC (cm)</Label>
                  <Input
                    id="measurement-muac"
                    type="number"
                    step="0.1"
                    min="0"
                    value={measurementForm.muacCm}
                    onChange={(event) => handleMeasurementChange("muacCm", event.target.value)}
                    aria-invalid={measurementErrors.muacCm ? "true" : undefined}
                  />
                  {measurementErrors.muacCm ? (
                    <p className="text-xs text-destructive">{measurementErrors.muacCm}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Use MUAC tape for children 6 months and older.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-temp">Temperature (°C)</Label>
                  <Input
                    id="measurement-temp"
                    type="number"
                    step="0.1"
                    value={measurementForm.temperatureC}
                    onChange={(event) => handleMeasurementChange("temperatureC", event.target.value)}
                    aria-invalid={measurementErrors.temperatureC ? "true" : undefined}
                  />
                  {measurementErrors.temperatureC ? (
                    <p className="text-xs text-destructive">{measurementErrors.temperatureC}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Capture axillary temperature if fever is suspected.</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="measurement-notes">Measurement notes</Label>
                  <textarea
                    id="measurement-notes"
                    placeholder="E.g. Child restless during measurement, counselled mother on nutrition."
                    className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={measurementForm.notes}
                    onChange={(event) => handleMeasurementChange("notes", event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-3 md:flex-row">
                  <Button type="submit" className="gap-2">
                    <Scale className="h-4 w-4" /> Record measurements
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetMeasurementForm}>
                    Clear
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Measurement history</h3>
                  <Badge variant="outline" className="text-xs">
                    {measurements.length} record{measurements.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {measurements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No measurements captured yet. Record today&apos;s weight to start trend tracking.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Weight (kg)</th>
                          <th className="py-2 pr-4">Length / height (cm)</th>
                          <th className="py-2 pr-4">Head circ. (cm)</th>
                          <th className="py-2 pr-4">MUAC (cm)</th>
                          <th className="py-2 pr-4">Temp (°C)</th>
                          <th className="py-2 pr-4">Recorded by</th>
                          <th className="py-2 pr-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-foreground">
                        {measurements.map((measurement) => (
                          <tr key={measurement.id}>
                            <td className="py-2 pr-4">{formatDate(measurement.date)}</td>
                            <td className="py-2 pr-4">{formatMeasurement(measurement.weightKg, 2)}</td>
                            <td className="py-2 pr-4">{formatMeasurement(measurement.lengthCm)}</td>
                            <td className="py-2 pr-4">{formatMeasurement(measurement.headCircumferenceCm)}</td>
                            <td className="py-2 pr-4">{formatMeasurement(measurement.muacCm)}</td>
                            <td className="py-2 pr-4">{formatTemperature(measurement.temperatureC)}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{measurement.recordedBy}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">
                              {measurement.notes ? measurement.notes : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Edit3 className="h-5 w-5 text-primary" /> Session notes
              </CardTitle>
              <CardDescription>Document growth monitoring, counselling, or follow-up actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder="Add session notes once the visit is complete."
                className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">Notes sync to HQ dashboards when the backend is connected.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="h-5 w-5 text-primary" /> AEFI watchlist
              </CardTitle>
              <CardDescription>Flag adverse events immediately for rapid escalation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>No AEFI recorded for this child.</p>
              <p>
                If you suspect an adverse event, tick the AEFI checkbox in the administer modal. An SMS and email alert will
                automatically notify the Branch Manager and district focal person.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      {selectedDose ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Administer vaccine</p>
                <p className="text-lg font-semibold text-foreground">{selectedDose.vaccine}</p>
              </div>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={closeAdministerModal}>
                Close
              </button>
            </div>
            <form className="space-y-4 px-6 py-5" onSubmit={handleAdministerSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateAdministered">Date administered</Label>
                  <Input
                    id="dateAdministered"
                    type="date"
                    required
                    value={administerForm.dateAdministered}
                    onChange={(event) => handleAdministerChange("dateAdministered", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Batch / lot number</Label>
                  <Input
                    id="batchNumber"
                    required
                    placeholder="e.g. PEN-44192"
                    value={administerForm.batchNumber}
                    onChange={(event) => handleAdministerChange("batchNumber", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    required
                    value={administerForm.expiryDate}
                    onChange={(event) => handleAdministerChange("expiryDate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site">Site of injection</Label>
                  <select
                    id="site"
                    required
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={administerForm.site}
                    onChange={(event) => handleAdministerChange("site", event.target.value)}
                  >
                    <option value="">Select site</option>
                    <option value="left thigh">Left thigh</option>
                    <option value="right thigh">Right thigh</option>
                    <option value="left arm">Left arm</option>
                    <option value="right arm">Right arm</option>
                    <option value="oral">Oral</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="administeredBy">Administered by</Label>
                  <Input
                    id="administeredBy"
                    required
                    value={administerForm.administeredBy}
                    onChange={(event) => handleAdministerChange("administeredBy", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aefiFlag" className="flex items-center gap-2 text-sm font-medium">
                    <input
                      id="aefiFlag"
                      type="checkbox"
                      className="h-4 w-4 rounded border border-border"
                      checked={administerForm.aefiFlag}
                      onChange={(event) => handleAdministerChange("aefiFlag", event.target.checked)}
                    />
                    Flag adverse event (AEFI)
                  </Label>
                </div>
              </div>

              {administerForm.aefiFlag ? (
                <div className="space-y-2">
                  <Label htmlFor="aefiNotes">AEFI notes</Label>
                  <textarea
                    id="aefiNotes"
                    required
                    placeholder="Describe symptoms, onset time, and immediate management."
                    className="min-h-[112px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={administerForm.aefiNotes}
                    onChange={(event) => handleAdministerChange("aefiNotes", event.target.value)}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Droplet className="h-4 w-4" />
                  Cold chain check: confirm vial was within +2°C to +8°C at administration.
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeAdministerModal}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Save dose
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function generateMeasurementId() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MEAS-${datePart}-${randomPart}`
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function formatMeasurement(value?: number, decimals = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—"
  }
  return value.toFixed(decimals)
}

function formatTemperature(value?: number) {
  const formatted = formatMeasurement(value, 1)
  return formatted === "—" ? "—" : `${formatted}°C`
}

function formatDate(dateString: string) {
  if (!dateString) return "—"
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
