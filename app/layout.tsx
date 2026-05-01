import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LegacyServiceWorkerCleanup } from "@/components/pwa/legacy-sw-cleanup"
import { Toaster } from "sonner"

const geistSans = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  applicationName: "Ghana Child Vaccination System",
  title: "Ghana Child Vaccination System",
  description: "Multi-branch vaccination tracking system for Ghana government",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/cvcc-favicon.png", type: "image/png" },
      { url: "/favicon-32x32.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: [
      { url: "/cvcc-favicon.png", type: "image/png" },
      { url: "/favicon-32x32.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CVCC",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased bg-background text-foreground transition-colors duration-500`}>
        <LegacyServiceWorkerCleanup />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
