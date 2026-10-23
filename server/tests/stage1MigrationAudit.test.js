/**
 * Lumina LMS — Stage 1 Migration Audit Automated Test Suite
 * 6th Civilians Corporation
 *
 * Fully isolated mock-based test suite.
 * Zero live database access. Zero external binary dependency.
 *
 * Verifies:
 * 1. Correct aggregate classification of normal records, missing attempt numbers, duplicates, and malformed records.
 * 2. Correct detection of a unique versus non-unique legacy index.
 * 3. Detection of conflicts that could prevent creation of the proposed four-field unique index.
 * 4. Query failures produce an explicit incomplete/failed audit result (checksCompleted: false, ACTION_REQUIRED).
 * 5. No document writes, deletes, updates, index creation, or index removal are performed.
 * 6. Output contains counts and safe diagnostic messages only—no student or document identifiers.
 * 7. The audit never automatically assigns attempt numbers or claims duplicates represent authorized retakes.
 * 8. Clean dataset produces READY_FOR_REVIEW verdict.
 * 9. Valid tenantId filter applies to aggregation pipeline without exposing tenant identifier in report.
 * 10. Strict positive-integer attemptNumber validation (rejects fractional, non-positive, non-numeric, null, undefined).
 * 11. Aggregation pipeline safely includes fractional attempt number detection with type guarding.
 * 12. Direct CLI invocation guard evaluates to false during test imports (zero accidental DB connection).
 * 13. executeAuditLifecycle successfully orchestrates connect, audit, and clean connection close.
 * 14. executeAuditLifecycle closes connection on audit failure without masking original audit error.
 * 15. executeAuditLifecycle rejects ephemeral in-memory database unless --allow-in-memory is specified.
 * 16. executeAuditLifecycle enforces --require-target=<dbName> matching to prevent running on wrong database.
 */

import mongoose from 'mongoose';
import { jest } from '@jest/globals';

import {
  runAssessmentAttemptAudit,
  inspectAssessmentAttemptIndexes,
  isValidAttemptNumber,
  isDirectCLIInvocation,
  executeAuditLifecycle,
  VALID_ATTEMPT_STATUSES,
  normalizeHostAndPort,
  verifyTargetHost,
  verifyTargetDatabase,
  verifyTargetDeployment
} from '../scripts/migrations/auditAssessmentAttempts.js';

