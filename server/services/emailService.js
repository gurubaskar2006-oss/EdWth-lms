/**
 * EdWth LMS — Secure Email Delivery Service
 * 6th Civilians Corporation
 *
 * Operational & Security Constraints:
 * 1. Sole authorized destination for SuperAdmin security flows:
 *    Validated SUPERADMIN_SECURITY_EMAIL (thesixthcivilians26@gmail.com).
 *    Strictly throws error if any other recipient is passed for SuperAdmin operations.
 * 2. Never accepts replacement recipients from frontend requests.
 * 3. Never logs plaintext OTP codes, private keys, or passwords.
 * 4. Fails closed with descriptive code ('EMAIL_PROVIDER_NOT_CONFIGURED') when SMTP
 *    credentials are not set; NEVER falsely reports simulated delivery as real delivery in dev/staging/prod.
 * 5. Dynamic configuration resolution: reads process.env at dispatch time.
 * 6. Verifies outbound mail transfer agent (MTA) acceptance: checks info.accepted.
 */

import nodemailer from 'nodemailer';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';
import { isProduction } from '../config/environment.js';

// In-memory store for unit test inspection and verification
export const testEmailDispatchLog = [];

/**
 * Validates that the target recipient matches the authorized SuperAdmin security mailbox.
 * Fails closed if mismatched.
 *
 * @param {string} recipientEmail
 */
export const assertAuthorizedSuperAdminRecipient = (recipientEmail) => {
  const authorized = getSuperAdminSecurityEmail();
  const normalized = (recipientEmail || '').trim().toLowerCase();

  if (!normalized || normalized !== authorized) {
    const errorMsg = `SECURITY VIOLATION: Attempted to dispatch SuperAdmin security message to unauthorized email ("${normalized}"). Messages are restricted exclusively to authorized security mailbox: ${authorized}`;
    console.error(`[emailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }
};

/**
 * Resolves current SMTP configuration dynamically from process.env.
 * Supports hot reloading of environment variables without server restart.
 *
 * @returns {{ host: string|undefined, port: number, user: string|undefined, pass: string|undefined, secure: boolean, from: string }}
 */
export const getEmailConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT?.trim() || '587', 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.SMTP_FROM?.trim() || (user ? `EdWth LMS Security <${user}>` : 'EdWth LMS Security <security@6thcivilians.org>');

  return { host, port, user, pass, secure, from };
};

/**
 * Returns true if an outbound SMTP provider has been configured with host, user, and password.
 *
 * @returns {boolean}
 */
export const isEmailConfigured = () => {
  const { host, user, pass } = getEmailConfig();
  return Boolean(host && user && pass);
};

/**
 * Returns safe metadata about the email delivery provider configuration.
 * Never leaks passwords or private keys.
 *
 * @returns {object} Sanitized provider status
 */
export const getEmailDeliveryStatus = () => {
  const config = getEmailConfig();
  const configured = isEmailConfigured();

  let maskedUser = null;
  if (config.user) {
    const parts = config.user.split('@');
    if (parts.length === 2) {
      const local = parts[0];
      const domain = parts[1];
      const visible = local.length > 3 ? local.slice(0, 3) : local.slice(0, 1);
      maskedUser = `${visible}***@${domain}`;
    } else {
      maskedUser = '***';
    }
  }

  return {
    configured,
    provider: config.host || (process.env.NODE_ENV === 'test' ? 'in-memory-test' : 'unconfigured'),
    host: config.host || null,
    port: config.host ? config.port : null,
    secure: config.secure,
    senderEmail: maskedUser,
    fromAddress: config.from,
    authorizedSecurityEmail: getSuperAdminSecurityEmail(),
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Creates or retrieves active Nodemailer transport based on environment configuration.
 *
 * @returns {object|null} Nodemailer transporter or null if unconfigured (test mock in test env)
 */
export const getTransporter = () => {
  // If running in automated Jest test suite (NODE_ENV=test), use the isolated in-memory test store
  if (process.env.NODE_ENV === 'test') {
    return {
      sendMail: async (options) => {
        testEmailDispatchLog.push({
          to: options.to,
          from: options.from,
          subject: options.subject,
          text: options.text,
          html: options.html,
          timestamp: new Date().toISOString()
        });
        return {
          messageId: `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          accepted: [options.to],
          rejected: [],
          response: '250 2.0.0 OK (test-mode-transport)'
        };
      },
      verify: async () => true
    };
  }

  const { host, port, user, pass, secure } = getEmailConfig();
  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

/**
 * Verifies the SMTP connection and authentication with the remote mail server.
 * Never throws uncaught exceptions; returns status object.
 *
 * @returns {Promise<{ verified: boolean, message: string, code?: string }>}
 */
