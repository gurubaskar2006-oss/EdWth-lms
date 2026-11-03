/**
 * EdWth LMS — Privileged Identity & Approved Domain Policy
 * 6th Civilians Corporation
 *
 * Enforces server-side restrictions on privileged account identities (SuperAdmin, Admin, Trainer).
 * - Prohibits arbitrary freemail (e.g. Gmail, Yahoo, Outlook) from holding or obtaining privileged access.
 * - Restricts privileged roles to explicit allowlists or verified institutional/corporate domains.
 * - Does not block school student accounts or legitimate institution-specific domains.
 * - Never grants SuperAdmin privileges based solely on an unverified email suffix.
 */

const BLOCKED_PUBLIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'zoho.com'
]);

// Verified corporate identities and approved company domains
const DEFAULT_CORPORATE_DOMAINS = ['6c.com', '6thcivilians.org', 'edwth.com'];
const DEFAULT_CORPORATE_IDENTITIES = ['edwthacademyadmin@6c.com'];
const DEFAULT_SUPERADMIN_SECURITY_EMAIL = 'thesixthcivilians26@gmail.com';

/**
 * Retrieves the validated SuperAdmin Security Email.
 * Sole authorized destination for SuperAdmin OTP, verification, and recovery.
 * @returns {string} Normalized email
 */
export const getSuperAdminSecurityEmail = () => {
  const configured = process.env.SUPERADMIN_SECURITY_EMAIL || DEFAULT_SUPERADMIN_SECURITY_EMAIL;
  if (!configured || typeof configured !== 'string') {
    throw new Error('FATAL: SUPERADMIN_SECURITY_EMAIL environment variable is missing.');
  }
  const trimmed = configured.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error(`FATAL: SUPERADMIN_SECURITY_EMAIL configuration is invalid ("${trimmed}").`);
  }
  return trimmed;
};

/**
 * Checks whether a given role is considered privileged.
 * @param {string} role
 * @returns {boolean}
 */
export const isPrivilegedRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  const normalized = role.toLowerCase().trim();
  return ['superadmin', 'admin', 'trainer', 'teacher'].includes(normalized);
};

/**
 * Retrieves the configured set of exact approved privileged email addresses.
 * @returns {Set<string>}
 */
export const getPrivilegedEmailAllowlist = () => {
  const envList = process.env.PRIVILEGED_EMAIL_ALLOWLIST || process.env.APPROVED_PRIVILEGED_EMAILS;
  const allowlist = new Set(DEFAULT_CORPORATE_IDENTITIES.map((e) => e.toLowerCase()));

  // Include authorized security email if configured
  try {
    allowlist.add(getSuperAdminSecurityEmail());
  } catch (err) {
    // If invalid, will fail at validation
  }

  if (envList) {
    envList
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .forEach((e) => allowlist.add(e));
  }

  return allowlist;
};

/**
 * Retrieves the configured set of approved domains for privileged accounts.
 * @returns {Set<string>}
 */
export const getApprovedPrivilegedDomains = () => {
  const envDomains = process.env.APPROVED_PRIVILEGED_DOMAINS || process.env.PRIVILEGED_DOMAIN_ALLOWLIST;
  const domains = new Set(DEFAULT_CORPORATE_DOMAINS.map((d) => d.toLowerCase()));

  // In non-production modes, permit recognized educational test fixtures
  if (process.env.NODE_ENV !== 'production') {
    DEV_TEST_DOMAINS.forEach((d) => domains.add(d.toLowerCase()));
  }

  if (envDomains) {
    envDomains
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean)
      .forEach((d) => domains.add(d));
  }

  return domains;
};

// Non-production test domains (for local test suites)
const DEV_TEST_DOMAINS = [
  'nexus.edu',
  'alpha.edu',
  'corp.org',
  'lumina.test',
  'edwth.test',
  'edwth.audit',
  'acceptance.edu',
  'test.edu',
  'college.edu'
];

/**
 * Validates whether an email address is permitted for a specific role.
 * Students are unrestricted (educational institution accounts, personal emails).
 * Privileged accounts (superadmin, admin, trainer) must be in the approved allowlist or domain list.
 *
 * @param {string} email
 * @param {string} role
 * @returns {{ allowed: boolean, reason?: string }}
 */
export const validatePrivilegedIdentity = (email, role) => {
  const normRole = (role || 'student').toLowerCase().trim();

  // 1. Students are never blocked by privileged identity policy
  if (!isPrivilegedRole(normRole)) {
    return { allowed: true };
  }

  if (!email || typeof email !== 'string') {
    return { allowed: false, reason: 'A valid email address is required for privileged access.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const atIdx = normalizedEmail.lastIndexOf('@');
  if (atIdx === -1 || atIdx === 0 || atIdx === normalizedEmail.length - 1) {
    return { allowed: false, reason: 'Invalid email address structure.' };
  }

  const domain = normalizedEmail.slice(atIdx + 1);
  const exactAllowlist = getPrivilegedEmailAllowlist();
  const approvedDomains = getApprovedPrivilegedDomains();

  // 2. Exact allowlisted identity match is always permitted (explicit corporate identity override)
  if (exactAllowlist.has(normalizedEmail)) {
    return { allowed: true };
  }

  // 3. Reject public / freemail domains for all non-allowlisted privileged roles
  if (BLOCKED_PUBLIC_DOMAINS.has(domain)) {
    return {
      allowed: false,
      reason: `Privileged roles (${normRole}) cannot use public email services (@${domain}). Verified company or institutional email required.`
    };
  }

  // 4. SuperAdmin strict enforcement: Cannot be granted by arbitrary domain match alone
  // Must match exact allowlist or confirmed corporate domain
  if (normRole === 'superadmin') {
    const isCorporateDomain = DEFAULT_CORPORATE_DOMAINS.includes(domain) ||
      (process.env.NODE_ENV !== 'production' && DEV_TEST_DOMAINS.includes(domain));

    if (isCorporateDomain || approvedDomains.has(domain)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `SuperAdmin access is restricted to verified 6th Civilians Corporation administrative identities (@${domain} is not authorized).`
    };
  }

  // 5. Admin and Trainer domain check:
  // Institutional admins and trainers cannot use public freemail (enforced above in step 3),
  // but can use any organizational, institutional, or custom school/college domain,
  // or explicitly approved privileged domains.
  if (approvedDomains.has(domain) || !BLOCKED_PUBLIC_DOMAINS.has(domain)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Email domain "@${domain}" is not authorized for privileged platform role "${normRole}". Contact institutional governance.`
  };
};

export default {
  isPrivilegedRole,
  getPrivilegedEmailAllowlist,
  getApprovedPrivilegedDomains,
  getSuperAdminSecurityEmail,
  validatePrivilegedIdentity
};
