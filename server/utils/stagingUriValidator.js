/**
 * Lumina LMS — Structured Staging Database URI & Environment Validator
 * 6th Civilians Corporation
 *
 * Strict whitelist validator for MongoDB connection strings and runtime configuration in staging.
 * NOTE: This is a dedicated staging security guard, not a general-purpose RFC-compliant URI parser.
 * It enforces that staging backend processes can ONLY connect to local loopback (127.0.0.1 or localhost)
 * on the designated staging port (27018), permanently blocking accidental Atlas / remote connections.
 */

export const ALLOWED_STAGING_HOSTS = new Set(['127.0.0.1', 'localhost']);
export const DEFAULT_STAGING_PORT = 27018;
export const DEFAULT_STAGING_APP_PORT = '5001';

/**
 * Validates a MongoDB URI for staging environments using structured parsing.
 *
 * @param {string} uri - The candidate MongoDB connection string.
 * @param {number|string} [expectedPort=27018] - The mandated staging MongoDB port.
 * @returns {{ valid: boolean, reason?: string, hosts?: string[], database?: string }}
 */
export function validateStagingMongoUri(uri, expectedPort = DEFAULT_STAGING_PORT) {
  if (typeof uri !== 'string' || !uri.trim()) {
    return { valid: false, reason: 'URI must be a non-empty string' };
  }

  // Validate expectedPort argument
  const expectedPortNum = Number(expectedPort);
  if (
    !Number.isInteger(expectedPortNum) ||
    expectedPortNum < 1 ||
    expectedPortNum > 65535
  ) {
    return {
      valid: false,
      reason: `Configuration error: expectedPort must be an integer between 1 and 65535 (received: ${expectedPort})`
    };
  }
  const expectedPortStr = String(expectedPortNum);

  const trimmed = uri.trim();

  // 1. Prohibit backslashes anywhere in the URI
  if (trimmed.includes('\\')) {
    return {
      valid: false,
      reason: 'Malformed URI: backslashes ("\\") are strictly prohibited.'
    };
  }

  // 2. Strict protocol enforcement (SRV and alternative schemes are strictly forbidden)
  if (!trimmed.startsWith('mongodb://')) {
    if (trimmed.startsWith('mongodb+srv://')) {
      return {
        valid: false,
        reason: 'Atlas SRV protocol (mongodb+srv://) is strictly prohibited in staging. Only local mongodb:// is permitted.'
      };
    }
    return {
      valid: false,
      reason: 'Protocol must be mongodb://. Remote or alternative protocols are strictly prohibited.'
    };
  }

  // 3. Strip protocol
  let remainder = trimmed.slice('mongodb://'.length);

  // Prohibit nested schemes/protocols (e.g. mongodb://http://...)
  if (remainder.includes('://')) {
    return {
      valid: false,
      reason: 'Malformed URI: nested protocols or schemes ("://") are prohibited.'
    };
  }

  // 4. Split authority component from path/query component
  // In a MongoDB URI, the authority ends at the first '/' or '?'
  const authEndIndex = remainder.search(/[/?]/);
  let authority = '';
  let pathAndQuery = '';

  if (authEndIndex === -1) {
    authority = remainder;
    pathAndQuery = '';
  } else {
    authority = remainder.slice(0, authEndIndex);
    pathAndQuery = remainder.slice(authEndIndex);
  }

  if (!authority.trim()) {
    return { valid: false, reason: 'No host authority found in connection string' };
  }

  // 5. Separate and validate credentials if present
  let hostListString = authority;
  if (authority.includes('@')) {
    const atMatches = authority.match(/@/g);
    if (atMatches && atMatches.length > 1) {
      return {
        valid: false,
        reason: 'Malformed credentials: multiple "@" characters detected. Unencoded "@" in credentials is prohibited.'
      };
    }

    const atIndex = authority.indexOf('@');
    const userInfo = authority.slice(0, atIndex);
    hostListString = authority.slice(atIndex + 1);

    if (!userInfo || !userInfo.trim()) {
      return {
        valid: false,
        reason: 'Malformed URI: empty credentials preceding "@"'
      };
    }

    // Credentials must not contain whitespace or control characters
    if (/[\s\x00-\x1f\x7f]/.test(userInfo)) {
      return {
        valid: false,
        reason: 'Malformed credentials: whitespace and control characters are prohibited.'
      };
    }

    // Username cannot be empty if colon is present (e.g. ":password@")
    if (userInfo.startsWith(':')) {
      return {
        valid: false,
        reason: 'Malformed credentials: username cannot be empty.'
      };
    }
  }

  // 6. Host list cannot be empty
  if (!hostListString || !hostListString.trim()) {
    return { valid: false, reason: 'No host entries found in connection string' };
  }

  // 7. Parse path and query (database name & options)
  let databaseName = '';
  if (pathAndQuery.startsWith('/')) {
    let pathPart = pathAndQuery.slice(1);
    const qIndex = pathPart.indexOf('?');
    if (qIndex !== -1) {
      pathPart = pathPart.slice(0, qIndex);
    }
    databaseName = pathPart;

    // Database names cannot contain additional slashes
    if (databaseName.includes('/')) {
      return {
        valid: false,
        reason: `Malformed database path "/${databaseName}": path slashes inside database name are prohibited.`
      };
    }
  }

  // 8. Structured host:port validation for every single host in replica set
  const hostEntries = hostListString.split(',');
  if (hostEntries.length === 0) {
    return { valid: false, reason: 'No host entries found in connection string' };
  }

  const validatedHosts = [];

  for (const entry of hostEntries) {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) {
      return { valid: false, reason: 'Empty host entry in comma-separated list' };
    }

    // Reject whitespace within host entry
    if (/\s/.test(trimmedEntry)) {
      return { valid: false, reason: `Malformed host entry "${trimmedEntry}": spaces are prohibited.` };
    }

    // Explicit rejection of IPv6 brackets or addresses
    if (trimmedEntry.includes('[') || trimmedEntry.includes(']')) {
      return {
        valid: false,
        reason: `IPv6 addresses (e.g. "${trimmedEntry}") are not permitted in staging. Only IPv4 "127.0.0.1" and hostname "localhost" are allowed.`
      };
    }

    // Check for multiple colons indicating unbracketed IPv6
    const colonCount = (trimmedEntry.match(/:/g) || []).length;
    if (colonCount > 1) {
      return {
        valid: false,
        reason: `IPv6 addresses (e.g. "${trimmedEntry}") are not permitted in staging. Only IPv4 "127.0.0.1" and hostname "localhost" are allowed.`
      };
    }

    if (colonCount === 0) {
      return {
        valid: false,
        reason: `Host entry "${trimmedEntry}" is missing an explicit port. Explicit port :${expectedPortStr} is required.`
      };
    }

    const colonIndex = trimmedEntry.lastIndexOf(':');
    const host = trimmedEntry.slice(0, colonIndex).toLowerCase().trim();
    const port = trimmedEntry.slice(colonIndex + 1).trim();

    // Host validation: must be exactly 127.0.0.1 or localhost
    if (!ALLOWED_STAGING_HOSTS.has(host)) {
      return {
        valid: false,
        reason: `Forbidden host "${host}". Staging is strictly restricted to 127.0.0.1 or localhost.`
      };
    }

    // Port validation: must be digits only
    if (!port || !/^\d+$/.test(port)) {
      return {
        valid: false,
        reason: `Malformed port "${port}". Port must be a valid numeric integer.`
      };
    }

    // Check for invalid leading zeros (e.g. 027018 or 00)
    if (port.length > 1 && port.startsWith('0')) {
      return {
        valid: false,
        reason: `Malformed port "${port}": leading zeros are prohibited.`
      };
    }

    const portNum = Number(port);
    if (portNum < 1 || portNum > 65535) {
      return {
        valid: false,
        reason: `Port "${port}" is out of valid range (1-65535).`
      };
    }

    // Port validation: must match mandated staging port
    if (port !== expectedPortStr) {
      return {
        valid: false,
        reason: `Forbidden port "${port}". Staging is strictly restricted to port ${expectedPortStr}.`
      };
    }

    validatedHosts.push(`${host}:${port}`);
  }

  return {
    valid: true,
    hosts: validatedHosts,
    database: databaseName || undefined
  };
}

