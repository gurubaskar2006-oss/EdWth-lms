/**
 * Lumina LMS — Dedicated Local Staging Super-Admin Provisioner
 * 6th Civilians Corporation
 *
 * Operational Safety Guarantees:
 * 1. Loads ONLY server/.env.staging. Rejects any Atlas or remote MongoDB URIs.
 * 2. Strictly verifies local MongoDB replica set rs0 is PRIMARY before proceeding.
 * 3. Enforces privileged corporate identity policy (rejects public freemail domains).
 * 4. Enforces high password complexity (min 14 chars, upper, lower, digit, symbol).
 * 5. Masks interactive password input in terminal (prohibits plaintext --password flags).
 * 6. Never prints plaintext passwords, hashes, or credentials to stdout, stderr, or logs.
 * 7. Supports a strict --dry-run mode that creates ZERO database records.
 * 8. Enforces atomic rollback: if audit logging fails, the user record is immediately deleted.
 * 9. Requires explicit confirmation (--confirm) before performing any write operations.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

import { validateStagingMongoUri } from '../utils/stagingUriValidator.js';
import { validatePrivilegedIdentity } from '../config/privilegedIdentities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const stagingEnvPath = path.resolve(rootDir, 'server/.env.staging');

/**
 * Validates password complexity against corporate security policy.
 * @param {string} pwd
 * @returns {string|null} Error string or null if valid
 */
export function validatePasswordComplexity(pwd) {
  if (!pwd || typeof pwd !== 'string') return 'Password is required.';
  if (pwd.length < 14) return 'Password must be at least 14 characters long.';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pwd)) return 'Password must contain at least one digit.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) {
    return 'Password must contain at least one special symbol.';
  }
  return null;
}

/**
 * Securely prompts for password on terminal without echoing characters.
 * @param {string} promptMessage
 * @returns {Promise<string>}
 */
export async function promptMaskedPassword(promptMessage = 'Enter Staging Super-Admin Password: ') {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(promptMessage);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      let password = '';

      const onData = (char) => {
        const c = char.toString('utf8');

        // Ctrl+C
        if (c === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          return reject(new Error('Password prompt cancelled by operator.'));
        }

        // Enter or Return
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          return resolve(password);
        }

        // Backspace
        if (c === '\u0008' || c === '\x7f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          return;
        }

        // Normal character
        password += c;
        process.stdout.write('*');
      };

      process.stdin.on('data', onData);
    } else {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Loads and validates staging environment exclusively.
 * @param {string} [customEnvPath]
 * @returns {{ mongoUri: string, port: string }}
 */
export function loadStagingEnvironment(customEnvPath = stagingEnvPath) {
  if (!fs.existsSync(customEnvPath)) {
    throw new Error(`FATAL: Staging environment file not found at: ${customEnvPath}`);
  }

  // Clear any external or production overrides from current process
  delete process.env.MONGO_URI;
  delete process.env.PORT;
  delete process.env.NODE_ENV;

  const result = dotenv.config({ path: customEnvPath, override: true });
  if (result.error) {
    throw new Error(`Failed to parse staging environment file: ${result.error.message}`);
  }

  process.env.NODE_ENV = 'staging';
  process.env.ENV_FILE = customEnvPath;

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('FATAL: MONGO_URI is missing from server/.env.staging.');
  }

  // Validate via strict structured staging validator
  const validation = validateStagingMongoUri(mongoUri, 27018);
  if (!validation.valid) {
    throw new Error(`Staging database URI rejected by security validator: ${validation.reason}`);
  }

  return {
    mongoUri,
    port: process.env.PORT || '5001',
    hosts: validation.hosts,
    database: validation.database
  };
}

/**
 * Core staging super-admin provisioning logic.
 *
 * @param {Object} options
 * @param {string} options.email - Corporate SuperAdmin email
 * @param {string} [options.name] - Administrator display name
 * @param {string} options.password - Initial administrative password
 * @param {boolean} [options.dryRun=false] - If true, validates all rules and connects but inserts zero records
 * @param {boolean} [options.confirm=false] - Required confirmation flag for live execution
 * @param {string} [options.customTargetDb] - Optional custom DB name for isolated testing (defaults to lumina_staging)
 * @param {string} [options.mongoUri] - Optional custom URI for isolated testing
 * @returns {Promise<{ success: boolean, dryRun: boolean, userId?: string, email: string, database: string }>}
 */
