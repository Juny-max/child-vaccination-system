import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

const geistSans = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Ghana Child Vaccination System",
  description: "Multi-branch vaccination tracking system for Ghana government",
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
    apple: "/cvcc-favicon.png",
    other: [{ rel: "manifest", url: "/site.webmanifest" }],
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased bg-background text-foreground transition-colors duration-500`}>
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
