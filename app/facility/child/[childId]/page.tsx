"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { QRCodeCanvas } from "qrcode.react"
import {
  AlertCircle,
  ArrowLeft,
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
  User,
  X,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"
import { supabase } from "@/lib/supabase"
import * as offlineSync from "@/lib/offline-vaccination-sync"
import { getVaccineSite, getSiteDescription } from "@/lib/ghana-epi-schedule"
import { toast } from "sonner"
import crypto from "crypto"

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
    preferredContact: "sms" | "email" | "whatsapp"
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

// Ghana EPI Schedule Sample Data
const defaultSchedule: VaccineEntry[] = [
  // Birth (0 weeks)
  { id: "BCG", vaccine: "BCG", scheduledDate: "2025-07-18", status: "completed", administeredDate: "2025-07-18", batchNumber: "BCG-44721" },
  { id: "OPV-0", vaccine: "OPV", scheduledDate: "2025-07-18", status: "completed", administeredDate: "2025-07-18", batchNumber: "OPV-55019" },
  { id: "HEPB-0", vaccine: "Hepatitis B", scheduledDate: "2025-07-18", status: "completed", administeredDate: "2025-07-18" },

  // 6 weeks
  { id: "OPV-1", vaccine: "OPV", scheduledDate: "2025-08-29", status: "completed", administeredDate: "2025-08-29" },
  { id: "PENTA-1", vaccine: "Pentavalent", scheduledDate: "2025-08-29", status: "completed", administeredDate: "2025-08-29", batchNumber: "PEN-33011" },
  { id: "PCV-1", vaccine: "PCV", scheduledDate: "2025-08-29", status: "completed", administeredDate: "2025-08-29" },
  { id: "ROTA-1", vaccine: "Rotavirus", scheduledDate: "2025-08-29", status: "completed", administeredDate: "2025-08-29" },
  { id: "HEPB-1", vaccine: "Hepatitis B", scheduledDate: "2025-08-29", status: "completed", administeredDate: "2025-08-29" },

  // 10 weeks
  { id: "OPV-2", vaccine: "OPV", scheduledDate: "2025-09-26", status: "completed", administeredDate: "2025-09-26" },
  { id: "PENTA-2", vaccine: "Pentavalent", scheduledDate: "2025-09-26", status: "completed", administeredDate: "2025-09-26" },
  { id: "PCV-2", vaccine: "PCV", scheduledDate: "2025-09-26", status: "completed", administeredDate: "2025-09-26" },
  { id: "ROTA-2", vaccine: "Rotavirus", scheduledDate: "2025-09-26", status: "completed", administeredDate: "2025-09-26" },

  // 14 weeks
  { id: "OPV-3", vaccine: "OPV", scheduledDate: "2025-10-24", status: "dueToday", notes: "Prepare vaccine and review cold chain log." },
  { id: "PENTA-3", vaccine: "Pentavalent", scheduledDate: "2025-10-24", status: "dueToday" },
  { id: "PCV-3", vaccine: "PCV", scheduledDate: "2025-10-24", status: "dueToday" },

  // 9 months
  { id: "MEASLES-1", vaccine: "Measles-Rubella", scheduledDate: "2026-04-18", status: "upcoming" },
  { id: "YF", vaccine: "Yellow Fever", scheduledDate: "2026-04-18", status: "upcoming" },

  // 18 months
  { id: "MEASLES-2", vaccine: "Measles-Rubella", scheduledDate: "2026-01-18", status: "overdue", notes: "Schedule appointment urgently" },
  { id: "MENA", vaccine: "Meningitis A", scheduledDate: "2026-01-18", status: "overdue" },
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

// Certificate security helper functions
const generateCertificateSerialNumber = (): string => {
  const year = new Date().getFullYear().toString().slice(-2)
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `GH-VAC-${year}${month}-${randomPart}`
}

const generateCertificateHash = (data: string): string => {
  if (typeof window === "undefined") return ""
  // Browser-safe hash using substring of data
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0").toUpperCase()
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
  const [siteAutoFilled, setSiteAutoFilled] = useState(false)
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
    preferredContact: "sms" as "sms" | "email" | "whatsapp",
  })
  const [isSavingGuardian, setIsSavingGuardian] = useState(false)
  const [isLoadingGuardian, setIsLoadingGuardian] = useState(false)

  // State for photo upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // State for completed vaccines modal
  const [showCompletedModal, setShowCompletedModal] = useState(false)

  // State for child details modal
  const [showChildDetailsModal, setShowChildDetailsModal] = useState(false)

  // State for vaccine group modals
  const [showOverdueModal, setShowOverdueModal] = useState(false)
  const [showDueTodayModal, setShowDueTodayModal] = useState(false)
  const [showUpcomingModal, setShowUpcomingModal] = useState(false)
  const [showGrowthMonitoringModal, setShowGrowthMonitoringModal] = useState(false)
  const [showRecordGrowthForm, setShowRecordGrowthForm] = useState(false)
  const [showCertificateModal, setShowCertificateModal] = useState(false)

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
          place: "Not recorded",
          deliveryType: "Not recorded",
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

    // Get set of administered vaccine names for quick lookup
    const administeredVaccines = new Set(vaccinationHistory.map((vax) => vax.vaccineName))

    // Add completed vaccinations from history
    vaccinationHistory.forEach((vax) => {
      entries.push({
        id: `completed-${vax.id}`,
        vaccine: vax.vaccineName,
        scheduledDate: vax.administeredDate, // Use administered date for completed vaccines
        status: "completed",
        administeredDate: vax.administeredDate,
        batchNumber: vax.batchNumber || undefined,
        notes: vax.notes || undefined,
      })
    })

    // Add scheduled vaccinations (excluding already administered ones)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    scheduledVaccines.forEach((vax) => {
      // Skip if this vaccine has already been administered
      if (administeredVaccines.has(vax.vaccineName)) {
        return
      }

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
        id: `scheduled-${vax.vaccineName}-${vax.dueDate}`,
        vaccine: vax.vaccineName,
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

  const certificateQRRef = useRef<HTMLCanvasElement>(null)

  const certificateContent = useMemo(() => {
    const serialNumber = generateCertificateSerialNumber()
    const certificateData = `${serialNumber}|${childId}|${childRecord.name}|${groupedSchedule.completed.length}`
    const certificateHash = generateCertificateHash(certificateData)
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)

    return { serialNumber, certificateHash, expiryDate }
  }, [childId, childRecord.name, groupedSchedule.completed])

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
    setSelectedDose(entry)
    setStockFromInventory(false)

    // Get the dose number for this vaccine (how many times has it been given already)
    const administeredCount = vaccinationHistory.filter(
      (vax) => vax.vaccineName === entry.vaccine
    ).length
    const doseNumber = administeredCount + 1

    // Auto-fill injection site based on vaccine and dose number
    const autoSite = getVaccineSite(entry.vaccine, doseNumber) || ""

    setAdministerForm({
      batchNumber: entry.batchNumber ?? "",
      dateAdministered: new Date().toISOString().split("T")[0],
      expiryDate: "",
      site: autoSite,
      administeredBy: userName || "Facility Nurse",
      aefiFlag: false,
      aefiNotes: "",
    })
    setSiteAutoFilled(!!autoSite)

    // Auto-fill batch number and expiry date from stock inventory
    const facilityId = childProfile?.facilityId
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
        }
      } catch {
        // Leave fields empty — nurse fills them in manually
      } finally {
        setIsLoadingStock(false)
      }
    }
  }

  const closeAdministerModal = () => {
    setSelectedDose(null)
    setAdministerForm(initialAdministerState)
    setSiteAutoFilled(false)
  }

  const handleAdministerChange = (field: keyof AdministerFormState, value: string | boolean) => {
    setAdministerForm((previous) => ({ ...previous, [field]: value }))
    // Mark site as manually changed if user modifies it
    if (field === "site") {
      setSiteAutoFilled(false)
    }
  }

  const handleAdministerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDose || isSavingVaccine) return

    setIsSavingVaccine(true)

    try {
      // Prepare the data for the API
      const requestData: facilityApi.AdministerVaccineRequest = {
        vaccineName: selectedDose.vaccine,
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
        if (childProfile?.dateOfBirth) {
          const [history, scheduled] = await Promise.all([
            facilityApi.getVaccinationHistory(childId),
            facilityApi.getScheduledVaccinations(childId, childProfile.dateOfBirth),
          ])
          
          setVaccinationHistory(history)
          setScheduledVaccines(scheduled)
        }

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
        preferredContact: guardian.preferredContact || "sms",
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
  }

  const handleGuardianFormChange = (field: keyof typeof guardianForm, value: string) => {
    setGuardianForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveGuardian = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!guardianData || isSavingGuardian) return

    setIsSavingGuardian(true)

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

      await facilityApi.updateGuardian(guardianData.id, updateData)

      // Refetch child profile to update displayed guardian info
      const profile = await facilityApi.getChildProfile(childId)
      setChildProfile(profile)

      closeGuardianModal()
      setSystemMessage("Guardian details updated successfully.")
    } catch (error) {
      console.error("Failed to update guardian:", error)
      setSystemMessage("Failed to update guardian details. Please try again.")
    } finally {
      setIsSavingGuardian(false)
    }
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
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Facility Nurse</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {loadError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}
        
        {systemMessage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}
        
        {isLoadingChild ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Loading child profile...</p>
            </CardContent>
          </Card>
        ) : (
          <>
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
                <div className="flex-1 space-y-2">
                  <p className="text-base font-semibold text-foreground">{childRecord.name}</p>
                  {childRecord.criticalNotes ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                      <ShieldAlert className="h-3 w-3" /> {childRecord.criticalNotes}
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowChildDetailsModal(true)}
                  >
                    More Details
                  </Button>
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
            <div className="space-y-6">
              {/* Vaccine Status Buttons Row */}
              <div className="grid gap-3 md:grid-cols-4">
                {/* Overdue Button */}
                <div className="rounded-lg border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-left flex flex-col justify-between h-full">
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-200">Overdue</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-200 mt-1">{groupedSchedule.overdue.length}</p>
                    <p className="text-xs text-red-600/70 dark:text-red-300/70 mt-1">vaccine{groupedSchedule.overdue.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => setShowOverdueModal(true)}
                    className="text-xs font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 px-3 py-1.5 rounded hover:bg-red-200 dark:hover:bg-red-900/70 transition self-end mt-3"
                  >
                    View
                  </button>
                </div>

                {/* Due Today Button */}
                <div className="rounded-lg border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-left flex flex-col justify-between h-full">
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">Due Today</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-200 mt-1">{groupedSchedule.dueToday.length}</p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-300/70 mt-1">vaccine{groupedSchedule.dueToday.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => setShowDueTodayModal(true)}
                    className="text-xs font-medium text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 px-3 py-1.5 rounded hover:bg-amber-200 dark:hover:bg-amber-900/70 transition self-end mt-3"
                  >
                    View
                  </button>
                </div>

                {/* Upcoming Button */}
                <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 text-left flex flex-col justify-between h-full">
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-200">Upcoming</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-200 mt-1">{groupedSchedule.upcoming.length}</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-300/70 mt-1">vaccine{groupedSchedule.upcoming.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => setShowUpcomingModal(true)}
                    className="text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 px-3 py-1.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900/70 transition self-end mt-3"
                  >
                    View
                  </button>
                </div>

                {/* Growth Monitoring Button */}
                <div className="rounded-lg border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-4 text-left flex flex-col justify-between h-full">
                  <div>
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-200">Growth Monitoring</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-200 mt-1">{measurements.length}</p>
                    <p className="text-xs text-purple-600/70 dark:text-purple-300/70 mt-1">record{measurements.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => setShowGrowthMonitoringModal(true)}
                    className="text-xs font-medium text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/50 px-3 py-1.5 rounded hover:bg-purple-200 dark:hover:bg-purple-900/70 transition self-end mt-3"
                  >
                    View
                  </button>
                </div>
              </div>

              {/* Completed Button */}
              {groupedSchedule.completed.length > 0 && (
                <div className="w-full rounded-lg border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 text-left flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-200">Completed</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-200 mt-1">{groupedSchedule.completed.length}</p>
                      <p className="text-xs text-green-600/70 dark:text-green-300/70 mt-1">vaccine{groupedSchedule.completed.length !== 1 ? "s" : ""}</p>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <button
                    onClick={() => setShowCompletedModal(true)}
                    className="text-xs font-medium text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900/50 px-3 py-1.5 rounded hover:bg-green-200 dark:hover:bg-green-900/70 transition self-end mt-3"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Certificate Section - Shows when all vaccinations complete */}
        {groupedSchedule.overdue.length === 0 &&
         groupedSchedule.dueToday.length === 0 &&
         groupedSchedule.upcoming.length === 0 &&
         groupedSchedule.completed.length > 0 && (
          <section className="mt-8">
            <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Vaccination Complete! 🎉</h3>
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                      All required vaccinations have been administered. Certificate is ready to download.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setShowCertificateModal(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                >
                  <FileText className="h-4 w-4" />
                  View & Print Certificate
                </Button>
              </div>
            </div>
          </section>
        )}

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
        </>
        )}
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
                  <DatePicker
                    date={administerForm.dateAdministered ? new Date(`${administerForm.dateAdministered}T00:00:00`) : undefined}
                    onDateChange={(selectedDate) =>
                      handleAdministerChange("dateAdministered", selectedDate ? formatDateForInput(selectedDate) : "")
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchNumber" className="flex items-center gap-2">
                    Batch / lot number
                    {isLoadingStock && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
                    {stockFromInventory && !isLoadingStock && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">From inventory</span>
                    )}
                  </Label>
                  <Input
                    id="batchNumber"
                    required
                    placeholder={isLoadingStock ? "Fetching…" : "e.g. PEN-44192"}
                    value={administerForm.batchNumber}
                    readOnly={stockFromInventory}
                    className={stockFromInventory ? "bg-muted cursor-not-allowed" : ""}
                    onChange={(event) => !stockFromInventory && handleAdministerChange("batchNumber", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="flex items-center gap-2">
                    Expiry date
                    {stockFromInventory && !isLoadingStock && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">From inventory</span>
                    )}
                  </Label>
                  {stockFromInventory ? (
                    <Input
                      id="expiryDate"
                      value={administerForm.expiryDate}
                      readOnly
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
                  <Label htmlFor="site">Site of injection (Ghana EPI standard)</Label>
                  <select
                    id="site"
                    required
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={administerForm.site}
                    onChange={(event) => handleAdministerChange("site", event.target.value)}
                  >
                    <option value="">Select site</option>
                    <option value="left-arm-upper">Left upper arm</option>
                    <option value="right-arm-upper">Right upper arm</option>
                    <option value="left-thigh">Left upper thigh</option>
                    <option value="right-thigh">Right upper thigh</option>
                    <option value="oral">Oral (by mouth)</option>
                  </select>
                  {siteAutoFilled && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Auto-filled per Ghana EPI guidelines: {getSiteDescription(administerForm.site as any)}
                    </p>
                  )}
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
      {showGuardianModal ? (
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
                  onChange={(e) => handleGuardianFormChange("preferredContact", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
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

      {/* Child Details Modal */}
      {showChildDetailsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Child Information</h3>
              <button
                type="button"
                onClick={() => setShowChildDetailsModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Birth Details */}
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">Birth Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth:</span>
                    <span className="text-foreground font-medium">{childRecord.dateOfBirth || "Pending"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age:</span>
                    <span className="text-foreground font-medium">{childRecord.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Birth Weight:</span>
                    <span className="text-foreground font-medium">{childRecord.birthDetails.weight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Birth Length:</span>
                    <span className="text-foreground font-medium">{childRecord.birthDetails.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Place of Birth:</span>
                    <span className="text-foreground font-medium">{childRecord.birthDetails.place}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Type:</span>
                    <span className="text-foreground font-medium">{childRecord.birthDetails.deliveryType}</span>
                  </div>
                </div>
              </div>

              {/* Guardian Details */}
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">Guardian Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="text-foreground font-medium">{childRecord.guardian.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="text-foreground font-medium">{childRecord.guardian.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-foreground font-medium text-right">{childRecord.guardian.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Contact:</span>
                    <span className="text-foreground font-medium uppercase">{childRecord.guardian.preferredContact}</span>
                  </div>
                </div>
              </div>

              {/* Allergies */}
              {childRecord.allergies.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive mb-2">⚠️ Allergies</p>
                  <p className="text-sm text-destructive">{childRecord.allergies.join(", ")}</p>
                </div>
              )}

              {/* Last Visit */}
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground mb-1">Last Visit</p>
                <p className="text-sm text-muted-foreground">{childRecord.lastVisit}</p>
              </div>
            </div>

            <div className="border-t border-border p-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowChildDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Overdue Vaccines Modal */}
      {showOverdueModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Overdue Vaccines</h3>
                <p className="text-sm text-muted-foreground">{groupedSchedule.overdue.length} vaccine{groupedSchedule.overdue.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setShowOverdueModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {groupedSchedule.overdue.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-destructive/40 bg-background/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
                      <p className="text-xs text-muted-foreground">Due: {entry.scheduledDate}</p>
                      {entry.notes && <p className="mt-2 text-xs text-destructive">{entry.notes}</p>}
                    </div>
                    <Button size="sm" variant="destructive" className="gap-2" onClick={() => { setShowOverdueModal(false); openAdministerModal(entry); }}>
                      <Syringe className="h-4 w-4" /> Administer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowOverdueModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Due Today Vaccines Modal */}
      {showDueTodayModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Due Today</h3>
                <p className="text-sm text-muted-foreground">{groupedSchedule.dueToday.length} vaccine{groupedSchedule.dueToday.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setShowDueTodayModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {groupedSchedule.dueToday.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-amber-300/50 bg-background/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
                      <p className="text-xs text-muted-foreground">Scheduled: {entry.scheduledDate}</p>
                      {entry.notes && <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                    </div>
                    <Button size="sm" variant="default" className="gap-2" onClick={() => { setShowDueTodayModal(false); openAdministerModal(entry); }}>
                      <Syringe className="h-4 w-4" /> Administer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowDueTodayModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Upcoming Vaccines Modal */}
      {showUpcomingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Upcoming Vaccines</h3>
                <p className="text-sm text-muted-foreground">{groupedSchedule.upcoming.length} vaccine{groupedSchedule.upcoming.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setShowUpcomingModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {groupedSchedule.upcoming.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-sky-300/60 bg-background/80 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
                    <p className="text-xs text-muted-foreground">Scheduled: {entry.scheduledDate}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowUpcomingModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Completed Vaccines Modal */}
      {showCompletedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Vaccination History</h3>
                <p className="text-sm text-muted-foreground">{groupedSchedule.completed.length} vaccine{groupedSchedule.completed.length === 1 ? "" : "s"} completed</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletedModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {groupedSchedule.completed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No completed vaccinations yet.</p>
              ) : (
                groupedSchedule.completed.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-background/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.vaccine}</p>
                        <p className="text-xs text-muted-foreground">Scheduled: {entry.scheduledDate}</p>
                        {entry.administeredDate ? (
                          <p className="text-xs text-muted-foreground">Administered: {entry.administeredDate}</p>
                        ) : null}
                        {entry.batchNumber ? (
                          <p className="text-xs text-muted-foreground">Batch: {entry.batchNumber}</p>
                        ) : null}
                        {entry.notes ? <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p> : null}
                      </div>
                      <Badge variant="secondary" className="w-fit">✓ Completed</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border p-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowCompletedModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Growth Monitoring Modal */}
      {showGrowthMonitoringModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-background shadow-xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Growth Monitoring</h3>
                <p className="text-sm text-muted-foreground">{measurements.length} record{measurements.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setShowGrowthMonitoringModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {measurements.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-violet-300/40 bg-violet-50/30 dark:bg-violet-950/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest measurement</p>
                    <p className="text-sm font-semibold text-foreground">
                      {latestMeasurement ? formatDate(latestMeasurement.date) : "No record yet"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {latestMeasurement ? `Recorded by ${latestMeasurement.recordedBy}` : ""}
                    </p>
                  </div>
                  {latestMeasurement ? (
                    <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" /> {formatMeasurement(latestMeasurement.weightKg, 2)} kg
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-4 w-4 text-violet-600 dark:text-violet-400" /> {formatMeasurement(latestMeasurement.lengthCm)} cm
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-4 w-4 text-violet-600 dark:text-violet-400" /> HC {formatMeasurement(latestMeasurement.headCircumferenceCm)} cm
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-4 w-4 text-violet-600 dark:text-violet-400" /> MUAC {formatMeasurement(latestMeasurement.muacCm)} cm
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="h-4 w-4 text-violet-600 dark:text-violet-400" /> {formatTemperature(latestMeasurement.temperatureC)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showRecordGrowthForm && (
                <div className="rounded-lg border border-violet-300/40 bg-violet-50/30 dark:bg-violet-950/10 p-4 space-y-4">
                  <h4 className="font-semibold text-foreground">Record New Measurement</h4>
                  <form className="grid gap-4 md:grid-cols-3" onSubmit={handleMeasurementSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="measurement-date">Measurement date</Label>
                      <DatePicker
                        date={measurementForm.date ? new Date(`${measurementForm.date}T00:00:00`) : undefined}
                        onDateChange={(selectedDate) =>
                          handleMeasurementChange("date", selectedDate ? formatDateForInput(selectedDate) : "")
                        }
                        toYear={new Date().getFullYear() + 5}
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
                        <p className="text-xs text-muted-foreground">Measure with soft tape above eyebrows.</p>
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
                      <Button type="button" variant="ghost" onClick={() => {
                        resetMeasurementForm()
                        setShowRecordGrowthForm(false)
                      }} disabled={isSavingMeasurement}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Measurement history</h3>
                  <Badge variant="outline" className="text-xs">
                    {measurements.length} record{measurements.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {measurements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No measurements captured yet. Record measurements in the form below.</p>
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
            </div>

            <div className="border-t border-border p-6 flex justify-end gap-3">
              <Button
                variant="default"
                onClick={() => setShowRecordGrowthForm(!showRecordGrowthForm)}
                className="gap-2"
              >
                <Scale className="h-4 w-4" /> Record Growth
              </Button>
              <Button variant="outline" onClick={() => setShowGrowthMonitoringModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Certificate Modal with QR Code - Modern Design */}
      {showCertificateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <BadgeCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Vaccination Certificate</h3>
                  <p className="text-emerald-100 text-sm">Official Ghana EPI Certificate</p>
                </div>
              </div>
              <button onClick={() => setShowCertificateModal(false)} className="text-white/80 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[80vh] overflow-y-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900" id="certificate-content">
              {/* Certificate Header with Logo placeholder */}
              <div className="text-center space-y-2 pb-6 border-b-2 border-emerald-200">
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  ✓ CERTIFICATE OF COMPLETION
                </div>
                <p className="text-emerald-700 dark:text-emerald-300 font-semibold">Child Vaccination Immunisation Certificate</p>
              </div>

              {/* Child Information - Enhanced */}
              <div className="grid grid-cols-2 gap-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-6 border border-emerald-200/50">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 tracking-wide">Full Name</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{childRecord.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 tracking-wide">CVCC ID</p>
                  <p className="text-lg font-mono font-bold text-slate-900 dark:text-white bg-white/50 dark:bg-slate-800/50 px-3 py-1 rounded">{childId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 tracking-wide">Date of Birth</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{new Date(childRecord.dateOfBirth).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 tracking-wide">Gender</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{childRecord.gender}</p>
                </div>
              </div>

              {/* Security & QR Code Section */}
              <div className="grid grid-cols-3 gap-6">
                {/* Security Info */}
                <div className="col-span-2 space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-emerald-600" />
                    Certificate Security
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200/50">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-2">Serial Number</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm break-all">{certificateContent.serialNumber}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4 border border-purple-200/50">
                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase mb-2">Verification Hash</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm truncate">{certificateContent.certificateHash}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200/50">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase mb-2">Valid Until</p>
                      <p className="font-bold text-slate-900 dark:text-white">{certificateContent.expiryDate.toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-950/20 rounded-lg p-4 border border-teal-200/50">
                      <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase mb-2">Issued</p>
                      <p className="font-bold text-slate-900 dark:text-white">{new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 border-4 border-emerald-200 rounded-xl bg-white shadow-lg">
                    <QRCodeCanvas
                      ref={certificateQRRef}
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://cvcc.example.com'}/verify?cert=${certificateContent.serialNumber}`}
                      size={180}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">🔒 SCAN TO VERIFY</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">CVCC Verification Page</p>
                  </div>
                </div>
              </div>

              {/* Vaccines List */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Vaccinations Completed ({groupedSchedule.completed.length})
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {groupedSchedule.completed.map((vaccine) => (
                    <div key={vaccine.id} className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-600"></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{vaccine.vaccine}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{vaccine.administeredDate || vaccine.scheduledDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 text-white text-center space-y-3 border border-slate-700">
                <p className="text-sm font-semibold">CERTIFICATE OF VACCINATION COMPLETION</p>
                <p className="text-xs text-slate-300">Generated: {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString('en-GB')}</p>
                <p className="text-xs text-slate-400">This document certifies that the child has completed required vaccinations per Ghana EPI schedule</p>
                <p className="text-xs font-semibold text-emerald-300 pt-2 border-t border-slate-700">🔒 Cryptographically Verified • 1-Year Validity</p>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  const printWindow = window.open('', '_blank')
                  if (printWindow) {
                    // Get QR code image
                    let qrDataUrl = ''
                    if (certificateQRRef.current) {
                      qrDataUrl = certificateQRRef.current.toDataURL('image/png')
                    }

                    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Vaccination Certificate - ${childRecord.name}</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; }
    .certificate {
      max-width: 800px;
      margin: 20px auto;
      background: linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 100%);
      border: 3px solid #059669;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #059669;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 32px;
      background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
      font-weight: 800;
    }
    .subtitle { color: #059669; font-size: 14px; font-weight: 600; }
    .info-section {
      background: rgba(16, 185, 129, 0.05);
      border: 2px solid #d1fae5;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-item { }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      color: #059669;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .security-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
      background: rgba(59, 130, 246, 0.05);
      padding: 20px;
      border-radius: 12px;
      border: 2px dashed #3b82f6;
    }
    .security-item {
      background: white;
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .security-label { font-size: 10px; color: #3b82f6; font-weight: 700; text-transform: uppercase; }
    .security-value { font-family: monospace; font-size: 12px; font-weight: 700; color: #0f172a; word-break: break-all; }
    .qr-section {
      text-align: center;
      margin: 25px 0;
      padding: 20px;
      background: white;
      border-radius: 12px;
      border: 2px solid #d1fae5;
    }
    .qr-section img { width: 180px; height: 180px; }
    .qr-label { font-size: 12px; color: #059669; font-weight: 700; margin-top: 10px; }
    .vaccines-section {
      margin: 25px 0;
    }
    .vaccines-section h3 {
      color: #059669;
      font-size: 16px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    .vaccine-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .vaccine-item {
      background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);
      padding: 12px;
      border-left: 4px solid #10b981;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #047857;
    }
    .vaccine-date { font-size: 12px; color: #059669; margin-top: 4px; }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #059669;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      border-radius: 8px;
      padding: 20px;
    }
    .footer p { margin: 8px 0; font-size: 13px; }
    .footer-title { font-weight: 700; font-size: 14px; margin-bottom: 10px; }
    .footer-sub { font-size: 12px; color: #cbd5e1; margin-top: 10px; border-top: 1px solid #475569; padding-top: 10px; }
    @media print {
      body { background: white; }
      .certificate { box-shadow: none; border: 2px solid #059669; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1>✓ VACCINATION CERTIFICATE</h1>
      <p class="subtitle">Ghana Child Vaccination Completion Certificate</p>
    </div>

    <div class="info-section">
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Child Name</div>
          <div class="value">${childRecord.name}</div>
        </div>
        <div class="info-item">
          <div class="label">CVCC ID</div>
          <div class="value" style="font-family: monospace;">${childId}</div>
        </div>
        <div class="info-item">
          <div class="label">Date of Birth</div>
          <div class="value">${new Date(childRecord.dateOfBirth).toLocaleDateString('en-GB')}</div>
        </div>
        <div class="info-item">
          <div class="label">Gender</div>
          <div class="value">${childRecord.gender}</div>
        </div>
      </div>
    </div>

    <div class="security-section">
      <div class="security-item">
        <div class="security-label">Serial Number</div>
        <div class="security-value">${certificateContent.serialNumber}</div>
      </div>
      <div class="security-item">
        <div class="security-label">Valid Until</div>
        <div class="security-value">${certificateContent.expiryDate.toLocaleDateString('en-GB')}</div>
      </div>
      <div class="security-item">
        <div class="security-label">Verification Hash</div>
        <div class="security-value">${certificateContent.certificateHash}</div>
      </div>
      <div class="security-item">
        <div class="security-label">Issued Date</div>
        <div class="security-value">${new Date().toLocaleDateString('en-GB')}</div>
      </div>
    </div>

    ${qrDataUrl ? `
    <div class="qr-section">
      <img src="${qrDataUrl}" alt="QR Code" />
      <div class="qr-label">🔒 SCAN TO VERIFY ON CVCC SITE</div>
    </div>
    ` : ''}

    <div class="vaccines-section">
      <h3>Completed Vaccinations (${groupedSchedule.completed.length})</h3>
      <div class="vaccine-grid">
        ${groupedSchedule.completed.map(v => `
          <div class="vaccine-item">
            ${v.vaccine}
            <div class="vaccine-date">${v.administeredDate || v.scheduledDate}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="footer">
      <p class="footer-title">CERTIFICATE OF VACCINATION COMPLETION</p>
      <p>Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
      <p class="footer-sub">
        This document certifies that the named child has completed all required vaccinations
        according to the Ghana EPI (Expanded Programme on Immunization) schedule.
      </p>
      <p class="footer-sub">🔒 Cryptographically Verified • 1-Year Validity Period</p>
    </div>
  </div>
</body>
</html>
                    `
                    printWindow.document.write(printContent)
                    printWindow.document.close()
                    setTimeout(() => printWindow.print(), 500)
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Print Certificate
              </Button>
              <Button variant="outline" onClick={() => setShowCertificateModal(false)}>
                Close
              </Button>
            </div>
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