export const verifyEmailTransporter = async () => {
  if (!isEmailConfigured()) {
    return {
      verified: false,
      message: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured in server/.env.',
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED'
    };
  }

  try {
    const transporter = getTransporter();
    if (!transporter) {
      return {
        verified: false,
        message: 'Could not initialize SMTP transport.',
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED'
      };
    }

    await transporter.verify();
    return { verified: true, message: 'SMTP mail transfer agent connection verified successfully.' };
  } catch (err) {
    return {
      verified: false,
      message: `SMTP connection verification failed: ${err.message}`,
      code: err.code || 'SMTP_CONNECTION_ERROR'
    };
  }
};

/**
 * Dispatches an OTP verification email to the authorized SuperAdmin mailbox.
 * Fails closed if provider is unconfigured or if MTA rejects message.
 *
 * @param {string} recipient - Must match authorized SuperAdmin security mailbox
 * @param {{ code: string, purpose: string, expiresMinutes: number }} options
 * @returns {Promise<{ success: boolean, messageId: string, accepted: string[], response: string }>}
 */
export const sendSuperAdminOtp = async (recipient, { code, purpose = 'authentication', expiresMinutes = 5 }) => {
  assertAuthorizedSuperAdminRecipient(recipient);

  const transporter = getTransporter();
  const config = getEmailConfig();

  if (!transporter) {
    const error = new Error(
      `Outbound email delivery is not configured. Real verification messages cannot be sent to "${recipient}" until SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are added to server/.env.`
    );
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    console.warn(`[emailService] ${error.message}`);
    throw error;
  }

  const subject = `[EdWth Security] SuperAdmin Verification Code: ${purpose.replace(/_/g, ' ').toUpperCase()}`;
  const text = `
EdWth Academy LMS — SuperAdmin Security Verification
6th Civilians Corporation

Your single-use verification code is: ${code}

This code will expire in ${expiresMinutes} minutes.
Purpose: ${purpose}

If you did not request this verification code, immediate security review is required.
Do not share this code with anyone.
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #0f172a; margin-top: 0;">EdWth Academy LMS — SuperAdmin Verification</h2>
  <p style="color: #475569; font-size: 14px;">6th Civilians Corporation Security Operations</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #1e293b; font-size: 16px;">Use the single-use code below to complete your privileged verification:</p>
  <div style="background-color: #f8fafc; border: 2px dashed #0284c7; padding: 16px; text-align: center; border-radius: 6px; margin: 20px 0;">
    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0369a1; font-family: monospace;">${code}</span>
  </div>
  <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
  <p style="color: #64748b; font-size: 13px;">Purpose: <code>${purpose}</code></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #ef4444; font-size: 12px; margin-bottom: 0;">
    <strong>Security Alert:</strong> If you did not initiate this request, your administrative credentials may be compromised.
  </p>
</div>
`;

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: recipient,
      subject,
      text,
      html
    });

    // Check if recipient was actually accepted by mail server
    if (info.rejected && info.rejected.includes(recipient)) {
      const rejectErr = new Error(`Outbound mail transfer agent rejected recipient: ${recipient}`);
      rejectErr.code = 'EMAIL_RECIPIENT_REJECTED';
      throw rejectErr;
    }

    if (info.accepted && !info.accepted.includes(recipient)) {
      const unconfirmedErr = new Error(`Outbound mail transfer agent did not confirm recipient acceptance: ${recipient}`);
      unconfirmedErr.code = 'EMAIL_DELIVERY_UNCONFIRMED';
      throw unconfirmedErr;
    }

    console.log(`[emailService] Verification email dispatched successfully to ${recipient} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response
    };
  } catch (err) {
    if (err.code === 'EMAIL_RECIPIENT_REJECTED' || err.code === 'EMAIL_DELIVERY_UNCONFIRMED') {
      throw err;
    }
    const safeError = new Error(`Outbound email dispatch failed: ${err.message || 'SMTP connection error'}`);
    safeError.code = err.code || 'SMTP_DISPATCH_FAILURE';
    console.error(`[emailService] Dispatch failure to ${recipient}: ${err.message} (Code: ${safeError.code})`);
    throw safeError;
  }
};

/**
 * Dispatches a passkey registration, removal, or account recovery security notification.
 *
 * @param {string} recipient
 * @param {{ action: 'registered' | 'removed' | 'recovered', deviceLabel: string, ip?: string, timestamp?: Date }} options
 */
export const sendPasskeySecurityNotification = async (recipient, { action, deviceLabel, ip = 'Unknown', timestamp = new Date() }) => {
  assertAuthorizedSuperAdminRecipient(recipient);

  const transporter = getTransporter();
  const config = getEmailConfig();

  if (!transporter) {
    console.warn(`[emailService] Outbound email provider not configured. Skipping passkey security notification to ${recipient}.`);
    return { success: false, reason: 'unconfigured' };
  }

  const isRecovered = action === 'recovered';
  const isAdded = action === 'registered';
  const subject = isRecovered
    ? '[Security Alert] SuperAdmin Account Recovered & Sessions Revoked'
    : `[Security Alert] Passkey ${isAdded ? 'Registered' : 'Removed'} on SuperAdmin Account`;

  const text = isRecovered
    ? `
EdWth Academy LMS — SuperAdmin Account Recovery Notice
6th Civilians Corporation

A replacement passkey was successfully registered via self-service account recovery.
All prior active sessions have been revoked for your security.

New Device: ${deviceLabel}
Time: ${timestamp.toISOString()}
IP Address: ${ip}

If this recovery was not performed by you, contact platform infrastructure security immediately.
`
    : `
EdWth Academy LMS — Passkey Security Notice
6th Civilians Corporation

A passkey was ${action.toUpperCase()} on your SuperAdmin account.
Device: ${deviceLabel}
Time: ${timestamp.toISOString()}
IP Address: ${ip}

If this was not done by you, take immediate action to secure your account and revoke affected credentials.
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #0f172a; margin-top: 0;">${isRecovered ? 'SuperAdmin Account Recovered & Prior Sessions Revoked' : `SuperAdmin Passkey ${isAdded ? 'Registered' : 'Removed'}`}</h2>
  <p style="color: #475569; font-size: 14px;">6th Civilians Corporation Platform Security Alert</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #1e293b;">${isRecovered ? 'A replacement passkey was registered through self-service recovery. All prior active sessions have been terminated.' : 'The following WebAuthn passkey modification was made on your administrator account:'}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
    <tr><td style="padding: 8px; color: #64748b;">Action:</td><td style="padding: 8px; font-weight: bold; color: ${isAdded || isRecovered ? '#10b981' : '#ef4444'};">${action.toUpperCase()}</td></tr>
    <tr><td style="padding: 8px; color: #64748b;">Device Label:</td><td style="padding: 8px; font-weight: bold;">${deviceLabel}</td></tr>
    <tr><td style="padding: 8px; color: #64748b;">Timestamp:</td><td style="padding: 8px;">${timestamp.toISOString()}</td></tr>
    <tr><td style="padding: 8px; color: #64748b;">Originating IP:</td><td style="padding: 8px;">${ip}</td></tr>
  </table>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
    If you did not authorize this change, please immediately review registered authenticators and notify platform governance.
  </p>
</div>
`;

  try {
    return await transporter.sendMail({
      from: config.from,
      to: recipient,
      subject,
      text,
      html
    });
  } catch (err) {
    console.warn(`[emailService] Passkey notification send error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Dispatches an account recovery link to the authorized SuperAdmin mailbox.
 * Fails closed if email provider is unconfigured.
 *
 * @param {string} recipient
 * @param {{ recoveryUrl: string, expiresMinutes: number }} options
 */
export const sendRecoveryLink = async (recipient, { recoveryUrl, expiresMinutes = 15 }) => {
  assertAuthorizedSuperAdminRecipient(recipient);

  const transporter = getTransporter();
  const config = getEmailConfig();

  if (!transporter) {
    const error = new Error(
      `Outbound email delivery is not configured. Real recovery link cannot be sent to "${recipient}" until SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are added to server/.env.`
    );
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    console.warn(`[emailService] ${error.message}`);
    throw error;
  }

  const subject = '[Critical Security] EdWth SuperAdmin Passkey Recovery';
  const text = `
EdWth Academy LMS — SuperAdmin Account Recovery
6th Civilians Corporation

A passkey recovery request was initiated for your SuperAdmin account.
Use the following single-use link to begin restricted recovery:
${recoveryUrl}

This link is valid for ${expiresMinutes} minutes and can only be used once.
If you did not initiate this recovery request, your account may be under targeting. Take immediate defensive measures.
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #b91c1c; margin-top: 0;">SuperAdmin Passkey Recovery</h2>
  <p style="color: #475569; font-size: 14px;">6th Civilians Corporation Security Operations</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #1e293b;">A request was received to recover passkey access for the SuperAdmin account.</p>
  <p style="color: #1e293b;">Click the button below to proceed to the secure recovery session:</p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="${recoveryUrl}" style="background-color: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      Access Restricted Recovery
    </a>
  </div>
  <p style="color: #64748b; font-size: 12px;">Link valid for ${expiresMinutes} minutes. Single-use only.</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="color: #ef4444; font-size: 12px; margin-bottom: 0;">
    <strong>Warning:</strong> Recovery creates a restricted session. It does NOT automatically reset existing credentials or bypass security verification.
  </p>
</div>
`;

  return await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject,
    text,
    html
  });
};

export default {
  sendSuperAdminOtp,
  sendPasskeySecurityNotification,
  sendRecoveryLink,
  assertAuthorizedSuperAdminRecipient,
  getEmailConfig,
  isEmailConfigured,
  getEmailDeliveryStatus,
  verifyEmailTransporter,
  testEmailDispatchLog
};
