/**
 * Interactive Password Reset Script
 * Run with: npx ts-node scripts/reset-password.ts
 */

import { createClient } from '@supabase/supabase-js';
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

// Same hashing function as auth.service.ts (using Web Crypto API)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
  
  // Hash the new password
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

  console.log('\n🔐 Password Reset Tool');
  console.log('='.repeat(50));

  // List available users
  await listUsers();

  while (true) {
    console.log('\nOptions:');
    console.log('  1. Reset password for a user');
    console.log('  2. List all users');
    console.log('  3. Exit');
    
    const choice = await question('\nEnter choice (1-3): ');

    switch (choice.trim()) {
      case '1':
        const email = await question('Enter email: ');
        const password = await question('Enter new password (min 6 chars): ');
        
        if (!email.trim()) {
          console.log('❌ Email is required');
          continue;
        }
        if (password.length < 6) {
          console.log('❌ Password must be at least 6 characters');
          continue;
        }
        
        await resetPassword(email.trim(), password);
        break;

      case '2':
        await listUsers();
        break;

      case '3':
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
