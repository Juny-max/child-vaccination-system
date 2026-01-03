'use client'

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useParentDashboard } from "../dashboard-context"
import * as parentApi from "@/lib/api/parent"
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
} from "lucide-react"

type ContactMethod = "phone" | "sms" | "email"

type MotherDetailsLocal = {
  name: string
  primaryPhone: string
  secondaryPhone?: string
  email: string
  address: string
  preferredContactMethod: ContactMethod
}

type EmergencyContact = parentApi.EmergencyContact

type EditableMotherFields = {
  name: string
  primaryPhone: string
  secondaryPhone: string
  email: string
  address: string
  preferredContactMethod: ContactMethod
}

type ProfileErrors = Partial<Record<keyof EditableMotherFields, string>>

const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone call",
  sms: "SMS",
  email: "Email",
}

const CONTACT_METHOD_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
]

type ContactFormState = {
  id: string | null
  name: string
  relationship: string
  phone: string
  isPrimary: boolean
}

type ContactErrors = Partial<Record<"name" | "relationship" | "phone", string>>

export default function MotherDetailsPage() {
  const { userName, motherDetails: apiMotherDetails, isLoading, updateMotherDetails } = useParentDashboard()
  
  // Convert API data to local format
  const initialDetails: MotherDetailsLocal = useMemo(() => {
    if (apiMotherDetails) {
      return {
        name: apiMotherDetails.name,
        primaryPhone: apiMotherDetails.primaryPhone || "",
        secondaryPhone: apiMotherDetails.secondaryPhone || "",
        email: apiMotherDetails.email || "",
        address: apiMotherDetails.address || "",
        preferredContactMethod: apiMotherDetails.preferredContact as ContactMethod || "sms",
      }
    }
    return {
      name: userName || "Parent",
      primaryPhone: "",
      secondaryPhone: "",
      email: "",
      address: "",
      preferredContactMethod: "sms" as ContactMethod,
    }
  }, [apiMotherDetails, userName])

  const [motherDetails, setMotherDetails] = useState<MotherDetailsLocal>(initialDetails)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<ProfileErrors>({})
  const [formState, setFormState] = useState<EditableMotherFields>(() => toEditableState(initialDetails))
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() => 
    ensurePrimaryContact(apiMotherDetails?.emergencyContacts || [])
  )
  const [contactFormState, setContactFormState] = useState<ContactFormState | null>(null)
  const [contactFormErrors, setContactFormErrors] = useState<ContactErrors>({})
  const [contactStatus, setContactStatus] = useState<string | null>(null)

  // Sync with API data when it loads
  useEffect(() => {
    if (apiMotherDetails) {
      const newDetails: MotherDetailsLocal = {
        name: apiMotherDetails.name,
        primaryPhone: apiMotherDetails.primaryPhone || "",
        secondaryPhone: apiMotherDetails.secondaryPhone || "",
        email: apiMotherDetails.email || "",
        address: apiMotherDetails.address || "",
        preferredContactMethod: apiMotherDetails.preferredContact as ContactMethod || "sms",
      }
      setMotherDetails(newDetails)
      setFormState(toEditableState(newDetails))
      setEmergencyContacts(ensurePrimaryContact(apiMotherDetails.emergencyContacts || []))
    }
  }, [apiMotherDetails])

  useEffect(() => {
    if (!statusMessage) return
    const timeout = window.setTimeout(() => setStatusMessage(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [statusMessage])

  useEffect(() => {
    if (!contactStatus) return
    const timeout = window.setTimeout(() => setContactStatus(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [contactStatus])

  const formattedAddress = motherDetails.address || "No address provided"

  const startEditing = () => {
    setFormState(toEditableState(motherDetails))
    setFormErrors({})
    setStatusMessage(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setFormErrors({})
    setFormState(toEditableState(motherDetails))
  }

  const openContactEditor = (contact?: EmergencyContact) => {
    setContactFormErrors({})
    setContactFormState(
      contact
        ? {
            id: contact.id,
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
            isPrimary: contact.isPrimary,
          }
        : {
            id: null,
            name: "",
            relationship: "",
            phone: "",
            isPrimary: emergencyContacts.length === 0,
          },
    )
  }

  const closeContactEditor = () => {
    setContactFormState(null)
    setContactFormErrors({})
  }

  const updateContactField = <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) => {
    setContactFormState((previous) => (previous ? { ...previous, [field]: value } : previous))
    if (isContactErrorKey(field)) {
      setContactFormErrors((previous) => {
        if (!previous[field]) return previous
        const { [field]: _removed, ...rest } = previous
        return rest
      })
    }
  }

  const [isSavingContact, setIsSavingContact] = useState(false)

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contactFormState) return

    const validation = validateContact(contactFormState)
    if (Object.keys(validation).length > 0) {
      setContactFormErrors(validation)
      return
    }

    const sanitized = sanitizeContact(contactFormState)

    const sanitizedDigits = sanitized.phone.replace(/\D/g, "")
    const isDuplicatePhone = emergencyContacts.some(
      (contact) => contact.id !== sanitized.id && contact.phone.replace(/\D/g, "") === sanitizedDigits,
    )

    if (isDuplicatePhone) {
      setContactFormErrors({ phone: "This phone number is already listed for another contact." })
      return
    }

    setIsSavingContact(true)

    try {
      let nextContacts: EmergencyContact[]
      let targetId = sanitized.id ?? ""

      if (sanitized.id) {
        nextContacts = emergencyContacts.map((contact) =>
          contact.id === sanitized.id
            ? {
                ...contact,
                name: sanitized.name,
                relationship: sanitized.relationship,
                phone: sanitized.phone,
                isPrimary: sanitized.isPrimary,
              }
            : contact,
        )
      } else {
        const newContact: EmergencyContact = {
          id: generateContactId(emergencyContacts.length + 1),
          name: sanitized.name,
          relationship: sanitized.relationship,
          phone: sanitized.phone,
          isPrimary: sanitized.isPrimary,
        }
        targetId = newContact.id
        nextContacts = [...emergencyContacts, newContact]
      }

      if (sanitized.isPrimary) {
        nextContacts = nextContacts.map((contact) => ({ ...contact, isPrimary: contact.id === (sanitized.id ? sanitized.id : targetId) }))
      } else {
        nextContacts = ensurePrimaryContact(nextContacts)
      }

      // Save to backend
      await updateMotherDetails({
        emergencyContacts: nextContacts.map(c => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          isPrimary: c.isPrimary,
        })),
      })

      setEmergencyContacts(nextContacts)
      setContactStatus(sanitized.id ? "Emergency contact details saved." : "Emergency contact added to your profile.")
      closeContactEditor()
    } catch (error) {
      console.error('Failed to save emergency contact:', error)
      setContactFormErrors({ name: "Failed to save. Please try again." })
    } finally {
      setIsSavingContact(false)
    }
  }

  const deleteContact = async (contactId: string) => {
    const filtered = emergencyContacts.filter((contact) => contact.id !== contactId)
    const nextContacts = ensurePrimaryContact(filtered)
    
    try {
      // Save to backend
      await updateMotherDetails({
        emergencyContacts: nextContacts.map(c => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          isPrimary: c.isPrimary,
        })),
      })
      
      setEmergencyContacts(nextContacts)
      setContactStatus("Emergency contact removed from your profile.")
      if (contactFormState?.id === contactId) {
        closeContactEditor()
      }
    } catch (error) {
      console.error('Failed to delete emergency contact:', error)
      setContactStatus("Failed to remove contact. Please try again.")
    }
  }

  const makePrimary = async (contactId: string) => {
    const nextContacts = emergencyContacts.map((contact) => ({
      ...contact,
      isPrimary: contact.id === contactId,
    }))
    
    try {
      // Save to backend
      await updateMotherDetails({
        emergencyContacts: nextContacts.map(c => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          isPrimary: c.isPrimary,
        })),
      })
      
      setEmergencyContacts(nextContacts)
      setContactStatus("Primary emergency contact updated.")
      if (contactFormState) {
        setContactFormState((previous) => (previous ? { ...previous, isPrimary: previous.id === contactId } : previous))
      }
    } catch (error) {
      console.error('Failed to update primary contact:', error)
      setContactStatus("Failed to update primary contact. Please try again.")
    }
  }

  const handleFieldChange = <K extends keyof EditableMotherFields>(field: K, value: EditableMotherFields[K]) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }))

    if (formErrors[field]) {
      setFormErrors((previous) => {
        const next = { ...previous }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateProfile(formState)
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation)
      setStatusMessage(null)
      return
    }

    const sanitized = sanitizeForm(formState)
    setIsSaving(true)

    window.setTimeout(async () => {
      const nextDetails: MotherDetailsLocal = {
        ...motherDetails,
        name: sanitized.name,
        primaryPhone: sanitized.primaryPhone,
        secondaryPhone: sanitized.secondaryPhone ? sanitized.secondaryPhone : undefined,
        email: sanitized.email,
        address: sanitized.address,
        preferredContactMethod: sanitized.preferredContactMethod,
      }

      // Call API to update
      try {
        await updateMotherDetails({
          primaryPhone: sanitized.primaryPhone,
          secondaryPhone: sanitized.secondaryPhone || undefined,
          email: sanitized.email,
          address: sanitized.address,
          preferredContact: sanitized.preferredContactMethod,
        })
      } catch (error) {
        console.error('Failed to update profile:', error)
      }

      setMotherDetails(nextDetails)
      setFormState(toEditableState(nextDetails))
      setIsSaving(false)
      setIsEditing(false)
      setFormErrors({})
      setStatusMessage("Your profile information has been updated. We will use the latest details for reminders and emergency contact.")
    }, 650)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="size-5" /> Mother profile
            </CardTitle>
            <CardDescription>Keep your contact and emergency information up to date.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2" onClick={isEditing ? cancelEditing : startEditing}>
            <Edit3 className="size-4" /> {isEditing ? "Close form" : "Update details"}
          </Button>
        </CardHeader>
      </Card>

      {statusMessage ? (
        <Alert role="status" className="border-primary/40 bg-primary/10 text-primary-foreground">
          <CheckCircle2 className="text-primary" />
          <AlertTitle className="text-foreground">Profile updated</AlertTitle>
          <AlertDescription className="text-foreground/80">{statusMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isEditing ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Update contact details</CardTitle>
            <CardDescription>
              You can update your primary mobile number and email anytime. Facility staff manage the rest of your profile details
              to keep records consistent across systems.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.keys(formErrors).length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Check the highlighted fields</AlertTitle>
                <AlertDescription>
                  Make sure your name, phone numbers, email, and address are entered exactly as you would share them with a health
                  worker.
                </AlertDescription>
              </Alert>
            ) : null}

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="fullName"
                  label="Full name"
                  autoComplete="name"
                  value={formState.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                  error={formErrors.name}
                  placeholder="e.g. Akosua Asante"
                  disabled
                  readOnly
                  helperText="Contact the facility to request legal name changes."
                />
                <Field
                  id="email"
                  type="email"
                  label="Email"
                  autoComplete="email"
                  value={formState.email}
                  onChange={(event) => handleFieldChange("email", event.target.value)}
                  error={formErrors.email}
                  placeholder="example@email.com"
                  icon={<Mail className="size-4 text-primary" />}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="primaryPhone"
                  type="tel"
                  label="Primary phone"
                  autoComplete="tel"
                  value={formState.primaryPhone}
                  onChange={(event) => handleFieldChange("primaryPhone", event.target.value)}
                  error={formErrors.primaryPhone}
                  placeholder="+233 24 123 4567"
                  icon={<Phone className="size-4 text-primary" />}
                />
                <Field
                  id="secondaryPhone"
                  type="tel"
                  label="Secondary phone (optional)"
                  autoComplete="tel-secondary"
                  value={formState.secondaryPhone}
                  onChange={(event) => handleFieldChange("secondaryPhone", event.target.value)}
                  error={formErrors.secondaryPhone}
                  placeholder="+233 20 765 4321"
                  icon={<Phone className="size-4 text-primary" />}
                  disabled
                  readOnly
                  helperText="Facility staff maintain alternate contact numbers."
                />
              </div>

              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <Lock className="mt-0.5 size-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Facility-managed information</p>
                    <p>
                      Residential address and preferred contact channel are locked to protect clinic records.
                      Speak with your assigned nurse if these details need an update.
                    </p>
                  </div>
                </div>
              </div>

              <Field
                id="address"
                label="Residential address"
                autoComplete="street-address"
                value={formState.address}
                onChange={(event) => handleFieldChange("address", event.target.value)}
                placeholder="Full address"
                icon={<MapPin className="size-4 text-primary" />}
                disabled
                readOnly
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="preferredContact" className="text-sm font-medium text-foreground">
                    Preferred contact method
                  </Label>
                  <select
                    id="preferredContact"
                    className="w-full rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
                    value={formState.preferredContactMethod}
                    onChange={(event) => handleFieldChange("preferredContactMethod", event.target.value as ContactMethod)}
                    aria-invalid={formErrors.preferredContactMethod ? "true" : undefined}
                    disabled
                  >
                    {CONTACT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Only facility staff can change this preference.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="gap-2" disabled={isSaving}>
                  <ShieldCheck className="size-4" /> {isSaving ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact information</CardTitle>
            <CardDescription>Used by your care team for reminders and follow ups.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Full name" value={motherDetails.name} icon={<User className="size-4 text-primary" />} />
            <Info label="Email" value={motherDetails.email} icon={<Mail className="size-4 text-primary" />} />
            <Info label="Primary phone" value={motherDetails.primaryPhone} icon={<Phone className="size-4 text-primary" />} />
            {motherDetails.secondaryPhone ? (
              <Info label="Secondary phone" value={motherDetails.secondaryPhone} icon={<Phone className="size-4 text-primary" />} />
            ) : null}
            <Info label="Address" value={formattedAddress} icon={<MapPin className="size-4 text-primary" />} />
            <Info
              label="Preferred contact method"
              value={CONTACT_METHOD_LABELS[motherDetails.preferredContactMethod]}
              icon={<MessageCircle className="size-4 text-primary" />}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Emergency contacts</CardTitle>
          <CardDescription>Add trusted contacts who can bring your child for appointments when needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contactStatus ? (
            <Alert role="status" className="border-primary/40 bg-primary/10 text-primary-foreground">
              <CheckCircle2 className="text-primary" />
              <AlertTitle className="text-foreground">Contact updated</AlertTitle>
              <AlertDescription className="text-foreground/80">{contactStatus}</AlertDescription>
            </Alert>
          ) : null}

          {emergencyContacts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              <p className="text-base font-semibold text-foreground">No emergency contacts yet</p>
              <p>Add at least one trusted family member or neighbor who can accompany your child to appointments.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-base font-semibold text-foreground">{contact.name}</p>
                    <p>
                      {contact.relationship} • {contact.phone}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contact.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                    <Button size="sm" variant="outline" onClick={() => openContactEditor(contact)}>
                      <UserCog className="size-4" /> Edit
                    </Button>
                    {!contact.isPrimary ? (
                      <Button size="sm" variant="outline" onClick={() => makePrimary(contact.id)}>
                        <ShieldCheck className="size-4" /> Set primary
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteContact(contact.id)}>
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" size="sm" className="self-start" onClick={() => openContactEditor()}>
            <Plus className="size-4" /> Add another contact
          </Button>

          {contactFormState ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {contactFormState.id ? "Edit emergency contact" : "Add emergency contact"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Provide someone the clinic can reach quickly when you are unavailable.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={closeContactEditor}>
                  Cancel
                </Button>
              </div>

              <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleContactSubmit}>
                <Field
                  id="contactName"
                  label="Full name"
                  value={contactFormState.name}
                  onChange={(event) => updateContactField("name", event.target.value)}
                  error={contactFormErrors.name}
                  placeholder="e.g. Kwame Asante"
                  autoComplete="name"
                />
                <Field
                  id="contactRelationship"
                  label="Relationship"
                  value={contactFormState.relationship}
                  onChange={(event) => updateContactField("relationship", event.target.value)}
                  error={contactFormErrors.relationship}
                  placeholder="Father, Auntie, Neighbor"
                  autoComplete="relationship"
                />
                <Field
                  id="contactPhone"
                  label="Phone number"
                  value={contactFormState.phone}
                  onChange={(event) => updateContactField("phone", event.target.value)}
                  error={contactFormErrors.phone}
                  placeholder="+233 24 000 0000"
                  autoComplete="tel"
                  icon={<Phone className="size-4 text-primary" />}
                />
                <div className="space-y-2">
                  <Label htmlFor="contactPrimary" className="text-sm font-medium text-foreground">
                    Primary contact
                  </Label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <input
                      id="contactPrimary"
                      type="checkbox"
                      checked={contactFormState.isPrimary}
                      onChange={(event) => updateContactField("isPrimary", event.target.checked)}
                      className="size-4"
                    />
                    <span className="text-muted-foreground">Mark as the first person nurses should call.</span>
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" className="gap-2">
                    <ShieldCheck className="size-4" /> {contactFormState.id ? "Save contact" : "Add contact"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeContactEditor}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

type InfoProps = {
  label: string
  value: string
  icon: ReactNode
}

function Info({ label, value, icon }: InfoProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
      <div className="mt-1 flex size-7 items-center justify-center rounded-md bg-primary/10">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground whitespace-pre-line">{value}</p>
      </div>
    </div>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
  placeholder?: string
  type?: string
  autoComplete?: string
  icon?: ReactNode
  disabled?: boolean
  readOnly?: boolean
  helperText?: string
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  autoComplete,
  icon,
  disabled,
  readOnly,
  helperText,
}: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        {icon ? <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{icon}</span> : null}
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={icon ? "pl-10" : undefined}
          disabled={disabled}
          readOnly={readOnly}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  )
}

function toEditableState(details: MotherDetailsLocal): EditableMotherFields {
  return {
    name: details.name,
    primaryPhone: details.primaryPhone,
    secondaryPhone: details.secondaryPhone ?? "",
    email: details.email,
    address: details.address,
    preferredContactMethod: details.preferredContactMethod,
  }
}

function sanitizeForm(values: EditableMotherFields): EditableMotherFields {
  const normalize = (input: string) => input.replace(/\s+/g, " ").trim()
  const normalizePhone = (input: string) => input.replace(/\s+/g, " ").trim()

  return {
    name: normalize(values.name),
    primaryPhone: normalizePhone(values.primaryPhone),
    secondaryPhone: values.secondaryPhone ? normalizePhone(values.secondaryPhone) : "",
    email: values.email.trim().toLowerCase(),
    address: normalize(values.address),
    preferredContactMethod: values.preferredContactMethod,
  }
}

function validateProfile(values: EditableMotherFields): ProfileErrors {
  const errors: ProfileErrors = {}

  const fullName = values.name.trim()
  if (!fullName) {
    errors.name = "Full name is required."
  } else {
    const nameParts = fullName.split(/\s+/)
    if (nameParts.length < 2) {
      errors.name = "Include at least a first and last name."
    }
    if (/\d/.test(fullName)) {
      errors.name = "Names should not contain numbers."
    }
  }

  const email = values.email.trim()
  if (!email) {
    errors.email = "An email address is required."
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address."
  }

  const primaryDigits = values.primaryPhone.replace(/\D/g, "")
  if (!primaryDigits) {
    errors.primaryPhone = "Primary phone number is required."
  } else if (primaryDigits.length < 10 || primaryDigits.length > 15) {
    errors.primaryPhone = "Provide a phone number with 10 to 15 digits."
  }

  if (values.primaryPhone && !/^[+()0-9\s-]+$/.test(values.primaryPhone)) {
    errors.primaryPhone = "Use digits, spaces, dashes, or + only."
  }

  if (values.secondaryPhone) {
    const secondaryDigits = values.secondaryPhone.replace(/\D/g, "")
    if (secondaryDigits.length < 10 || secondaryDigits.length > 15) {
      errors.secondaryPhone = "Secondary number should have 10 to 15 digits."
    }
    if (secondaryDigits && secondaryDigits === primaryDigits) {
      errors.secondaryPhone = "Secondary phone must be different from the primary number."
    }
    if (!/^[+()0-9\s-]+$/.test(values.secondaryPhone)) {
      errors.secondaryPhone = "Use digits, spaces, dashes, or + only."
    }
  }

  if (!CONTACT_METHOD_OPTIONS.some((option) => option.value === values.preferredContactMethod)) {
    errors.preferredContactMethod = "Select a contact method."
  }

  return errors
}

function sanitizeContact(values: ContactFormState): ContactFormState {
  const normalize = (input: string) => input.replace(/\s+/g, " ").trim()
  const normalizePhone = (input: string) => input.replace(/\s+/g, " ").trim()

  return {
    id: values.id,
    name: normalize(values.name),
    relationship: normalize(values.relationship),
    phone: normalizePhone(values.phone),
    isPrimary: values.isPrimary,
  }
}

function validateContact(values: ContactFormState): ContactErrors {
  const errors: ContactErrors = {}

  const name = values.name.trim()
  if (!name) {
    errors.name = "Contact name is required."
  } else if (name.split(/\s+/).length < 2) {
    errors.name = "Include at least a first and last name."
  }

  const relationship = values.relationship.trim()
  if (!relationship) {
    errors.relationship = "Relationship is required."
  }

  const digits = values.phone.replace(/\D/g, "")
  if (!digits) {
    errors.phone = "Phone number is required."
  } else if (digits.length < 10 || digits.length > 15) {
    errors.phone = "Provide a phone number with 10 to 15 digits."
  }

  if (values.phone && !/^[+()0-9\s-]+$/.test(values.phone)) {
    errors.phone = "Use digits, spaces, dashes, or + only."
  }

  return errors
}

function ensurePrimaryContact(contacts: EmergencyContact[]): EmergencyContact[] {
  if (contacts.length === 0) return []

  const normalized = contacts.map((contact) => ({ ...contact }))
  let hasPrimary = false

  for (const contact of normalized) {
    if (contact.isPrimary) {
      if (!hasPrimary) {
        hasPrimary = true
      } else {
        contact.isPrimary = false
      }
    }
  }

  if (!hasPrimary) {
    normalized[0].isPrimary = true
  }

  return normalized
}

function generateContactId(sequence: number) {
  const timestamp = Date.now().toString(36)
  return `CONTACT-${timestamp}-${Math.max(sequence, 1).toString().padStart(3, "0")}`
}

function isContactErrorKey(field: keyof ContactFormState): field is keyof ContactErrors {
  return field === "name" || field === "relationship" || field === "phone"
}
