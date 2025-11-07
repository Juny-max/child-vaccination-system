"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Users, TrendingUp, Bell, Lock, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation with Theme Toggle */}
      <nav className="sticky top-0 z-50 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">V</span>
              </div>
              <span className="font-semibold text-lg">Vaccination System</span>
            </div>
            <div className="flex gap-4 items-center">
              <ThemeToggle />
              <Link href="/auth/parent-login">
                <Button variant="outline">Parent Login</Button>
              </Link>
              <Link href="/auth/staff-login">
                <Button>Staff Login</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Images and Glassmorphism */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Light mode hero image */}
        {mounted && (
          <>
            <div className="absolute inset-0 dark:hidden">
              <Image
                src="/child-vaccination-healthcare-bright.jpg"
                alt="Child getting vaccinated - light mode"
                fill
                className="object-cover"
                priority
                quality={85}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/30 to-white/20" />
            </div>

            {/* Dark mode hero image */}
            <div className="absolute inset-0 hidden dark:block">
              <Image
                src="/child-vaccination-healthcare-professional-dark.jpg"
                alt="Child getting vaccinated - dark mode"
                fill
                className="object-cover"
                priority
                quality={85}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/30" />
            </div>
          </>
        )}

        {/* Fallback background if images don't load */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-green-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="backdrop-blur-xl bg-white/20 dark:bg-slate-900/30 rounded-3xl p-8 sm:p-12 border border-white/30 dark:border-white/10 shadow-2xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 text-balance text-slate-900 dark:text-white">
              Child Vaccination Tracking
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-slate-700 dark:text-slate-200 mb-8 max-w-3xl mx-auto leading-relaxed">
              Ghana's comprehensive vaccination management system. Track immunizations across branches, manage adverse
              events, and generate official digital certificates—offline capable and government-grade secure.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/auth/staff-login">
                <Button size="lg" className="text-base">
                  Staff Portal
                </Button>
              </Link>
              <Link href="/auth/parent-login">
                <Button variant="outline" size="lg" className="text-base bg-transparent">
                  Parent Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Core Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="text-primary" size={24} />
              </div>
              <CardTitle>Child Registration</CardTitle>
              <CardDescription>Register children with UUID and QR codes</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Offline registration support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Automatic QR generation</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Bell className="text-primary" size={24} />
              </div>
              <CardTitle>Smart Notifications</CardTitle>
              <CardDescription>SMS and email reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Dual-channel notifications</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Automated reminders</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Lock className="text-primary" size={24} />
              </div>
              <CardTitle>Secure Certificates</CardTitle>
              <CardDescription>Digital vaccination certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>QR verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>PDF generation</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="text-primary" size={24} />
              </div>
              <CardTitle>Offline-First</CardTitle>
              <CardDescription>Works without internet</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>IndexedDB storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Auto sync on reconnect</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="text-primary" size={24} />
              </div>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>Real-time reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Coverage analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Dropout tracking</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Lock className="text-primary" size={24} />
              </div>
              <CardTitle>Healthcare Security</CardTitle>
              <CardDescription>HIPAA-like compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Field encryption</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-primary" size={16} />
                  <span>Audit logging</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <Card className="bg-gradient-to-r from-primary/90 to-primary/70 dark:from-primary/80 dark:to-primary/60 text-primary-foreground border-0 backdrop-blur-sm">
          <CardHeader className="pb-8">
            <CardTitle className="text-3xl">Ready to Get Started?</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Join Ghana's vaccination tracking system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/auth/staff-login">
                <Button size="lg" variant="secondary">
                  Staff Portal
                </Button>
              </Link>
              <Link href="/auth/parent-login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
                >
                  Parent Portal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-muted-foreground">
            <p>Ghana Child Vaccination System • Government of Ghana Ministry of Health</p>
            <p className="mt-2">© 2025. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
