/**
 * Lumina LMS — Canonical Database Role Definitions
 * 6th Civilians Corporation
 *
 * Single source of truth for MongoDB least-privilege runtime role definitions.
 * Consumed by:
 * 1. Automated database-level role tests (`server/tests/databaseLeastPrivilegeRole.test.js`)
 * 2. Application startup validation tests
 * 3. Deployment / Atlas configuration scripts
 *
 * Security Constraints:
 * - NO database-wide write access
 * - NO index-creation permissions (createIndex, createIndexes, dropIndex)
 * - NO collection/database drop or migration permissions
 * - Append-only access on `auditlogs` (find, insert ONLY; update and remove are excluded)
 * - Standard CRUD on the 17 mutable operational collections
 */

export const LUMINA_APP_ROLE_NAME = 'luminaAppServiceRole';

export const MUTABLE_COLLECTIONS = [
  'users',
  'colleges',
  'batches',
  'courses',
  'notes',
  'teachernotes',
  'assessments',
  'assessmentattempts',
  'assessmentevents',
  'assignments',
  'attendances',
  'grades',
  'retakeauthorizations',
  'studentprogresses',
  'submissions',
  'academicevents',
  'announcements'
];

export const APPEND_ONLY_COLLECTIONS = ['auditlogs'];

export const ALL_APPLICATION_COLLECTIONS = [
  ...MUTABLE_COLLECTIONS,
  ...APPEND_ONLY_COLLECTIONS
];

/**
 * Returns the exact MongoDB role specification for the runtime application service user.
 *
 * @param {string} dbName - Target database name (e.g. 'lumina_production')
 * @returns {object} MongoDB createRole / updateRole specification
 */
export const getLuminaAppRoleDefinition = (dbName) => {
  if (!dbName || typeof dbName !== 'string') {
    throw new Error('Target database name is required to construct role definition.');
  }

  const privileges = [
    // 1. 17 Mutable collections: Full operational CRUD
    ...MUTABLE_COLLECTIONS.map((col) => ({
      resource: { db: dbName, collection: col },
      actions: ['find', 'insert', 'update', 'remove']
    })),
    // 2. Audit logs: Strictly append-only (no update, no remove)
    {
      resource: { db: dbName, collection: 'auditlogs' },
      actions: ['find', 'insert']
    }
  ];

  return {
    role: LUMINA_APP_ROLE_NAME,
    privileges,
    roles: []
  };
};

/**
 * Generates the mongosh command script for operator execution on MongoDB Atlas.
 *
 * @param {string} dbName - Target database name
 * @returns {string} mongosh executable script
 */
export const generateAtlasRoleScript = (dbName) => {
  const roleDef = getLuminaAppRoleDefinition(dbName);
  return `// Lumina LMS — MongoDB Least-Privilege Custom Role Deployment Script
// Execute in mongosh connected to target cluster as an admin user (dbAdmin / atlasAdmin):

use ${dbName};

db.createRole(${JSON.stringify(roleDef, null, 2)});

// Assign this role to the application service user:
// db.createUser({
//   user: "luminaAppServiceUser",
//   pwd: passwordPrompt(),
//   roles: [{ role: "${LUMINA_APP_ROLE_NAME}", db: "${dbName}" }]
// });
`;
};

export default {
  LUMINA_APP_ROLE_NAME,
  MUTABLE_COLLECTIONS,
  APPEND_ONLY_COLLECTIONS,
  ALL_APPLICATION_COLLECTIONS,
  getLuminaAppRoleDefinition,
  generateAtlasRoleScript
};
