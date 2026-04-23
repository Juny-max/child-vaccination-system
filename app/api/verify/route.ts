import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTokenValid } from '@/lib/verify-token'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHILD_QR_TOKEN_REGEX = /^QRC-CH-[A-Z0-9-]{10,64}$/i
const CERT_QR_TOKEN_REGEX = /^QRC-CERT-[A-Z0-9-]{10,64}$/i

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

function readBackendEnvServiceKey(): string | null {
  try {
    const backendEnvPath = resolve(process.cwd(), 'backend', '.env')
    if (!existsSync(backendEnvPath)) return null

    const content = readFileSync(backendEnvPath, 'utf8')
    const line = content
      .split(/\r?\n/)
      .find((entry) => /^SUPABASE_SERVICE_ROLE_KEY=/.test(entry.trim()))

    if (!line) return null

    const value = line.slice(line.indexOf('=') + 1).trim()
    if (!value) return null

    // Support quoted .env values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1)
    }

    return value
  } catch {
    return null
  }
}

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  readBackendEnvServiceKey()

const hasSupabaseServiceKey = Boolean(supabaseServiceKey)

const supabaseClientKey =
  supabaseServiceKey ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseClientKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const CERTIFICATE_SELECT_FIELDS = `
  certificate_id,
  qr_payload,
  issued_date,
  completion_status,
  vaccines_completed,
  status,
  issued_by_facility_id,
  branches!issued_by_facility_id ( name, region )
`

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function addCandidate(candidates: Set<string>, value?: string | null) {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (!trimmed) return
  candidates.add(trimmed.slice(0, 300))
}

function buildLookupCandidates(rawValue: string, normalizedValue: string): string[] {
  const candidates = new Set<string>()

  addCandidate(candidates, normalizedValue)
  addCandidate(candidates, rawValue)
  addCandidate(candidates, safeDecodeURIComponent(rawValue))

  if (rawValue.includes('|')) {
    addCandidate(candidates, rawValue.split('|')[0])
  }
  if (normalizedValue.includes('|')) {
    addCandidate(candidates, normalizedValue.split('|')[0])
  }

  addCandidate(candidates, normalizedValue.toUpperCase())
  addCandidate(candidates, normalizedValue.toLowerCase())

  return Array.from(candidates)
}

async function findCertificateByCandidates(candidates: string[], preferredColumn: 'certificate_id' | 'qr_payload') {
  const columns: Array<'certificate_id' | 'qr_payload'> =
    preferredColumn === 'qr_payload'
      ? ['qr_payload', 'certificate_id']
      : ['certificate_id', 'qr_payload']

  for (const column of columns) {
    for (const candidate of candidates) {
      const { data, error } = await supabase
        .from('certificates')
        .select(CERTIFICATE_SELECT_FIELDS)
        .eq(column, candidate)
        .maybeSingle()

      if (error) continue
      if (data) return data
    }
  }

  return null
}