export async function provisionStagingSuperAdmin({
  email,
  name = 'Staging Super Administrator',
  password,
  dryRun = false,
  confirm = false,
  customTargetDb,
  mongoUri
} = {}) {
  // 1. Validate Environment & Target Database URI
  let effectiveUri = mongoUri;
  let targetDbName = customTargetDb || 'lumina_staging';

  if (!effectiveUri) {
    const envConfig = loadStagingEnvironment();
    effectiveUri = envConfig.mongoUri;
    if (envConfig.database) {
      targetDbName = customTargetDb || envConfig.database;
    }
  } else {
    // Explicit security check on custom URI
    const uriCheck = validateStagingMongoUri(effectiveUri, 27018);
    if (!uriCheck.valid) {
      throw new Error(`Target URI rejected by staging security guard: ${uriCheck.reason}`);
    }
  }

  // 2. Validate Corporate Privileged Email Identity
  if (!email || typeof email !== 'string') {
    throw new Error('Valid super-admin email address is required.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const identityCheck = validatePrivilegedIdentity(cleanEmail, 'superadmin');
  if (!identityCheck.allowed) {
    throw new Error(`Privileged identity policy violation: ${identityCheck.reason}`);
  }

  // 3. Validate Password Complexity
  const pwdError = validatePasswordComplexity(password);
  if (pwdError) {
    throw new Error(`Password policy violation: ${pwdError}`);
  }

  // 4. Pre-Flight Replica Set Status Verification via directConnection
  const directClient = new MongoClient('mongodb://127.0.0.1:27018/?directConnection=true', {
    serverSelectionTimeoutMS: 4000
  });

  try {
    await directClient.connect();
    const rsStatus = await directClient.db('admin').command({ replSetGetStatus: 1 });
    if (rsStatus.set !== 'rs0') {
      throw new Error(`Replica set mismatch: connected to "${rsStatus.set}", but expected "rs0".`);
    }
    const myMember = rsStatus.members?.find((m) => m.self);
    if (!myMember || myMember.stateStr !== 'PRIMARY') {
      throw new Error(`Local replica set node is in state "${myMember?.stateStr || 'UNKNOWN'}", expected "PRIMARY".`);
    }
  } catch (rsErr) {
    throw new Error(`Local replica set verification failed: ${rsErr.message}`);
  } finally {
    await directClient.close().catch(() => {});
  }

  // 5. Connect Mongoose to the Local Staging Replica Set
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(effectiveUri, {
      serverSelectionTimeoutMS: 5000
    });
  }

  const connectedDb = mongoose.connection.db ? mongoose.connection.db.databaseName : null;
  if (connectedDb !== targetDbName) {
    throw new Error(
      `Database target mismatch: connected to "${connectedDb}", expected "${targetDbName}". Provisioning aborted.`
    );
  }

  const User = (await import('../models/User.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  // 6. Inspect Existing Database Records (Unexpected non-empty safeguard)
  const existingUserCount = await User.countDocuments();
  const existingAccount = await User.findOne({ email: cleanEmail });

  if (existingAccount) {
    throw new Error(
      `Account conflict: an account with email "${cleanEmail}" already exists in "${connectedDb}". Cannot overwrite or promote existing account.`
    );
  }

  // 7. DRY-RUN EXECUTION BRANCH
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      email: cleanEmail,
      database: connectedDb,
      cluster: '127.0.0.1:27018 (rs0: PRIMARY)',
      existingUsersCount: existingUserCount,
      message: 'Dry-run validation successful. Zero records created.'
    };
  }

  // 8. LIVE PROVISIONING CONFIRMATION CHECK
  if (!confirm) {
    throw new Error(
      'Operational Safety: Confirmation flag missing. Pass --confirm to execute actual account creation.'
    );
  }

  // 9. Password Hashing (12 bcrypt rounds)
  const hashedPassword = await bcrypt.hash(password, 12);
  const corporateId = `6CC-STAGING-SUPERADMIN-${Date.now().toString().slice(-4)}`;

  // 10. Atomic Account Creation
  const superAdmin = await User.create({
    studentId: corporateId,
    name,
    email: cleanEmail,
    password: hashedPassword,
    role: 'superadmin',
    tenantId: null, // Global platform oversight
    mustChangePassword: true, // Forces immediate credential change
    mfaEnforced: true, // Enforce MFA
    mfaSetupRequired: true,
    status: 'active',
    accountStatus: 'Active',
    isTwoFactorEnabled: false
  });

  // 11. Atomic Audit Log Creation with Rollback
  try {
    await AuditLog.create({
      tenantId: new mongoose.Types.ObjectId('000000000000000000000000'),
      actor: {
        userId: superAdmin._id,
        role: 'superadmin',
        email: superAdmin.email
      },
      action: 'PLATFORM_SUPERADMIN_PROVISIONED',
      details: {
        operator: process.env.USERNAME || process.env.USER || 'staging_cli',
        email: superAdmin.email,
        corporateId,
        environment: 'staging',
        databaseTarget: connectedDb,
        clusterHost: '127.0.0.1:27018',
        replicaSet: 'rs0',
        mustChangePassword: true,
        mfaEnforced: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (auditErr) {
    // ATOMIC ROLLBACK: Remove the user if audit logging fails
    try {
      await User.findByIdAndDelete(superAdmin._id);
    } catch (rollbackErr) {
      throw new Error(
        `CRITICAL ROLLBACK FAILURE: Audit log creation failed (${auditErr.message}) AND user deletion failed (${rollbackErr.message}). Immediate manual intervention required for ID: ${superAdmin._id}.`
      );
    }
    throw new Error(
      `CRITICAL: Audit log creation failed (${auditErr.message}). Staging super-admin creation was rolled back to maintain audit integrity.`
    );
  }

  return {
    success: true,
    dryRun: false,
    userId: superAdmin._id.toString(),
    corporateId,
    email: superAdmin.email,
    database: connectedDb,
    cluster: '127.0.0.1:27018 (rs0: PRIMARY)'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('provisionStagingSuperAdmin.mjs')) {
  (async () => {
    const args = process.argv.slice(2);
    const getArg = (flag) => {
      const idx = args.indexOf(flag);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    // PROHIBIT plaintext password CLI arguments
    if (args.includes('--password') || args.some((a) => a.startsWith('--password='))) {
      console.error('❌ SECURITY ERROR: Plaintext passwords as command-line arguments are prohibited.');
      console.error('   Please use the interactive masked prompt or SUPERADMIN_INITIAL_PASSWORD.');
      process.exit(1);
    }

    const dryRun = args.includes('--dry-run');
    const confirm = args.includes('--confirm');
    const email = getArg('--email');
    const name = getArg('--name') || 'Staging Super Administrator';

    console.log('================================================================');
    console.log('🛡️  LUMINA LMS — STAGING SUPER-ADMIN PROVISIONING CLI');
    console.log('================================================================');

    if (!email) {
      console.log(`
Usage:
  node server/scripts/provisionStagingSuperAdmin.mjs --email <corporate_email> [--name <name>] [--dry-run] [--confirm]

Options:
  --email <email>     Approved corporate SuperAdmin email (e.g. edwthacademyadmin@6c.com)
  --name <name>       Display name (default: "Staging Super Administrator")
  --dry-run           Validates environment, database, policy, and conflicts WITHOUT creating records
  --confirm           Explicit execution confirmation required for live creation

Safety Rules:
  - Connects ONLY to 127.0.0.1:27018/lumina_staging via server/.env.staging.
  - Production Atlas is completely unreachable.
  - Enforces minimum 14-character complex password with interactive masked entry.
  - Plaintext --password CLI argument is strictly forbidden.
================================================================
`);
      process.exit(0);
    }

    // Retrieve password
    let password = process.env.SUPERADMIN_INITIAL_PASSWORD;
    const passwordFile = getArg('--password-file') || process.env.SUPERADMIN_PASSWORD_FILE;
    if (passwordFile && fs.existsSync(passwordFile)) {
      password = fs.readFileSync(passwordFile, 'utf8').trim();
    }

    if (!password) {
      if (process.stdin.isTTY) {
        try {
          password = await promptMaskedPassword('Enter Staging Super-Admin Password (14+ characters, hidden): ');
          if (!dryRun) {
            const confirmPassword = await promptMaskedPassword('Confirm Password: ');
            if (password !== confirmPassword) {
              console.error('❌ Passwords do not match.');
              process.exit(1);
            }
          }
        } catch (promptErr) {
          console.error(`❌ ${promptErr.message}`);
          process.exit(1);
        }
      } else {
        console.error('❌ Error: Password required. Provide via interactive TTY or SUPERADMIN_INITIAL_PASSWORD.');
        process.exit(1);
      }
    }

    try {
      const result = await provisionStagingSuperAdmin({
        email,
        name,
        password,
        dryRun,
        confirm
      });

      if (result.dryRun) {
        console.log('----------------------------------------------------------------');
        console.log('✅ DRY-RUN COMPLETED SUCCESSFULLY — ZERO DATABASE RECORDS WRITTEN');
        console.log('----------------------------------------------------------------');
        console.log(`- Validated Email:     ${result.email}`);
        console.log(`- Target Database:     ${result.database}`);
        console.log(`- Cluster Identity:    ${result.cluster}`);
        console.log(`- Password Policy:     Satisfied (min 14 chars, complex)`);
        console.log(`- Privileged Policy:   Satisfied (approved corporate identity)`);
        console.log(`- Existing Accounts:   ${result.existingUsersCount}`);
        console.log('----------------------------------------------------------------');
        console.log('Ready for live creation: Re-run with --confirm to provision.');
      } else {
        console.log('----------------------------------------------------------------');
        console.log('🎉 STAGING SUPER-ADMIN PROVISIONED SUCCESSFULLY');
        console.log('----------------------------------------------------------------');
        console.log(`- User ID:             ${result.userId}`);
        console.log(`- Corporate ID:        ${result.corporateId}`);
        console.log(`- Account Email:       ${result.email}`);
        console.log(`- Target Database:     ${result.database}`);
        console.log(`- Cluster Host:        ${result.cluster}`);
        console.log(`- Initial Credentials: mustChangePassword=true, mfaEnforced=true`);
        console.log('----------------------------------------------------------------');
      }
      process.exit(0);
    } catch (err) {
      console.error('❌ Provisioning Error:', err.message);
      process.exit(1);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
    }
  })();
}

export default {
  provisionStagingSuperAdmin,
  validatePasswordComplexity,
  loadStagingEnvironment
};

