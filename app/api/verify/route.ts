import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTokenValid } from '@/lib/verify-token'

const CHILD_QR_TOKEN_REGEX = /^QRC-CH-[A-Z0-9-]{10,64}$/i
const CERT_QR_TOKEN_REGEX = /^QRC-CERT-[A-Z0-9-]{10,64}$/i

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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

  value = value.trim().slice(0, 100).replace(/[^A-Za-z0-9-]/g, '')

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

  const lookupValue = normalizeLookupValue(id)
  if (!lookupValue) {
    return NextResponse.json({ found: false, error: 'Certificate ID is required' }, { status: 400 })
  }

  // Child QR tokens represent registered children, even before formal certificate issuance.
  if (CHILD_QR_TOKEN_REGEX.test(lookupValue)) {
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id')
      .eq('qr_code_payload', lookupValue)
      .single()

    if (!child) {
      return NextResponse.json({ found: false, certificateId: lookupValue })
    }

    return NextResponse.json({
      found: true,
      isPending: true,
      isValid: false,
      certificateId: `TEMP-${child.cvcc_id}`,
    })
  }

  // Handle TEMP- prefix (child registered but no certificate issued yet)
  if (lookupValue.startsWith('TEMP-')) {
    const cvccId = lookupValue.slice(5)
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id, full_name')
      .eq('cvcc_id', cvccId)
      .single()

    if (!child) return NextResponse.json({ found: false, certificateId: lookupValue })

    return NextResponse.json({
      found: true,
      isPending: true,
      isValid: false,
      certificateId: lookupValue,
    })
  }

  const lookupColumn = CERT_QR_TOKEN_REGEX.test(lookupValue) ? 'qr_payload' : 'certificate_id'

  // Look up by certificate_id or secure certificate token
  const { data: cert } = await supabase
    .from('certificates')
    .select(`
      certificate_id,
      qr_payload,
      issued_date,
      completion_status,
      vaccines_completed,
      status,
      issued_by_facility_id,
      branches!issued_by_facility_id ( name, region )
    `)
    .eq(lookupColumn, lookupValue)
    .single()

  if (!cert) {
    if (lookupColumn === 'qr_payload') {
      return NextResponse.json({ found: false, certificateId: lookupValue })
    }

    // Fallback: check if safeId is a CVCC ID (child registered but no cert)
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id')
      .eq('cvcc_id', lookupValue)
      .single()

    if (child) {
      return NextResponse.json({
        found: true,
        isPending: true,
        isValid: false,
        certificateId: lookupValue,
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