function normalizeLookupValue(rawValue: string): string {
  let value = (rawValue || '').trim()
  if (!value) return ''

  try {
    const parsed = JSON.parse(value)
    const candidate =
      parsed?.certificateId ||
      parsed?.id ||
      parsed?.cvccId ||
      parsed?.qrPayload ||
      parsed?.token ||
      parsed?.childId

    if (typeof candidate === 'string' && candidate.trim()) {
      value = candidate.trim()
    }
  } catch {
    // Not JSON; continue with raw value.
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const fromParams =
        url.searchParams.get('cert') ||
        url.searchParams.get('id') ||
        url.searchParams.get('certificateId') ||
        url.searchParams.get('token') ||
        url.searchParams.get('childId') ||
        url.searchParams.get('cvccId')

      if (fromParams && fromParams.trim()) {
        value = fromParams.trim()
      } else {
        const segments = url.pathname.split('/').filter(Boolean)
        const lastSegment = segments[segments.length - 1]
        if (lastSegment) {
          value = lastSegment
        }
      }
    } catch {
      // Keep raw value when URL parsing fails.
    }
  }

  if (value.includes('|')) {
    value = value.split('|')[0].trim()
  }

  value = value.trim().slice(0, 300)

  if (/^(qrc-(ch|cert)-|cert-gh-|cvcc-|temp-)/i.test(value)) {
    value = value.toUpperCase()
  }

  return value
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const token = req.nextUrl.searchParams.get('token')

  if (!id || id.trim().length === 0) {
    return NextResponse.json({ found: false, error: 'Certificate ID is required' }, { status: 400 })
  }

  // Verify token is valid (must be generated from /verify page)
  if (!isTokenValid(token || '')) {
    return NextResponse.json(
      { found: false, error: 'Invalid or expired verification token. Please refresh the page and try again.' },
      { status: 401 }
    )
  }

  if (!hasSupabaseServiceKey) {
    // Avoid false "not found" results when deployment is missing privileged DB credentials.
    return NextResponse.json(
      {
        found: false,
        error: 'Certificate verification is temporarily unavailable due to server configuration.',
        code: 'VERIFY_SERVICE_NOT_CONFIGURED',
      },
      { status: 500 },
    )
  }

  const rawLookupInput = id.trim().slice(0, 300)
  const lookupValue = normalizeLookupValue(rawLookupInput)
  if (!lookupValue) {
    return NextResponse.json({ found: false, error: 'Certificate ID is required' }, { status: 400 })
  }

  const lookupCandidates = buildLookupCandidates(rawLookupInput, lookupValue)

  // Child QR tokens represent registered children, even before formal certificate issuance.
  const childTokenCandidates = lookupCandidates.filter((candidate) => CHILD_QR_TOKEN_REGEX.test(candidate))
  if (childTokenCandidates.length > 0) {
    for (const candidate of childTokenCandidates) {
      const { data: child } = await supabase
        .from('children')
        .select('id, cvcc_id')
        .eq('qr_code_payload', candidate)
        .maybeSingle()

      if (!child) continue

      return NextResponse.json({
        found: true,
        isPending: true,
        isValid: false,
        certificateId: `TEMP-${child.cvcc_id}`,
      })
    }

    return NextResponse.json({ found: false, certificateId: lookupValue })
  }

  // Handle TEMP- prefix (child registered but no certificate issued yet)
  const tempCandidate = lookupCandidates.find((candidate) => candidate.toUpperCase().startsWith('TEMP-'))
  if (tempCandidate) {
    const cvccId = tempCandidate.toUpperCase().slice(5)
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id, full_name')
      .eq('cvcc_id', cvccId)
      .maybeSingle()

    if (!child) return NextResponse.json({ found: false, certificateId: lookupValue })

    return NextResponse.json({
      found: true,
      isPending: true,
      isValid: false,
      certificateId: `TEMP-${cvccId}`,
    })
  }

  const lookupColumn: 'certificate_id' | 'qr_payload' = CERT_QR_TOKEN_REGEX.test(lookupValue)
    ? 'qr_payload'
    : 'certificate_id'

  const cert = await findCertificateByCandidates(lookupCandidates, lookupColumn)

  if (!cert) {
    // Fallback: check if scanned value matches a registered child CVCC ID (no formal cert yet).
    for (const candidate of lookupCandidates) {
      const { data: child } = await supabase
        .from('children')
        .select('id, cvcc_id')
        .eq('cvcc_id', candidate)
        .maybeSingle()

      if (!child) continue

      return NextResponse.json({
        found: true,
        isPending: true,
        isValid: false,
        certificateId: candidate,
      })
    }

    return NextResponse.json({ found: false, certificateId: lookupValue })
  }

  const isRevoked = cert.status === 'revoked' || cert.status === 'expired'
  const branch = Array.isArray(cert.branches) ? cert.branches[0] : cert.branches

  return NextResponse.json({
    found: true,
    isValid: !isRevoked,
    isPending: false,
    certificateId: cert.certificate_id,
    issuedDate: cert.issued_date,
    completionStatus: cert.completion_status,
    vaccinesCompleted: cert.vaccines_completed ?? [],
    issuedBy: branch?.name ?? '',
    region: branch?.region ?? '',
    status: cert.status,
  })
}