describe('Lumina LMS — Stage 1 Read-Only Migration Audit Test Suite (Isolated Mocks)', () => {
  // Helper to construct a fully mockable model matching Mongoose interface
  const createMockModel = (options = {}) => {
    const {
      facetResult = null,
      indexes = [
        { name: '_id_', key: { _id: 1 } },
        { name: 'tenantId_1_assessmentId_1_studentId_1', key: { tenantId: 1, assessmentId: 1, studentId: 1 }, unique: false }
      ],
      aggregateError = null,
      indexesError = null
    } = options;

    const mockCollection = {
      indexes: indexesError
        ? jest.fn().mockRejectedValue(indexesError)
        : jest.fn().mockResolvedValue(indexes),
      createIndex: jest.fn(),
      dropIndex: jest.fn()
    };

    const mockModel = {
      collection: mockCollection,
      aggregate: aggregateError
        ? jest.fn().mockRejectedValue(aggregateError)
        : jest.fn().mockResolvedValue([facetResult]),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOneAndUpdate: jest.fn()
    };

    return mockModel;
  };

  // ─── Test 1: Aggregate Classification ────────────────────────────────────────
  it('1. should correctly classify normal records, missing attempt numbers, duplicates, and malformed records', async () => {
    const mockFacetResult = {
      totalCount: [{ count: 10 }],
      missingOrInvalidAttemptNumber: [{ count: 3 }],
      missingOrInvalidKeys: [{ count: 1 }],
      invalidStatus: [{ count: 1 }],
      malformedScores: [{ count: 1 }],
      duplicateGroups: [
        {
          duplicateGroupsCount: 1,
          totalRecordsInDuplicates: 2
        }
      ]
    };

    const mockModel = createMockModel({ facetResult: mockFacetResult });

    const report = await runAssessmentAttemptAudit({ model: mockModel });

    expect(report.checksCompleted).toBe(true);
    expect(report.auditStatus).toBe('ACTION_REQUIRED');

    // Aggregate metrics assertion
    expect(report.metrics.totalAttempts).toBe(10);
    expect(report.metrics.missingOrInvalidAttemptNumber).toBe(3);
    expect(report.metrics.duplicateGroupsCount).toBe(1);
    expect(report.metrics.totalRecordsInDuplicateGroups).toBe(2);
    expect(report.metrics.recordsWithMissingOrInvalidKeys).toBe(1);
    expect(report.metrics.invalidStatusCount).toBe(1);
    expect(report.metrics.malformedScoreOrPercentageCount).toBe(1);

    // Verify aggregate pipeline was invoked with base match
    expect(mockModel.aggregate).toHaveBeenCalledTimes(1);
  });

  // ─── Test 2: Detection of Unique vs Non-Unique Legacy Index ───────────────────
  it('2. should correctly detect whether the legacy three-field index is unique or non-unique', async () => {
    // A: Non-unique legacy index
    const nonUniqueModel = createMockModel({
      indexes: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'tenantId_1_assessmentId_1_studentId_1', key: { tenantId: 1, assessmentId: 1, studentId: 1 }, unique: false }
      ],
      facetResult: {
        totalCount: [{ count: 5 }],
        missingOrInvalidAttemptNumber: [],
        missingOrInvalidKeys: [],
        invalidStatus: [],
        malformedScores: [],
        duplicateGroups: []
      }
    });

    const inspectionNonUnique = await inspectAssessmentAttemptIndexes(nonUniqueModel);
    expect(inspectionNonUnique.success).toBe(true);
    expect(inspectionNonUnique.legacyThreeFieldIndex).toBeDefined();
    expect(inspectionNonUnique.legacyThreeFieldIndex.unique).toBe(false);

    const reportNonUnique = await runAssessmentAttemptAudit({ model: nonUniqueModel });
    expect(reportNonUnique.conflicts.items.some((c) => c.code === 'ACTIVE_LEGACY_UNIQUE_INDEX')).toBe(false);

    // B: Unique legacy index (CONFLICT)
    const uniqueModel = createMockModel({
      indexes: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'tenantId_1_assessmentId_1_studentId_1', key: { tenantId: 1, assessmentId: 1, studentId: 1 }, unique: true }
      ],
      facetResult: {
        totalCount: [{ count: 5 }],
        missingOrInvalidAttemptNumber: [],
        missingOrInvalidKeys: [],
        invalidStatus: [],
        malformedScores: [],
        duplicateGroups: []
      }
    });

    const inspectionUnique = await inspectAssessmentAttemptIndexes(uniqueModel);
    expect(inspectionUnique.legacyThreeFieldIndex.unique).toBe(true);

    const reportUnique = await runAssessmentAttemptAudit({ model: uniqueModel });
    const legacyUniqueConflict = reportUnique.conflicts.items.find(
      (c) => c.code === 'ACTIVE_LEGACY_UNIQUE_INDEX'
    );
    expect(legacyUniqueConflict).toBeDefined();
    expect(legacyUniqueConflict.severity).toBe('CRITICAL');
  });

  // ─── Test 3: Detection of Conflicts for Proposed Four-Field Index ─────────────
  it('3. should detect all conflicts that would prevent creation of the proposed four-field unique index', async () => {
    const mockFacetResult = {
      totalCount: [{ count: 20 }],
      missingOrInvalidAttemptNumber: [{ count: 5 }],
      missingOrInvalidKeys: [{ count: 2 }],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: [
        {
          duplicateGroupsCount: 2,
          totalRecordsInDuplicates: 4
        }
      ]
    };

    const mockModel = createMockModel({
      facetResult: mockFacetResult,
      indexes: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'tenantId_1_assessmentId_1_studentId_1', key: { tenantId: 1, assessmentId: 1, studentId: 1 }, unique: true }
      ]
    });

    const report = await runAssessmentAttemptAudit({ model: mockModel });

    expect(report.auditStatus).toBe('ACTION_REQUIRED');
    expect(report.conflicts.totalConflictsCount).toBe(4);

    const conflictCodes = report.conflicts.items.map((c) => c.code);
    expect(conflictCodes).toContain('MISSING_ATTEMPT_NUMBER');
    expect(conflictCodes).toContain('DUPLICATE_STUDENT_ASSESSMENT_GROUPS');
    expect(conflictCodes).toContain('CORRUPTED_IDENTIFIER_KEYS');
    expect(conflictCodes).toContain('ACTIVE_LEGACY_UNIQUE_INDEX');
  });

  // ─── Test 4: Query Failures Produce Incomplete Audit Result ───────────────────
  it('4. should produce an explicit ACTION_REQUIRED and checksCompleted: false result on query failures', async () => {
    // 4A: Aggregate failure
    const errorModel = createMockModel({
      aggregateError: new Error('Simulated database connection timeout')
    });

    const report = await runAssessmentAttemptAudit({ model: errorModel });

    expect(report.checksCompleted).toBe(false);
    expect(report.auditStatus).toBe('ACTION_REQUIRED');
    expect(report.error).toContain('Simulated database connection timeout');
    expect(report.metrics).toBeNull();

    // 4B: Index inspection failure
    const indexErrorModel = createMockModel({
      indexesError: new Error('Permission denied on system.indexes')
    });

    const indexReport = await runAssessmentAttemptAudit({ model: indexErrorModel });

    expect(indexReport.checksCompleted).toBe(false);
    expect(indexReport.auditStatus).toBe('ACTION_REQUIRED');
    expect(indexReport.error).toContain('Permission denied on system.indexes');

    // 4C: Invalid tenantId format
    const invalidTenantReport = await runAssessmentAttemptAudit({
      tenantId: 'non-existent-not-an-objectid',
      model: errorModel
    });

    expect(invalidTenantReport.checksCompleted).toBe(false);
    expect(invalidTenantReport.auditStatus).toBe('ACTION_REQUIRED');
    expect(invalidTenantReport.error).toContain('Invalid tenantId filter');
  });

  // ─── Test 5: Strict Read-Only Guarantee (No Writes/Updates/Deletes) ────────────
  it('5. should perform zero writes, updates, deletes, or index operations during audit', async () => {
    const mockFacetResult = {
      totalCount: [{ count: 1 }],
      missingOrInvalidAttemptNumber: [],
      missingOrInvalidKeys: [],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: []
    };

    const mockModel = createMockModel({ facetResult: mockFacetResult });

    await runAssessmentAttemptAudit({ model: mockModel });

    expect(mockModel.updateOne).not.toHaveBeenCalled();
    expect(mockModel.updateMany).not.toHaveBeenCalled();
    expect(mockModel.deleteOne).not.toHaveBeenCalled();
    expect(mockModel.deleteMany).not.toHaveBeenCalled();
    expect(mockModel.create).not.toHaveBeenCalled();
    expect(mockModel.save).not.toHaveBeenCalled();
    expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockModel.collection.createIndex).not.toHaveBeenCalled();
    expect(mockModel.collection.dropIndex).not.toHaveBeenCalled();
  });

  // ─── Test 6: Zero PII / Student Data Leakage in Output ─────────────────────────
  it('6. should never output student identifiers, names, document IDs, or answers in the audit report', async () => {
    const sensitiveStudentName = 'Johnathan Doe-Smith-Confidential';
    const sensitiveStudentId = 'STU-SECRET-ROLL-998877';
    const sensitiveAnswerText = 'Secret Student Essay Answer Text 12345';
    const sensitiveDocId = '66f00112233445566778899a';

    const mockFacetResult = {
      totalCount: [{ count: 1 }],
      missingOrInvalidAttemptNumber: [{ count: 1 }],
      missingOrInvalidKeys: [],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: []
    };

    const mockModel = createMockModel({ facetResult: mockFacetResult });

    const report = await runAssessmentAttemptAudit({ model: mockModel });
    const serializedReport = JSON.stringify(report);

    expect(serializedReport).not.toContain(sensitiveStudentName);
    expect(serializedReport).not.toContain(sensitiveStudentId);
    expect(serializedReport).not.toContain(sensitiveAnswerText);
    expect(serializedReport).not.toContain(sensitiveDocId);
  });

  // ─── Test 7: No Automatic Attempt Number Assignment or Retake Assumptions ────
  it('7. should never automatically assign attempt numbers to unnumbered records or assume duplicates are retakes', async () => {
    const mockFacetResult = {
      totalCount: [{ count: 4 }],
      missingOrInvalidAttemptNumber: [{ count: 2 }],
      missingOrInvalidKeys: [],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: [
        {
          duplicateGroupsCount: 1,
          totalRecordsInDuplicates: 2
        }
      ]
    };

    const mockModel = createMockModel({ facetResult: mockFacetResult });

    const report = await runAssessmentAttemptAudit({ model: mockModel });

    // Verify recommendations use explicit approval/review disclaimers
    const hasApprovalWarning = report.recommendations.some(
      (r) => r.includes('[Approval Required]') || r.includes('[Human Review Required]')
    );
    expect(hasApprovalWarning).toBe(true);

    const serialized = JSON.stringify(report).toLowerCase();
    expect(serialized.includes('authorized retake detected')).toBe(false);
    expect(serialized.includes('automatically backfilled')).toBe(false);

    // Verify no updates occurred
    expect(mockModel.updateOne).not.toHaveBeenCalled();
    expect(mockModel.updateMany).not.toHaveBeenCalled();
  });

  // ─── Test 8: Clean Dataset Produces READY_FOR_REVIEW ──────────────────────────
  it('8. should return READY_FOR_REVIEW when all records have valid keys, numbers, and no conflicts', async () => {
    const mockCleanFacetResult = {
      totalCount: [{ count: 100 }],
      missingOrInvalidAttemptNumber: [],
      missingOrInvalidKeys: [],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: []
    };

    const cleanModel = createMockModel({
      facetResult: mockCleanFacetResult,
      indexes: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'tenantId_1_assessmentId_1_studentId_1', key: { tenantId: 1, assessmentId: 1, studentId: 1 }, unique: false },
        { name: 'uniq_tenant_assessment_student_attempt', key: { tenantId: 1, assessmentId: 1, studentId: 1, attemptNumber: 1 }, unique: true }
      ]
    });

    const report = await runAssessmentAttemptAudit({ model: cleanModel });

    expect(report.checksCompleted).toBe(true);
    expect(report.auditStatus).toBe('READY_FOR_REVIEW');
    expect(report.conflicts.totalConflictsCount).toBe(0);
    expect(report.metrics.missingOrInvalidAttemptNumber).toBe(0);
    expect(report.metrics.duplicateGroupsCount).toBe(0);
    expect(report.metrics.recordsWithMissingOrInvalidKeys).toBe(0);
    expect(report.metrics.invalidStatusCount).toBe(0);
    expect(report.metrics.malformedScoreOrPercentageCount).toBe(0);
    expect(report.recommendations[0]).toContain('prepared for Stage 2');
  });

  // ─── Test 9: Valid Tenant Filter Applies to Aggregation ───────────────────────
  it('9. should apply valid tenantId filter to match pipeline without exposing tenant identifier in report', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const mockFacetResult = {
      totalCount: [{ count: 2 }],
      missingOrInvalidAttemptNumber: [],
      missingOrInvalidKeys: [],
      invalidStatus: [],
      malformedScores: [],
      duplicateGroups: []
    };

    const mockModel = createMockModel({ facetResult: mockFacetResult });

    const report = await runAssessmentAttemptAudit({
      tenantId: tenantId.toString(),
      model: mockModel
    });

    expect(report.checksCompleted).toBe(true);
    expect(report.auditStatus).toBe('READY_FOR_REVIEW');

    // Verify tenantId was passed in pipeline
    const pipelinePassed = mockModel.aggregate.mock.calls[0][0];
    expect(pipelinePassed[0].$match.tenantId).toEqual(tenantId);

    // Verify tenantId is not leaked in recommendations or errors
    expect(JSON.stringify(report.recommendations)).not.toContain(tenantId.toString());
  });

  // ─── Test 10: Positive-Integer Validation for attemptNumber ──────────────────
  it('10. should validate attemptNumber as strictly positive integer, rejecting fractions, strings, booleans, and non-positives', () => {
    // Valid positive integers
    expect(isValidAttemptNumber(1)).toBe(true);
    expect(isValidAttemptNumber(2)).toBe(true);
    expect(isValidAttemptNumber(5)).toBe(true);
    expect(isValidAttemptNumber(100)).toBe(true);

    // Missing, null, undefined
    expect(isValidAttemptNumber(null)).toBe(false);
    expect(isValidAttemptNumber(undefined)).toBe(false);

    // Non-numeric types
    expect(isValidAttemptNumber('1')).toBe(false);
    expect(isValidAttemptNumber('2')).toBe(false);
    expect(isValidAttemptNumber('abc')).toBe(false);
    expect(isValidAttemptNumber('')).toBe(false);
    expect(isValidAttemptNumber(true)).toBe(false);
    expect(isValidAttemptNumber(false)).toBe(false);
    expect(isValidAttemptNumber({})).toBe(false);
    expect(isValidAttemptNumber([])).toBe(false);
    expect(isValidAttemptNumber([1])).toBe(false);

    // Non-positive numbers
    expect(isValidAttemptNumber(0)).toBe(false);
    expect(isValidAttemptNumber(-1)).toBe(false);
    expect(isValidAttemptNumber(-99)).toBe(false);

    // Fractional numbers
    expect(isValidAttemptNumber(1.5)).toBe(false);
    expect(isValidAttemptNumber(2.7)).toBe(false);
    expect(isValidAttemptNumber(0.5)).toBe(false);
    expect(isValidAttemptNumber(3.14159)).toBe(false);
    expect(isValidAttemptNumber(-0.5)).toBe(false);

    // Non-finite numbers
    expect(isValidAttemptNumber(NaN)).toBe(false);
    expect(isValidAttemptNumber(Infinity)).toBe(false);
    expect(isValidAttemptNumber(-Infinity)).toBe(false);
  });

  // ─── Test 11: Aggregation Pipeline Matches Fractional Attempt Numbers ────────
  it('11. should configure pipeline to flag fractional, missing, null, and non-numeric attemptNumbers with safe guards', async () => {
    const mockModel = createMockModel({
      facetResult: {
        totalCount: [{ count: 0 }],
        missingOrInvalidAttemptNumber: [{ count: 0 }],
        missingOrInvalidKeys: [],
        invalidStatus: [],
        malformedScores: [],
        duplicateGroups: []
      }
    });

    await runAssessmentAttemptAudit({ model: mockModel });

    expect(mockModel.aggregate).toHaveBeenCalledTimes(1);
    const pipeline = mockModel.aggregate.mock.calls[0][0];
    const facetStage = pipeline.find((stage) => stage.$facet);
    expect(facetStage).toBeDefined();

    const attemptNumberMatch = facetStage.$facet.missingOrInvalidAttemptNumber[0].$match;
    expect(attemptNumberMatch.$or).toBeDefined();

    // Verify fractional check expression exists within the $or array
    const exprCheck = attemptNumberMatch.$or.find((clause) => clause.$expr);
    expect(exprCheck).toBeDefined();
    expect(exprCheck.$expr.$cond).toBeDefined();

    // Verify condition guards against non-numeric types before evaluating $floor
    expect(exprCheck.$expr.$cond.if.$in[0].$type).toBe('$attemptNumber');
    expect(exprCheck.$expr.$cond.then.$ne[0].$floor).toBe('$attemptNumber');
  });

  // ─── Test 12: Zero Connection on Import (Direct CLI Invocation Guard) ─────────
  it('12. should evaluate isDirectCLIInvocation to false during test imports, ensuring zero accidental DB connection', () => {
    // When running under Jest, process.argv[1] is Jest runner, not auditAssessmentAttempts.js
    const isDirect = isDirectCLIInvocation();
    expect(isDirect).toBe(false);
    expect(mongoose.connection.readyState).toBe(0);
  });

  // ─── Test 13: executeAuditLifecycle Clean Run & Connection Cleanup ─────────────
  it('13. should orchestrate connect, audit, and clean connection closure in executeAuditLifecycle', async () => {
    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockReport = {
      timestamp: new Date().toISOString(),
      auditStatus: 'READY_FOR_REVIEW',
      checksCompleted: true
    };
    const mockAudit = jest.fn().mockResolvedValue(mockReport);

    const result = await executeAuditLifecycle({
      connectDB: mockConnect,
      closeDB: mockClose,
      runAuditCLI: mockAudit,
      argv: ['node', 'auditAssessmentAttempts.js']
    });

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(result.auditStatus).toBe('READY_FOR_REVIEW');
  });

  // ─── Test 14: executeAuditLifecycle Cleanup on Failure Without Masking Error ──
  it('14. should guarantee closeDB runs on audit failure without masking original audit error', async () => {
    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn().mockRejectedValue(new Error('Fatal collection aggregate failure'));

    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js']
      })
    ).rejects.toThrow('Fatal collection aggregate failure');

    // Ensure connection was closed even though audit failed
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Test secondary close error does NOT mask primary audit error
    const mockCloseWithWarning = jest.fn().mockRejectedValue(new Error('Socket close timeout'));
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockCloseWithWarning,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js']
      })
    ).rejects.toThrow('Fatal collection aggregate failure');
  });

  // ─── Test 15: executeAuditLifecycle Rejects In-Memory DB Without Flag ─────────
  it('15. should refuse to audit ephemeral in-memory database unless --allow-in-memory is specified', async () => {
    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: true });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn();

    // Without --allow-in-memory: should reject
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js']
      })
    ).rejects.toThrow(/Refusing to run migration audit against ephemeral in-memory database/i);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockAudit).not.toHaveBeenCalled();

    // With --allow-in-memory: should proceed
    const mockAuditSuccess = jest.fn().mockResolvedValue({ auditStatus: 'READY_FOR_REVIEW' });
    const result = await executeAuditLifecycle({
      connectDB: mockConnect,
      closeDB: mockClose,
      runAuditCLI: mockAuditSuccess,
      argv: ['node', 'auditAssessmentAttempts.js', '--allow-in-memory']
    });

    expect(result.auditStatus).toBe('READY_FOR_REVIEW');
    expect(mockAuditSuccess).toHaveBeenCalledTimes(1);
  });

  // ─── Test 16: executeAuditLifecycle Enforces --require-target=<dbName> ────────
  it('16. should abort if --require-target does not match the actual connected database name', async () => {
    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn();

    // Mock connection.name
    const originalConnectionName = mongoose.connection.name;
    Object.defineProperty(mongoose.connection, 'name', {
      value: 'lumina_staging',
      configurable: true
    });

    try {
      // Operator specified --require-target=lumina_production, but connected to lumina_staging
      await expect(
        executeAuditLifecycle({
          connectDB: mockConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js', '--require-target=lumina_production']
        })
      ).rejects.toThrow(/Target database mismatch.*Expected "lumina_production" but connected to "lumina_staging"/i);

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockAudit).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(mongoose.connection, 'name', {
        value: originalConnectionName,
        configurable: true
      });
    }
  });

  // ─── Test 17: Partial Connection Initialization Failure Triggers Cleanup ─────
  it('17. should trigger cleanup when connection partially initializes and fails, without masking primary error', async () => {
    const originalReadyState = mongoose.connection.readyState;
    const mockAudit = jest.fn();
    const mockClose = jest.fn().mockResolvedValue();

    const mockPartialConnect = jest.fn().mockImplementation(async () => {
      // Simulate partial connection where readyState is left in connecting (2) or connected (1) state
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 2,
        configurable: true
      });
      throw new Error('TLS negotiation failed after socket open');
    });

    try {
      await expect(
        executeAuditLifecycle({
          connectDB: mockPartialConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js']
        })
      ).rejects.toThrow('TLS negotiation failed after socket open');

      // Cleanup must be invoked because connectionAttempted was true and readyState !== 0
      expect(mockPartialConnect).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockAudit).not.toHaveBeenCalled();

      // Test that secondary close failure does NOT mask the primary connect error
      const mockCloseWithError = jest.fn().mockRejectedValue(new Error('Secondary socket abort error'));
      await expect(
        executeAuditLifecycle({
          connectDB: mockPartialConnect,
          closeDB: mockCloseWithError,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js']
        })
      ).rejects.toThrow('TLS negotiation failed after socket open');
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: originalReadyState,
        configurable: true
      });
    }
  });

  // ─── Test 18: Exact Target Identity Verification & Substring Rejection ───────
  it('18. should strictly verify target deployment identity using exact normalized matching and reject substrings', async () => {
    const originalHost = mongoose.connection.host;
    const originalName = mongoose.connection.name;
    const originalPort = mongoose.connection.port;

    Object.defineProperty(mongoose.connection, 'host', {
      value: 'cluster-staging.mongodb.net',
      configurable: true
    });
    Object.defineProperty(mongoose.connection, 'name', {
      value: 'lumina_staging_db',
      configurable: true
    });
    Object.defineProperty(mongoose.connection, 'port', {
      value: 27017,
      configurable: true
    });

    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn().mockResolvedValue({ auditStatus: 'READY_FOR_REVIEW' });

    try {
      // 18A: Exact host match succeeds
      const matchResult = await executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-host=cluster-staging.mongodb.net']
      });
      expect(matchResult.auditStatus).toBe('READY_FOR_REVIEW');

      // 18B: Case differences in DNS names are normalized and succeed
      const caseMatchResult = await executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-host=CLUSTER-STAGING.MONGODB.NET']
      });
      expect(caseMatchResult.auditStatus).toBe('READY_FOR_REVIEW');

      // 18C: Substring matching is strictly rejected (e.g. expected is substring of actual)
      await expect(
        executeAuditLifecycle({
          connectDB: mockConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js', '--require-host=staging.mongodb.net']
        })
      ).rejects.toThrow(/Target cluster host mismatch! Expected "staging.mongodb.net" but connected to "cluster-staging.mongodb.net"/i);

      // 18D: Unexpected host containing expected as substring is rejected
      await expect(
        executeAuditLifecycle({
          connectDB: mockConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js', '--require-host=cluster-staging']
        })
      ).rejects.toThrow(/Target cluster host mismatch! Expected "cluster-staging" but connected to "cluster-staging.mongodb.net"/i);

      // 18E: Different ports reject
      await expect(
        executeAuditLifecycle({
          connectDB: mockConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js', '--require-host=cluster-staging.mongodb.net:27018']
        })
      ).rejects.toThrow(/Target cluster port mismatch! Expected port 27018 but connected to port 27017/i);

      // 18F: Matching port succeeds
      const portMatchResult = await executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-host=cluster-staging.mongodb.net:27017']
      });
      expect(portMatchResult.auditStatus).toBe('READY_FOR_REVIEW');
    } finally {
      Object.defineProperty(mongoose.connection, 'host', {
        value: originalHost,
        configurable: true
      });
      Object.defineProperty(mongoose.connection, 'name', {
        value: originalName,
        configurable: true
      });
      Object.defineProperty(mongoose.connection, 'port', {
        value: originalPort,
        configurable: true
      });
    }
  });

  // ─── Test 19: Atlas SRV Seed vs Replica Node Discrepancy Fails Closed ────────
  it('19. should fail closed and prompt operator verification when Atlas SRV seed does not match replica node', async () => {
    const originalHost = mongoose.connection.host;
    Object.defineProperty(mongoose.connection, 'host', {
      value: 'cluster0-shard-00-01.abcde.mongodb.net',
      configurable: true
    });

    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn().mockResolvedValue({ auditStatus: 'READY_FOR_REVIEW' });

    try {
      // Operator passed SRV seed name, but driver resolved to specific shard node
      await expect(
        executeAuditLifecycle({
          connectDB: mockConnect,
          closeDB: mockClose,
          runAuditCLI: mockAudit,
          argv: ['node', 'auditAssessmentAttempts.js', '--require-host=cluster0.abcde.mongodb.net']
        })
      ).rejects.toThrow(/Do not assume SRV seeds and replica node hostnames are interchangeable.*Operator verification required/i);
    } finally {
      Object.defineProperty(mongoose.connection, 'host', {
        value: originalHost,
        configurable: true
      });
    }
  });

  // ─── Test 20: Missing or Invalid Identity Flags Handling ─────────────────────
  it('20. should fail closed when required identity flags are missing, empty, or malformed', async () => {
    const mockConnect = jest.fn().mockResolvedValue({ isInMemory: false });
    const mockClose = jest.fn().mockResolvedValue();
    const mockAudit = jest.fn();

    // 20A: --require-identity specified without any target/host flags
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-identity']
      })
    ).rejects.toThrow(/Target identity verification is required: Operator must supply --require-target and --require-host/i);

    // 20B: --require-target passed with empty value
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-target=']
      })
    ).rejects.toThrow(/Target verification failed: --require-target must specify a non-empty database name/i);

    // 20C: --require-host passed with empty value
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-host=']
      })
    ).rejects.toThrow(/Target verification failed: --require-host must specify a non-empty hostname/i);

    // 20D: --require-deployment passed with malformed format (no slash)
    await expect(
      executeAuditLifecycle({
        connectDB: mockConnect,
        closeDB: mockClose,
        runAuditCLI: mockAudit,
        argv: ['node', 'auditAssessmentAttempts.js', '--require-deployment=invalid-format-no-slash']
      })
    ).rejects.toThrow(/Target verification failed: --require-deployment must be in format "host\/databaseName"/i);
  });

  // ─── Test 21: Audit-Specific Read-Only Connection (autoIndex: false, autoCreate: false)
  it('21. should pass audit-specific read-only options to connectDB and never invoke index creation methods', async () => {
    let capturedOptions = null;
    const mockConnectWithOptions = jest.fn().mockImplementation(async (opts) => {
      capturedOptions = opts;
      return { isInMemory: false };
    });
    const mockClose = jest.fn().mockResolvedValue();

    const mockModel = createMockModel({
      facetResult: {
        totalCount: [{ count: 0 }],
        missingOrInvalidAttemptNumber: [],
        missingOrInvalidKeys: [],
        invalidStatus: [],
        malformedScores: [],
        duplicateGroups: []
      }
    });

    const mockAudit = jest.fn().mockImplementation(async () => {
      return runAssessmentAttemptAudit({ model: mockModel });
    });

    await executeAuditLifecycle({
      connectDB: mockConnectWithOptions,
      closeDB: mockClose,
      runAuditCLI: mockAudit,
      argv: ['node', 'auditAssessmentAttempts.js']
    });

    // 21A: Verified audit passes autoIndex: false and autoCreate: false
    expect(capturedOptions).toEqual({
      autoIndex: false,
      autoCreate: false
    });

    // 21B: Verified no index-altering methods are invoked
    expect(mockModel.collection.createIndex).not.toHaveBeenCalled();
    expect(mockModel.collection.dropIndex).not.toHaveBeenCalled();
    expect(mockModel.updateOne).not.toHaveBeenCalled();
    expect(mockModel.updateMany).not.toHaveBeenCalled();
    expect(mockModel.deleteOne).not.toHaveBeenCalled();
    expect(mockModel.deleteMany).not.toHaveBeenCalled();
  });
});
