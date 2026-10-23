/**
 * 6th Civilians Corporation — Dedicated Platform Super-Admin Provisioning Utility
 *
 * Operational Safety Constraints:
 * 1. Must NEVER run automatically during server boot or test cycles.
 * 2. Requires explicit operator confirmation via `--confirm` flag or `PROVISION_CONFIRM=true`.
 * 3. Prohibits plaintext password command-line arguments to prevent leakage in process tables (`ps`, `wmic`) and shell history.
 * 4. Supports secure interactive masked password entry or `SUPERADMIN_INITIAL_PASSWORD` / `SUPERADMIN_PASSWORD_FILE`.
 * 5. Requires independent target database verification (verifies `mongoose.connection.db.databaseName` matches expected target).
 * 6. Never prints passwords, hashes, tokens, or MFA secrets to stdout or stderr.
 * 7. Enforces high password complexity (min 14 chars, upper/lower/digit/symbol).
 * 8. Forces `mustChangePassword: true` for credential rotation on initial login.
 * 9. Sets `role: 'superadmin'` with `tenantId: null` (global corporate oversight).
 * 10. Atomic rollback: if the audit log creation fails, the user record is immediately removed.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const validatePasswordComplexity = (pwd) => {
  if (!pwd || typeof pwd !== 'string') return 'Password is required.';
  if (pwd.length < 14) return 'Password must be at least 14 characters long.';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pwd)) return 'Password must contain at least one digit.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) return 'Password must contain at least one special symbol.';
  return null;
};

export const extractUriClusterHost = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  try {
    const sanitized = uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://');
    const parsed = new URL(sanitized);
    return (parsed.host || '').toLowerCase();
  } catch {
    const match = uri.match(/@([^/?#]+)/);
    return match ? match[1].toLowerCase() : '';
  }
};

export const sanitizeErrorMessage = (msg) => {
  if (!msg || typeof msg !== 'string') return 'Unknown error';
  return msg
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb$1://[REDACTED_CREDENTIALS]@')
    .replace(/(password|secret|token|hash|pwd)=[^&\s]+/gi, '$1=[REDACTED]');
};

/**
 * Securely prompts for password on terminal without echoing characters to screen.
 */
