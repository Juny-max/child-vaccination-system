import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  email: z.string().trim().email("Provide a valid email address").max(160, "Email is too long"),
  facility: z.string().trim().min(2, "Facility is too short").max(120, "Facility is too long"),
  message: z.string().trim().min(10, "Message is too short").max(2000, "Message is too long"),
  website: z.string().optional().default(""),
})

type ContactRateMap = Map<string, number[]>

const globalForRateLimit = globalThis as unknown as { __contactRateMap?: ContactRateMap }
const contactRateMap: ContactRateMap = globalForRateLimit.__contactRateMap ?? new Map<string, number[]>()
if (!globalForRateLimit.__contactRateMap) {
  globalForRateLimit.__contactRateMap = contactRateMap
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 5

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const checkRateLimit = (ip: string) => {
  const now = Date.now()
  const requests = contactRateMap.get(ip) ?? []
  const withinWindow = requests.filter((timestamp) => now - timestamp < WINDOW_MS)

  if (withinWindow.length >= MAX_REQUESTS_PER_WINDOW) {
    contactRateMap.set(ip, withinWindow)
    return false
  }

  withinWindow.push(now)
  contactRateMap.set(ip, withinWindow)
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid form data." }, { status: 400 })
  }

  const { name, email, facility, message, website } = parsed.data

  // Honeypot field: bots that fill hidden fields are silently accepted.
  if (website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const brevoApiKey = process.env.BREVO_API_KEY
  if (!brevoApiKey) {
    return NextResponse.json(
      { error: "Support email service is not configured on this environment.", code: "CONTACT_NOT_CONFIGURED" },
      { status: 503 },
    )
  }

  const supportEmail = process.env.CONTACT_SUPPORT_EMAIL || "support@cvcc.gov.gh"
  const senderEmail = process.env.CONTACT_SENDER_EMAIL || process.env.SMTP_FROM || "noreply@cvcc.gov.gh"
  const senderName = process.env.CONTACT_SENDER_NAME || "CVCC Website"

  const subject = `[CVCC Contact] ${facility} - ${name}`
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeFacility = escapeHtml(facility)
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>")

  const brevoPayload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: supportEmail, name: "CVCC Support Team" }],
    replyTo: { email, name },
    subject,
    htmlContent: `
      <h2>New Support Request from CVCC Landing Page</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Facility/District:</strong> ${safeFacility}</p>
      <p><strong>Message:</strong><br/>${safeMessage}</p>
    `,
    textContent: `New Support Request from CVCC Landing Page\n\nName: ${name}\nEmail: ${email}\nFacility/District: ${facility}\n\nMessage:\n${message}`,
  }

  let response: Response

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(brevoPayload),
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    console.error("Contact email delivery request failed", error)
    return NextResponse.json({ error: "Support service timed out. Please try again." }, { status: 504 })
  }

  if (!response.ok) {
    const errorDetails = await response.text().catch(() => "")
    console.error("Contact email delivery failed", response.status, errorDetails)
    return NextResponse.json({ error: "Failed to send your message. Please try again." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
