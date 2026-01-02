'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import * as parentApi from "@/lib/api/parent"
import * as authApi from "@/lib/api/auth"
import { 
  childInfo, 
  certificateRecords, 
  motherDetailsTemplate, 
  appointments as demoAppointments,
  missedVaccinations as demoMissedVaccinations
} from "./data"

// ============================================
// Types
// ============================================

export type ParentDashboardContextValue = {
  // User info
  userName: string
  greeting: string
  isLoading: boolean
  error: string | null
  
  // Dashboard data
  dashboard: parentApi.ParentDashboard | null
  children: parentApi.ChildProfile[]
  appointments: parentApi.Appointment[]
  certificates: parentApi.Certificate[]
  missedVaccinations: parentApi.MissedVaccination[]
  notifications: parentApi.Notification[]
  motherDetails: parentApi.MotherDetails | null
  
  // Actions
  refreshDashboard: () => Promise<void>
  refreshChildren: () => Promise<void>
  refreshAppointments: () => Promise<void>
  refreshCertificates: () => Promise<void>
  refreshMissedVaccinations: () => Promise<void>
  getChildVaccinations: (childId: string) => Promise<parentApi.VaccinationRecord[]>
  getChildUpcomingVaccinations: (childId: string) => Promise<parentApi.UpcomingVaccination[]>
  createAppointment: (data: parentApi.CreateAppointmentRequest) => Promise<parentApi.Appointment>
  cancelAppointment: (appointmentId: string, reason?: string) => Promise<void>
  updateMotherDetails: (data: parentApi.UpdateMotherDetailsRequest) => Promise<void>
  logout: () => Promise<void>
}

const defaultContext: ParentDashboardContextValue = {
  userName: "User",
  greeting: "Welcome",
  isLoading: true,
  error: null,
  dashboard: null,
  children: [],
  appointments: [],
  certificates: [],
  missedVaccinations: [],
  notifications: [],
  motherDetails: null,
  refreshDashboard: async () => {},
  refreshChildren: async () => {},
  refreshAppointments: async () => {},
  refreshCertificates: async () => {},
  refreshMissedVaccinations: async () => {},
  getChildVaccinations: async () => [],
  getChildUpcomingVaccinations: async () => [],
  createAppointment: async () => ({} as parentApi.Appointment),
  cancelAppointment: async () => {},
  updateMotherDetails: async () => {},
  logout: async () => {},
}

const ParentDashboardContext = createContext<ParentDashboardContextValue>(defaultContext)

