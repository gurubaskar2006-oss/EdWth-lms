/**
 * EdWth LMS — SuperAdmin Security Email OTP Verification CLI
 * 6th Civilians Corporation
 *
 * Verifies the 6-digit code received in the authorized security mailbox
 * and binds the email to the SuperAdmin account.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../database/mongoose.js';
import User from '../models/User.js';
import { verifySecurityEmailBindingOtp } from '../services/superAdminSecurityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const code = process.argv[2]?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    console.error('Usage: node server/scripts/verifyEmailOtp.js <6-digit-code>');
    console.error('Example: node server/scripts/verifyEmailOtp.js 123456');
    process.exit(1);
  }

  await connectDB();
  const superAdmin = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!superAdmin) {
    console.error('Error: SuperAdmin account not found in database.');
    process.exit(1);
  }

  try {
    const result = await verifySecurityEmailBindingOtp(superAdmin, code);
    console.log('\n===============================================================');
    console.log('       SECURITY EMAIL SUCCESSFULLY VERIFIED & BOUND            ');
    console.log('===============================================================');
    console.log(`✅ ${result.message}`);
    console.log(`   SuperAdmin Account: ${superAdmin.email}`);
    console.log(`   Bound Mailbox:      ${superAdmin.securityEmail}`);
    console.log(`   Verified Status:    ACTIVE`);
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

