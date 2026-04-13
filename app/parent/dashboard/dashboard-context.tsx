'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import * as parentApi from "@/lib/api/parent"
import * as authApi from "@/lib/api/auth"

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
  requestEmailChangeVerification: (newEmail: string) => Promise<parentApi.RequestEmailChangeResponse>
  verifyEmailChangeToken: (token: string) => Promise<parentApi.MotherDetails>
  retryFetch: () => Promise<void>
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
  requestEmailChangeVerification: async () => ({ success: false, message: '' }),
  verifyEmailChangeToken: async () => ({} as parentApi.MotherDetails),
  retryFetch: async () => {},
  logout: async () => {},
}

const ParentDashboardContext = createContext<ParentDashboardContextValue>(defaultContext)

// Helper to extract error message
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Check for network errors
    if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    // Check for auth errors
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      return 'Your session has expired. Please log in again.'
    }
    // Check for server errors
    if (err.message.includes('500') || err.message.includes('Internal Server')) {
      return 'The server encountered an error. Please try again later.'
    }
    return err.message
  }
  return 'An unexpected error occurred. Please try again.'
}

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
    const data = await parentApi.getDashboard()
    setDashboard(data)
    setUserName(data.guardian.name.split(' ')[0])
    setMissedVaccinations(data.missedVaccinations)
    setNotifications(data.recentNotifications)
  }, [])

  // Fetch children
  const refreshChildren = useCallback(async () => {
    const data = await parentApi.getChildren()
    setChildrenData(data)
  }, [])

  // Fetch appointments
  const refreshAppointments = useCallback(async () => {
    const data = await parentApi.getAppointments()
    setAppointments(data)
  }, [])

  // Fetch certificates
  const refreshCertificates = useCallback(async () => {
    const data = await parentApi.getAllCertificates()
    setCertificates(data)
  }, [])

  // Fetch missed vaccinations
  const refreshMissedVaccinations = useCallback(async () => {
    const data = await parentApi.getMissedVaccinations()
    setMissedVaccinations(data)
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

  const requestEmailChangeVerificationHandler = useCallback(async (newEmail: string) => {
    return parentApi.requestEmailChangeVerification({ newEmail })
  }, [])

  const verifyEmailChangeTokenHandler = useCallback(async (token: string) => {
    const updated = await parentApi.verifyEmailChangeToken(token)
    setMotherDetails(updated)
    return updated
  }, [])

  // Logout
  const logoutHandler = useCallback(async () => {
    await authApi.logout()
    router.push('/auth/login')
  }, [router])

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch dashboard first (contains most data)
      await refreshDashboard()
      
      // Fetch additional data in parallel
      const results = await Promise.allSettled([
        refreshChildren(),
        refreshAppointments(),
        refreshCertificates(),
        parentApi.getProfile().then(setMotherDetails),
      ])
      
      // Check for partial failures and log them (non-critical)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const endpoints = ['children', 'appointments', 'certificates', 'profile']
          console.warn(`Failed to fetch ${endpoints[index]}:`, result.reason)
        }
      })
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      
      // If auth error, redirect to login
      if (errorMessage.includes('session has expired')) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('userRole')
        localStorage.removeItem('userName')
        sessionStorage.removeItem('userName')
        router.push('/auth/login')
      }
    } finally {
      setIsLoading(false)
    }
  }, [refreshDashboard, refreshChildren, refreshAppointments, refreshCertificates, router])

  // Retry fetch
  const retryFetch = useCallback(async () => {
    await fetchAllData()
  }, [fetchAllData])

  // Initial data fetch
  useEffect(() => {
    const role = localStorage.getItem('userRole')
    const name = sessionStorage.getItem('userName') || localStorage.getItem('userName')

    if (role !== 'parent') {
      router.push('/dashboard')
      return
    }

    // Set initial name from localStorage while loading
    if (name) {
      setUserName(name.split(' ')[0])
    }

    fetchAllData()
  }, [router, fetchAllData])

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
    requestEmailChangeVerification: requestEmailChangeVerificationHandler,
    verifyEmailChangeToken: verifyEmailChangeTokenHandler,
    retryFetch,
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
