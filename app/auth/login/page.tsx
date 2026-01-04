"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck, User } from "lucide-react"
import { toast } from "sonner"

import Lottie from "lottie-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import loadingAnimation from "@/public/animations/loading.json"
import { login } from "@/lib/api/auth"

type UserRole = "parent" | "hq-admin" | "branch-manager" | "facility-nurse" | "chw" | "data-officer" | "pha"

const ROLE_ROUTES: Record<UserRole, string> = {
  parent: "/parent/dashboard",
  "hq-admin": "/hq/dashboard",
  "branch-manager": "/branch/dashboard",
  "facility-nurse": "/facility/dashboard",
  chw: "/chw/dashboard",
  "data-officer": "/dashboard",
  pha: "/pha/dashboard",
}

export default function UnifiedLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email || !password || password.length < 6) {
      const message = "Enter your email and a password with at least 6 characters."
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await login({
        email,
        password,
        userType: "parent", // Backend will return the actual role
      })

      const resolvedRole = (response.user.role as UserRole) || "parent"
      const storedRole = resolvedRole === "parent" ? "parent" : "staff"
      const route = ROLE_ROUTES[resolvedRole] ?? "/dashboard"

      localStorage.setItem("userRole", storedRole)
      localStorage.setItem("userRoleDetail", resolvedRole)
      localStorage.setItem("userName", response.user.fullName)
      localStorage.setItem("userId", response.user.id)

      // Check if user must change password (first-time login with temp password)
      if (response.mustChangePassword) {
        toast.info("Please set a new password before continuing.")
        router.replace("/auth/change-password")
        return
      }

      toast.success(`Welcome back, ${response.user.fullName.split(" ")[0]}!`)
      router.replace(route)
    } catch (pushError) {
      console.error("Login failed", pushError)
      const message =
        pushError instanceof Error
          ? pushError.message || "Could not complete sign in. Please try again."
          : "Could not complete sign in. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Child Vaccination Command Center</p>
              <p className="text-xs text-muted-foreground">Secure unified portal for parents and health teams</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" /> Back to home
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 lg:flex-row">
        <section className="flex w-full flex-col gap-6 lg:w-2/5">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-xl">Role-based access</CardTitle>
              <CardDescription>Sign in once, get routed automatically to your workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <User className="mt-0.5 size-4 text-primary" /> Parents view child immunisation journeys and home visit plans.
              </p>
              <p className="flex items-start gap-2">
                <KeyRound className="mt-0.5 size-4 text-primary" /> Nurses and supervisors record doses, track coverage and report to HQ.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-primary" /> Access is audited so only verified staff see sensitive clinic data.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="flex w-full flex-1 items-center justify-center">
          <Card className="relative w-full max-w-lg border-border shadow-sm">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl">Sign in to continue</CardTitle>
              <CardDescription>Use your clinic-issued email and password to access the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Having trouble?</p>
                <p>Confirm your email is registered by the clinic admin. Contact your facility manager if you need access.</p>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                <p>By signing in you accept the Ministry&apos;s data protection policy.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur">
          <Lottie animationData={loadingAnimation} loop className="h-36 w-36" aria-hidden />
          <p className="text-base font-semibold text-muted-foreground" role="status" aria-live="polite">
            Signing you in...
          </p>
        </div>
      ) : null}
    </div>
  )
}
