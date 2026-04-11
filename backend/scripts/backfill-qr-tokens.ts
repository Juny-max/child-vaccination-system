/**
 * Backfill readable QR payloads to opaque token format.
 *
 * Dry run (default):
 *   npx ts-node scripts/backfill-qr-tokens.ts
 *
 * Apply updates:
 *   npx ts-node scripts/backfill-qr-tokens.ts --apply
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

const supabase = createClient(supabaseUrl, supabaseKey);
const shouldApply = process.argv.includes('--apply');

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomBody(byteLength = 18): string {
  const bytes = randomBytes(byteLength);
  let output = '';

  for (let i = 0; i < bytes.length; i += 1) {
    output += alphabet[bytes[i] % alphabet.length];
  }

  return output;
}

function childToken(): string {
  return `QRC-CH-${randomBody()}`;
}

function certToken(): string {
  return `QRC-CERT-${randomBody()}`;
}

function isChildToken(value?: string | null): boolean {
  if (!value) return false;
  return /^QRC-CH-[A-Z0-9-]{10,64}$/i.test(value.trim());
}

function isCertToken(value?: string | null): boolean {
  if (!value) return false;
  return /^QRC-CERT-[A-Z0-9-]{10,64}$/i.test(value.trim());
}

async function updateChildren() {
  const { data: children, error } = await supabase
    .from('children')
    .select('id, cvcc_id, qr_code_payload')
    .limit(50000);

  if (error) {
    throw new Error(`Failed to load children: ${error.message}`);
  }

  const rows = children || [];
  const legacyRows = rows.filter((row: any) => !isChildToken(row.qr_code_payload));

  console.log(`Children: ${rows.length} total, ${legacyRows.length} legacy payloads.`);

  let updated = 0;
  for (const row of legacyRows) {
    const token = childToken();

    if (!shouldApply) {
      console.log(`DRY-RUN child ${row.cvcc_id}: ${row.qr_code_payload} -> ${token}`);
      updated += 1;
      continue;
    }

    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      attempts += 1;
      const candidate = attempts === 1 ? token : childToken();

      const { error: updateError } = await supabase
        .from('children')
        .update({ qr_code_payload: candidate })
        .eq('id', row.id);

      if (!updateError) {
        success = true;
        updated += 1;
      } else if (updateError.code !== '23505') {
        throw new Error(`Failed updating child ${row.cvcc_id}: ${updateError.message}`);
      }
    }

    if (!success) {
      throw new Error(`Failed updating child ${row.cvcc_id}: could not generate unique token after retries.`);
    }
  }

  return updated;
}

async function updateCertificates() {
  const { data: certificates, error } = await supabase
    .from('certificates')
    .select('id, certificate_id, qr_payload')
    .limit(50000);

  if (error) {
    throw new Error(`Failed to load certificates: ${error.message}`);
  }

  const rows = certificates || [];
  const legacyRows = rows.filter((row: any) => !isCertToken(row.qr_payload));

  console.log(`Certificates: ${rows.length} total, ${legacyRows.length} legacy payloads.`);

  let updated = 0;
  for (const row of legacyRows) {
    const token = certToken();

    if (!shouldApply) {
      console.log(`DRY-RUN cert ${row.certificate_id}: ${row.qr_payload} -> ${token}`);
      updated += 1;
      continue;
    }

    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      attempts += 1;
      const candidate = attempts === 1 ? token : certToken();

      const { error: updateError } = await supabase
        .from('certificates')
        .update({ qr_payload: candidate })
        .eq('id', row.id);

      if (!updateError) {
        success = true;
        updated += 1;
      } else if (updateError.code !== '23505') {
        throw new Error(`Failed updating cert ${row.certificate_id}: ${updateError.message}`);
      }
    }

    if (!success) {
      throw new Error(`Failed updating cert ${row.certificate_id}: could not generate unique token after retries.`);
    }
  }

  return updated;
}

async function main() {
  console.log('QR payload backfill started.');
  console.log(`Mode: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);

  const updatedChildren = await updateChildren();
  const updatedCertificates = await updateCertificates();

  console.log('Done.');
  console.log(`Children updated: ${updatedChildren}`);
  console.log(`Certificates updated: ${updatedCertificates}`);

  if (!shouldApply) {
    console.log('No database rows were changed. Re-run with --apply to persist updates.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
