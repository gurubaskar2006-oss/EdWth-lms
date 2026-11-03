/**
 * EdWth LMS — MFA Secret Encryption & Cryptographic Utilities
 * 6th Civilians Corporation
 *
 * Implements AES-256-GCM authenticated encryption at rest for TOTP secrets.
 * Features:
 * - Managed secret key configuration (MFA_ENCRYPTION_KEY or derived from JWT_SECRET)
 * - Safe backward compatibility with legacy unencrypted base32 secrets
 * - Never stores encryption keys in source code
 * - Tamper-resistant authenticated encryption (AES-256-GCM with 96-bit IV and 128-bit tag)
 */

import crypto from 'crypto';
import { getMfaEncryptionKey } from '../config/environment.js';

const CIPHER_ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

export { getMfaEncryptionKey };

/**
 * Check whether a secret string is already encrypted at rest.
 * @param {string} secret
 * @returns {boolean}
 */
export const isEncrypted = (secret) => {
  return typeof secret === 'string' && secret.startsWith(PREFIX);
};

/**
 * Encrypt a plaintext TOTP base32 secret using AES-256-GCM.
 * Formats output as: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 * Idempotent: If already encrypted, returns original string.
 *
 * @param {string} plaintextSecret
 * @returns {string} Encrypted secret
 */
export const encryptTotpSecret = (plaintextSecret) => {
  if (!plaintextSecret || typeof plaintextSecret !== 'string') {
    return plaintextSecret;
  }

  if (isEncrypted(plaintextSecret)) {
    return plaintextSecret;
  }

  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM standard
  const cipher = crypto.createCipheriv(CIPHER_ALGO, key, iv);

  let encrypted = cipher.update(plaintextSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt a TOTP secret.
 * Backward compatible: If string does not start with enc:v1:, assumes legacy unencrypted secret and returns as-is.
 *
 * @param {string} encryptedOrPlaintext
 * @returns {string} Plaintext base32 TOTP secret
 */
export const decryptTotpSecret = (encryptedOrPlaintext) => {
  if (!encryptedOrPlaintext || typeof encryptedOrPlaintext !== 'string') {
    return encryptedOrPlaintext;
  }

  if (!isEncrypted(encryptedOrPlaintext)) {
    // Backward compatibility: legacy plaintext base32 TOTP secret
    return encryptedOrPlaintext;
  }

  try {
    const withoutPrefix = encryptedOrPlaintext.slice(PREFIX.length);
    const parts = withoutPrefix.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted MFA secret structure');
    }

    const [ivHex, tagHex, cipherHex] = parts;
    const key = getMfaEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    if (iv.length !== 12 || authTag.length !== 16) {
      throw new Error('Invalid initialization vector or authentication tag length');
    }

    const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[mfaCrypto] Failed to decrypt TOTP secret:', err.message);
    throw new Error('MFA cryptographic verification failed: unable to decrypt TOTP secret.');
  }
};

/**
 * Safely diagnose the state of an encrypted TOTP secret without revealing keys or plaintext.
 * Distinguishes missing configuration, malformed ciphertext, invalid lengths, and auth-tag mismatch.
 *
 * @param {string} encryptedOrPlaintext
 * @returns {{ status: string, isEncrypted: boolean, message: string }}
 */
export const diagnoseMfaEncryption = (encryptedOrPlaintext) => {
  if (!encryptedOrPlaintext || typeof encryptedOrPlaintext !== 'string') {
    return {
      status: 'EMPTY_OR_INVALID',
      isEncrypted: false,
      message: 'Secret is null, empty, or not a string.'
    };
  }

  if (!isEncrypted(encryptedOrPlaintext)) {
    return {
      status: 'LEGACY_PLAINTEXT',
      isEncrypted: false,
      message: 'Secret is stored in legacy unencrypted base32 format.'
    };
  }

  const withoutPrefix = encryptedOrPlaintext.slice(PREFIX.length);
  const parts = withoutPrefix.split(':');
  if (parts.length !== 3) {
    return {
      status: 'MALFORMED_STRUCTURE',
      isEncrypted: true,
      message: 'Encrypted secret does not follow the enc:v1:<iv>:<tag>:<ciphertext> schema.'
    };
  }

  const [ivHex, tagHex, cipherHex] = parts;
  if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(tagHex) || !/^[0-9a-fA-F]+$/.test(cipherHex)) {
    return {
      status: 'INVALID_HEX_ENCODING',
      isEncrypted: true,
      message: 'Cryptographic components contain invalid non-hexadecimal characters.'
    };
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  if (iv.length !== 12) {
    return {
      status: 'INVALID_IV_LENGTH',
      isEncrypted: true,
      message: `Invalid IV length (${iv.length} bytes; expected 12 bytes / 96-bit).`
    };
  }

  if (authTag.length !== 16) {
    return {
      status: 'INVALID_AUTH_TAG_LENGTH',
      isEncrypted: true,
      message: `Invalid auth tag length (${authTag.length} bytes; expected 16 bytes / 128-bit).`
    };
  }

  let key;
  try {
    key = getMfaEncryptionKey();
  } catch (keyErr) {
    return {
      status: 'MISSING_CONFIGURATION',
      isEncrypted: true,
      message: 'Encryption key configuration is missing or invalid: ' + keyErr.message
    };
  }

  try {
    const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (decrypted && decrypted.length >= 16) {
      return {
        status: 'DECRYPTABLE_HEALTHY',
        isEncrypted: true,
        message: 'Secret is correctly encrypted and decryptable with active environment key.'
      };
    } else {
      return {
        status: 'DECRYPTED_PAYLOAD_UNEXPECTED',
        isEncrypted: true,
        message: 'Decryption succeeded but resulting payload length is below standard base32 seed.'
      };
    }
  } catch (cipherErr) {
    return {
      status: 'AUTH_TAG_OR_KEY_MISMATCH',
      isEncrypted: true,
      message: 'AES-256-GCM authentication tag mismatch or encryption key mismatch.'
    };
  }
};

export default {
  getMfaEncryptionKey,
  isEncrypted,
  encryptTotpSecret,
  decryptTotpSecret,
  diagnoseMfaEncryption
};
