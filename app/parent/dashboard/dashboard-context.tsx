'use client'

import { createContext, useContext } from "react"

export type ParentDashboardContextValue = {
  userName: string
  greeting: string
}

const ParentDashboardContext = createContext<ParentDashboardContextValue>({
  userName: "User",
  greeting: "Welcome",
})

export const ParentDashboardProvider = ParentDashboardContext.Provider

export function useParentDashboard() {
  return useContext(ParentDashboardContext)
}
