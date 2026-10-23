/**
 * Lumina LMS — Stage 1 Read-Only Assessment Attempt Migration Audit
 * 6th Civilians Corporation
 *
 * NON-DESTRUCTIVE / READ-ONLY UTILITY ONLY.
 * Performs zero database mutations (no writes, updates, deletes, drops, or index operations).
 * Produces aggregate counts and readiness diagnostics only.
 * Never outputs sensitive credentials, tokens, student identifiers, or document IDs.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import AssessmentAttempt from '../../models/AssessmentAttempt.js';

export const VALID_ATTEMPT_STATUSES = Object.freeze([
  'scheduled',
  'in_progress',
  'submitted',
  'evaluated',
  'missed',
  'disqualified',
  'result_published'
]);

/**
 * Validates whether a value is a strictly positive integer (1, 2, 3...)
 * Rejects missing, null, strings, booleans, objects, arrays, zero, negative,
 * and fractional numbers such as 1.5.
 *
 * @param {*} val Value to inspect
 * @returns {boolean} True only if val is a positive integer >= 1
 */
export const isValidAttemptNumber = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (!Number.isInteger(val)) return false;
  return val >= 1;
};

/**
 * Normalizes index key comparison to detect compound key matches
 */
const matchesCompoundKey = (indexKey, expectedFields) => {
  if (!indexKey || typeof indexKey !== 'object') return false;
  const fields = Object.keys(indexKey);
  if (fields.length !== expectedFields.length) return false;
  return expectedFields.every((field, idx) => fields[idx] === field);
};

/**
 * Inspects database index metadata for AssessmentAttempt collection
 * Strictly read-only: calls collection.indexes(). Does not create or drop indexes.
 */
