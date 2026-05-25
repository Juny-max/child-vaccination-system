/**
 * Issue Missing Certificates
 *
 * Finds every child who has completed all mandatory vaccines but has no
 * certificate record in the DB, then creates one for each of them.
 *
 * This fixes children like Dorcas who show "Issued: Not issued yet" in the
 * parent portal and "in progress" when scanned — because a certificate row
 * was never written even though all vaccines were done.
 *
 * Run with:
 *   cd backend
 *   npx ts-node scripts/issue-missing-certificates.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

function generateCertToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(18);
  let token = 'QRC-CERT-';
  for (let i = 0; i < bytes.length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

async function main() {
  console.log('Checking for children with completed vaccines but no certificate...\n');
  const { data: activeVersion } = await db
    .from('schedule_versions')
    .select('id')
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 1. Get mandatory schedule entries by schedule version.
  let scheduleQuery = db
    .from('vaccination_schedules')
    .select('id, schedule_version_id, vaccine_id, dose_number')
    .eq('is_mandatory', true);

  const { data: schedules } = await scheduleQuery;
  const schedulesByVersion = new Map<string, any[]>();
  for (const schedule of schedules || []) {
    const versionId = schedule.schedule_version_id || activeVersion?.id || 'default';
    schedulesByVersion.set(versionId, [...(schedulesByVersion.get(versionId) || []), schedule]);
  }

  const activeRequired = activeVersion?.id ? schedulesByVersion.get(activeVersion.id)?.length || 0 : schedules?.length || 0;
  console.log(`Active mandatory vaccine doses required: ${activeRequired}`);

  if ((schedules?.length || 0) === 0) {
    console.log('No mandatory schedules found. Make sure your vaccination_schedules table is seeded.');
    process.exit(0);
  }

  // 2. Get all active children
  const { data: children } = await db
    .from('children')
    .select('id, cvcc_id, full_name, primary_facility_id, schedule_version_id')
    .eq('is_active', true);

  console.log(`Total active children: ${children?.length || 0}\n`);

  let issued = 0;
  let skipped = 0;
  let incomplete = 0;

  for (const child of children || []) {
    // Check how many vaccines this child has completed
    const { data: completed } = await db
      .from('vaccination_events')
      .select('id, vaccine_id, dose_number, vaccines(name)')
      .eq('child_id', child.id)
      .eq('status', 'completed');

    const childScheduleVersionId = child.schedule_version_id || activeVersion?.id || 'default';
    const childSchedules = schedulesByVersion.get(childScheduleVersionId) || [];
    const totalRequired = childSchedules.length;
    const completedDoseSet = new Set(
      (completed || []).map((event: any) => `${event.vaccine_id}-${event.dose_number}`),
    );
    const completedCount = childSchedules.filter((schedule: any) =>
      completedDoseSet.has(`${schedule.vaccine_id}-${schedule.dose_number}`),
    ).length;

    if (completedCount < totalRequired) {
      incomplete++;
      continue; // not fully vaccinated yet
    }

    // Check if a certificate already exists
    const { data: existing } = await db
      .from('certificates')
      .select('id, certificate_id')
      .eq('child_id', child.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP  ${child.full_name} (${child.cvcc_id}) — already has certificate ${existing.certificate_id}`);
      skipped++;
      continue;
    }

    // Create the certificate
    const year = new Date().getFullYear();
    const suffix = Math.floor(Math.random() * 900000) + 100000;
    const certificateId = `CERT-GH-${year}-${suffix}`;
    const qrPayload = generateCertToken();
    const vaccineNames = (completed || []).map((v: any) => v.vaccines?.name).filter(Boolean);

    const { error } = await db.from('certificates').insert({
      certificate_id: certificateId,
      child_id: child.id,
      qr_payload: qrPayload,
      issued_date: new Date().toISOString().split('T')[0],
      issued_by_facility_id: child.primary_facility_id || null,
      schedule_version_id: childScheduleVersionId === 'default' ? null : childScheduleVersionId,
      completion_status: 'Complete',
      vaccines_completed: vaccineNames,
      status: 'issued',
    });

    if (error) {
      console.error(`  ERROR ${child.full_name} (${child.cvcc_id}): ${error.message}`);
    } else {
      console.log(`  ISSUED ${child.full_name} (${child.cvcc_id}) → ${certificateId}`);
      issued++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`  Certificates issued : ${issued}`);
  console.log(`  Already had one     : ${skipped}`);
  console.log(`  Still incomplete    : ${incomplete}`);
  console.log('─────────────────────────────────');
  console.log('\nDone. Refresh the parent dashboard to see the real certificate and QR code.');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
