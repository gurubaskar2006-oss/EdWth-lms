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

export default {
  getMfaEncryptionKey,
  isEncrypted,
  encryptTotpSecret,
  decryptTotpSecret
};
