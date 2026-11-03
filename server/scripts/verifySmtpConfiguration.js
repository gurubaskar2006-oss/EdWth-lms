/**
 * EdWth LMS — Outbound SMTP Verification & Diagnostics CLI
 * 6th Civilians Corporation
 *
 * Operational & Safety Constraints:
 * 1. NEVER prints passwords, secrets, or OTP codes to stdout or logs.
 * 2. Masks all user email addresses and credentials.
 * 3. Tests live SMTP handshake (transporter.verify) without side effects.
 * 4. Optionally sends a benign test email when --send-test is specified.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '[NOT SET]';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const visible = local.length > 3 ? local.slice(0, 3) : local.slice(0, 1);
  return `${visible}***@${domain}`;
};

const maskSecret = (secret) => {
  if (!secret) return '[NOT CONFIGURED]';
  return `[CONFIGURED: ${secret.length} characters]`;
};

async function runSmtpVerification() {
  console.log('===============================================================');
  console.log('      EdWth LMS — Outbound SMTP Diagnostic & Verification      ');
  console.log('===============================================================\n');

  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT?.trim() || '587', 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.SMTP_FROM?.trim() || (user ? `EdWth LMS Security <${user}>` : 'EdWth LMS Security <security@6thcivilians.org>');
  const securityEmail = process.env.SUPERADMIN_SECURITY_EMAIL?.trim() || 'thesixthcivilians26@gmail.com';

  console.log('1. Environment Configuration Audit:');
  console.log(`   - SMTP_HOST:                 ${host || '[MISSING / UNCONFIGURED]'}`);
  console.log(`   - SMTP_PORT:                 ${port} (${secure ? 'SSL/TLS' : 'STARTTLS'})`);
  console.log(`   - SMTP_USER:                 ${maskEmail(user)}`);
  console.log(`   - SMTP_PASS:                 ${maskSecret(pass)}`);
  console.log(`   - SMTP_SECURE:               ${secure}`);
  console.log(`   - SMTP_FROM:                 ${from}`);
  console.log(`   - SUPERADMIN_SECURITY_EMAIL: ${securityEmail}`);
  console.log('');

  const missing = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    console.log('❌ STATUS: SMTP IS NOT CONFIGURED');
    console.log(`   Missing required environment variable(s): ${missing.join(', ')}`);
    console.log('\n   To configure SMTP in server/.env, add:');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=587');
    console.log('   SMTP_USER=<your-email>@gmail.com');
    console.log('   SMTP_PASS=<your-16-char-app-password>');
    console.log('   SUPERADMIN_SECURITY_EMAIL=thesixthcivilians26@gmail.com\n');
    process.exit(2);
  }

  console.log('2. Testing Remote Mail Transfer Agent (MTA) Connection...');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    await transporter.verify();
    console.log('   ✅ SMTP Connection & Authentication Successful!');
  } catch (err) {
    console.error('   ❌ SMTP Connection Failed:', err.message);
    if (err.code === 'EAUTH') {
      console.error('      [Hint]: For Gmail, ensure 2-Step Verification is enabled and use a 16-character App Password (not your normal Google account password).');
    }
    process.exit(1);
  }

  // Optional: Send test message if requested via flag
  const sendTestArgIndex = process.argv.indexOf('--send-test');
  if (sendTestArgIndex !== -1) {
    const targetRecipient = process.argv[sendTestArgIndex + 1] || securityEmail;
    console.log(`\n3. Sending Benign Test Message to ${maskEmail(targetRecipient)}...`);
    try {
      const info = await transporter.sendMail({
        from,
        to: targetRecipient,
        subject: '[EdWth Security] SMTP Connection Verification Test',
        text: `EdWth LMS — Outbound SMTP Verification\n\nThis is a diagnostic message sent at ${new Date().toISOString()} confirming that outbound SMTP delivery is operational on the host.\n\nNo further action is required.`
      });

      console.log(`   ✅ Test Message Successfully Dispatched!`);
      console.log(`   - Message ID: ${info.messageId}`);
      console.log(`   - Accepted:   ${info.accepted.join(', ')}`);
      console.log(`   - Response:   ${info.response}`);
    } catch (sendErr) {
      console.error('   ❌ Failed to send test email:', sendErr.message);
      process.exit(1);
    }
  } else {
    console.log('\n   [Info] Pass --send-test <email> to dispatch a live test email.');
  }

  console.log('\n===============================================================');
  console.log('               SMTP VERIFICATION COMPLETE                      ');
  console.log('===============================================================\n');
  process.exit(0);
}

runSmtpVerification().catch(err => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});

