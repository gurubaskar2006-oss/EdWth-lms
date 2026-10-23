/**
 * Lumina LMS — Development-Only Test Account Provisioning Utility
 * 6th Civilians Corporation
 *
 * Operational Constraints:
 * 1. STRICTLY FORBIDDEN IN PRODUCTION: Throws fatal error if NODE_ENV === 'production'.
 * 2. ATLAS / PRODUCTION DB SAFEGUARD: Refuses execution if connected to a remote Atlas cluster.
 * 3. ZERO-DEMO COMPLIANCE:
 *    - Does NOT create demo students.
 *    - Does NOT create classes/cohorts.
 *    - Does NOT create subjects.
 *    - Does NOT create assessments, marks, submissions, or attendance.
 * 4. PROVISIONS MINIMAL TEST CREDENTIALS:
 *    - Student (Dev): role 'student' scoped to dev institution tenant.
 *    - Trainer / Teacher (Dev): role 'trainer' scoped to dev institution tenant.
 *    - Admin — 6th Civilians Corporation (Dev): role 'superadmin' with company-wide platform oversight.
 * 5. Uses secure bcrypt password hashing.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import College from '../models/College.js';

export const DEV_TEST_CREDENTIALS = {
  student: {
    studentId: 'DEV-STU-001',
    name: 'Development Student',
    email: 'dev.student@lumina.test',
    password: process.env.DEV_STUDENT_PASSWORD || 'DevStudent@123!',
    role: 'student'
  },
  trainer: {
    studentId: 'DEV-TRN-001',
    name: 'Development Trainer',
    email: 'dev.trainer@lumina.test',
    password: process.env.DEV_TRAINER_PASSWORD || 'DevTrainer@123!',
    role: 'trainer'
  },
  admin: {
    studentId: 'DEV-ADMIN-001',
    name: 'Company Platform Administrator',
    email: 'dev.admin@lumina.test',
    password: process.env.DEV_ADMIN_PASSWORD || 'DevAdmin@123!',
    role: 'superadmin' // 6th Civilians Corporation Platform Administrator
  }
};

/**
 * Validates that current environment and database connection are safe for dev provisioning.
 */
export const assertSafeDevEnvironment = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: Development test accounts cannot be provisioned in production.');
  }

  const host = mongoose.connection.host || '';
  if (host.includes('mongodb.net') || process.env.PROHIBIT_DEV_PROVISIONING === 'true') {
    throw new Error('FATAL: Refusing to provision development test accounts on production or Atlas cluster.');
  }
};

/**
 * Provisions minimal development-only test accounts in local/in-memory database.
 */
export const provisionDevTestAccounts = async () => {
  assertSafeDevEnvironment();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database is not connected. Cannot provision dev test accounts.');
  }

  // 1. Ensure minimal isolated development tenant exists for student/trainer scoping
  let devTenant = await College.findOne({ code: 'DEV-INST' });
  if (!devTenant) {
    devTenant = await College.create({
      name: 'Development Institution',
      code: 'DEV-INST',
      slug: 'dev-inst',
      institutionType: 'school',
      status: 'active'
    });
    console.log('✅ [Dev Provisioner] Development tenant created: DEV-INST');
  }

  const accountsToProvision = [
    {
      ...DEV_TEST_CREDENTIALS.student,
      tenantId: devTenant._id,
      tenantName: devTenant.name
    },
    {
      ...DEV_TEST_CREDENTIALS.trainer,
      tenantId: devTenant._id,
      tenantName: devTenant.name
    },
    {
      ...DEV_TEST_CREDENTIALS.admin,
      tenantId: null, // Global platform administrator for 6th Civilians Corporation
      tenantName: '6th Civilians Corporation',
      isTwoFactorEnabled: false
    }
  ];

  const results = [];

  for (const acc of accountsToProvision) {
    let existing = await User.findOne({ email: acc.email });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(acc.password, 10);
      existing = await User.create({
        studentId: acc.studentId,
        name: acc.name,
        email: acc.email,
        password: hashedPassword,
        role: acc.role,
        tenantId: acc.tenantId,
        tenantName: acc.tenantName,
        accountStatus: 'Active',
        isTwoFactorEnabled: acc.isTwoFactorEnabled || false,
        batchId: null // Zero cohorts/classes
      });
      console.log(`✅ [Dev Provisioner] Created ${acc.role} account: ${acc.email}`);
    } else {
      // Ensure role, tenantId, and password hash match required specifications
      let updated = false;
      if (existing.role !== acc.role) {
        existing.role = acc.role;
        updated = true;
      }
      if (acc.tenantId === null && existing.tenantId !== null) {
        existing.tenantId = null;
        updated = true;
      }
      if (existing.isTwoFactorEnabled !== (acc.isTwoFactorEnabled || false)) {
        existing.isTwoFactorEnabled = acc.isTwoFactorEnabled || false;
        updated = true;
      }
      const isMatch = await bcrypt.compare(acc.password, existing.password).catch(() => false);
      if (!isMatch) {
        existing.password = await bcrypt.hash(acc.password, 10);
        updated = true;
      }
      if (updated) {
        await existing.save();
        console.log(`🔄 [Dev Provisioner] Updated credentials/role for: ${acc.email}`);
      }
    }
    results.push({ email: existing.email, role: existing.role, tenantId: existing.tenantId });
  }

  console.log(`ℹ️ [Dev Provisioner] ${results.length} development test accounts ready (0 demo students, 0 demo classes created).`);
  return { success: true, count: results.length, tenantId: devTenant._id };
};

// Allow direct execution: node server/scripts/provisionDevTestAccount.js
if (process.argv[1] && process.argv[1].endsWith('provisionDevTestAccount.js')) {
  import('../database/mongoose.js').then(async ({ connectDB, closeDB }) => {
    try {
      await connectDB();
      await provisionDevTestAccounts();
      await closeDB();
      process.exit(0);
    } catch (err) {
      console.error('❌ [Dev Provisioner Error]:', err.message);
      process.exit(1);
    }
  });
}
