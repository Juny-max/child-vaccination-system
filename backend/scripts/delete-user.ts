/**
 * Interactive User Deletion Script
 * Safely deletes a user by cleaning dependent references first.
 *
 * Run with: npx ts-node scripts/delete-user.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function countRows(table: string, column: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, userId);

  if (error) {
    return 0;
  }

  return count || 0;
}

async function nullifyRef(table: string, column: string, userId: string): Promise<void> {
  const payload: Record<string, null> = { [column]: null };
  const { error } = await supabase.from(table).update(payload).eq(column, userId);
  if (error) {
    throw new Error(`${table}.${column} -> ${error.message}`);
  }
}

async function deleteRefRows(table: string, column: string, userId: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq(column, userId);
  if (error) {
    throw new Error(`${table}.${column} -> ${error.message}`);
  }
}

async function main() {
  console.log('\n🗑️  Safe User Deletion Tool');
  console.log('='.repeat(60));
  console.log('This tool cleans common FK references (including audit_logs) first.\n');

  const emailInput = (await ask('Enter user email to delete: ')).trim().toLowerCase();

  if (!emailInput || !emailInput.includes('@')) {
    console.error('❌ Please enter a valid email address.');
    rl.close();
    process.exit(1);
  }

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name, role, status')
    .eq('email', emailInput)
    .single();

  if (fetchError || !user) {
    console.error(`❌ User not found for email: ${emailInput}`);
    rl.close();
    process.exit(1);
  }

  console.log('\nFound user:');
  console.log(`  ID:     ${user.id}`);
  console.log(`  Name:   ${user.full_name}`);
  console.log(`  Email:  ${user.email}`);
  console.log(`  Role:   ${user.role}`);
  console.log(`  Status: ${user.status}`);

  const userId = user.id as string;

  const nullableRefs: Array<{ table: string; column: string }> = [
    { table: 'audit_logs', column: 'user_id' },
    { table: 'guardians', column: 'user_id' },
    { table: 'guardians', column: 'created_by_user_id' },
    { table: 'children', column: 'created_by_user_id' },
    { table: 'vaccination_events', column: 'administered_by_user_id' },
    { table: 'aefi_reports', column: 'reported_by_user_id' },
    { table: 'certificates', column: 'issued_by_user_id' },
    { table: 'duplicate_candidates', column: 'merged_by_user_id' },
    { table: 'sync_conflicts', column: 'resolved_by_user_id' },
    { table: 'system_settings', column: 'updated_by_user_id' },
    { table: 'stock_inventory', column: 'received_by_user_id' },
    { table: 'branches', column: 'manager_id' },
    { table: 'catchment_areas', column: 'assigned_chw_id' },
  ];

  const deleteRefs: Array<{ table: string; column: string }> = [
    { table: 'visit_logs', column: 'chw_id' },
    { table: 'sync_queue', column: 'user_id' },
  ];

  console.log('\nDependency summary:');
  for (const ref of nullableRefs) {
    const total = await countRows(ref.table, ref.column, userId);
    if (total > 0) {
      console.log(`  - ${ref.table}.${ref.column}: ${total} row(s) will be set to NULL`);
    }
  }
  for (const ref of deleteRefs) {
    const total = await countRows(ref.table, ref.column, userId);
    if (total > 0) {
      console.log(`  - ${ref.table}.${ref.column}: ${total} row(s) will be deleted`);
    }
  }

  const confirm = (await ask('\nType DELETE to confirm permanent deletion: ')).trim();
  if (confirm !== 'DELETE') {
    console.log('❎ Cancelled. No changes made.');
    rl.close();
    process.exit(0);
  }

  try {
    for (const ref of nullableRefs) {
      await nullifyRef(ref.table, ref.column, userId);
    }

    for (const ref of deleteRefs) {
      await deleteRefRows(ref.table, ref.column, userId);
    }

    const { error: deleteUserError } = await supabase.from('users').delete().eq('id', userId);
    if (deleteUserError) {
      throw new Error(`users.id -> ${deleteUserError.message}`);
    }

    console.log('\n✅ User deleted successfully.');
    console.log('   Related references were cleaned first to avoid FK errors.');
  } catch (error) {
    console.error('\n❌ Deletion failed:', error instanceof Error ? error.message : error);
    console.error('   Tip: another table may still reference this user.');
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  rl.close();
  process.exit(1);
});
