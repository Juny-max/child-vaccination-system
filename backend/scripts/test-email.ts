// Test SMTP Email Script
// Run with: npx ts-node scripts/test-email.ts

import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n📧 SMTP Email Test Script');
  console.log('========================\n');

  // Show current SMTP config
  console.log('Current SMTP Configuration:');
  console.log(`  Host: ${process.env.SMTP_HOST || 'smtp-relay.brevo.com'}`);
  console.log(`  Port: ${process.env.SMTP_PORT || '587'}`);
  console.log(`  User: ${process.env.SMTP_USER || '(not set)'}`);
  console.log(`  Pass: ${process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-4) : '(not set)'}`);
  console.log(`  From: ${process.env.SMTP_FROM || '(not set - will use SMTP_USER)'}`);
  console.log('');

  // Get email address to send to
  const toEmail = await ask('Enter email address to send test to: ');
  
  if (!toEmail || !toEmail.includes('@')) {
    console.log('❌ Invalid email address');
    rl.close();
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('\n⏳ Sending test email...\n');

  try {
    // Use verified sender email, not the SMTP login
    const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    
    const info = await transporter.sendMail({
      from: `"CVCC Test" <${senderEmail}>`,
      to: toEmail,
      subject: '✅ SMTP Test - Child Vaccination System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a;">🎉 SMTP Test Successful!</h1>
          <p>This is a test email from the Child Vaccination Command Center.</p>
          <p>If you're seeing this, your Brevo SMTP is configured correctly!</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br>
            SMTP Host: ${process.env.SMTP_HOST}<br>
            SMTP User: ${process.env.SMTP_USER}
          </p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Sent to: ${toEmail}`);
    console.log('\n📬 Check your inbox (and spam folder)!\n');
  } catch (error: any) {
    console.log('❌ Failed to send email!');
    console.log(`   Error: ${error.message}`);
    if (error.code) console.log(`   Code: ${error.code}`);
    console.log('\nTroubleshooting:');
    console.log('  1. Check SMTP_USER and SMTP_PASS in .env');
    console.log('  2. Verify your Brevo account is active');
    console.log('  3. Check if port 587 is not blocked');
  }

  rl.close();
}

main();