/**
 * Validates the complete staging environment configuration.
 * Used by the staging backend launcher and health checks to ensure fail-closed isolation.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @param {{ expectedPort?: number, expectedAppPort?: string }} [options]
 * @returns {{ valid: boolean, reason?: string, hosts?: string[], database?: string, port?: string, env?: string }}
 */
export function validateStagingEnvironmentConfig(env = process.env, options = {}) {
  const expectedPort = options.expectedPort || DEFAULT_STAGING_PORT;
  const expectedAppPort = options.expectedAppPort || DEFAULT_STAGING_APP_PORT;

  // 1. Fail-closed check for required variables
  const requiredVars = ['MONGO_URI', 'PORT', 'JWT_SECRET', 'NODE_ENV'];
  for (const varName of requiredVars) {
    if (!env[varName] || !String(env[varName]).trim()) {
      return {
        valid: false,
        reason: `Required staging variable "${varName}" is missing from configuration.`
      };
    }
  }

  // 2. Strict NODE_ENV check
  if (env.NODE_ENV !== 'staging') {
    return {
      valid: false,
      reason: `NODE_ENV must be strictly "staging" (found: "${env.NODE_ENV}"). Refusing to run in non-staging mode.`
    };
  }

  // 3. Strict Application PORT check
  if (String(env.PORT).trim() !== String(expectedAppPort).trim()) {
    return {
      valid: false,
      reason: `PORT must be strictly "${expectedAppPort}" for staging (found: "${env.PORT}").`
    };
  }

  // 4. Strict Database URI validation
  const uriValidation = validateStagingMongoUri(env.MONGO_URI, expectedPort);
  if (!uriValidation.valid) {
    return {
      valid: false,
      reason: `Staging database URI rejected: ${uriValidation.reason}`
    };
  }

  return {
    valid: true,
    hosts: uriValidation.hosts,
    database: uriValidation.database,
    port: String(env.PORT).trim(),
    env: env.NODE_ENV
  };
}

export default {
  validateStagingMongoUri,
  validateStagingEnvironmentConfig,
  ALLOWED_STAGING_HOSTS,
  DEFAULT_STAGING_PORT,
  DEFAULT_STAGING_APP_PORT
};
