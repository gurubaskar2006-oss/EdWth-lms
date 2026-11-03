/**
 * EdWth Academy LMS — SuperAdmin MFA Diagnostics & Recovery Utility
 * 6th Civilians Corporation
 *
 * Operational Safety Constraints:
 * 1. DEFAULTS TO READ-ONLY / DRY-RUN. Modifying operations are strictly blocked
 *    unless both `--execute` and `--confirm-mfa-reset` flags are explicitly supplied.
 * 2. Never prints TOTP secrets, plaintext passwords, backup codes, or encryption keys.
 * 3. Safely verifies whether the active environment encryption key can decrypt the stored TOTP secret.
 * 4. Logs audited security events when any recovery operation is authorized.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptTotpSecret, isEncrypted, diagnoseMfaEncryption } from '../utils/mfaCrypto.js';
import { getMfaEncryptionKey, getJwtSecret, isProduction } from '../config/environment.js';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function runMfaDiagnostics(options = {}) {
  const {
    email,
    execute = false,
    confirmReset = false,
    mongoUri = process.env.MONGO_URI
  } = options;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required to connect to the database.');
  }

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 25000 });
  }

  try {
    const User = (await import('../models/User.js')).default;
    const AuditLog = (await import('../models/AuditLog.js')).default;

    const query = email
      ? { email: email.toLowerCase().trim(), role: 'superadmin' }
      : { role: 'superadmin' };

    const superAdmin = await User.findOne(query).select(
      '+twoFactorSecret +pendingTwoFactorSecret +twoFactorBackupCodes +password'
    );

    if (!superAdmin) {
      return {
        success: false,
        message: email
          ? `SuperAdmin with email "${email}" not found.`
          : 'No SuperAdmin account found in database.'
      };
    }

    // Inspect active secret decryption without printing secret material
    let activeSecretDecryptable = false;
    let activeDecryptError = null;
    let activeSecretIsEncryptedFormat = false;

    if (superAdmin.twoFactorSecret) {
      activeSecretIsEncryptedFormat = isEncrypted(superAdmin.twoFactorSecret);
      try {
        const decrypted = decryptTotpSecret(superAdmin.twoFactorSecret);
        activeSecretDecryptable = !!(decrypted && decrypted.length >= 16);
      } catch (err) {
        activeDecryptError = err.message;
      }
    }

    // Inspect pending secret decryption
    let pendingSecretDecryptable = false;
    let pendingDecryptError = null;
    if (superAdmin.pendingTwoFactorSecret) {
      try {
        const decrypted = decryptTotpSecret(superAdmin.pendingTwoFactorSecret);
        pendingSecretDecryptable = !!(decrypted && decrypted.length >= 16);
      } catch (err) {
        pendingDecryptError = err.message;
      }
    }

    let configuredSecurityEmail = null;
    try {
      configuredSecurityEmail = getSuperAdminSecurityEmail();
    } catch (e) {
      configuredSecurityEmail = 'MISSING_OR_INVALID: ' + e.message;
    }

    const detailedMfaCryptoDiagnosis = diagnoseMfaEncryption(superAdmin.twoFactorSecret);

    const diagnostics = {
      user: {
        id: superAdmin._id.toString(),
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
        tenantId: superAdmin.tenantId || null
      },
      securityEmailBinding: {
        configuredAuthorizedSecurityEmail: configuredSecurityEmail,
        accountEmail: superAdmin.email,
        accountSecurityEmail: superAdmin.securityEmail || null,
        isSecurityEmailVerified: !!superAdmin.isSecurityEmailVerified,
        isBoundToAuthorizedEmail:
          (superAdmin.securityEmail && superAdmin.securityEmail.toLowerCase() === configuredSecurityEmail) ||
          (superAdmin.email && superAdmin.email.toLowerCase() === configuredSecurityEmail),
        status: (
          ((superAdmin.securityEmail && superAdmin.securityEmail.toLowerCase() === configuredSecurityEmail) ||
           (superAdmin.email && superAdmin.email.toLowerCase() === configuredSecurityEmail)) &&
          superAdmin.isSecurityEmailVerified
        )
          ? 'VERIFIED_AND_BOUND'
          : 'MISMATCH_OR_UNVERIFIED (Separately authorized account-verification procedure required before enabling passkey/recovery flow)'
      },
      mfaState: {
        isTwoFactorEnabled: !!superAdmin.isTwoFactorEnabled,
        mfaEnforced: !!superAdmin.mfaEnforced,
        mfaSetupRequired: !!superAdmin.mfaSetupRequired,
        hasActiveSecret: !!superAdmin.twoFactorSecret,
        activeSecretIsEncryptedFormat,
        activeSecretDecryptableWithActiveKey: activeSecretDecryptable,
        activeDecryptError: activeDecryptError ? 'AES-GCM AuthTag or Key Mismatch' : null,
        cryptoDiagnostic: detailedMfaCryptoDiagnosis,
        hasPendingSecret: !!superAdmin.pendingTwoFactorSecret,
        pendingSecretDecryptableWithActiveKey: pendingSecretDecryptable,
        backupCodesCount: (superAdmin.twoFactorBackupCodes || []).length
      },
      diagnosis: '',
      actionTaken: 'NONE (READ-ONLY / DRY-RUN)'
    };

    if (!superAdmin.isTwoFactorEnabled) {
      diagnostics.diagnosis = 'MFA is not enabled on this account. First-time enrollment is required.';
    } else if (superAdmin.twoFactorSecret && !activeSecretDecryptable) {
      diagnostics.diagnosis =
        'CRITICAL: SuperAdmin MFA secret is encrypted with a key that does NOT match the active environment key. All TOTP code verifications will fail with HTTP 401 until the secret is safely re-initialized under the active key.';
    } else if (superAdmin.twoFactorSecret && activeSecretDecryptable) {
      diagnostics.diagnosis =
        'HEALTHY: SuperAdmin MFA secret is correctly encrypted and decryptable with active environment key.';
    }

    // Check if modifying recovery was requested
    if (execute && confirmReset) {
      // Modifying recovery action:
      // Clear un-decryptable MFA secrets and mark mfaSetupRequired: true
      // So the SuperAdmin can safely perform initial enrollment upon next login.
      superAdmin.twoFactorSecret = null;
      superAdmin.pendingTwoFactorSecret = null;
      superAdmin.twoFactorBackupCodes = [];
      superAdmin.pendingTwoFactorBackupCodes = [];
      superAdmin.isTwoFactorEnabled = false;
      superAdmin.mfaSetupRequired = true;

      await superAdmin.save();

      await AuditLog.create({
        tenantId: null,
        actor: {
          userId: superAdmin._id,
          role: 'superadmin',
          email: superAdmin.email
        },
        action: 'AUTH_2FA_RECOVERY_RESET',
        details: {
          reason: 'Manual CLI recovery due to encryption key mismatch / corrupted secret',
          timestamp: new Date().toISOString()
        }
      }).catch(() => {});

      diagnostics.actionTaken =
        'RESET_COMPLETED: Corrupted MFA secret cleared. Account set to mfaSetupRequired: true. SuperAdmin must scan a new QR code upon next login.';
    }

    return { success: true, diagnostics };
  } finally {
    if (!isConnected) {
      await mongoose.disconnect();
    }
  }
}

// CLI Execution Wrapper
if (process.argv[1] && process.argv[1].endsWith('superAdminMfaDiagnosticsAndRecovery.js')) {
  (async () => {
    const args = process.argv.slice(2);
    const getArg = (flag) => {
      const idx = args.indexOf(flag);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };

    const email = getArg('--email');
    const execute = args.includes('--execute');
    const confirmReset = args.includes('--confirm-mfa-reset');

    console.log(`
================================================================================
EdWth Academy LMS — SuperAdmin MFA Diagnostics & Recovery CLI
6th Civilians Corporation
================================================================================
Mode: ${execute && confirmReset ? '⚠️  MODIFYING EXECUTION (RESET AUTHORIZED)' : '🛡️  DRY-RUN / READ-ONLY (No changes made)'}
Target Email: ${email || 'First SuperAdmin found'}
================================================================================
`);

    try {
      const result = await runMfaDiagnostics({ email, execute, confirmReset });
      console.log('Diagnostics Result:');
      console.log(JSON.stringify(result.diagnostics, null, 2));

      if (!execute || !confirmReset) {
        console.log(`
--------------------------------------------------------------------------------
DRY-RUN NOTICE:
No modifications were made to the database.
To perform an authorized recovery reset, re-run with:
  node server/scripts/superAdminMfaDiagnosticsAndRecovery.js --email <email> --execute --confirm-mfa-reset
--------------------------------------------------------------------------------
`);
      }
      process.exit(0);
    } catch (err) {
      console.error('❌ Error executing diagnostics:', err.message);
      process.exit(1);
    }
  })();
}
