import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { childId, certificateSerialNumber, vaccinationsCompleted } = body

    if (!childId || !certificateSerialNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: childId, certificateSerialNumber' },
        { status: 400 }
      )
    }

    // Get child and facility info
    const { data: child } = await supabase
      .from('children')
      .select('id, full_name, date_of_birth, gender, facility_id')
      .eq('id', childId)
      .single()

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    // Get facility info
    const { data: facility } = await supabase
      .from('branches')
      .select('id, name, region')
      .eq('id', child.facility_id)
      .single()

    // Check if certificate already exists
    const { data: existingCert } = await supabase
      .from('certificates')
      .select('id')
      .eq('certificate_id', certificateSerialNumber)
      .single()

    if (existingCert) {
      return NextResponse.json(
        {
          id: existingCert.id,
          childId,
          certificateId: certificateSerialNumber,
          issuedDate: new Date().toISOString().split('T')[0],
          completionStatus: 'Complete',
          vaccinesCompleted: [],
          issuedBy: facility?.name || 'Ghana Health Service',
          region: facility?.region || 'Unknown',
        },
        { status: 200 }
      )
    }

    // Get vaccination history to list all completed vaccines
    const { data: vaccinations } = await supabase
      .from('vaccination_events')
      .select('vaccine_name')
      .eq('child_id', childId)

    const vaccinesList = [...new Set(vaccinations?.map(v => v.vaccine_name) || [])]

    // Create new certificate
    const { data: newCert, error } = await supabase
      .from('certificates')
      .insert({
        certificate_id: certificateSerialNumber,
        issued_date: new Date().toISOString().split('T')[0],
        completion_status: 'Complete',
        vaccines_completed: vaccinesList,
        status: 'issued',
        issued_by_facility_id: child.facility_id,
        template_id: 'certificate',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating certificate:', error)
      return NextResponse.json(
        { error: 'Failed to create certificate' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: newCert.id,
      childId,
      certificateId: newCert.certificate_id,
      issuedDate: newCert.issued_date,
      completionStatus: newCert.completion_status,
      vaccinesCompleted: newCert.vaccines_completed || [],
      issuedBy: facility?.name || 'Ghana Health Service',
      region: facility?.region || 'Unknown',
    })
  } catch (error) {
    console.error('Error in POST /api/facility/certificates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
