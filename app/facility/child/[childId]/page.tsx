"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  Baby,
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Droplet,
  Edit3,
  FileText,
  Flame,
  Loader2,
  Ruler,
  Scale,
  ShieldAlert,
  Syringe,
  Thermometer,
  X,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"
import { supabase } from "@/lib/supabase"
import * as offlineSync from "@/lib/offline-vaccination-sync"
import { isVaccineCutoffExpired } from "@/lib/vaccine-cutoffs"
import { toast } from "sonner"

type VaccineStatus = "overdue" | "dueToday" | "upcoming" | "completed"

type VaccineEntry = {
  id: string
  vaccine: string
  doseNumber?: number
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
      name: "Akua Agyeman",
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
  weightKg?: number
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
  recordedBy: "Nurse Akosua Mensah",
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
  recordedBy: "Nurse Akosua Mensah",
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
  recordedBy: "Nurse Akosua Mensah",
    },
  ],
}

const formatDateForInput = (dateValue: Date) => {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, "0")
  const day = String(dateValue.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const createEmptyMeasurementForm = (recordedBy = ""): MeasurementFormState => ({
  date: formatDateForInput(new Date()),
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
  dateAdministered: formatDateForInput(new Date()),
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
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  const isValidChildId = childId && childId !== "new-child" && isUuid(childId)
  const [userName, setUserName] = useState("")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [selectedDose, setSelectedDose] = useState<VaccineEntry | null>(null)
  const [administerForm, setAdministerForm] = useState<AdministerFormState>(initialAdministerState)
  const [measurementForm, setMeasurementForm] = useState<MeasurementFormState>(() => createEmptyMeasurementForm())
  const [measurementErrors, setMeasurementErrors] = useState<MeasurementFormErrors>({})
  const [measurementStatus, setMeasurementStatus] = useState<string | null>(null)
  
  // State for fetched data
  const [isLoadingChild, setIsLoadingChild] = useState(true)
  const [childProfile, setChildProfile] = useState<facilityApi.FacilityChildProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [vaccinationHistory, setVaccinationHistory] = useState<facilityApi.VaccinationEvent[]>([])
  const [scheduledVaccines, setScheduledVaccines] = useState<facilityApi.ScheduledVaccine[]>([])
  const [isLoadingVaccines, setIsLoadingVaccines] = useState(true)
  const [isSavingVaccine, setIsSavingVaccine] = useState(false)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  const [stockFromInventory, setStockFromInventory] = useState(false)
  const [noStockAvailable, setNoStockAvailable] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  
  // State for growth monitoring
  const [measurements, setMeasurements] = useState<AnthropometricMeasurement[]>([])
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(true)
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false)
  
  // State for session notes
  const [sessionNote, setSessionNote] = useState("")
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [sessionNotes, setSessionNotes] = useState<facilityApi.SessionNote[]>([])
  
  // State for guardian update modal
  const [showGuardianModal, setShowGuardianModal] = useState(false)
  const [guardianData, setGuardianData] = useState<facilityApi.Guardian | null>(null)
  const [guardianForm, setGuardianForm] = useState({
    fullName: "",
    phonePrimary: "",
    phoneAlternate: "",
    email: "",
    addressLine1: "",
    landmark: "",
    city: "",
    region: "",
    preferredContact: "sms" as "sms" | "email",
  })
  const [isSavingGuardian, setIsSavingGuardian] = useState(false)
  const [isLoadingGuardian, setIsLoadingGuardian] = useState(false)
  const [showGuardianOtpModal, setShowGuardianOtpModal] = useState(false)
  const [guardianOtpCode, setGuardianOtpCode] = useState("")
  const [guardianOtpToken, setGuardianOtpToken] = useState("")
  const [guardianOtpNotice, setGuardianOtpNotice] = useState<string | null>(null)
  const [guardianOtpError, setGuardianOtpError] = useState<string | null>(null)
  const [isVerifyingGuardianOtp, setIsVerifyingGuardianOtp] = useState(false)
  const [pendingGuardianUpdate, setPendingGuardianUpdate] =
    useState<facilityApi.UpdateGuardianRequest | null>(null)

  const [showChildDetailsModal, setShowChildDetailsModal] = useState(false)
  const [vaccineModalGroup, setVaccineModalGroup] = useState<{
    title: string
    entries: VaccineEntry[]
    colorScheme: "red" | "amber" | "sky" | "emerald"
  } | null>(null)

  // State for photo upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // AEFI watchlist state
  const [aefiReports, setAefiReports] = useState<facilityApi.FacilityAefiReport[]>([])
  const [isLoadingAefi, setIsLoadingAefi] = useState(false)
  const [aefiModalOpen, setAefiModalOpen] = useState(false)

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
  
  // Fetch child profile data
  useEffect(() => {
    const fetchChildData = async () => {
      if (!childId || childId === "new-child") return
      if (!isValidChildId) {
        setIsLoadingChild(false)
        setLoadError("This child record is a temporary ID. Save to the database to view the full chart.")
        return
      }
      
      setIsLoadingChild(true)
      setLoadError(null)
      
      try {
        const profile = await facilityApi.getChildProfile(childId)
        setChildProfile(profile)
      } catch (error) {
        console.error("Failed to load child profile:", error)
        setLoadError("Could not load child data. Please try again.")
      } finally {
        setIsLoadingChild(false)
      }
    }
    
    fetchChildData()
  }, [childId, isValidChildId])
  
  // Fetch vaccination data
  useEffect(() => {
    const fetchVaccinationData = async () => {
      if (!childId || childId === "new-child" || !childProfile?.dateOfBirth) return
      if (!isValidChildId) {
        setIsLoadingVaccines(false)
        return
      }
      
      setIsLoadingVaccines(true)
      
      try {
        const [history, scheduled] = await Promise.all([
          facilityApi.getVaccinationHistory(childId),
          facilityApi.getScheduledVaccinations(childId, childProfile.dateOfBirth),
        ])
        
        setVaccinationHistory(history)
        setScheduledVaccines(scheduled)
      } catch (error) {
        console.error("Failed to load vaccination data:", error)
      } finally {
        setIsLoadingVaccines(false)
      }
    }
    
    fetchVaccinationData()
  }, [childId, childProfile?.dateOfBirth, isValidChildId])
  
  // Fetch AEFI watchlist (last 30 days)
  useEffect(() => {
    const fetchAefi = async () => {
      if (!childId || childId === "new-child" || !isValidChildId) return
      setIsLoadingAefi(true)
      try {
        const reports = await facilityApi.getChildAefiReports(childId)
        setAefiReports(reports)
      } catch (error) {
        console.error("Failed to load AEFI reports:", error)
      } finally {
        setIsLoadingAefi(false)
      }
    }
    fetchAefi()
  }, [childId, isValidChildId])

  // Fetch growth monitoring data
  useEffect(() => {
    const fetchMeasurements = async () => {
      if (!childId || childId === "new-child") return
      if (!isValidChildId) {
        setIsLoadingMeasurements(false)
        return
      }
      
      setIsLoadingMeasurements(true)
      
      try {
        const history = await facilityApi.getGrowthMonitoringHistory(childId)
        
        // Transform API data to component format
        const transformed: AnthropometricMeasurement[] = history.map(m => ({
          id: m.id,
          date: m.measurementDate,
          weightKg: m.weightKg || undefined,
          lengthCm: m.lengthCm || undefined,
          headCircumferenceCm: m.headCircumferenceCm || undefined,
          muacCm: m.muacCm || undefined,
          temperatureC: m.temperatureC || undefined,
          recordedBy: m.recordedByName,
          notes: m.notes || undefined,
        }))
        
        setMeasurements(transformed)
      } catch (error) {
        console.error("Failed to load measurements:", error)
      } finally {
        setIsLoadingMeasurements(false)
      }
    }
    
    fetchMeasurements()
  }, [childId, isValidChildId])
  
  // Fetch session notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!childId || childId === "new-child") return
      if (!isValidChildId) {
        return
      }
      
      try {
        const notes = await facilityApi.getSessionNotes(childId)
        setSessionNotes(notes)
      } catch (error) {
        console.error("Failed to load session notes:", error)
      }
    }
    
    fetchNotes()
  }, [childId, isValidChildId])

  useEffect(() => {
    if (!userName) return
    setMeasurementForm((previous) => {
      if (previous.recordedBy) {
        return previous
      }
      return { ...previous, recordedBy: userName }
    })
  }, [userName])

  // Background sync for offline vaccinations
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await offlineSync.getPendingCount()
        setPendingSyncCount(count)
      } catch (error) {
        console.error("Failed to get pending count:", error)
      }
    }

    // Update count on mount
    updatePendingCount()

    // Monitor network status
    const handleOnline = () => {
      setIsOnline(true)
      toast.info("Connection restored. Syncing offline records...")
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("You're offline. Vaccinations will be saved locally.")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Start background sync
    const cleanup = offlineSync.startBackgroundSync((result) => {
      if (result.success > 0) {
        toast.success(
          `${result.success} offline vaccination${result.success > 1 ? "s" : ""} synced successfully!`
        )
        updatePendingCount()
        
        // Refresh vaccination data after sync
        if (childProfile?.dateOfBirth) {
          facilityApi.getVaccinationHistory(childId).then(setVaccinationHistory)
          facilityApi.getScheduledVaccinations(childId, childProfile.dateOfBirth).then(setScheduledVaccines)
        }
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} vaccination${result.failed > 1 ? "s" : ""} failed to sync.`)
      }
    })

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      cleanup()
    }
  }, [childId, childProfile?.dateOfBirth])

  const childRecord = useMemo<ChildRecord>(() => {
    // If we have fetched profile data, use it
    if (childProfile) {
      return {
        id: childProfile.childId,
        name: childProfile.name,
        dateOfBirth: childProfile.dateOfBirth,
        age: childProfile.age,
        gender: childProfile.gender,
        photoUrl: childProfile.profilePhoto || undefined,
        guardian: {
          name: childProfile.guardianName,
          phone: childProfile.guardianPhone,
          address: childProfile.guardianAddress || "Address not provided",
          preferredContact: childProfile.guardianPreferredContact || "sms",
        },
        birthDetails: {
          weight: childProfile.weight ? `${childProfile.weight} kg` : "Not recorded",
          length: childProfile.length ? `${childProfile.length} cm` : "Not recorded",
          place: childProfile.placeOfBirth || "Not recorded",
          deliveryType: childProfile.deliveryType || "Not recorded",
        },
        allergies: [],
        lastVisit: childProfile.lastVisit || "Not yet",
      }
    }
    
    // Fallback to sample data or default
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
  }, [childId, childProfile])

  const schedule = useMemo<VaccineEntry[]>(() => {
    const entries: VaccineEntry[] = []
    
    // Add completed vaccinations from history
    vaccinationHistory.forEach((vax) => {
      entries.push({
        id: `completed-${vax.id}`,
        vaccine: vax.vaccineName,
        doseNumber: vax.doseNumber,
        scheduledDate: vax.administeredDate, // Use administered date for completed vaccines
        status: "completed",
        administeredDate: vax.administeredDate,
        batchNumber: vax.batchNumber || undefined,
        notes: vax.notes || undefined,
      })
    })
    
    // Add scheduled vaccinations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    scheduledVaccines.forEach((vax) => {
      const dueDate = new Date(vax.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      
      let status: VaccineStatus
      if (vax.isOverdue) {
        status = "overdue"
      } else if (dueDate.getTime() === today.getTime()) {
        status = "dueToday"
      } else {
        status = "upcoming"
      }
      
      entries.push({
        id: `scheduled-${vax.vaccineName}-${vax.doseNumber}-${vax.dueDate}`,
        vaccine: vax.vaccineName,
        doseNumber: vax.doseNumber,
        scheduledDate: vax.dueDate,
        status,
        notes: vax.isOverdue ? "Overdue - administer as soon as possible" : undefined,
      })
    })
    
    return entries
  }, [vaccinationHistory, scheduledVaccines])

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

  const handleMeasurementSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSavingMeasurement) return
    
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

    setIsSavingMeasurement(true)

    try {
      // Save to database
      const requestData: facilityApi.RecordGrowthMeasurementRequest = {
        measurementDate: measurementForm.date,
        recordedByName: recordedByName,
        weightKg: roundTo(parsedWeight, 2),
        lengthCm: parsedLength !== undefined ? roundTo(parsedLength, 1) : undefined,
        headCircumferenceCm: parsedHead !== undefined ? roundTo(parsedHead, 1) : undefined,
        muacCm: parsedMuac !== undefined ? roundTo(parsedMuac, 1) : undefined,
        temperatureC: parsedTemp !== undefined ? roundTo(parsedTemp, 1) : undefined,
        notes: measurementForm.notes.trim() ? measurementForm.notes.trim() : undefined,
      }

      await facilityApi.recordGrowthMeasurement(childId, requestData)

      // Refetch measurements from database
      const history = await facilityApi.getGrowthMonitoringHistory(childId)
      const transformed: AnthropometricMeasurement[] = history.map(m => ({
        id: m.id,
        date: m.measurementDate,
        weightKg: m.weightKg || undefined,
        lengthCm: m.lengthCm || undefined,
        headCircumferenceCm: m.headCircumferenceCm || undefined,
        muacCm: m.muacCm || undefined,
        temperatureC: m.temperatureC || undefined,
        recordedBy: m.recordedByName,
        notes: m.notes || undefined,
      }))
      
      setMeasurements(transformed)
      setMeasurementStatus("Growth monitoring saved. Update the Child Health Record Book and growth chart.")
      resetMeasurementForm()
    } catch (error) {
      console.error("Failed to save measurement:", error)
      setMeasurementStatus("Failed to save measurement. Please try again.")
    } finally {
      setIsSavingMeasurement(false)
    }
  }

  const openAdministerModal = async (entry: VaccineEntry) => {
    setVaccineModalGroup(null)
    setSelectedDose(entry)
    setStockFromInventory(false)
    setAdministerForm({
      batchNumber: entry.batchNumber ?? "",
      dateAdministered: new Date().toISOString().split("T")[0],
      expiryDate: "",
      site: "",
      administeredBy: userName || "Facility Nurse",
      aefiFlag: false,
      aefiNotes: "",
    })

    // Auto-fill batch number and expiry date from stock inventory
    setNoStockAvailable(false)
    const facilityId = localStorage.getItem("branchId") || childProfile?.facilityId
    if (facilityId && entry.vaccine) {
      setIsLoadingStock(true)
      try {
        const stock = await facilityApi.getVaccineStockInfo(entry.vaccine, facilityId)
        if (stock) {
          setAdministerForm((prev) => ({
            ...prev,
            batchNumber: stock.batchNumber,
            expiryDate: stock.expiryDate,
          }))
          setStockFromInventory(true)
        } else {
          setNoStockAvailable(true)
        }
      } catch {
        setNoStockAvailable(true)
      } finally {
        setIsLoadingStock(false)
      }
    }
  }

  const closeAdministerModal = () => {
    setSelectedDose(null)
    setAdministerForm(initialAdministerState)
    setStockFromInventory(false)
    setNoStockAvailable(false)
  }

  const handleAdministerChange = (field: keyof AdministerFormState, value: string | boolean) => {
    setAdministerForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleAdministerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDose || isSavingVaccine) return

    setIsSavingVaccine(true)

    try {
      // Prepare the data for the API
      const requestData: facilityApi.AdministerVaccineRequest = {
        vaccineName: selectedDose.vaccine,
        doseNumber: selectedDose.doseNumber,
        administeredDate: administerForm.dateAdministered,
        batchNumber: administerForm.batchNumber,
        expiryDate: administerForm.expiryDate || undefined,
        administeredBy: administerForm.administeredBy,
        vaccinationSite: administerForm.site || undefined,
        aefiFlag: administerForm.aefiFlag,
        notes: administerForm.aefiFlag ? administerForm.aefiNotes : undefined,
      }

      // Try to save online first
      try {
        await facilityApi.administerVaccine(childId, requestData)

        // Refetch vaccination data to update the timeline
        const refreshPromises: Promise<any>[] = [
          facilityApi.getChildAefiReports(childId).then(setAefiReports),
        ]
        if (childProfile?.dateOfBirth) {
          refreshPromises.push(
            facilityApi.getVaccinationHistory(childId).then(setVaccinationHistory),
            facilityApi.getScheduledVaccinations(childId, childProfile.dateOfBirth).then(setScheduledVaccines),
          )
        }
        await Promise.all(refreshPromises)

        closeAdministerModal()
        toast.success(
          administerForm.aefiFlag
            ? `Dose recorded and AEFI alert sent to branch manager for ${selectedDose.vaccine}.`
            : `${selectedDose.vaccine} recorded successfully!`
        )
      } catch (apiError: any) {
        // Check if it's a network error
        const isNetworkError = 
          !navigator.onLine ||
          apiError?.message?.includes("fetch") ||
          apiError?.message?.includes("network") ||
          apiError?.code === "NETWORK_ERROR"

        if (isNetworkError) {
          // Save offline
          await offlineSync.savePendingVaccination(childId, requestData)
          
          // Update pending count
          const count = await offlineSync.getPendingCount()
          setPendingSyncCount(count)
          
          closeAdministerModal()
          toast.warning(
            `${selectedDose.vaccine} saved offline. Will sync when connection is restored.`,
            { duration: 5000 }
          )
        } else {
          // Other error (validation, server error, etc.)
          throw apiError
        }
      }
    } catch (error) {
      console.error("Failed to save vaccination:", error)
      toast.error("Failed to save vaccination. Please try again.")
    } finally {
      setIsSavingVaccine(false)
    }
  }

  const handleSaveSessionNote = async () => {
    if (!sessionNote.trim() || isSavingNote) return

    setIsSavingNote(true)

    try {
      const requestData: facilityApi.RecordSessionNoteRequest = {
        visitDate: new Date().toISOString().split("T")[0],
        recordedByName: userName || "Facility Nurse",
        notes: sessionNote.trim(),
      }

      await facilityApi.recordSessionNote(childId, requestData)

      // Refetch notes from database
      const notes = await facilityApi.getSessionNotes(childId)
      setSessionNotes(notes)
      setSessionNote("")
      setSystemMessage("Session note saved successfully.")
    } catch (error) {
      console.error("Failed to save session note:", error)
      setSystemMessage("Failed to save session note. Please try again.")
    } finally {
      setIsSavingNote(false)
    }
  }

  const openGuardianModal = async () => {
    if (isLoadingGuardian) return
    
    setIsLoadingGuardian(true)
    try {
      const guardian = await facilityApi.getGuardian(childId)
      setGuardianData(guardian)
      setGuardianForm({
        fullName: guardian.fullName,
        phonePrimary: guardian.phonePrimary,
        phoneAlternate: guardian.phoneAlternate || "",
        email: guardian.email || "",
        addressLine1: guardian.addressLine1,
        landmark: guardian.landmark || "",
        city: guardian.city,
        region: guardian.region,
        preferredContact: guardian.preferredContact === "email" ? "email" : "sms",
      })
      setShowGuardianModal(true)
    } catch (error) {
      console.error("Failed to load guardian:", error)
      setSystemMessage("Failed to load guardian details. Please try again.")
    } finally {
      setIsLoadingGuardian(false)
    }
  }

  const closeGuardianModal = () => {
    setShowGuardianModal(false)
    setGuardianData(null)
    setShowGuardianOtpModal(false)
    setGuardianOtpCode("")
    setGuardianOtpToken("")
    setGuardianOtpNotice(null)
    setGuardianOtpError(null)
    setPendingGuardianUpdate(null)
  }

  const closeGuardianOtpModal = () => {
    if (isVerifyingGuardianOtp) return
    setShowGuardianOtpModal(false)
    setGuardianOtpCode("")
    setGuardianOtpToken("")
    setGuardianOtpNotice(null)
    setGuardianOtpError(null)
    setPendingGuardianUpdate(null)
  }

  const handleGuardianFormChange = (field: keyof typeof guardianForm, value: string) => {
    setGuardianForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveGuardian = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!guardianData || isSavingGuardian) return

    setIsSavingGuardian(true)
    setGuardianOtpNotice(null)
    setGuardianOtpError(null)

    try {
      const updateData: facilityApi.UpdateGuardianRequest = {
        fullName: guardianForm.fullName,
        phonePrimary: guardianForm.phonePrimary,
        phoneAlternate: guardianForm.phoneAlternate || undefined,
        email: guardianForm.email || undefined,
        addressLine1: guardianForm.addressLine1,
        landmark: guardianForm.landmark || undefined,
        city: guardianForm.city,
        region: guardianForm.region,
        preferredContact: guardianForm.preferredContact,
      }

      const updatedGuardian = await facilityApi.updateGuardian(guardianData.id, updateData)

      if (updatedGuardian.phoneOtpRequired) {
        if (!updatedGuardian.phoneOtpToken) {
          setSystemMessage("Could not initialize phone verification. Please try again.")
          return
        }

        setPendingGuardianUpdate(updateData)
        setGuardianOtpToken(updatedGuardian.phoneOtpToken)
        setGuardianOtpCode("")
        setGuardianOtpNotice(
          updatedGuardian.message ||
            `OTP sent to ${guardianForm.phonePrimary}. Enter the code to continue.`,
        )
        setGuardianOtpError(null)
        setShowGuardianOtpModal(true)
        setSystemMessage(null)
        return
      }

      // Refetch child profile to update displayed guardian info
      const profile = await facilityApi.getChildProfile(childId)
      setChildProfile(profile)

      closeGuardianModal()
      setSystemMessage(updatedGuardian.message || "Guardian details updated successfully.")
    } catch (error) {
      console.error("Failed to update guardian:", error)
      setSystemMessage("Failed to update guardian details. Please try again.")
    } finally {
      setIsSavingGuardian(false)
    }
  }

  const handleVerifyGuardianOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!guardianData || !pendingGuardianUpdate || isVerifyingGuardianOtp) {
      return
    }

    const enteredOtp = guardianOtpCode.trim()
    if (!/^\d{6}$/.test(enteredOtp)) {
      setGuardianOtpError("Enter the 6-digit OTP sent to the guardian's new phone number.")
      return
    }

    setIsVerifyingGuardianOtp(true)
    setGuardianOtpNotice(null)
    setGuardianOtpError(null)

    try {
      const updatedGuardian = await facilityApi.updateGuardian(guardianData.id, {
        ...pendingGuardianUpdate,
        phoneOtpCode: enteredOtp,
        phoneOtpToken: guardianOtpToken,
      })

      if (updatedGuardian.phoneOtpRequired) {
        if (updatedGuardian.phoneOtpToken) {
          setGuardianOtpToken(updatedGuardian.phoneOtpToken)
        }
        setGuardianOtpCode("")
        setGuardianOtpNotice(
          updatedGuardian.message ||
            "A new OTP has been sent. Enter the latest code to continue.",
        )
        setGuardianOtpError(null)
        return
      }

      // Refetch child profile to update displayed guardian info
      const profile = await facilityApi.getChildProfile(childId)
      setChildProfile(profile)

      closeGuardianModal()
      setSystemMessage(updatedGuardian.message || "Guardian details updated successfully.")
    } catch (error) {
      console.error("Failed to verify guardian OTP:", error)
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Failed to verify OTP. Please try again."
      setGuardianOtpError(errorMessage)
    } finally {
      setIsVerifyingGuardianOtp(false)
    }
  }

  const handleResendGuardianOtp = async () => {
    if (!guardianData || !pendingGuardianUpdate || isVerifyingGuardianOtp) {
      return
    }

    setIsVerifyingGuardianOtp(true)
    setGuardianOtpNotice(null)
    setGuardianOtpError(null)

    try {
      const response = await facilityApi.updateGuardian(guardianData.id, pendingGuardianUpdate)

      if (!response.phoneOtpRequired || !response.phoneOtpToken) {
        setGuardianOtpError("Could not resend OTP right now. Please close and try again.")
        return
      }

      setGuardianOtpToken(response.phoneOtpToken)
      setGuardianOtpCode("")
      setGuardianOtpNotice(
        response.message ||
          `A new OTP has been sent to ${guardianForm.phonePrimary}.`,
      )
    } catch (error) {
      console.error("Failed to resend guardian OTP:", error)
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Failed to resend OTP. Please try again."
      setGuardianOtpError(errorMessage)
    } finally {
      setIsVerifyingGuardianOtp(false)
    }
  }

  const renderVaccineEntry = (entry: VaccineEntry) => {
    const daysUntil = entry.status === "upcoming"
      ? Math.max(1, Math.ceil((new Date(entry.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0
    const weeksUntil = Math.ceil(daysUntil / 7)
    const upcomingLabel = daysUntil < 7
      ? `${daysUntil} day${daysUntil !== 1 ? "s" : ""}`
      : `${weeksUntil} week${weeksUntil !== 1 ? "s" : ""}`
    const cutoffExpired = entry.status === "overdue" && isVaccineCutoffExpired(entry.vaccine, childProfile?.dateOfBirth)

    return (
      <div key={entry.id} className="rounded-lg border border-border bg-background/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
            <p className="text-xs text-muted-foreground">
              {entry.status === "completed" ? `Administered: ${entry.administeredDate}` : `Due: ${formatDate(entry.scheduledDate)}`}
            </p>
            {entry.notes ? <p className="mt-1.5 text-xs text-muted-foreground">{entry.notes}</p> : null}
            {cutoffExpired && (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Administration window closed — this dose can no longer be given.
              </p>
            )}
          </div>

          {entry.status === "completed" ? (
            <Badge variant="secondary" className="w-fit shrink-0">Completed</Badge>
          ) : entry.status === "upcoming" ? (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <div className="leading-tight">
                <p className="text-xs font-semibold text-primary">
                  In {upcomingLabel}
                </p>
                <p className="text-[10px] text-primary/60">{formatDate(entry.scheduledDate)}</p>
              </div>
            </div>
          ) : cutoffExpired ? (
            <Badge variant="outline" className="w-fit shrink-0 border-muted-foreground/40 text-muted-foreground gap-1">
              Window Expired
            </Badge>
          ) : (
            <Button
              size="sm"
              variant={entry.status === "overdue" ? "destructive" : "default"}
              className="shrink-0 gap-2"
              onClick={() => openAdministerModal(entry)}
            >
              <Syringe className="h-4 w-4" /> Administer
            </Button>
          )}
        </div>
      </div>
    )
  }

  const renderScheduleGroup = (
    title: string,
    entries: VaccineEntry[],
    accent: string,
    empty: string,
    colorScheme: "red" | "amber" | "sky" | "emerald",
  ) => {
    const PREVIEW_COUNT = 4
    const visible = entries.slice(0, PREVIEW_COUNT)
    const remaining = entries.length - PREVIEW_COUNT
    return (
      <Card className={accent}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{entries.length} item{entries.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{empty}</p>
          ) : (
            <>
              {visible.map(renderVaccineEntry)}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setVaccineModalGroup({ title, entries, colorScheme })}
                  className="w-full rounded-lg border border-dashed border-border py-2.5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  View {remaining} more {title.toLowerCase()} {remaining === 1 ? "vaccine" : "vaccines"}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

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
            {!isOnline && (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {pendingSyncCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <Syringe className="h-3 w-3" />
                {pendingSyncCount} pending sync
              </Badge>
            )}
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Facility Nurse</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {isLoadingChild ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Loading child profile...</p>
            </CardContent>
          </Card>
        ) : (
          <>
        <section className="mt-6">
          <Card className="border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BadgeCheck className="h-5 w-5 text-primary" /> Child overview
                </CardTitle>
                <div className="relative shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75" />
                  <button
                    type="button"
                    onClick={() => setShowChildDetailsModal(true)}
                    className="group relative flex items-center gap-0 overflow-hidden rounded-full border border-primary/30 bg-primary/10 p-2 text-primary transition-all duration-500 ease-in-out hover:gap-2 hover:border-primary hover:bg-primary hover:px-4 hover:text-white"
                    aria-label="View child's details"
                    title="View child's details"
                  >
                    <Baby className="h-5 w-5 shrink-0" />
                    <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-500 group-hover:max-w-[180px]">
                      View Child&apos;s Details
                    </span>
                  </button>
                </div>
              </div>
              <CardDescription>ID: {childRecord.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/70 p-4 sm:flex-row sm:items-center">
                <div className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {isUploadingPhoto ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : childRecord.photoUrl ? (
                    <img src={childRecord.photoUrl} alt={`${childRecord.name} photo`} className="h-full w-full object-cover" />
                  ) : (
                    childRecord.name
                      .split(" ")
                      .map((segment) => segment[0])
                      .join("")
                      .slice(0, 2)
                  )}
                  {/* Camera overlay */}
                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                    title="Update photo"
                  >
                    <Camera className="h-5 w-5 text-white drop-shadow" />
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !childProfile) return
                      setIsUploadingPhoto(true)
                      try {
                        const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg"
                        const filePath = `${childProfile.childId}.${fileExt}`
                        const { error: uploadError } = await supabase.storage
                          .from("child-photos")
                          .upload(filePath, file, { cacheControl: "3600", upsert: true })
                        if (uploadError) throw uploadError
                        const { data: urlData } = supabase.storage
                          .from("child-photos")
                          .getPublicUrl(filePath)
                        // Add cache-buster to force re-render
                        const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
                        // Update DB
                        await supabase
                          .from("children")
                          .update({ profile_photo_url: urlData.publicUrl })
                          .eq("id", childProfile.id)
                        // Update local state
                        setChildProfile({ ...childProfile, profilePhoto: newUrl })
                        setSystemMessage("Profile photo updated successfully.")
                      } catch (err) {
                        console.error("Photo upload failed:", err)
                        setSystemMessage("Failed to update photo. Please try again.")
                      } finally {
                        setIsUploadingPhoto(false)
                        if (photoInputRef.current) photoInputRef.current.value = ""
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-base font-semibold text-foreground">{childRecord.name}</p>
                  <p className="text-sm text-muted-foreground">Date of Birth: {childRecord.dateOfBirth ? formatDOB(childRecord.dateOfBirth) : "Pending"}</p>
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
        </section>

        <section className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Vaccination timeline</h2>
            <p className="text-sm text-muted-foreground">
              Review overdue doses first, then capture today&apos;s vaccines before the child leaves.
            </p>
          </div>

          {isLoadingVaccines ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Loading vaccination records...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {renderScheduleGroup(
                "Overdue",
                groupedSchedule.overdue,
                "border-destructive/40",
                "No overdue vaccines. Maintain adherence to the EPI schedule.",
                "red"
              )}
              {renderScheduleGroup(
                "Due today",
                groupedSchedule.dueToday,
                "border-amber-300/50",
                "No vaccines scheduled for today.",
                "amber"
              )}
              {renderScheduleGroup(
                "Upcoming",
                groupedSchedule.upcoming,
                "border-sky-300/60",
                "Upcoming vaccines will appear here.",
                "sky"
              )}
              {renderScheduleGroup(
                "Completed",
                groupedSchedule.completed,
                "border-emerald-300/60",
                "Completed vaccinations will display once recorded.",
                "emerald"
              )}
            </div>
          )}
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
                  <DatePicker
                    date={measurementForm.date ? new Date(`${measurementForm.date}T00:00:00`) : undefined}
                    onDateChange={(selectedDate) =>
                      handleMeasurementChange("date", selectedDate ? formatDateForInput(selectedDate) : "")
                    }
                    maxDate={new Date()}
                    toYear={new Date().getFullYear()}
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
                  <Button type="submit" className="gap-2" disabled={isSavingMeasurement}>
                    {isSavingMeasurement ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <Scale className="h-4 w-4" /> Record measurements
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetMeasurementForm} disabled={isSavingMeasurement}>
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
            <CardContent className="space-y-4">
              <div>
                <textarea
                  placeholder="Add session notes once the visit is complete."
                  className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  disabled={isSavingNote}
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Notes are saved to the database and visible on HQ dashboards.</p>
                  <Button 
                    size="sm" 
                    onClick={handleSaveSessionNote}
                    disabled={!sessionNote.trim() || isSavingNote}
                    className="gap-2"
                  >
                    {isSavingNote ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      "Save note"
                    )}
                  </Button>
                </div>
              </div>
              
              {sessionNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Previous notes</p>
                  <div className="max-h-[200px] space-y-2 overflow-y-auto">
                    {sessionNotes.map((note) => (
                      <div key={note.id} className="rounded-md border border-border bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(note.visitDate)} • {note.recordedByName}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{note.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Flame className="h-5 w-5 text-primary" /> AEFI watchlist
                  </CardTitle>
                  <CardDescription>Adverse events flagged in the last 30 days.</CardDescription>
                </div>
                {aefiReports.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAefiModalOpen(true)}>
                    View all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingAefi ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading watchlist...
                </div>
              ) : aefiReports.length === 0 ? (
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>No AEFI recorded in the last 30 days.</p>
                  <p>
                    If you suspect an adverse event, tick the AEFI checkbox in the administer modal. An alert will notify the Branch Manager.
                  </p>
                </div>
              ) : (
                <>
                  {aefiReports.slice(0, 2).map((report) => (
                    <div key={report.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {report.vaccineName}{report.doseNumber ? ` (Dose ${report.doseNumber})` : ""}
                        </p>
                        <div className="flex shrink-0 gap-1.5">
                          <Badge
                            variant={report.severity === "severe" ? "destructive" : report.severity === "moderate" ? "secondary" : "outline"}
                            className="text-xs capitalize"
                          >
                            {report.severity}
                          </Badge>
                          <Badge
                            variant={report.status === "reported" || report.status === "escalated" ? "destructive" : report.status === "resolved" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {report.status === "under-review" ? "Under review" : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      {report.symptoms.length > 0 && (
                        <p className="text-xs text-muted-foreground">{report.symptoms.join(", ")}</p>
                      )}
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{formatDate(report.onsetDate)}</p>
                    </div>
                  ))}
                  {aefiReports.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      Showing 2 of {aefiReports.length}.{" "}
                      <button type="button" className="underline hover:text-foreground" onClick={() => setAefiModalOpen(true)}>
                        View all
                      </button>
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>
        </>
        )}
      </main>

      <NotificationModal
        open={Boolean(loadError)}
        title="Unable to load child record"
        message={loadError || ""}
        onOpenChange={(open) => {
          if (!open) {
            setLoadError(null)
          }
        }}
      />

      <NotificationModal
        open={Boolean(systemMessage)}
        title="Notification"
        message={systemMessage || ""}
        onOpenChange={(open) => {
          if (!open) {
            setSystemMessage(null)
          }
        }}
      />

      <NotificationModal
        open={Boolean(measurementStatus)}
        title="Growth monitoring update"
        message={measurementStatus || ""}
        onOpenChange={(open) => {
          if (!open) {
            setMeasurementStatus(null)
          }
        }}
      />

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
                  <DatePicker
                    date={administerForm.dateAdministered ? new Date(`${administerForm.dateAdministered}T00:00:00`) : undefined}
                    onDateChange={(selectedDate) =>
                      handleAdministerChange("dateAdministered", selectedDate ? formatDateForInput(selectedDate) : "")
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchNumber" className="flex items-center gap-2">
                    Batch number
                    {isLoadingStock && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
                    {stockFromInventory && !isLoadingStock && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">From inventory</span>
                    )}
                    {noStockAvailable && !isLoadingStock && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">No stock logged</span>
                    )}
                  </Label>
                  <Input
                    id="batchNumber"
                    required
                    placeholder={isLoadingStock ? "Fetching…" : noStockAvailable ? "Branch manager has not logged this vaccine" : "e.g. PEN-44192"}
                    value={administerForm.batchNumber}
                    readOnly={stockFromInventory || noStockAvailable}
                    disabled={noStockAvailable}
                    className={(stockFromInventory || noStockAvailable) ? "bg-muted cursor-not-allowed" : ""}
                    onChange={(event) => !stockFromInventory && !noStockAvailable && handleAdministerChange("batchNumber", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="flex items-center gap-2">
                    Expiry date
                    {stockFromInventory && !isLoadingStock && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">From inventory</span>
                    )}
                    {noStockAvailable && !isLoadingStock && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">No stock logged</span>
                    )}
                  </Label>
                  {stockFromInventory ? (
                    <Input
                      id="expiryDate"
                      value={administerForm.expiryDate}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                    />
                  ) : noStockAvailable ? (
                    <Input
                      id="expiryDate"
                      placeholder="Branch manager has not logged this vaccine"
                      readOnly
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  ) : (
                    <DatePicker
                      date={administerForm.expiryDate ? new Date(`${administerForm.expiryDate}T00:00:00`) : undefined}
                      onDateChange={(selectedDate) =>
                        handleAdministerChange("expiryDate", selectedDate ? formatDateForInput(selectedDate) : "")
                      }
                    />
                  )}
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
                    <option value="left-thigh">Left thigh</option>
                    <option value="right-thigh">Right thigh</option>
                    <option value="left-arm-upper">Left arm (upper)</option>
                    <option value="right-arm-upper">Right arm (upper)</option>
                    <option value="oral">Oral</option>
                    <option value="intranasal">Intranasal</option>
                    <option value="other">Other</option>
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
                  <Button type="button" variant="outline" onClick={closeAdministerModal} disabled={isSavingVaccine}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSavingVaccine}>
                    {isSavingVaccine ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Save dose
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Guardian Edit Modal */}
      {showGuardianModal && !showGuardianOtpModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Update Guardian Details</h3>
              <button
                type="button"
                onClick={closeGuardianModal}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGuardian} className="space-y-4">
              <div>
                <label htmlFor="guardian-fullName" className="block text-sm font-medium">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="guardian-fullName"
                  type="text"
                  value={guardianForm.fullName}
                  onChange={(e) => handleGuardianFormChange("fullName", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="guardian-phonePrimary" className="block text-sm font-medium">
                    Primary Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="guardian-phonePrimary"
                    type="tel"
                    value={guardianForm.phonePrimary}
                    onChange={(e) => handleGuardianFormChange("phonePrimary", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="guardian-phoneAlternate" className="block text-sm font-medium">
                    Alternate Phone
                  </label>
                  <input
                    id="guardian-phoneAlternate"
                    type="tel"
                    value={guardianForm.phoneAlternate}
                    onChange={(e) => handleGuardianFormChange("phoneAlternate", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guardian-email" className="block text-sm font-medium">
                  Email Address
                </label>
                <input
                  id="guardian-email"
                  type="email"
                  value={guardianForm.email}
                  onChange={(e) => handleGuardianFormChange("email", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="guardian-addressLine1" className="block text-sm font-medium">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="guardian-addressLine1"
                  type="text"
                  value={guardianForm.addressLine1}
                  onChange={(e) => handleGuardianFormChange("addressLine1", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="guardian-landmark" className="block text-sm font-medium">
                  Landmark
                </label>
                <input
                  id="guardian-landmark"
                  type="text"
                  value={guardianForm.landmark}
                  onChange={(e) => handleGuardianFormChange("landmark", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Near the market, opposite school..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="guardian-city" className="block text-sm font-medium">
                    City/Town <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="guardian-city"
                    type="text"
                    value={guardianForm.city}
                    onChange={(e) => handleGuardianFormChange("city", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="guardian-region" className="block text-sm font-medium">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="guardian-region"
                    value={guardianForm.region}
                    onChange={(e) => handleGuardianFormChange("region", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">Select region...</option>
                    <option value="Greater Accra">Greater Accra</option>
                    <option value="Ashanti">Ashanti</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Central">Central</option>
                    <option value="Northern">Northern</option>
                    <option value="Volta">Volta</option>
                    <option value="Bono">Bono</option>
                    <option value="Bono East">Bono East</option>
                    <option value="Ahafo">Ahafo</option>
                    <option value="Upper East">Upper East</option>
                    <option value="Upper West">Upper West</option>
                    <option value="North East">North East</option>
                    <option value="Savannah">Savannah</option>
                    <option value="Oti">Oti</option>
                    <option value="Western North">Western North</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="guardian-preferredContact" className="block text-sm font-medium">
                  Preferred Contact Method
                </label>
                <select
                  id="guardian-preferredContact"
                  value={guardianForm.preferredContact}
                  onChange={(e) => handleGuardianFormChange("preferredContact", e.target.value as "sms" | "email")}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={closeGuardianModal} disabled={isSavingGuardian}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={isSavingGuardian}>
                  {isSavingGuardian ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showGuardianOtpModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Verify New Phone Number</h3>
              <button
                type="button"
                onClick={closeGuardianOtpModal}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
                disabled={isVerifyingGuardianOtp}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              We sent a 6-digit OTP to {guardianForm.phonePrimary || "the new phone number"}. Ask the parent for the code,
              enter it below, and save.
            </p>

            {guardianOtpNotice ? (
              <div className="mb-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
                {guardianOtpNotice}
              </div>
            ) : null}

            {guardianOtpError ? (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {guardianOtpError}
              </div>
            ) : null}

            <form onSubmit={handleVerifyGuardianOtp} className="space-y-4">
              <div>
                <label htmlFor="guardian-phone-otp" className="block text-sm font-medium">
                  OTP Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="guardian-phone-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={guardianOtpCode}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 6)
                    setGuardianOtpCode(digitsOnly)
                    if (guardianOtpError) {
                      setGuardianOtpError(null)
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-base tracking-[0.35em] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="000000"
                  maxLength={6}
                  required
                  disabled={isVerifyingGuardianOtp}
                />
                <p className="mt-1 text-xs text-muted-foreground">Code expires in 10 minutes.</p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeGuardianOtpModal}
                  disabled={isVerifyingGuardianOtp}
                >
                  Cancel
                </Button>
                <Button type="button" variant="ghost" onClick={handleResendGuardianOtp} disabled={isVerifyingGuardianOtp}>
                  {isVerifyingGuardianOtp ? "Please wait..." : "Resend OTP"}
                </Button>
                <Button type="submit" className="gap-2" disabled={isVerifyingGuardianOtp}>
                  {isVerifyingGuardianOtp ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Verify & Save
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Child Details Modal */}
      {showChildDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="flex w-full max-w-xl flex-col rounded-xl border border-border bg-background shadow-2xl" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Baby className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{childRecord.name}</h2>
                  <p className="text-xs text-muted-foreground">CVCC ID: {childRecord.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChildDetailsModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Personal Information</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Full Name</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.name}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date of Birth</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.dateOfBirth ? formatDOB(childRecord.dateOfBirth) : "Pending"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Age</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.age}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gender</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.gender}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last Clinic Visit</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.lastVisit}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Birth Details</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Birth Weight</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.birthDetails.weight || "Not recorded"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Birth Length</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.birthDetails.length || "Not recorded"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Place of Birth</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.birthDetails.place || "Not recorded"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivery Type</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.birthDetails.deliveryType || "Not recorded"}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Guardian &amp; Contact</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Guardian Name</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.guardian.name}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.guardian.phone || "Not captured"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preferred Contact</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.guardian.preferredContact.toUpperCase()}</p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Address</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.guardian.address}</p>
                  </div>
                </div>
              </div>

              {(childRecord.criticalNotes || childRecord.allergies.length > 0) && (
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Alerts &amp; Allergies</p>
                  <div className="space-y-2">
                    {childRecord.criticalNotes && (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>{childRecord.criticalNotes}</span>
                      </div>
                    )}
                    {childRecord.allergies.length > 0 && (
                      <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 p-3 dark:bg-amber-950/20">
                        <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">Known Allergies</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{childRecord.allergies.join(", ")}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setShowChildDetailsModal(false)}>Close</Button>
              <Button
                onClick={async () => {
                  if (isLoadingGuardian) return
                  await openGuardianModal()
                  setShowChildDetailsModal(false)
                }}
                disabled={isLoadingGuardian}
                className="gap-2"
              >
                {isLoadingGuardian ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ClipboardList className="h-4 w-4" /> Update Guardian
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vaccine Group Modal */}
      {vaccineModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-background shadow-2xl" style={{ maxHeight: "90vh" }}>
            <div className={`flex items-center justify-between border-b border-border px-6 py-5 ${
              vaccineModalGroup.colorScheme === "red" ? "bg-destructive/5" :
              vaccineModalGroup.colorScheme === "amber" ? "bg-amber-50/80 dark:bg-amber-950/20" :
              vaccineModalGroup.colorScheme === "sky" ? "bg-sky-50/80 dark:bg-sky-950/20" :
              "bg-emerald-50/80 dark:bg-emerald-950/20"
            }`}>
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{vaccineModalGroup.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {vaccineModalGroup.entries.length} vaccine{vaccineModalGroup.entries.length === 1 ? "" : "s"} — {childRecord.name}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  vaccineModalGroup.colorScheme === "red" ? "bg-destructive/15 text-destructive" :
                  vaccineModalGroup.colorScheme === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  vaccineModalGroup.colorScheme === "sky" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" :
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                }`}>
                  {vaccineModalGroup.entries.length} total
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVaccineModalGroup(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-3">
              {vaccineModalGroup.entries.map(renderVaccineEntry)}
            </div>

            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setVaccineModalGroup(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── AEFI Watchlist Modal ───────────────────────────────────────── */}
      <Dialog open={aefiModalOpen} onOpenChange={setAefiModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" /> AEFI watchlist — last 30 days
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {aefiReports.length} report{aefiReports.length !== 1 ? "s" : ""} on record for this child
            </p>
          </DialogHeader>

          <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {aefiReports.map((report) => (
              <div key={report.id} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {report.vaccineName}{report.doseNumber ? ` — Dose ${report.doseNumber}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Onset: {formatDate(report.onsetDate)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge
                      variant={report.severity === "severe" ? "destructive" : report.severity === "moderate" ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {report.severity}
                    </Badge>
                    <Badge
                      variant={report.status === "reported" || report.status === "escalated" ? "destructive" : report.status === "resolved" ? "default" : "secondary"}
                    >
                      {report.status === "under-review" ? "Under review" : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </Badge>
                  </div>
                </div>

                {report.symptoms.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Symptoms</p>
                    <p className="mt-0.5 text-sm text-foreground">{report.symptoms.join(", ")}</p>
                  </div>
                )}

                {report.notes ? (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nurse note</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{report.notes}</p>
                  </div>
                ) : null}

                {report.reportedBy ? (
                  <p className="text-xs text-muted-foreground">Reported by: {report.reportedBy}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-border pt-3">
            <Button variant="outline" onClick={() => setAefiModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

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

function formatDOB(dateString: string) {
  if (!dateString) return "Pending"
  const date = new Date(dateString + "T00:00:00")
  if (Number.isNaN(date.getTime())) return "Pending"
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}-${mm}-${yy}`
}

function NotificationModal({
  open,
  title,
  message,
  onOpenChange,
}: {
  open: boolean
  title: string
  message: string
  onOpenChange: (open: boolean) => void
}) {
  if (!message) {
    return null
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end">
          <AlertDialogAction>OK</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
