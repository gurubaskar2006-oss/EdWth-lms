/**
 * Lumina LMS — Database & CRUD Error Handler
 * 6th Civilians Corporation
 *
 * Normalizes MongoDB and Mongoose errors into consistent HTTP responses.
 * Converts duplicate key violations (E11000) into HTTP 409 Conflict.
 * Converts schema validation failures into HTTP 400 Bad Request.
 */

export const handleDatabaseError = (err, res, defaultMsg = 'An unexpected database error occurred.') => {
  // 1. Duplicate Key Violation (E11000)
  if (err.code === 11000 || (err.message && err.message.includes('E11000 duplicate key error'))) {
    const keys = err.keyPattern ? Object.keys(err.keyPattern) : [];
    const keyVals = err.keyValue || {};
    
    let field = keys.length > 0 ? keys.join(', ') : 'unique field';
    let valDesc = '';
    if (Object.keys(keyVals).length > 0) {
      valDesc = ` (${JSON.stringify(keyVals)})`;
    }

    // Clean field name for human-readable output
    if (field === 'tenantId, email') field = 'email address';
    else if (field === 'tenantId, studentId') field = 'student/trainer identifier';
    else if (field === 'tenantId, name') field = 'cohort/batch name';
    else if (field === 'tenantId, code') field = 'course/institution code';
    else if (field === 'tenantId, id') field = 'record identifier';
    else if (field === 'tenantId, assignmentId, studentId') field = 'assignment submission';

    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_KEY_CONFLICT',
      message: `A record with this ${field} already exists${valDesc}. Duplicate records are prohibited.`,
      conflictFields: keys,
      conflictValues: keyVals
    });
  }

  // 2. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = {};
    if (err.errors) {
      for (const [key, val] of Object.entries(err.errors)) {
        errors[key] = val.message;
      }
    }
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: Object.values(errors).join('; ') || err.message,
      errors
    });
  }

  // 3. Mongoose Cast Error (Invalid ObjectId / Type)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_IDENTIFIER_FORMAT',
      message: `Invalid format for field "${err.path}".`,
      path: err.path,
      value: err.value
    });
  }

  // 4. Default / Internal Server Error
  console.error('[DatabaseError]', err);
  return res.status(500).json({
    success: false,
    code: 'DATABASE_OPERATION_FAILED',
    message: defaultMsg || err.message || 'Operation failed due to an unexpected error.'
  });
};

export default handleDatabaseError;

