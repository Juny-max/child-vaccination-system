"use client"

import { useState, useEffect, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import Lottie from "lottie-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import loadingAnimation from "@/public/animations/loading.json"
import { resetPassword } from "@/lib/api/auth"

interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessful, setIsSuccessful] = useState(false)

  const [requirements, setRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  })

  useEffect(() => {
    // Check password requirements in real-time
    setRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    })
  }, [password])

  const isPasswordValid = Object.values(requirements).every((req) => req)
  const passwordsMatch = password === confirmPassword && password.length > 0
  const canSubmit = isPasswordValid && passwordsMatch && !isSubmitting

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!token) {
      const message = "Invalid or missing reset token. Please request a new password reset."
      setError(message)
      toast.error(message)
      return
    }

    if (!isPasswordValid) {
      const message = "Password does not meet all requirements."
      setError(message)
      toast.error(message)
      return
    }

    if (password !== confirmPassword) {
      const message = "Passwords do not match."
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await resetPassword(token, password)

      toast.success("Password reset successfully!")
      setIsSuccessful(true)

      // Redirect to login page
      setTimeout(() => {
        router.replace("/auth/login")
      }, 2000)
    } catch (pushError) {
      console.error("Reset password failed", pushError)
      const message =
        pushError instanceof Error
          ? pushError.message || "Could not reset password. Please try again."
          : "Could not reset password. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-muted/40">
                <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ministry of Health</p>
                <p className="text-sm font-semibold text-foreground">Child Vaccination Command Center</p>
              </div>
            </div>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                <ArrowLeft className="size-4" /> Back to Login
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10">
          <Card className="relative w-full max-w-md border-border bg-background shadow-sm">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>Invalid or missing reset token. Please request a new password reset.</AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Link href="/auth/forgot-password">
                  <Button variant="outline" className="w-full">
                    Request New Reset Link
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-muted/40">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ministry of Health</p>
              <p className="text-sm font-semibold text-foreground">Child Vaccination Command Center</p>
            </div>
          </div>
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="size-4" /> Back to Login
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10">
        <Card className="relative w-full max-w-md border-border bg-background shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-28 items-center justify-center rounded-full border border-border bg-background shadow-sm">
              <div className="relative size-20">
                <Image
                  src="/images/cvcc-logo.png"
                  alt="Child Vaccination Command Center logo"
                  fill
                  sizes="80px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {isSuccessful ? "Password reset successfully!" : "Enter a new password to regain access to your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSuccessful ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="size-16 text-green-600" />
                </div>
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">Your password has been successfully reset. You can now log in with your new password.</AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">Redirecting to login page...</p>
              </div>
            ) : (
              <>
                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        autoComplete="new-password"
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

                  {/* Password Requirements */}
                  <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Password Requirements</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {requirements.minLength ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground" />
                        )}
                        <span className={requirements.minLength ? "text-green-600" : "text-muted-foreground"}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {requirements.hasUppercase ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground" />
                        )}
                        <span className={requirements.hasUppercase ? "text-green-600" : "text-muted-foreground"}>
                          Uppercase letter (A-Z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {requirements.hasLowercase ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground" />
                        )}
                        <span className={requirements.hasLowercase ? "text-green-600" : "text-muted-foreground"}>
                          Lowercase letter (a-z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {requirements.hasNumber ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground" />
                        )}
                        <span className={requirements.hasNumber ? "text-green-600" : "text-muted-foreground"}>
                          Number (0-9)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Match Indicator */}
                  {confirmPassword && (
                    <div className="flex items-center gap-2 text-sm">
                      {passwordsMatch ? (
                        <>
                          <CheckCircle2 className="size-4 text-green-600" />
                          <span className="text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-4 text-red-600" />
                          <span className="text-red-600">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={isSubmitting}>
                    {isSubmitting ? "Resetting Password..." : "Reset Password"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur">
          <Lottie animationData={loadingAnimation} loop className="h-36 w-36" aria-hidden />
          <p className="text-base font-semibold text-muted-foreground" role="status" aria-live="polite">
            Resetting your password...
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
