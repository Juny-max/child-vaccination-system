/**
 * Generate Password Hash Script
 * This generates the exact hash the backend expects
 * Run with: npx ts-node scripts/generate-hash.ts <password>
 */

async function generateHash(password: string): Promise<string> {
  // Use the same method as auth.service.ts (Web Crypto API)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const password = process.argv[2] || 'password1234';
  
  console.log('\n🔐 Password Hash Generator');
  console.log('='.repeat(50));
  console.log(`Password: ${password}`);
  
  const hash = await generateHash(password);
  console.log(`Hash: ${hash}`);
  
  console.log('\n📋 SQL to update password:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'akosua.asante@example.com';`);
  
  console.log('\n📋 SQL to update ALL demo users:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE role IN ('parent', 'hq-admin', 'branch-manager', 'facility-nurse', 'chw', 'data-officer', 'pha');`);
}

main();