export async function promptMaskedPassword(promptMessage = 'Enter Super-Admin Password: ') {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(promptMessage);

    // If stdin is a TTY, mask keystrokes
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
      // Non-interactive fallback (e.g. piped input)
      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Core super-admin provisioning logic.
 */
export async function provisionSuperAdmin({
  email,
  name = '6th Civilians Corp Super Administrator',
  password,
  expectedDatabaseName,
  expectedClusterIdentity,
  confirm = false,
  confirmProduction = false,
  allowEphemeral = false
} = {}) {
  // 1. Explicit Confirmation Check
  if (!confirm) {
    throw new Error(
      'Operational Safety: Confirmation flag missing. Pass --confirm or PROVISION_CONFIRM=true to execute.'
    );
  }

  // 2. Email Validation
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new Error('Valid super-admin email address is required.');
  }

  // 3. Password Complexity Validation
  const pwdError = validatePasswordComplexity(password);
  if (pwdError) {
    throw new Error(`Password policy violation: ${pwdError}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !confirmProduction) {
    throw new Error(
      'Production Safeguard: Operating in NODE_ENV=production. You must supply --confirm-production or PROVISION_PRODUCTION_CONFIRM=true.'
    );
  }

  // 4. Target Database URI check
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri && !allowEphemeral && mongoose.connection.readyState !== 1) {
    throw new Error('MONGO_URI environment variable is required to connect to the target database.');
  }

  if (mongoose.connection.readyState !== 1 && mongoUri) {
    console.log('📡 [SuperAdmin Provisioning] Connecting to target database cluster...');
    await mongoose.connect(mongoUri);
  }

  // 5. Independent Target-Database & Cluster Identity Verification
  const connectedDb = mongoose.connection.db ? mongoose.connection.db.databaseName : null;
  const connectedHost = (mongoose.connection.host || '').toLowerCase();
  const replicaSetName = (mongoose.connection.client?.topology?.description?.setName || '').toLowerCase();
  const uriClusterHost = extractUriClusterHost(mongoUri);

  // Collect topology server hosts
  const topologyServers = [];
  if (mongoose.connection.client?.topology?.description?.servers) {
    for (const [address] of mongoose.connection.client.topology.description.servers.entries()) {
      topologyServers.push(address.toLowerCase());
    }
  }

  // Handle malformed identity values (whitespace or empty string)
  if (expectedDatabaseName !== undefined && expectedDatabaseName !== null) {
    if (typeof expectedDatabaseName !== 'string' || expectedDatabaseName.trim().length === 0) {
      throw new Error('Target Identity Error: Provided expectedDatabaseName is malformed or empty.');
    }
  }

  if (expectedClusterIdentity !== undefined && expectedClusterIdentity !== null) {
    if (typeof expectedClusterIdentity !== 'string' || expectedClusterIdentity.trim().length === 0) {
      throw new Error('Target Identity Error: Provided expectedClusterIdentity is malformed or empty.');
    }
  }

  // In production, both target database name and target cluster identity are mandatory
  if (isProduction) {
    if (!expectedDatabaseName || expectedDatabaseName.trim().length === 0) {
      throw new Error(
        'Operational Safety: In production (NODE_ENV=production), --target-db (or TARGET_DATABASE_NAME) is required. Refusing to proceed with unverified target identity.'
      );
    }
    if (!expectedClusterIdentity || expectedClusterIdentity.trim().length === 0) {
      throw new Error(
        'Operational Safety: In production (NODE_ENV=production), --target-cluster (or EXPECTED_CLUSTER_IDENTITY) is required. Refusing to proceed with unverified target cluster identity.'
      );
    }
  }

  // Logical database name verification
  if (expectedDatabaseName) {
    const cleanExpectedDb = expectedDatabaseName.trim().toLowerCase();
    if (!connectedDb || connectedDb.toLowerCase() !== cleanExpectedDb) {
      throw new Error(
        `Target Database Mismatch: Connected to database '${connectedDb || 'unknown'}', but expected '${cleanExpectedDb}'. Provisioning aborted to protect wrong cluster.`
      );
    }
  }

  // Deployment / cluster identity verification (handles SRV parent host, shard host, or replica set)
  if (expectedClusterIdentity) {
    const cleanExpectedCluster = expectedClusterIdentity.trim().toLowerCase();
    const availableIdentities = [
      connectedHost,
      replicaSetName,
      uriClusterHost,
      ...topologyServers
    ].filter(Boolean);

    if (availableIdentities.length === 0) {
      throw new Error(
        'Target Identity Error: Unable to establish connected cluster identity from connection or driver topology. Failing closed.'
      );
    }

    const clusterMatches = 
      connectedHost.includes(cleanExpectedCluster) ||
      (replicaSetName && replicaSetName === cleanExpectedCluster) ||
      (uriClusterHost && uriClusterHost.includes(cleanExpectedCluster)) ||
      topologyServers.some(srv => srv.includes(cleanExpectedCluster));

    if (!clusterMatches) {
      throw new Error(
        `Target Cluster Mismatch: Connected to cluster host '${connectedHost}' (uri: '${uriClusterHost || 'unknown'}', replicaSet: '${replicaSetName || 'none'}'), but expected '${cleanExpectedCluster}'. Provisioning aborted to protect wrong cluster.`
      );
    }
  }

  const User = (await import('../models/User.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  // 6. Duplicate Email Check
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new Error(
      `An account with email "${email}" already exists. Superadmin provisioning cannot overwrite or promote existing accounts.`
    );
  }

  // 7. Secure Password Hashing
  const hashedPassword = await bcrypt.hash(password, 12);
  const corporateId = `6CC-SUPERADMIN-${Date.now().toString().slice(-4)}`;

  // 8. Create User Record
  const superAdmin = await User.create({
    studentId: corporateId,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'superadmin',
    tenantId: null, // Platform-wide corporate oversight
    mustChangePassword: true, // Forces immediate credential rotation on first login
    mfaEnforced: true, // Enforce MFA enrollment
    mfaSetupRequired: true,
    status: 'active',
    accountStatus: 'Active',
    isTwoFactorEnabled: false
  });

  // 9. Atomic Audit Log Creation with Rollback Safeguard
  try {
    await AuditLog.create({
      tenantId: new mongoose.Types.ObjectId('000000000000000000000000'), // Platform-level governance tenant
      actor: {
        userId: superAdmin._id,
        role: 'superadmin',
        email: superAdmin.email
      },
      action: 'PLATFORM_SUPERADMIN_PROVISIONED',
      details: {
        operator: process.env.USER || process.env.USERNAME || 'operator_cli',
        email: superAdmin.email,
        corporateId,
        databaseTarget: connectedDb,
        clusterHost: connectedHost,
        mustChangePassword: true,
        mfaEnforced: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (auditErr) {
    // ATOMIC ROLLBACK: Never leave a partially-provisioned privileged account without audit trail
    try {
      await User.findByIdAndDelete(superAdmin._id);
    } catch (rollbackErr) {
      // CRITICAL UNRESOLVED STATE: Both audit logging and deletion failed!
      // Must report a critical unresolved state with operator intervention required, WITHOUT printing secrets/passwords/hashes.
      throw new Error(
        `CRITICAL UNRESOLVED STATE: Audit log generation failed (${sanitizeErrorMessage(auditErr.message)}) AND subsequent rollback deletion failed (${sanitizeErrorMessage(rollbackErr.message)}). An un-audited superadmin record (ID: ${superAdmin._id}, email: ${superAdmin.email}) may persist in database '${connectedDb}'. Immediate manual operator intervention required.`
      );
    }
    throw new Error(
      `CRITICAL: Audit logging failed (${sanitizeErrorMessage(auditErr.message)}). Superadmin creation was rolled back to maintain audit integrity.`
    );
  }

  console.log('✅ 6th Civilians Corporation Super-Admin successfully provisioned.');
  console.log(`   Corporate ID: ${corporateId}`);
  console.log(`   Account Email: ${superAdmin.email}`);
  console.log(`   Target Database: ${connectedDb}`);
  console.log(`   Cluster Host: ${connectedHost}`);
  console.log(`   Role: ${superAdmin.role} (Platform-Wide Oversight)`);
  console.log('   Security Status: mustChangePassword=true, mfaEnforced=true enforced for first login.');

  return {
    success: true,
    userId: superAdmin._id,
    corporateId,
    email: superAdmin.email,
    database: connectedDb,
    cluster: connectedHost
  };
}

// CLI Execution Entry Point (only when run directly via node)
if (process.argv[1] && process.argv[1].endsWith('provisionSuperAdmin.js')) {
  (async () => {
    const args = process.argv.slice(2);
    const getArg = (flag) => {
      const idx = args.indexOf(flag);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    // PROHIBIT plaintext password CLI arguments
    if (args.includes('--password') || args.some((a) => a.startsWith('--password='))) {
      console.error(
        '❌ SECURITY ERROR: Plaintext passwords as command-line arguments are prohibited.'
      );
      console.error(
        '   Command-line arguments are visible in process tables (`ps aux`, `wmic`) and shell history.'
      );
      console.error(
        '   Please use the interactive hidden password prompt or set SUPERADMIN_INITIAL_PASSWORD in a protected environment.'
      );
      process.exit(1);
    }

    const email = getArg('--email') || process.env.SUPERADMIN_EMAIL;
    const name = getArg('--name') || process.env.SUPERADMIN_NAME || '6th Civilians Corp Super Administrator';
    const expectedDatabaseName = getArg('--target-db') || getArg('--expected-database') || process.env.TARGET_DATABASE_NAME || process.env.EXPECTED_DATABASE_NAME;
    const expectedClusterIdentity = getArg('--target-cluster') || getArg('--expected-cluster') || getArg('--expected-cluster-identity') || process.env.EXPECTED_CLUSTER_IDENTITY || process.env.EXPECTED_CLUSTER_HOST;
    const confirm = args.includes('--confirm') || process.env.PROVISION_CONFIRM === 'true';
    const confirmProduction = args.includes('--confirm-production') || process.env.PROVISION_PRODUCTION_CONFIRM === 'true';
    const allowEphemeral = args.includes('--allow-ephemeral');

    if (!confirm || !email) {
      console.log(`
================================================================================
6th Civilians Corporation — Dedicated Super-Admin Provisioning CLI
================================================================================
Usage:
  node server/scripts/provisionSuperAdmin.js \\
    --email superadmin@6thcivilians.org \\
    --name "Corp Super Administrator" \\
    --target-db <expected_db_name> \\
    --target-cluster <expected_cluster_host_or_replica_set> \\
    --confirm

Secret Input Options:
  1. Interactive hidden prompt (prompted automatically when running in TTY)
  2. SUPERADMIN_INITIAL_PASSWORD environment variable
  3. SUPERADMIN_PASSWORD_FILE=<path_to_secret_file>

Safety Requirements:
  - --password CLI argument is strictly rejected to prevent process-table leaks.
  - Requires explicit confirmation (--confirm).
  - Verifies expected target database matches connected cluster.
  - Verifies expected cluster/deployment identity (mandatory in production).
  - Requires 14+ character password with upper, lower, digit, and symbol.
  - Atomic rollback: if audit logging fails, account creation is reversed.
================================================================================
`);
      process.exit(0);
    }

    // Retrieve password securely
    let password = process.env.SUPERADMIN_INITIAL_PASSWORD;
    const passwordFile = process.env.SUPERADMIN_PASSWORD_FILE || getArg('--password-file');

    if (passwordFile && fs.existsSync(passwordFile)) {
      password = fs.readFileSync(passwordFile, 'utf8').trim();
    }

    if (!password) {
      if (process.stdin.isTTY) {
        try {
          password = await promptMaskedPassword('Enter Super-Admin Password (14+ characters, hidden): ');
          const confirmPassword = await promptMaskedPassword('Confirm Super-Admin Password: ');
          if (password !== confirmPassword) {
            console.error('❌ Error: Passwords do not match.');
            process.exit(1);
          }
        } catch (promptErr) {
          console.error(`❌ ${promptErr.message}`);
          process.exit(1);
        }
      } else {
        console.error('❌ Error: No password provided. Set SUPERADMIN_INITIAL_PASSWORD or run in an interactive terminal.');
        process.exit(1);
      }
    }

    try {
      await provisionSuperAdmin({
        email,
        name,
        password,
        expectedDatabaseName,
        expectedClusterIdentity,
        confirm,
        confirmProduction,
        allowEphemeral
      });
      process.exit(0);
    } catch (err) {
      console.error('❌ Provisioning Error:', err.message);
      process.exit(1);
    }
  })();
}
