import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id || id.trim().length === 0) {
    return NextResponse.json({ found: false, error: 'Certificate ID is required' }, { status: 400 })
  }

  const safeId = id.trim().slice(0, 100).replace(/[^A-Za-z0-9-]/g, '')

  // Handle TEMP- prefix (child registered but no certificate issued yet)
  if (safeId.startsWith('TEMP-')) {
    const cvccId = safeId.slice(5)
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id, full_name')
      .eq('cvcc_id', cvccId)
      .single()

    if (!child) return NextResponse.json({ found: false, certificateId: safeId })

    return NextResponse.json({
      found: true,
      isPending: true,
      isValid: false,
      certificateId: safeId,
    })
  }

  // Look up by certificate_id first
  const { data: cert } = await supabase
    .from('certificates')
    .select(`
      certificate_id,
      issued_date,
      completion_status,
      vaccines_completed,
      status,
      issued_by_facility_id,
      branches!issued_by_facility_id ( name, region )
    `)
    .eq('certificate_id', safeId)
    .single()

  if (!cert) {
    // Fallback: check if safeId is a CVCC ID (child registered but no cert)
    const { data: child } = await supabase
      .from('children')
      .select('id, cvcc_id')
      .eq('cvcc_id', safeId)
      .single()

    if (child) {
      return NextResponse.json({
        found: true,
        isPending: true,
        isValid: false,
        certificateId: safeId,
      })
    }

    return NextResponse.json({ found: false, certificateId: safeId })
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