export const inspectAssessmentAttemptIndexes = async (model = AssessmentAttempt) => {
  try {
    if (!model?.collection?.indexes) {
      return {
        success: false,
        error: 'Model collection is not initialized or indexes function unavailable.',
        indexes: []
      };
    }

    const rawIndexes = await model.collection.indexes();
    const indexes = rawIndexes.map((idx) => ({
      name: idx.name || 'unnamed',
      key: idx.key || {},
      unique: Boolean(idx.unique),
      sparse: Boolean(idx.sparse),
      background: Boolean(idx.background)
    }));

    const legacyThreeFieldIndex = indexes.find((idx) =>
      matchesCompoundKey(idx.key, ['tenantId', 'assessmentId', 'studentId'])
    ) || null;

    const proposedFourFieldIndex = indexes.find((idx) =>
      matchesCompoundKey(idx.key, ['tenantId', 'assessmentId', 'studentId', 'attemptNumber'])
    ) || null;

    return {
      success: true,
      totalIndexesCount: indexes.length,
      indexes,
      legacyThreeFieldIndex: legacyThreeFieldIndex
        ? {
            name: legacyThreeFieldIndex.name,
            key: legacyThreeFieldIndex.key,
            unique: legacyThreeFieldIndex.unique
          }
        : null,
      proposedFourFieldIndex: proposedFourFieldIndex
        ? {
            name: proposedFourFieldIndex.name,
            key: proposedFourFieldIndex.key,
            unique: proposedFourFieldIndex.unique
          }
        : null
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to inspect index metadata: ${err.message}`,
      indexes: []
    };
  }
};

/**
 * Runs the complete read-only migration audit against AssessmentAttempt records.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} [options.tenantId] Optional tenant filter
 * @param {mongoose.Model} [options.model] Optional model override for testing/fixtures
 * @returns {Promise<Object>} Aggregate audit report
 */
export const runAssessmentAttemptAudit = async (options = {}) => {
  const { tenantId = null, model = AssessmentAttempt } = options;

  // Validate optional tenant filter safely without exposing raw payload
  let tenantFilter = {};
  if (tenantId !== null && tenantId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return {
        timestamp: new Date().toISOString(),
        auditStatus: 'ACTION_REQUIRED',
        checksCompleted: false,
        error: 'Invalid tenantId filter provided. Must be a valid ObjectId representation.',
        metrics: null,
        indexReadiness: null,
        conflicts: null,
        recommendations: [
          'Correct the tenant filter before re-running migration audit.'
        ]
      };
    }
    tenantFilter = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  }

  try {
    // 1. Inspect Indexes (Read-only metadata)
    const indexInspection = await inspectAssessmentAttemptIndexes(model);
    if (!indexInspection.success) {
      return {
        timestamp: new Date().toISOString(),
        auditStatus: 'ACTION_REQUIRED',
        checksCompleted: false,
        error: indexInspection.error,
        metrics: null,
        indexReadiness: null,
        conflicts: null,
        recommendations: [
          'Verify MongoDB connectivity and ensure collection metadata can be read.'
        ]
      };
    }

    // 2. Aggregate Data Metrics (Read-only aggregation)
    const baseMatch = { ...tenantFilter };

    const aggregationPipeline = [
      { $match: baseMatch },
      {
        $facet: {
          totalCount: [{ $count: 'count' }],

          missingOrInvalidAttemptNumber: [
            {
              $match: {
                $or: [
                  // Missing or explicit null
                  { attemptNumber: { $exists: false } },
                  { attemptNumber: null },
                  // Non-numeric types (strings, booleans, arrays, objects)
                  { attemptNumber: { $not: { $type: 'number' } } },
                  // Non-positive numbers (0, negative)
                  { attemptNumber: { $lt: 1 } },
                  // Fractional numbers (e.g. 1.5, 2.7) - safely evaluated only on numeric types
                  {
                    $expr: {
                      $cond: {
                        if: {
                          $in: [
                            { $type: '$attemptNumber' },
                            ['int', 'long', 'double', 'decimal']
                          ]
                        },
                        then: { $ne: [{ $floor: '$attemptNumber' }, '$attemptNumber'] },
                        else: false
                      }
                    }
                  }
                ]
              }
            },
            { $count: 'count' }
          ],

          missingOrInvalidKeys: [
            {
              $match: {
                $or: [
                  { tenantId: { $exists: false } },
                  { tenantId: null },
                  { tenantId: { $not: { $type: 'objectId' } } },
                  { studentId: { $exists: false } },
                  { studentId: null },
                  { studentId: { $not: { $type: 'objectId' } } },
                  { assessmentId: { $exists: false } },
                  { assessmentId: null },
                  { assessmentId: '' }
                ]
              }
            },
            { $count: 'count' }
          ],

          invalidStatus: [
            {
              $match: {
                $or: [
                  { status: { $exists: false } },
                  { status: null },
                  { status: { $nin: VALID_ATTEMPT_STATUSES } }
                ]
              }
            },
            { $count: 'count' }
          ],

          malformedScores: [
            {
              $match: {
                $or: [
                  // Non-null, non-numeric or negative score
                  {
                    $and: [
                      { score: { $exists: true, $ne: null } },
                      {
                        $or: [
                          { score: { $not: { $type: 'number' } } },
                          { score: { $lt: 0 } }
                        ]
                      }
                    ]
                  },
                  // Non-null, non-numeric or out-of-bounds percentage
                  {
                    $and: [
                      { percentage: { $exists: true, $ne: null } },
                      {
                        $or: [
                          { percentage: { $not: { $type: 'number' } } },
                          { percentage: { $lt: 0 } },
                          { percentage: { $gt: 100 } }
                        ]
                      }
                    ]
                  }
                ]
              }
            },
            { $count: 'count' }
          ],

          duplicateGroups: [
            {
              $group: {
                _id: {
                  tenantId: '$tenantId',
                  assessmentId: '$assessmentId',
                  studentId: '$studentId'
                },
                count: { $sum: 1 }
              }
            },
            { $match: { count: { $gt: 1 } } },
            {
              $group: {
                _id: null,
                duplicateGroupsCount: { $sum: 1 },
                totalRecordsInDuplicates: { $sum: '$count' }
              }
            }
          ]
        }
      }
    ];

    const [facetResults] = await model.aggregate(aggregationPipeline);

    const totalAttempts = facetResults?.totalCount[0]?.count || 0;
    const missingOrInvalidAttemptNumber =
      facetResults?.missingOrInvalidAttemptNumber[0]?.count || 0;
    const recordsWithMissingOrInvalidKeys =
      facetResults?.missingOrInvalidKeys[0]?.count || 0;
    const invalidStatusCount = facetResults?.invalidStatus[0]?.count || 0;
    const malformedScoreOrPercentageCount =
      facetResults?.malformedScores[0]?.count || 0;

    const dupGroupSummary = facetResults?.duplicateGroups[0] || {};
    const duplicateGroupsCount = dupGroupSummary.duplicateGroupsCount || 0;
    const totalRecordsInDuplicateGroups =
      dupGroupSummary.totalRecordsInDuplicates || 0;

    // Any records with combined critical defects not classified elsewhere
    const unclassifiedRecordsCount =
      recordsWithMissingOrInvalidKeys > 0 && invalidStatusCount > 0
        ? Math.min(recordsWithMissingOrInvalidKeys, invalidStatusCount)
        : 0;

    // 3. Conflict Analysis with Proposed Four-Field Unique Index
    // Proposed Key: { tenantId: 1, assessmentId: 1, studentId: 1, attemptNumber: 1 }
    const conflicts = [];

    if (missingOrInvalidAttemptNumber > 0) {
      conflicts.push({
        code: 'MISSING_ATTEMPT_NUMBER',
        description: `${missingOrInvalidAttemptNumber} record(s) lack a valid positive-integer attemptNumber. In MongoDB, unique indexes index missing fields as null, causing duplicate key collision on creation.`,
        severity: 'CRITICAL',
        affectedCount: missingOrInvalidAttemptNumber
      });
    }

    if (duplicateGroupsCount > 0) {
      conflicts.push({
        code: 'DUPLICATE_STUDENT_ASSESSMENT_GROUPS',
        description: `${duplicateGroupsCount} group(s) containing ${totalRecordsInDuplicateGroups} record(s) share identical (tenantId, assessmentId, studentId). If records within a group have identical or null attemptNumbers, unique index creation will fail with E11000.`,
        severity: 'CRITICAL',
        affectedCount: totalRecordsInDuplicateGroups
      });
    }

    if (recordsWithMissingOrInvalidKeys > 0) {
      conflicts.push({
        code: 'CORRUPTED_IDENTIFIER_KEYS',
        description: `${recordsWithMissingOrInvalidKeys} record(s) have missing, null, or invalid tenant/assessment/student identifiers.`,
        severity: 'HIGH',
        affectedCount: recordsWithMissingOrInvalidKeys
      });
    }

    if (indexInspection.legacyThreeFieldIndex?.unique) {
      conflicts.push({
        code: 'ACTIVE_LEGACY_UNIQUE_INDEX',
        description: 'The legacy three-field index { tenantId, assessmentId, studentId } is currently marked UNIQUE in database metadata. This will reject any authorized Attempt #2 even if the four-field index is deployed.',
        severity: 'CRITICAL',
        affectedCount: 0
      });
    }

    // 4. Overall Audit Status Determination
    // ACTION_REQUIRED if any defects or conflicts exist; READY_FOR_REVIEW only if clean.
    const hasDefects =
      missingOrInvalidAttemptNumber > 0 ||
      duplicateGroupsCount > 0 ||
      recordsWithMissingOrInvalidKeys > 0 ||
      invalidStatusCount > 0 ||
      malformedScoreOrPercentageCount > 0 ||
      Boolean(indexInspection.legacyThreeFieldIndex?.unique);

    const auditStatus = hasDefects ? 'ACTION_REQUIRED' : 'READY_FOR_REVIEW';

    // 5. Formulation of Proposed Actions (Explicitly non-executed recommendations)
    const recommendations = [];

    if (missingOrInvalidAttemptNumber > 0) {
      recommendations.push(
        `[Approval Required] Plan migration backfill to assign attemptNumber: 1 to ${missingOrInvalidAttemptNumber - totalRecordsInDuplicateGroups} non-duplicate legacy record(s).`
      );
    }

    if (duplicateGroupsCount > 0) {
      recommendations.push(
        `[Human Review Required] Conduct administrative audit of ${duplicateGroupsCount} duplicate group(s) (${totalRecordsInDuplicateGroups} records) to establish sequential attempt ordering without overwriting historical marks.`
      );
    }

    if (recordsWithMissingOrInvalidKeys > 0) {
      recommendations.push(
        `[Action Required] Investigate and isolate ${recordsWithMissingOrInvalidKeys} record(s) with missing or malformed tenant/assessment/student keys.`
      );
    }

    if (invalidStatusCount > 0 || malformedScoreOrPercentageCount > 0) {
      recommendations.push(
        `[Action Required] Correct ${invalidStatusCount} invalid status value(s) and ${malformedScoreOrPercentageCount} malformed score/percentage field(s).`
      );
    }

    if (indexInspection.legacyThreeFieldIndex?.unique) {
      recommendations.push(
        '[Deployment Precondition] The legacy three-field unique index must be dropped concurrently with or prior to activating multi-attempt retake creation.'
      );
    }

    if (auditStatus === 'READY_FOR_REVIEW') {
      if (totalAttempts === 0) {
        recommendations.push(
          'Collection contains zero assessment attempts. Collection is empty and prepared for Stage 2 schema and index migration review.'
        );
      } else {
        recommendations.push(
          'All records have valid attemptNumbers and key integrity. Collection is prepared for Stage 2 schema and index migration review.'
        );
      }
    }

    return {
      timestamp: new Date().toISOString(),
      auditStatus,
      checksCompleted: true,
      error: null,
      metrics: {
        totalAttempts,
        missingOrInvalidAttemptNumber,
        duplicateGroupsCount,
        totalRecordsInDuplicateGroups,
        recordsWithMissingOrInvalidKeys,
        invalidStatusCount,
        malformedScoreOrPercentageCount,
        unclassifiedRecordsCount
      },
      indexReadiness: {
        totalIndexesCount: indexInspection.totalIndexesCount,
        legacyThreeFieldIndex: indexInspection.legacyThreeFieldIndex,
        proposedFourFieldIndex: indexInspection.proposedFourFieldIndex
      },
      conflicts: {
        totalConflictsCount: conflicts.length,
        items: conflicts
      },
      recommendations
    };
  } catch (err) {
    return {
      timestamp: new Date().toISOString(),
      auditStatus: 'ACTION_REQUIRED',
      checksCompleted: false,
      error: `Audit execution failed: ${err.message}`,
      metrics: null,
      indexReadiness: null,
      conflicts: null,
      recommendations: [
        'Audit terminated unexpectedly. Investigate query failure and re-run inspection.'
      ]
    };
  }
};

/**
 * Formats and prints the aggregate audit report to console.
 * Strictly outputs aggregate counts and safe diagnostics. Never outputs PII or credentials.
 *
 * @param {Object} [auditOptions] Options passed to runAssessmentAttemptAudit
 * @returns {Promise<Object>} The generated report
 */
export const runAuditCLI = async (auditOptions = {}) => {
  console.log('================================================================');
  console.log('  LUMINA LMS — STAGE 1 READ-ONLY RETAKE MIGRATION AUDIT REPORT');
  console.log('================================================================\n');

  try {
    const report = await runAssessmentAttemptAudit(auditOptions);

    console.log(`Execution Timestamp: ${report.timestamp}`);
    console.log(`Audit Status:        ${report.auditStatus}`);
    console.log(`Checks Completed:    ${report.checksCompleted ? 'YES' : 'NO'}`);

    if (report.error) {
      console.error(`\n❌ Error Encountered: ${report.error}`);
    }

    if (report.metrics) {
      console.log('\n--- DATA HEALTH METRICS (AGGREGATE COUNTS ONLY) ---');
      console.log(`Total Assessment Attempts:               ${report.metrics.totalAttempts}`);
      console.log(`Missing or Invalid attemptNumber:       ${report.metrics.missingOrInvalidAttemptNumber}`);
      console.log(`Duplicate (tenant, assessment, student): ${report.metrics.duplicateGroupsCount} groups (${report.metrics.totalRecordsInDuplicateGroups} total records)`);
      console.log(`Missing/Invalid Tenant or Student Keys:  ${report.metrics.recordsWithMissingOrInvalidKeys}`);
      console.log(`Invalid Lifecycle Status Values:         ${report.metrics.invalidStatusCount}`);
      console.log(`Malformed Score or Percentage Values:    ${report.metrics.malformedScoreOrPercentageCount}`);
      console.log(`Unclassified / Anomaly Records:          ${report.metrics.unclassifiedRecordsCount}`);
    }

    if (report.indexReadiness) {
      console.log('\n--- INDEX METADATA INSPECTION ---');
      console.log(`Total Collection Indexes:                ${report.indexReadiness.totalIndexesCount}`);
      console.log(`Legacy 3-Field Index Present:            ${report.indexReadiness.legacyThreeFieldIndex ? 'YES' : 'NO'}`);
      if (report.indexReadiness.legacyThreeFieldIndex) {
        console.log(`  - Name:                                ${report.indexReadiness.legacyThreeFieldIndex.name}`);
        console.log(`  - Unique Constraint Active:            ${report.indexReadiness.legacyThreeFieldIndex.unique ? 'YES (CONFLICT DETECTED)' : 'NO'}`);
      }
      console.log(`Proposed 4-Field Index Present:          ${report.indexReadiness.proposedFourFieldIndex ? 'YES' : 'NO'}`);
    }

    if (report.conflicts?.items?.length > 0) {
      console.log(`\n--- CONFLICTS WITH PROPOSED 4-FIELD UNIQUE INDEX (${report.conflicts.totalConflictsCount}) ---`);
      report.conflicts.items.forEach((c, idx) => {
        console.log(`  [${idx + 1}] [${c.severity}] ${c.code}: ${c.description}`);
      });
    }

    if (report.recommendations?.length > 0) {
      console.log('\n--- PROPOSED ACTIONS (NON-DESTRUCTIVE / REQUIRES SEPARATE APPROVAL) ---');
      report.recommendations.forEach((rec, idx) => {
        console.log(`  [${idx + 1}] ${rec}`);
      });
    }

    console.log('\n================================================================');
    console.log(`Verdict: ${report.auditStatus === 'READY_FOR_REVIEW' ? '✅ READY FOR REVIEW' : '⚠️ ACTION REQUIRED BEFORE MIGRATION'}`);
    console.log('================================================================\n');

    return report;
  } catch (cliErr) {
    console.error('Fatal CLI audit error:', cliErr.message);
    throw cliErr;
  }
};

/**
 * Checks whether this file is being executed directly from the command line.
 * Returns false when imported into other modules or test suites.
 */
export const isDirectCLIInvocation = () => {
  if (typeof process === 'undefined' || !process.argv || !process.argv[1]) return false;
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const executedPath = path.resolve(process.argv[1]);
    return scriptPath === executedPath;
  } catch (_) {
    return false;
  }
};

/**
 * Normalizes host strings and extracts optional ports.
 * Standardizes DNS hostnames to lowercase and handles IPv4/IPv6/ports.
 *
 * @param {string} raw Raw host string
 * @returns {{ host: string, port: number|null }|null}
 */
export const normalizeHostAndPort = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle bracketed IPv6: [::1]:27017 or [::1]
  if (trimmed.startsWith('[')) {
    const closeBracket = trimmed.indexOf(']');
    if (closeBracket !== -1) {
      const ipv6Host = trimmed.slice(1, closeBracket).toLowerCase();
      const afterBracket = trimmed.slice(closeBracket + 1);
      if (afterBracket.startsWith(':')) {
        const portStr = afterBracket.slice(1);
        const port = parseInt(portStr, 10);
        if (!Number.isNaN(port) && String(port) === portStr && port > 0 && port <= 65535) {
          return { host: ipv6Host, port };
        }
        return null;
      }
      return { host: ipv6Host, port: null };
    }
  }

  // Standard host:port
  const lastColonIdx = trimmed.lastIndexOf(':');
  if (lastColonIdx > 0 && !trimmed.includes('::')) {
    const hostPart = trimmed.slice(0, lastColonIdx).toLowerCase();
    const portPart = trimmed.slice(lastColonIdx + 1);
    const port = parseInt(portPart, 10);
    if (!Number.isNaN(port) && String(port) === portPart && port > 0 && port <= 65535) {
      return { host: hostPart, port };
    }
  }

  return { host: trimmed.toLowerCase(), port: null };
};

/**
 * Validates actual connected host against expected host flag.
 * Uses strict exact host matching (case-insensitive DNS) and port matching.
 * Rejects substring matches and alerts on Atlas SRV seed vs replica node discrepancies.
 *
 * @param {string} actualHost Driver reported host
 * @param {number|string|null} actualPort Driver reported port
 * @param {string} expectedRawHost Operator-supplied host string
 */
export const verifyTargetHost = (actualHost, actualPort, expectedRawHost) => {
  if (expectedRawHost === undefined || expectedRawHost === null) {
    throw new Error('Target verification failed: --require-host was specified without a value.');
  }
  const expectedParsed = normalizeHostAndPort(expectedRawHost);
  if (!expectedParsed || !expectedParsed.host) {
    throw new Error('Target verification failed: --require-host must specify a non-empty hostname.');
  }

  const actualParsed = normalizeHostAndPort(actualHost);
  const normalizedActualHost = actualParsed?.host || (actualHost ? String(actualHost).trim().toLowerCase() : '');
  const normalizedActualPort = actualParsed?.port || (actualPort ? parseInt(actualPort, 10) : null);

  // Port verification if expected port is explicitly specified
  if (expectedParsed.port !== null && normalizedActualPort !== null) {
    if (expectedParsed.port !== normalizedActualPort) {
      throw new Error(
        `Target cluster port mismatch! Expected port ${expectedParsed.port} but connected to port ${normalizedActualPort}. Aborting.`
      );
    }
  }

  // Exact normalized hostname comparison (Eliminates substring matching)
  if (expectedParsed.host !== normalizedActualHost) {
    // Check if the mismatch appears to be an Atlas SRV seed hostname vs replica set node hostname
    const isSrvSeedCandidate = expectedParsed.host.includes('.mongodb.net') && !expectedParsed.host.includes('-shard-');
    const isReplicaNodeCandidate = normalizedActualHost.includes('-shard-');

    if (isSrvSeedCandidate && isReplicaNodeCandidate) {
      throw new Error(
        `Target cluster host mismatch! Expected SRV seed "${expectedRawHost}" but driver connected to replica-set node "${actualHost}". In MongoDB Atlas replica sets, the driver resolves the SRV seed to individual shard nodes. Do not assume SRV seeds and replica node hostnames are interchangeable. Operator verification required: specify the exact resolved node host via --require-host or verify deployment target independently.`
      );
    }

    throw new Error(
      `Target cluster host mismatch! Expected "${expectedRawHost}" but connected to "${actualHost}". Aborting to prevent inspecting the wrong cluster.`
    );
  }
};

/**
 * Validates actual connected database name against expected database name.
 *
 * @param {string} actualDbName Driver reported db name
 * @param {string} expectedRawDbName Operator-supplied db name
 */
export const verifyTargetDatabase = (actualDbName, expectedRawDbName) => {
  if (expectedRawDbName === undefined || expectedRawDbName === null) {
    throw new Error('Target verification failed: --require-target was specified without a value.');
  }
  const trimmed = expectedRawDbName.trim();
  if (!trimmed) {
    throw new Error('Target verification failed: --require-target must specify a non-empty database name.');
  }
  if (trimmed !== actualDbName) {
    throw new Error(
      `Target database mismatch! Expected "${trimmed}" but connected to "${actualDbName}". Aborting to prevent inspecting the wrong database.`
    );
  }
};

/**
 * Validates actual deployment (host/database) against expected deployment flag.
 *
 * @param {string} actualHost Driver reported host
 * @param {number|string|null} actualPort Driver reported port
 * @param {string} actualDbName Driver reported db name
 * @param {string} expectedRawDeployment Operator-supplied deployment string
 */
export const verifyTargetDeployment = (actualHost, actualPort, actualDbName, expectedRawDeployment) => {
  if (expectedRawDeployment === undefined || expectedRawDeployment === null) {
    throw new Error('Target verification failed: --require-deployment was specified without a value.');
  }
  const trimmed = expectedRawDeployment.trim();
  if (!trimmed) {
    throw new Error('Target verification failed: --require-deployment must specify a non-empty deployment string.');
  }
  const slashIdx = trimmed.indexOf('/');
  if (slashIdx <= 0 || slashIdx === trimmed.length - 1) {
    throw new Error(
      `Target verification failed: --require-deployment must be in format "host/databaseName" (e.g. "cluster0.mongodb.net/lumina_prod"). Received: "${trimmed}".`
    );
  }

  const expHostPart = trimmed.slice(0, slashIdx);
  const expDbPart = trimmed.slice(slashIdx + 1);

  verifyTargetHost(actualHost, actualPort, expHostPart);
  verifyTargetDatabase(actualDbName, expDbPart);
};

/**
 * Orchestrates safe CLI execution:
 * 1. Checks target database environment safely.
 * 2. Prevents accidental execution against fallback in-memory databases without --allow-in-memory.
 * 3. Enforces audit-specific read-only connection options (autoIndex: false, autoCreate: false).
 * 4. Supports exact normalized --require-target, --require-host, and --require-deployment flags.
 * 5. Ensures closeDB() is executed on both success and failure in a finally block.
 * 6. Guarantees that connection closure errors never mask the primary audit error.
 *
 * @param {Object} [deps] Dependency overrides for testing
 * @returns {Promise<Object>} The audit report
 */
export const executeAuditLifecycle = async (deps = {}) => {
  const argv = deps.argv || (typeof process !== 'undefined' ? process.argv : []);
  const connectFn = deps.connectDB || (async (options = { autoIndex: false, autoCreate: false }) => {
    const mod = await import('../../database/mongoose.js');
    return mod.connectDB(options);
  });
  const closeFn = deps.closeDB || (async () => {
    const mod = await import('../../database/mongoose.js');
    return mod.closeDB();
  });
  const auditRunner = deps.runAuditCLI || runAuditCLI;

  let connectionAttempted = false;
  let connectionOpened = false;
  let primaryError = null;

  try {
    console.log('📡 [Lumina LMS] Operator initiated migration audit. Connecting to database...');
    connectionAttempted = true;
    const dbInfo = await connectFn({ autoIndex: false, autoCreate: false });
    connectionOpened = true;

    // Safety Guard 1: Accidental in-memory fallback prevention
    if (dbInfo?.isInMemory && !argv.includes('--allow-in-memory')) {
      throw new Error(
        'Refusing to run migration audit against ephemeral in-memory database. Provide a valid MONGO_URI in environment or pass --allow-in-memory for local testing.'
      );
    }

    // Safety Guard 2: Target database and deployment confirmation flags
    const actualDbName = mongoose.connection?.name;
    const actualHost = mongoose.connection?.host;
    const actualPort = mongoose.connection?.port;

    // 2A: Identity Verification Requirement Check (when explicit identity is required)
    const requireIdentity = argv.includes('--require-identity') || process.env.REQUIRE_TARGET_VERIFICATION === 'true';
    const hasTargetFlag = argv.some((arg) => arg === '--require-target' || arg.startsWith('--require-target='));
    const hasHostFlag = argv.some((arg) => arg === '--require-host' || arg.startsWith('--require-host='));
    const hasDeploymentFlag = argv.some((arg) => arg === '--require-deployment' || arg.startsWith('--require-deployment='));

    if (requireIdentity && !(hasDeploymentFlag || (hasTargetFlag && hasHostFlag))) {
      throw new Error(
        'Target identity verification is required: Operator must supply --require-target and --require-host (or --require-deployment).'
      );
    }

    // 2B: Verify database name if flag is provided
    const targetArg = argv.find((arg) => arg === '--require-target' || arg.startsWith('--require-target='));
    if (targetArg) {
      const expectedDbName = targetArg.includes('=') ? targetArg.split('=').slice(1).join('=') : '';
      verifyTargetDatabase(actualDbName, expectedDbName);
    }

    // 2C: Verify cluster host if flag is provided
    const hostArg = argv.find((arg) => arg === '--require-host' || arg.startsWith('--require-host='));
    if (hostArg) {
      const expectedHost = hostArg.includes('=') ? hostArg.split('=').slice(1).join('=') : '';
      verifyTargetHost(actualHost, actualPort, expectedHost);
    }

    // 2D: Verify deployment tuple if flag is provided
    const deploymentArg = argv.find((arg) => arg === '--require-deployment' || arg.startsWith('--require-deployment='));
    if (deploymentArg) {
      const expectedDeployment = deploymentArg.includes('=') ? deploymentArg.split('=').slice(1).join('=') : '';
      verifyTargetDeployment(actualHost, actualPort, actualDbName, expectedDeployment);
    }

    // Sanitized target information log (Strictly host and database name, zero credentials)
    const targetHost = actualHost || 'unknown-host';
    const targetDb = actualDbName || 'unknown-db';
    console.log(`🎯 [Audit Target] Connected to deployment: ${targetHost}/${targetDb}`);

    const report = await auditRunner();
    return report;
  } catch (err) {
    primaryError = err;
    console.error('❌ [Lumina LMS] Migration audit execution failed:', err.message);
    throw err;
  } finally {
    // Attempt cleanup if connection was opened, OR if connection was attempted and mongoose.connection is not disconnected
    const shouldClose = connectionOpened || (connectionAttempted && mongoose.connection?.readyState !== 0);
    if (shouldClose) {
      try {
        await closeFn();
        console.log('🛑 [Lumina LMS] Database connection cleanly closed.');
      } catch (closeErr) {
        console.warn('⚠️ [Lumina LMS] Warning during database close:', closeErr.message);
        // Do not mask primaryError if one occurred
        if (!primaryError) {
          throw closeErr;
        }
      }
    }
  }
};

// Safe direct invocation guard:
// ONLY runs when explicitly invoked directly by an operator via `node auditAssessmentAttempts.js`.
// NEVER runs on module import.
if (isDirectCLIInvocation()) {
  executeAuditLifecycle()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runAssessmentAttemptAudit;
