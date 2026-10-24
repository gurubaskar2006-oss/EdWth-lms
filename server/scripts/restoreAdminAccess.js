/**
 * EdWth LMS — Administrator Access Restoration Utility
 * 6th Civilians Corporation
 *
 * Operational Safety & Security:
 * 1. Targeted exclusively to administrator email: edwthacademyadmin@6c.com (normalized).
 * 2. Interactive masked password prompt — never echoes password characters to screen.
 * 3. Double-entry confirmation and strict complexity validation.
 * 4. Password is hashed with bcrypt (salt rounds: 12) before storage; plaintext is never stored or logged.
 * 5. Explicit operator confirmation ('YES') required before writing to MongoDB Atlas.
 * 6. Safe duplicate handling: updates password if account exists, creates account if it does not.
 * 7. Zero secret exposure: connection strings, tokens, and hashes are never printed.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const TARGET_EMAIL = 'edwthacademyadmin@6c.com';

/**
 * Validates password against enterprise complexity standards:
 * - At least 10 characters long
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special symbol (!@#$%^&* etc.)
 */
export function validatePasswordSecurity(pwd) {
  if (!pwd || typeof pwd !== 'string') {
    return 'Password cannot be empty.';
  }
  if (pwd.length < 10) {
    return 'Password must be at least 10 characters long.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Password must contain at least one digit (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd)) {
    return 'Password must contain at least one special symbol (e.g. !@#$%&*).';
  }
  return null;
}

/**
 * Prompts operator for masked password on TTY terminal.
 * Characters typed appear as asterisks (*) and are never echoed in plaintext.
 */
export function promptMaskedPassword(promptMessage) {
  return new Promise((resolve, reject) => {
    process.stdout.write(promptMessage);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let input = '';
      const onData = (char) => {
        // Ctrl+C (cancel)
        if (char === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          process.stdout.write('\n');
          return reject(new Error('Operation cancelled by user (Ctrl+C).'));
        }

        // Enter / Return
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          process.stdout.write('\n');
          return resolve(input);
        }

        // Backspace (\u0008 or \x7f)
        if (char === '\u0008' || char === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          return;
        }

        // Ignore other control codes
        if (char.charCodeAt(0) < 32) {
          return;
        }

        input += char;
        process.stdout.write('*');
      };

      process.stdin.on('data', onData);
    } else {
      // Non-interactive fallback
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Prompts operator for text confirmation.
 */
function promptText(promptMessage) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(promptMessage, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('🔐 EdWth LMS — Administrator Access Restoration Utility');
  console.log('   6th Civilians Corporation Platform Operations');
  console.log('================================================================\n');

  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error('❌ Configuration Error: MONGO_URI is missing from environment.');
    process.exit(1);
  }

  // Connect to Database
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000
    });
    console.log(`✅ Connected to Database: "${mongoose.connection.name}"`);
    console.log(`   Host: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
    process.exit(1);
  }

  const User = (await import('../models/User.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  const normalizedEmail = TARGET_EMAIL.toLowerCase().trim();

  // 1. Check existing account state
  console.log(`\n📋 Auditing target account: ${normalizedEmail}`);
  const existingUser = await User.findOne({
    email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
  });

  if (existingUser) {
    console.log(`ℹ️  Target account ALREADY EXISTS (ID: ${existingUser._id}, Role: ${existingUser.role}).`);
    console.log('   This procedure will safely update the password hash for this account.');
  } else {
    console.log('ℹ️  Target account DOES NOT EXIST.');
    console.log('   This procedure will provision a new platform administrator account.');
  }

  // 2. Interactive Masked Password Input
  console.log('\n--- CHOOSE ADMINISTRATOR PASSWORD ---');
  console.log('Policy: Minimum 10 characters, including uppercase, lowercase, number, and special character.');
  console.log('Note: Keystrokes will be masked with asterisks (*).\n');

  let password = '';
  while (true) {
    try {
      password = await promptMaskedPassword('Enter new administrator password: ');
    } catch (err) {
      console.log(`\n❌ ${err.message}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const validationError = validatePasswordSecurity(password);
    if (validationError) {
      console.log(`⚠️  ${validationError} Please try again.\n`);
      continue;
    }

    let confirmPassword = '';
    try {
      confirmPassword = await promptMaskedPassword('Confirm new administrator password: ');
    } catch (err) {
      console.log(`\n❌ ${err.message}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    if (password !== confirmPassword) {
      console.log('⚠️  Passwords do not match. Please re-enter.\n');
      continue;
    }

    console.log('✅ Password verified and confirmed.');
    break;
  }

  // 3. Explicit Operator Confirmation
  console.log('\n--- CONFIRMATION REQUIRED ---');
  console.log(`Target Email   : ${normalizedEmail}`);
  console.log(`Target Database: ${mongoose.connection.name} (${mongoose.connection.host})`);
  console.log(`Action         : ${existingUser ? 'Update Password Hash' : 'Provision New Platform SuperAdmin'}`);

  const confirmation = await promptText('\nType "YES" to commit this change to production: ');
  if (confirmation !== 'YES') {
    console.log('\n🛑 Operation cancelled by operator. No changes were made to the database.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 4. Hash Password & Persist
  console.log('\n⏳ Hashing password using bcrypt (cost factor: 12)...');
  const hashedPassword = await bcrypt.hash(password, 12);
  password = ''; // Clear plaintext from memory immediately

  try {
    let targetDocId;

    if (existingUser) {
      existingUser.password = hashedPassword;
      existingUser.mustChangePassword = false;
      existingUser.accountStatus = 'Active';
      existingUser.soft_deleted = false;
      await existingUser.save();
      targetDocId = existingUser._id;
      console.log(`\n✅ Administrator password successfully updated for ${normalizedEmail}.`);
    } else {
      const studentId = 'ADMIN-EDWTH-001';
      const newUser = await User.create({
        studentId,
        name: 'EdWth Platform Administrator',
        email: normalizedEmail,
        password: hashedPassword,
        role: 'superadmin',
        tenantId: null, // Cross-tenant company-wide oversight
        accountStatus: 'Active',
        isTwoFactorEnabled: false,
        mustChangePassword: false,
        mfaEnforced: true,
        soft_deleted: false
      });
      targetDocId = newUser._id;
      console.log(`\n✅ Platform Super-Administrator successfully created: ${normalizedEmail}`);
      console.log(`   Admin ID: ${studentId}`);
      console.log(`   Role    : superadmin (Global Platform Oversight)`);
    }

    // 5. Audit Log Entry
    try {
      await AuditLog.create({
        tenantId: null,
        actor: {
          userId: targetDocId,
          role: 'superadmin',
          email: normalizedEmail
        },
        action: existingUser ? 'ADMIN_PASSWORD_RESTORED' : 'ADMIN_ACCOUNT_PROVISIONED',
        details: {
          email: normalizedEmail,
          operator: process.env.USERNAME || process.env.USER || 'operator_terminal',
          database: mongoose.connection.name,
          timestamp: new Date().toISOString()
        }
      });
      console.log('✅ Security audit log recorded successfully.');
    } catch (auditErr) {
      console.warn('⚠️  Warning: Audit log record could not be written:', auditErr.message);
    }

    console.log('\n================================================================');
    console.log('🎉 Administrator access is ready!');
    console.log(`   Email: ${normalizedEmail}`);
    console.log('   Portal: https://edwth-lms.vercel.app/ (or /admin.html)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Error applying administrator update:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Database connection closed cleanly.');
  }
}

// Only run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('restoreAdminAccess.js')) {
  main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}
