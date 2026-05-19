"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Phone, Save } from "lucide-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as facilityApi from "@/lib/api/facility"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

type GuardianFormState = {
  fullName: string
  phoneNumber: string
  alternatePhone: string
  email: string
  addressLine1: string
  landmark: string
  city: string
  region: string
  country: string
  postalCode: string
  community: string
  ghanaCard: string
  nhisNumber: string
  preferredContact: "sms" | "email"
  emergencyContactName: string
  emergencyContactPhone: string
  notes: string
}

const initialState: GuardianFormState = {
  fullName: "",
  phoneNumber: "",
  alternatePhone: "",
  email: "",
  addressLine1: "",
  landmark: "",
  city: "",
  region: "",
  country: "Ghana",
  postalCode: "",
  community: "",
  ghanaCard: "",
  nhisNumber: "",
  preferredContact: "sms",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
}

export default function RegisterGuardianPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [formData, setFormData] = useState<GuardianFormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [systemMessage, setSystemMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState("")
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalMessage, setSuccessModalMessage] = useState("")

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/facility/dashboard")
      return
    }

    setUserName(name || "Facility Nurse")
  }, [router])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 10000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  const handleChange = (field: keyof GuardianFormState, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    // Validate email is required when email is selected as contact method
    if (formData.preferredContact === "email" && !formData.email) {
      toast.error("Email address is required when Email is selected as contact method")
      return
    }
    
    setIsSubmitting(true)

    try {
      const result = await facilityApi.registerGuardian({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        alternatePhone: formData.alternatePhone || undefined,
        email: formData.email || undefined,
        addressLine1: formData.addressLine1,
        landmark: formData.landmark || undefined,
        city: formData.city,
        region: formData.region,
        country: formData.country || 'Ghana',
        postalCode: formData.postalCode || undefined,
        community: formData.community || undefined,
        ghanaCard: formData.ghanaCard || undefined,
        nhisNumber: formData.nhisNumber || undefined,
        preferredContact: formData.preferredContact,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        notes: formData.notes || undefined,
      })

      // Show success message with email and SMS status
      if (result.emailSent && result.smsSent) {
        setSystemMessage({ text: result.message, type: 'success' })
        setSuccessModalMessage(result.message)
        setShowSuccessModal(true)
      } else if (result.emailSent) {
        setSystemMessage({ text: result.message, type: 'success' })
        setSuccessModalMessage(result.message)
        setShowSuccessModal(true)
      } else if (result.smsSent) {
        setSystemMessage({ text: result.message, type: 'success' })
        setSuccessModalMessage(result.message)
        setShowSuccessModal(true)
      } else if (result.preferredContact === 'email' && result.email && !result.emailSent) {
        // Email was supposed to be sent but may have failed
        setSystemMessage({ text: result.message, type: 'info' })
        toast.warning("Registration successful, but please verify delivery")
      } else if (result.preferredContact === 'sms' && !result.smsSent) {
        // SMS was supposed to be sent but may have failed
        setSystemMessage({ text: result.message, type: 'info' })
        toast.warning("Registration successful, but please verify SMS delivery")
      } else {
        setSystemMessage({ text: result.message, type: 'success' })
        setSuccessModalMessage(result.message)
        setShowSuccessModal(true)
      }
      
      setFormData(initialState)
    } catch (error) {
      console.error("Registration error:", error)
      const message = error instanceof Error ? error.message : "Failed to register guardian. Please try again."
      setSystemMessage({ text: message, type: 'error' })
      setErrorModalMessage(message)
      setShowErrorModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/facility/dashboard">
                <ArrowLeft className="h-4 w-4" /> Today&apos;s clinic
              </Link>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Facility Nurse Workflow</p>
              <p className="text-lg font-semibold text-foreground">Register new guardian</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Facility Nurse</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {systemMessage ? (
          <Alert variant={systemMessage.type === 'error' ? 'destructive' : 'default'} className={systemMessage.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}>
            {systemMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription className={systemMessage.type === 'success' ? 'text-green-700 dark:text-green-400' : ''}>{systemMessage.text}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="mt-6 border-primary/40">
          <CardHeader className="space-y-2">
            <CardTitle>Guardian details</CardTitle>
            <CardDescription>
              Capture the information recorded for the child&apos;s guardian. Required fields ensure SMS
              reminders are delivered to the right caregiver.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    required
                    placeholder="e.g. Akosua Mensah"
                    value={formData.fullName}
                    onChange={(event) => handleChange("fullName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ghanaCard">Ghana card number (optional)</Label>
                  <Input
                    id="ghanaCard"
                    placeholder="GHA-123456789-0"
                    value={formData.ghanaCard}
                    onChange={(event) => handleChange("ghanaCard", event.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Primary phone number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    required
                    placeholder="e.g. +233 24 500 1100"
                    value={formData.phoneNumber}
                    onChange={(event) => handleChange("phoneNumber", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate phone / WhatsApp</Label>
                  <Input
                    id="alternatePhone"
                    type="tel"
                    placeholder="Optional support contact"
                    value={formData.alternatePhone}
                    onChange={(event) => handleChange("alternatePhone", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">If provided, the guardian portal credentials will be emailed immediately.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nhisNumber">NHIS number (optional)</Label>
                  <Input
                    id="nhisNumber"
                    placeholder="e.g. 1234567890"
                    value={formData.nhisNumber}
                    onChange={(event) => handleChange("nhisNumber", event.target.value)}
                  />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine1">Residential address</Label>
                  <Input
                    id="addressLine1"
                    required
                    placeholder="House 12, Zongo Lane"
                    value={formData.addressLine1}
                    onChange={(event) => handleChange("addressLine1", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landmark">Nearest landmark / GPS</Label>
                  <Input
                    id="landmark"
                    placeholder="Bole Clinic Junction, GPS: WR-123-4567"
                    value={formData.landmark}
                    onChange={(event) => handleChange("landmark", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Town / city</Label>
                  <Input
                    id="city"
                    required
                    placeholder="e.g. Bole"
                    value={formData.city}
                    onChange={(event) => handleChange("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    required
                    placeholder="e.g. Savannah Region"
                    value={formData.region}
                    onChange={(event) => handleChange("region", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="community">Community / catchment</Label>
                  <Input
                    id="community"
                    required
                    placeholder="e.g. Jakpa North"
                    value={formData.community}
                    onChange={(event) => handleChange("community", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    required
                    placeholder="Ghana"
                    value={formData.country}
                    onChange={(event) => handleChange("country", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal / digital address (optional)</Label>
                  <Input
                    id="postalCode"
                    placeholder="GA-184-5123"
                    value={formData.postalCode}
                    onChange={(event) => handleChange("postalCode", event.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preferred contact method</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    SMS is recommended for guardians without smartphones. Email requires internet access but provides login credentials.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                        formData.preferredContact === "sms"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground"
                      }`}
                      onClick={() => handleChange("preferredContact", "sms")}
                    >
                      <Phone className="h-4 w-4" /> SMS
                    </button>
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                        formData.preferredContact === "email"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground"
                      }`}
                      onClick={() => handleChange("preferredContact", "email")}
                    >
                      <Mail className="h-4 w-4" /> Email
                    </button>
                  </div>
                  {formData.preferredContact === "email" && !formData.email && (
                    <p className="text-xs text-destructive mt-1">
                      Email address is required when Email is selected as contact method.
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Emergency contact name</Label>
                  <Input
                    id="emergencyContactName"
                    placeholder="Optional guardian or relative"
                    value={formData.emergencyContactName}
                    onChange={(event) => handleChange("emergencyContactName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    placeholder="Optional backup number"
                    value={formData.emergencyContactPhone}
                    onChange={(event) => handleChange("emergencyContactPhone", event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Clinic notes</Label>
                  <textarea
                    id="notes"
                    placeholder="Add any additional information (e.g. preferred language, mobility support needs)."
                    className="min-h-[112px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                  />
                </div>
              </section>

              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground">
                  The caregiver will receive vaccination reminders via their preferred contact method.
                </div>
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save guardian record
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-3 text-sm">
                <p className="text-muted-foreground">Next step: register the child once the caregiver&apos;s information is saved.</p>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href="/facility/register-child">
                    Continue to child registration
                    <CheckCircle2 className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </main>

      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-28 w-28">
              <DotLottieReact src="/Sign%20for%20error%20_%20Flat%20style.lottie" autoplay loop className="h-full w-full" />
            </div>
            <DialogTitle className="text-center text-xl">Registration Failed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{errorModalMessage}</p>
            <Button className="w-full" onClick={() => setShowErrorModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-28 w-28">
              <DotLottieReact src="/Done.lottie" autoplay loop className="h-full w-full" />
            </div>
            <DialogTitle className="text-center text-xl">Guardian Registered Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{successModalMessage}</p>
            <Button className="w-full" onClick={() => setShowSuccessModal(false)}>
              Great, continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
