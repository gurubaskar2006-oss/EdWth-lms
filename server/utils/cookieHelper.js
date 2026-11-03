/**
 * Lumina LMS — Unified Cookie Security Helper
 * 6th Civilians Corporation
 *
 * Ensures consistent cookie attributes across login, 2FA verification,
 * and logout. Prevents browser cookie clearing mismatches in production.
 */

import { isProduction } from '../config/environment.js';

export const getAuthCookieOptions = (timeoutMinutes = null) => {
  const prod = isProduction();
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  const maxAge = timeoutMinutes
    ? Number(timeoutMinutes) * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000; // default 30 days if not dynamically provided

  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? sameSite : 'lax',
    domain: prod && process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined,
    path: '/',
    maxAge
  };
};

export const setAuthCookie = (res, token, timeoutMinutes = null) => {
  if (typeof res?.cookie === 'function') {
    res.cookie('jwt', token, getAuthCookieOptions(timeoutMinutes));
  }
};

export const clearAuthCookie = (res) => {
  if (typeof res?.cookie === 'function') {
    const options = getAuthCookieOptions();
    delete options.maxAge;
    res.cookie('jwt', '', {
      ...options,
      expires: new Date(0)
    });
  }
};

export default {
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie
};
