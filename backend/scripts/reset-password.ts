/**
 * Interactive Password Reset Script with bcrypt
 * Run with: npx ts-node scripts/reset-password.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hash password using bcrypt (same as production)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function listUsers(): Promise<void> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, status')
    .order('role');

  if (error) {
    console.error('❌ Failed to fetch users:', error.message);
    return;
  }

  console.log('\n📋 Available Users:');
  console.log('─'.repeat(70));
  users?.forEach((u, i) => {
    console.log(`${i + 1}. ${u.email.padEnd(35)} | ${u.role.padEnd(15)} | ${u.status}`);
  });
  console.log('─'.repeat(70));
}

async function resetPassword(email: string, newPassword: string): Promise<boolean> {
  // Check if user exists
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', email.toLowerCase());

  if (fetchError) {
    console.error(`❌ Database error:`, fetchError.message);
    return false;
  }

  if (!users || users.length === 0) {
    console.error(`❌ User not found: ${email}`);
    return false;
  }

  const user = users[0];

  // Hash the new password using bcrypt
  const passwordHash = await hashPassword(newPassword);

  // Update the password
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id);

  if (updateError) {
    console.error('❌ Failed to update password:', updateError.message);
    return false;
  }

  console.log(`\n✅ Password updated for ${user.full_name} (${user.email})`);
  return true;
}

async function bulkResetPasswords(): Promise<void> {
  console.log('\n⚠️  BULK PASSWORD RESET');
  console.log('─'.repeat(70));
  console.log('This will reset passwords for ALL users in the database.');
  console.log('Each user will get a temporary password that they must change.');
  console.log('─'.repeat(70));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  const confirm = await question('\nType "YES" to confirm bulk reset: ');

  if (confirm.trim() !== 'YES') {
    console.log('❌ Bulk reset cancelled');
    rl.close();
    return;
  }

  const defaultPassword = await question('Enter default password for all users (min 8 chars): ');

  if (defaultPassword.length < 8) {
    console.log('❌ Password must be at least 8 characters');
    rl.close();
    return;
  }

  // Fetch all users
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .order('email');

  if (fetchError || !users) {
    console.error('❌ Failed to fetch users:', fetchError?.message);
    rl.close();
    return;
  }

  console.log(`\n📊 Found ${users.length} users. Starting bulk reset...`);
  console.log('─'.repeat(70));

  const passwordHash = await hashPassword(defaultPassword);
  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          must_change_password: true  // Force password change on next login
        })
        .eq('id', user.id);

      if (error) {
        console.error(`❌ Failed: ${user.email} - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${user.email}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Failed: ${user.email} - ${err}`);
      errorCount++;
    }
  }

  console.log('─'.repeat(70));
  console.log(`\n📈 Bulk Reset Results:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📧 Total: ${users.length}`);
  console.log(`\n⚠️  All users must change their password on next login.`);
  console.log(`   Default password: ${defaultPassword}`);

  rl.close();
}

async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('\n🔐 Password Reset Tool (bcrypt enabled)');
  console.log('='.repeat(50));

  // List available users
  await listUsers();

  while (true) {
    console.log('\nOptions:');
    console.log('  1. Reset password for a single user');
    console.log('  2. List all users');
    console.log('  3. Bulk reset all passwords');
    console.log('  4. Exit');

    const choice = await question('\nEnter choice (1-4): ');

    switch (choice.trim()) {
      case '1':
        const email = await question('Enter email: ');
        const password = await question('Enter new password (min 8 chars): ');

        if (!email.trim()) {
          console.log('❌ Email is required');
          continue;
        }
        if (password.length < 8) {
          console.log('❌ Password must be at least 8 characters');
          continue;
        }

        await resetPassword(email.trim(), password);
        break;

      case '2':
        await listUsers();
        break;

      case '3':
        rl.close();
        await bulkResetPasswords();
        return;

      case '4':
        console.log('\n👋 Goodbye!');
        rl.close();
        return;

      default:
        console.log('❌ Invalid choice');
    }
  }
}

// Run interactive mode
interactiveMode().then(() => process.exit(0)).catch(console.error);
