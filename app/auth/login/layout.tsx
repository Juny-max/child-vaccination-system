import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Secure Portal Login | Child Vaccination Command Center",
  description:
    "Access the unified child vaccination command center. Parents and health teams sign in through one secure portal.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
