import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const generateCertificateId = () => {
  const year = new Date().getFullYear()
  const randomNum = Math.floor(Math.random() * 100000).toString().padStart(6, '0')
  return `CERT-GH-${year}-${randomNum}`
}

async function generateTestCertificate() {
  try {
    console.log('🧪 Generating test certificate...\n')

    // Step 1: Create a test branch/facility
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        name: 'Test Facility - Nungua',
        region: 'Greater Accra',
        district: 'Ledzokuku-Krowor',
      })
      .select()
      .single()

    if (branchError) {
      console.error('❌ Error creating branch:', branchError)
      return
    }

    console.log('✅ Created test branch:', branch.name)

    // Step 2: Create a test child
    const testChildData = {
      full_name: 'Test Child Mensah',
      date_of_birth: new Date('2024-01-15').toISOString(),
      gender: 'Male',
      cvcc_id: `CH-2025-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`,
      branch_id: branch.id,
      mother_name: 'Test Mother Ama',
      mother_phone: '+233245001100',
      status: 'active',
    }

    const { data: child, error: childError } = await supabase
      .from('children')
      .insert(testChildData)
      .select()
      .single()

    if (childError) {
      console.error('❌ Error creating child:', childError)
      return
    }

    console.log('✅ Created test child:', child.full_name)
    console.log('   CVCC ID:', child.cvcc_id)

    // Step 3: Create a test certificate
    const certificateId = generateCertificateId()
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert({
        certificate_id: certificateId,
        child_id: child.id,
        issued_by_facility_id: branch.id,
        issued_date: new Date().toISOString(),
        completion_status: 'Complete',
        vaccines_completed: [
          'BCG',
          'Polio (Birth)',
          'Polio (6 weeks)',
          'Polio (10 weeks)',
          'Polio (14 weeks)',
          'DPT (6 weeks)',
          'DPT (10 weeks)',
          'DPT (14 weeks)',
          'Hepatitis B (Birth)',
          'Hepatitis B (6 weeks)',
        ],
        status: 'active',
      })
      .select()
      .single()

    if (certError) {
      console.error('❌ Error creating certificate:', certError)
      return
    }

    console.log('✅ Created test certificate:', certificateId)

    // Print summary
    console.log('\n📋 TEST CERTIFICATE DETAILS:')
    console.log('━'.repeat(50))
    console.log(`Certificate ID:  ${certificateId}`)
    console.log(`Child Name:      ${child.full_name}`)
    console.log(`CVCC ID:         ${child.cvcc_id}`)
    console.log(`Date of Birth:   ${new Date(child.date_of_birth).toLocaleDateString()}`)
    console.log(`Facility:        ${branch.name}`)
    console.log(`Region:          ${branch.region}`)
    console.log(`Status:          ${certificate.status}`)
    console.log(`Vaccines:        ${certificate.vaccines_completed.length} completed`)
    console.log('━'.repeat(50))

    console.log('\n🌐 TEST ON HOMEPAGE:')
    console.log('1. Open: http://localhost:3000/verify')
    console.log(`2. Enter: ${certificateId}`)
    console.log('3. Click "Verify" to test certificate verification\n')

    console.log('✅ Test certificate generated successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

generateTestCertificate()
