"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import Lottie from "lottie-react"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import loadingAnimation from "@/public/animations/loading.json"
import { forgotPassword } from "@/lib/api/auth"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessful, setIsSuccessful] = useState(false)
  const [showNoAccountModal, setShowNoAccountModal] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email) {
      const message = "Please enter your email address."
      setError(message)
      toast.error(message)
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const message = "Please enter a valid email address."
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await forgotPassword(email)

      // Check if email was found
      if (!response.emailFound) {
        // Show error modal instead of success
        setShowNoAccountModal(true)
        return
      }

      toast.success("Check your email for password reset instructions!")
      setIsSuccessful(true)

      // Show success message for 3 seconds, then redirect to login
      setTimeout(() => {
        router.replace("/auth/login")
      }, 3000)
    } catch (pushError) {
      console.error("Forgot password failed", pushError)
      const message =
        pushError instanceof Error
          ? pushError.message || "Could not process your request. Please try again."
          : "Could not process your request. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
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
            <CardTitle className="text-2xl">Forgot Password?</CardTitle>
            <CardDescription>
              {isSuccessful
                ? "Check your email for reset instructions"
                : "Enter your email address and we'll send you a link to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSuccessful ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="size-16 text-green-600" />
                </div>
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">
                    Password reset link sent! Check your email and click the link to reset your password.
                    <br />
                    <br />
                    <span className="text-sm">The reset link expires in 1 hour.</span>
                  </AlertDescription>
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

                  <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>

                <div className="text-center text-xs text-muted-foreground">
                  <p>Don't have an account? Contact your facility administrator.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Error Modal - No Account Found */}
      {showNoAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <Card className="relative w-full max-w-sm border-border bg-background shadow-lg">
            <CardHeader className="space-y-3 text-center">
              <button
                onClick={() => setShowNoAccountModal(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                aria-label="Close modal"
              >
                <X className="size-5" />
              </button>

              <div className="mx-auto flex h-24 w-24 items-center justify-center">
                <DotLottieReact
                  src="/Sign for error _ Flat style.lottie"
                  loop={false}
                  autoplay
                  className="h-full w-full"
                  aria-hidden
                />
              </div>

              <CardTitle className="text-2xl">Oops</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                We couldn't process your password reset request at this time. Please try again or contact your facility administrator if you continue to have issues.
              </p>

              <div className="pt-2">
                <Link href="/auth/login" className="block">
                  <Button className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur">
          <Lottie animationData={loadingAnimation} loop className="h-36 w-36" aria-hidden />
          <p className="text-base font-semibold text-muted-foreground" role="status" aria-live="polite">
            Sending password reset link...
          </p>
        </div>
      ) : null}
    </div>
  )
}