export function ParentDashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [userName, setUserName] = useState("User")
  const [greeting, setGreeting] = useState("Welcome")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Data state
  const [dashboard, setDashboard] = useState<parentApi.ParentDashboard | null>(null)
  const [childrenData, setChildrenData] = useState<parentApi.ChildProfile[]>([])
  const [appointments, setAppointments] = useState<parentApi.Appointment[]>([])
  const [certificates, setCertificates] = useState<parentApi.Certificate[]>([])
  const [missedVaccinations, setMissedVaccinations] = useState<parentApi.MissedVaccination[]>([])
  const [notifications, setNotifications] = useState<parentApi.Notification[]>([])
  const [motherDetails, setMotherDetails] = useState<parentApi.MotherDetails | null>(null)

  // Set greeting based on time of day
  useEffect(() => {
    const hours = new Date().getHours()
    if (hours < 12) {
      setGreeting("Good morning")
    } else if (hours < 17) {
      setGreeting("Good afternoon")
    } else {
      setGreeting("Good evening")
    }
  }, [])

  // Fetch dashboard data
  const refreshDashboard = useCallback(async () => {
    try {
      setError(null)
      const data = await parentApi.getDashboard()
      setDashboard(data)
      setUserName(data.guardian.name.split(' ')[0])
      setMissedVaccinations(data.missedVaccinations)
      setNotifications(data.recentNotifications)
      setAppointments(data.upcomingAppointments)
    } catch (err) {
      console.warn('Failed to fetch dashboard, using demo data:', err)
      // Use demo data as fallback (cast to API types)
      const storedName = localStorage.getItem('userName') || 'User'
      setUserName(storedName.split(' ')[0])
      setMissedVaccinations(demoMissedVaccinations.map(m => ({
        childId: childInfo.id,
        childName: childInfo.name,
        vaccine: m.vaccine,
        dueDate: m.due,
        daysOverdue: m.daysOverdue,
      })))
      setNotifications([])
      setAppointments(demoAppointments.map((a, idx) => ({
        id: `demo-appt-${idx}`,
        childId: childInfo.id,
        childName: childInfo.name,
        facilityId: 'demo-facility',
        facilityName: a.location,
        scheduledDate: a.date,
        scheduledTime: a.time,
        purpose: a.title,
        status: 'scheduled' as const,
        notes: a.notes
      })))
      setDashboard(null) // Indicate demo mode
    }
  }, [])

  // Fetch children
  const refreshChildren = useCallback(async () => {
    try {
      const data = await parentApi.getChildren()
      setChildrenData(data)
    } catch (err) {
      console.warn('Failed to fetch children, using demo data:', err)
      // Use demo data as fallback (matching API types)
      setChildrenData([{
        id: childInfo.id,
        childId: childInfo.id,
        name: childInfo.name,
        dateOfBirth: '2023-06-15',
        age: childInfo.age,
        gender: 'female',
        bloodType: childInfo.bloodType,
        weight: childInfo.birthWeight,
        length: childInfo.height,
        profilePhoto: childInfo.profilePhoto,
        registrationDate: '2023-06-20',
        facilityName: childInfo.primaryFacility,
        facilityId: 'demo-facility'
      }])
    }
  }, [])

  // Fetch appointments
  const refreshAppointments = useCallback(async () => {
    try {
      const data = await parentApi.getAppointments()
      setAppointments(data)
    } catch (err) {
      console.error('Failed to fetch appointments:', err)
    }
  }, [])

  // Fetch certificates
  const refreshCertificates = useCallback(async () => {
    try {
      const data = await parentApi.getAllCertificates()
      setCertificates(data)
    } catch (err) {
      console.warn('Failed to fetch certificates, using demo data:', err)
      // Use demo data as fallback (matching API types)
      setCertificates(certificateRecords.map(cert => ({
        id: cert.certificateId,
        certificateId: cert.certificateId,
        childId: cert.childId,
        childName: cert.childName,
        completionStatus: cert.completionStatus as 'Complete' | 'Partial' | 'Pending',
        issuedDate: cert.issuedDate,
        issuedBy: cert.issuedBy,
        qrPayload: cert.qrPayload,
        vaccines: cert.vaccinesCompleted
      })))
    }
  }, [])

  // Fetch missed vaccinations
  const refreshMissedVaccinations = useCallback(async () => {
    try {
      const data = await parentApi.getMissedVaccinations()
      setMissedVaccinations(data)
    } catch (err) {
      console.error('Failed to fetch missed vaccinations:', err)
    }
  }, [])

  // Get child vaccinations
  const getChildVaccinations = useCallback(async (childId: string) => {
    return parentApi.getVaccinationHistory(childId)
  }, [])

  // Get child upcoming vaccinations
  const getChildUpcomingVaccinations = useCallback(async (childId: string) => {
    return parentApi.getUpcomingVaccinations(childId)
  }, [])

  // Create appointment
  const createAppointmentHandler = useCallback(async (data: parentApi.CreateAppointmentRequest) => {
    const appointment = await parentApi.createAppointment(data)
    await refreshAppointments()
    return appointment
  }, [refreshAppointments])

  // Cancel appointment
  const cancelAppointmentHandler = useCallback(async (appointmentId: string, reason?: string) => {
    await parentApi.cancelAppointment(appointmentId, reason)
    await refreshAppointments()
  }, [refreshAppointments])

  // Update mother details
  const updateMotherDetailsHandler = useCallback(async (data: parentApi.UpdateMotherDetailsRequest) => {
    const updated = await parentApi.updateProfile(data)
    setMotherDetails(updated)
  }, [])

  // Logout
  const logoutHandler = useCallback(async () => {
    await authApi.logout()
    router.push('/auth/login')
  }, [router])

  // Initial data fetch
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const role = localStorage.getItem('userRole')
    const name = localStorage.getItem('userName')

    if (!token) {
      router.push('/auth/login')
      return
    }

    if (role !== 'parent') {
      router.push('/dashboard')
      return
    }

    // Set initial name from localStorage
    if (name) {
      setUserName(name.split(' ')[0])
    }

    // Fetch all data
    const fetchData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          refreshDashboard(),
          refreshChildren(),
          refreshCertificates(),
        ])
        
        // Fetch mother details
        try {
          const mother = await parentApi.getProfile()
          setMotherDetails(mother)
        } catch {
          // Use demo mother details as fallback (matching API types)
          setMotherDetails({
            id: 'demo-mother',
            name: motherDetailsTemplate.name,
            primaryPhone: motherDetailsTemplate.primaryPhone,
            secondaryPhone: motherDetailsTemplate.secondaryPhone,
            email: motherDetailsTemplate.email,
            address: `${motherDetailsTemplate.addressLine1}, ${motherDetailsTemplate.city}`,
            preferredContact: motherDetailsTemplate.preferredContactMethod as 'phone' | 'sms' | 'email',
            preferredLanguage: 'en',
            emergencyContacts: []
          })
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err)
        // Don't set error - we have demo data fallback
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router, refreshDashboard, refreshChildren, refreshCertificates])

  const value: ParentDashboardContextValue = {
    userName,
    greeting,
    isLoading,
    error,
    dashboard,
    children: childrenData,
    appointments,
    certificates,
    missedVaccinations,
    notifications,
    motherDetails,
    refreshDashboard,
    refreshChildren,
    refreshAppointments,
    refreshCertificates,
    refreshMissedVaccinations,
    getChildVaccinations,
    getChildUpcomingVaccinations,
    createAppointment: createAppointmentHandler,
    cancelAppointment: cancelAppointmentHandler,
    updateMotherDetails: updateMotherDetailsHandler,
    logout: logoutHandler,
  }

  return (
    <ParentDashboardContext.Provider value={value}>
      {children}
    </ParentDashboardContext.Provider>
  )
}

export function useParentDashboard() {
  return useContext(ParentDashboardContext)
}
