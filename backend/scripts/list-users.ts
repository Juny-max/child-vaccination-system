/**
 * List All System Users
 * Shows every user with their role, status, and assigned facility.
 * 
 * Run with:  cd backend && npx ts-node scripts/list-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      status,
      branch_id,
      last_login_at,
      branches:branch_id (
        name,
        region
      )
    `)
    .order('role')
    .order('full_name');

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('No users found in the system.');
    return;
  }

  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              SYSTEM USERS DIRECTORY                                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total users: ${users.length.toString().padEnd(79)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  // Group by role
  const grouped: Record<string, typeof users> = {};
  for (const user of users) {
    const role = user.role || 'unknown';
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(user);
  }

  const roleLabels: Record<string, string> = {
    'parent': '👨‍👩‍👧 Parent / Guardian',
    'hq-admin': '🏛️  HQ Administrator',
    'branch-manager': '🏥 Branch Manager',
    'facility-nurse': '💉 Facility Nurse',
    'chw': '🚶 Community Health Worker',
    'data-officer': '📊 Data Officer',
    'pha': '🔬 Public Health Authority',
  };

  for (const [role, roleUsers] of Object.entries(grouped)) {
    const label = roleLabels[role] || `📋 ${role}`;
    console.log(`\n── ${label} (${roleUsers.length}) ${'─'.repeat(60)}`);
    console.log('');

    for (const user of roleUsers) {
      const facility = (user.branches as any);
      const facilityName = facility?.name || '—';
      const facilityRegion = facility?.region || '';
      const facilityInfo = facility ? `${facilityName} (${facilityRegion})` : 'No facility assigned';
      const statusIcon = user.status === 'active' ? '✅' : '❌';
      const lastLogin = user.last_login_at
        ? new Date(user.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Never';

      console.log(`  ${statusIcon} ${user.full_name}`);
      console.log(`     Email:     ${user.email}`);
      console.log(`     Facility:  ${facilityInfo}`);
      console.log(`     Status:    ${user.status}  |  Last login: ${lastLogin}`);
      console.log('');
    }
  }

  console.log('─'.repeat(80));
  console.log(`Total: ${users.length} users across ${Object.keys(grouped).length} roles\n`);
}

listUsers().catch(console.error);
