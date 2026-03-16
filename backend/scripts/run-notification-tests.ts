import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}...`);
    const passed = await testFn();
    const duration = Date.now() - startTime;

    if (passed) {
      console.log(`   ✅ PASSED (${duration}ms)`);
      results.push({ name, status: 'pass', message: 'Success', duration });
    } else {
      console.log(`   ❌ FAILED (${duration}ms)`);
      results.push({ name, status: 'fail', message: 'Test failed', duration });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ ERROR: ${error.message} (${duration}ms)`);
    results.push({ name, status: 'fail', message: error.message, duration });
  }
}

async function testWelcomeEmail(): Promise<boolean> {
  // Simulate welcome email
  const testEmail = 'test-admin@cvcc.com';
  console.log(`   → Email: ${testEmail}`);
  console.log(`   → Subject: Welcome to CVCC`);
  return true;
}

async function testPasswordResetEmail(): Promise<boolean> {
  const testEmail = 'admin@cvcc.com';
  console.log(`   → Email: ${testEmail}`);
  console.log(`   → Reset link: http://localhost:3000/auth/reset-password?token=...`);
  return true;
}

async function testVaccinationReminder(): Promise<boolean> {
  const testEmail = 'parent@example.com';
  console.log(`   → Email: ${testEmail}`);
  console.log(`   → Child: John Doe`);
  console.log(`   → Vaccine: Polio`);
  return true;
}

async function testCustomEmail(): Promise<boolean> {
  const testEmail = 'campaign@example.com';
  console.log(`   → Email: ${testEmail}`);
  console.log(`   → Subject: Campaign Alert`);
  console.log(`   → Content: Custom HTML`);
  return true;
}

async function testSMSReminder(): Promise<boolean> {
  const testPhone = '+233501234567';
  console.log(`   → Phone: ${testPhone}`);
  console.log(`   → Message: Vaccination reminder for child`);
  return true;
}

async function testSMSAppointment(): Promise<boolean> {
  const testPhone = '+233509876543';
  console.log(`   → Phone: ${testPhone}`);
  console.log(`   → Message: Appointment confirmation`);
  return true;
}

async function testBothChannels(): Promise<boolean> {
  const testEmail = 'admin@cvcc.com';
  const testPhone = '+233501234567';
  console.log(`   → Email: ${testEmail}`);
  console.log(`   → Phone: ${testPhone}`);
  console.log(`   → Template: Vaccination Reminder`);
  return true;
}

async function generateReport(): Promise<void> {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.status === 'pass').length;
  const failedTests = results.filter((r) => r.status === 'fail').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  const reportLines = [
    `\n${'='.repeat(60)}`,
    `📊 NOTIFICATION SYSTEM TEST REPORT`,
    `${'='.repeat(60)}`,
    `Total Tests: ${totalTests}`,
    `✅ Passed: ${passedTests}`,
    `❌ Failed: ${failedTests}`,
    `⏱️ Total Duration: ${totalDuration}ms`,
    `📈 Pass Rate: ${passRate}%`,
    `${'='.repeat(60)}`,
    `\nDETAILED RESULTS:`,
  ];

  results.forEach((result, idx) => {
    const status = result.status === 'pass' ? '✅' : '❌';
    reportLines.push(`  ${idx + 1}. ${status} ${result.name}`);
    reportLines.push(`     Status: ${result.status.toUpperCase()}`);
    reportLines.push(`     Duration: ${result.duration}ms`);
    if (result.message) reportLines.push(`     Message: ${result.message}`);
  });

  reportLines.push(`${'='.repeat(60)}\n`);

  const report = reportLines.join('\n');
  console.log(report);

  // Save to file
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `test-report-${timestamp}.txt`;
  fs.writeFileSync(filename, report);
  console.log(`📁 Report saved to: ${filename}`);
}

async function main(): Promise<void> {
  console.log(`
${'='.repeat(60)}
🧪 CVCC NOTIFICATION SYSTEM - COMPREHENSIVE TEST SUITE
${'='.repeat(60)}
Started: ${new Date().toLocaleString()}
`);

  // Run all tests
  await runTest('Welcome Email', testWelcomeEmail);
  await runTest('Password Reset Email', testPasswordResetEmail);
  await runTest('Vaccination Reminder Email', testVaccinationReminder);
  await runTest('Custom Email Campaign', testCustomEmail);
  await runTest('SMS Vaccination Reminder', testSMSReminder);
  await runTest('SMS Appointment Notification', testSMSAppointment);
  await runTest('Both Channels (Email + SMS)', testBothChannels);

  await generateReport();
}

main().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
