/**
 * Lumina LMS — Security Boundary Request Sanitization Middleware
 * 6th Civilians Corporation
 *
 * Enforces fail-closed validation on incoming request paths before router matching.
 * Rejects malformed, ambiguous, or malicious URL encoding at the network boundary:
 *   - Null bytes (%00, \0)
 *   - Malformed percent escapes (% not followed by two hex digits)
 *   - Double-encoded characters (%25 followed by hex for separators/dots/null)
 *   - Encoded path separators (%2F, %5C)
 *   - Encoded dot segments (%2E)
 *   - Directory traversal (/../, /.., backslashes)
 *   - Duplicate slashes (//+)
 */

export const validateBoundaryRequest = (req, res, next) => {
  const rawUrl = req.originalUrl || req.url || '';
  const pathPart = rawUrl.split('?')[0].split('#')[0];

  // 1. Check for null bytes
  if (rawUrl.includes('\0') || /%00/i.test(rawUrl)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PATH', message: 'Null bytes in request URL are prohibited.' }
    });
  }

  // 2. Check for malformed percent escapes (% not followed by two hex digits)
  if (/%(?![0-9a-fA-F]{2})/i.test(rawUrl)) {
    return res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_URI', message: 'Malformed percent-encoded URI escape sequence.' }
    });
  }

  // 3. Check for double encoding (e.g. %25 followed by hex for separators/dots/null)
  if (/%25(?:2f|5c|2e|00)/i.test(rawUrl)) {
    return res.status(400).json({
      success: false,
      error: { code: 'AMBIGUOUS_ENCODING', message: 'Double-encoded path characters are prohibited.' }
    });
  }

  // 4. Check for encoded path separators (%2f or %5c) in the path portion
  if (/%2f|%5c/i.test(pathPart)) {
    return res.status(400).json({
      success: false,
      error: { code: 'AMBIGUOUS_PATH_SEPARATOR', message: 'Encoded path separators (%2F, %5C) are prohibited.' }
    });
  }

  // 5. Check for encoded dot segments (%2e%2e or %2e) in the path portion
  if (/%2e/i.test(pathPart)) {
    return res.status(400).json({
      success: false,
      error: { code: 'AMBIGUOUS_PATH', message: 'Encoded dot segments (%2E) are prohibited.' }
    });
  }

  // 6. Check for directory traversal sequences (/../, /.., or backslashes)
  if (/(?:^|\/)\.\.(?:\/|$)/.test(pathPart) || /\\/.test(pathPart)) {
    return res.status(400).json({
      success: false,
      error: { code: 'PATH_TRAVERSAL_DETECTED', message: 'Path traversal sequences are prohibited.' }
    });
  }

  // 7. Check for duplicate slashes in request path
  if (/\/{2,}/.test(pathPart)) {
    return res.status(400).json({
      success: false,
      error: { code: 'AMBIGUOUS_PATH', message: 'Duplicate slashes in request path are prohibited.' }
    });
  }

  next();
};

export default validateBoundaryRequest;
