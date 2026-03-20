import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Create a test HQ admin payload
const payload = {
  sub: 'test-user-001',
  email: 'admin@health.gov.gh',
  role: 'hq-admin',
  fullName: 'Test Admin',
  permissions: [
    'create_user',
    'edit_user',
    'delete_user',
    'manage_branches',
    'view_analytics',
    'trigger_backup',
  ],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
};

// Generate token
const token = sign(payload, JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: '24h',
});

console.log('✅ JWT Token Generated Successfully');
console.log('━'.repeat(60));
console.log('\n📋 Token Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n🔑 JWT Token:');
console.log(token);
console.log('\n━'.repeat(60));
console.log('\n📝 Usage in API calls:');
console.log(`Authorization: Bearer ${token}`);
console.log('\n💡 Example cURL:');
console.log(
  `curl -H "Authorization: Bearer ${token}" http://localhost:3001/api/hq-admin/system/metrics`
);

// Also save to .env files for easy access
console.log('\n✨ To use this token in browser console:');
console.log(`localStorage.setItem("accessToken", "${token}");`);
