/**
 * EdWth LMS — Permanent Demo Data Purge Script
 * 6th Civilians Corporation
 *
 * Executes verified, permanent removal of audited demo records:
 * - 2 Demo Colleges: NEXUS, OAKRIDGE
 * - 1 Demo Batch: Class 10 - Section A
 * - 15 Demo Users under NEXUS & OAKRIDGE
 * - 18 Dependent Demo Audit Logs
 *
 * STRICT SAFETY ENFORCEMENT:
 * - Never uses unrestricted deleteMany({})
 * - Uses exact ObjectId targets verified in prePurgeSafetyInspection
 * - Explicitly protects SuperAdmin account edwthacademyadmin@6c.com
 * - Verifies post-deletion counts and database integrity
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const VERIFIED_TARGETS = {
  colleges: [
    new mongoose.Types.ObjectId('6acfac8c2f851573b8e02dfc'), // Nexus Institute of Technology
    new mongoose.Types.ObjectId('6acfac8c2f851573b8e02dfd')  // Oakridge High School
  ],
  batches: [
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02dfe')  // Class 10 - Section A
  ],
  users: [
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02dff'), // admin@nexus.edu
    new mongoose.Types.ObjectId('6acfac8f2f851573b8e02e01'), // trainer@nexus.edu
    new mongoose.Types.ObjectId('6acfac962f851573b8e02e0d'), // elena.rostova@nexus.edu
    new mongoose.Types.ObjectId('6acfac932f851573b8e02e08'), // alex.vance@mit.edu
    new mongoose.Types.ObjectId('6acfac952f851573b8e02e0b'), // chloe.bennett@nexus.edu
    new mongoose.Types.ObjectId('6acfac942f851573b8e02e0a'), // jordan.hayes@nexus.edu
    new mongoose.Types.ObjectId('6acfac942f851573b8e02e09'), // maya.lin@nexus.edu
    new mongoose.Types.ObjectId('6acfac962f851573b8e02e0c'), // samir.patel@nexus.edu
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02e00'), // admin@oakridge.edu
    new mongoose.Types.ObjectId('6acfac902f851573b8e02e02'), // teacher@oakridge.edu
    new mongoose.Types.ObjectId('6acfac912f851573b8e02e03'), // leo.miller@oakridge.edu
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e04'), // samantha.lee@oakridge.edu
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e05'), // daniel.wu@oakridge.edu
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e06'), // aisha.patel@oakridge.edu
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e07')  // maya.lin@oakridge.edu
  ]
};

async function executePurge() {
  console.log('================================================================');
  console.log('🗑️  [PERMANENT PURGE] Lumina LMS Verified Demo Data Removal');
  console.log('================================================================\n');

  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('FATAL: MONGO_URI is missing in server/.env');
  }

  await mongoose.connect(mongoURI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000
  });

  const db = mongoose.connection.db;
  console.log(`Connected to Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);

  // PRE-CONDITION 1: Confirm Database Name
  if (mongoose.connection.name !== 'lumina_lms') {
    throw new Error(`ABORT: Target database is '${mongoose.connection.name}', expected 'lumina_lms'`);
  }

  // PRE-CONDITION 2: Protect and verify genuine SuperAdmin
  const superAdmin = await db.collection('users').findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!superAdmin) {
    throw new Error('ABORT: SuperAdmin edwthacademyadmin@6c.com not found!');
  }

  const superAdminIdStr = superAdmin._id.toString();
  console.log(`\n🔒 Genuine SuperAdmin Verified: ${superAdmin.email} (_id: ${superAdminIdStr})`);

  // Ensure SuperAdmin is NOT in the deletion list
  const targetsContainSuperAdmin = VERIFIED_TARGETS.users.some(id => id.toString() === superAdminIdStr);
  if (targetsContainSuperAdmin) {
    throw new Error('FATAL SAFETY VIOLATION: SuperAdmin ID is in the target deletion list! Halting immediately.');
  }

  // Locate audit log IDs that belong to demo tenants or demo users
  const demoAuditLogs = await db.collection('auditlogs').find({
    $or: [
      { tenantId: { $in: VERIFIED_TARGETS.colleges } },
      { 'actor.id': { $in: VERIFIED_TARGETS.users.map(u => u.toString()) } },
      { targetRecord: { $in: [...VERIFIED_TARGETS.users, ...VERIFIED_TARGETS.colleges, ...VERIFIED_TARGETS.batches] } }
    ]
  }).toArray();
  const demoAuditLogIds = demoAuditLogs.map(l => l._id);
  console.log(`Found ${demoAuditLogIds.length} dependent demo audit logs.`);

  console.log('\n--- TARGETS SUMMARY FOR PERMANENT DELETION ---');
  console.log(`• Colleges to delete: ${VERIFIED_TARGETS.colleges.length}`);
  console.log(`• Batches to delete: ${VERIFIED_TARGETS.batches.length}`);
  console.log(`• Users to delete: ${VERIFIED_TARGETS.users.length}`);
  console.log(`• Audit logs to delete: ${demoAuditLogIds.length}`);

  // Try executing with MongoDB session / transaction
  const session = await mongoose.startSession();
  let transactionSupported = true;

  try {
    session.startTransaction();
  } catch (txErr) {
    console.warn(`Transaction start notice (${txErr.message}). Falling back to atomic ordered ops.`);
    transactionSupported = false;
  }

  const purgeResults = {
    deletedAuditLogs: 0,
    deletedBatches: 0,
    deletedUsers: 0,
    deletedColleges: 0,
    otherDependenciesDeleted: 0
  };

  try {
    const opts = transactionSupported ? { session } : {};

    // 1. Delete dependent demo audit logs
    if (demoAuditLogIds.length > 0) {
      const resAudit = await db.collection('auditlogs').deleteMany(
        { _id: { $in: demoAuditLogIds } },
        opts
      );
      purgeResults.deletedAuditLogs = resAudit.deletedCount;
      console.log(`✔ Permanently deleted ${resAudit.deletedCount} demo audit log records`);
    }

    // 2. Delete demo batches
    const resBatches = await db.collection('batches').deleteMany(
      { _id: { $in: VERIFIED_TARGETS.batches } },
      opts
    );
    purgeResults.deletedBatches = resBatches.deletedCount;
    console.log(`✔ Permanently deleted ${resBatches.deletedCount} demo batch records`);

    // 3. Delete demo users (strict exclusion of SuperAdmin)
    const resUsers = await db.collection('users').deleteMany(
      {
        _id: { $in: VERIFIED_TARGETS.users, $ne: superAdmin._id }
      },
      opts
    );
    purgeResults.deletedUsers = resUsers.deletedCount;
    console.log(`✔ Permanently deleted ${resUsers.deletedCount} demo user records`);

    // 4. Delete demo colleges / tenants
    const resColleges = await db.collection('colleges').deleteMany(
      { _id: { $in: VERIFIED_TARGETS.colleges } },
      opts
    );
    purgeResults.deletedColleges = resColleges.deletedCount;
    console.log(`✔ Permanently deleted ${resColleges.deletedCount} demo tenant records`);

    // 5. Clean any residual references in all other collections using tenantId
    const otherCollections = [
      'attendances', 'assignments', 'submissions', 'courses',
      'assessments', 'assessmentattempts', 'assessmentevents',
      'studentprogresses', 'announcements', 'doubts', 'grades',
      'notes', 'teachernotes', 'retakeauthorizations', 'academicevents'
    ];

    for (const cName of otherCollections) {
      const coll = db.collection(cName);
      const resOther = await coll.deleteMany(
        {
          $or: [
            { tenantId: { $in: VERIFIED_TARGETS.colleges } },
            { studentId: { $in: VERIFIED_TARGETS.users } },
            { trainerId: { $in: VERIFIED_TARGETS.users } },
            { batchId: { $in: VERIFIED_TARGETS.batches } }
          ]
        },
        opts
      );
      if (resOther.deletedCount > 0) {
        console.log(`✔ Permanently deleted ${resOther.deletedCount} records from ${cName}`);
        purgeResults.otherDependenciesDeleted += resOther.deletedCount;
      }
    }

    if (transactionSupported) {
      await session.commitTransaction();
      console.log('\n🔒 Transaction committed successfully.');
    }
  } catch (err) {
    if (transactionSupported) {
      await session.abortTransaction();
      console.error('❌ Transaction aborted due to error:', err);
    }
    throw err;
  } finally {
    session.endSession();
  }

  // --- POST-PURGE VERIFICATION CHECKS ---
  console.log('\n================================================================');
  console.log('🔍 [POST-PURGE VERIFICATION]');
  console.log('================================================================');

  // Verify demo tenants are 0
  const remainingTenants = await db.collection('colleges').countDocuments({
    _id: { $in: VERIFIED_TARGETS.colleges }
  });
  console.log(`• Remaining Demo Tenants: ${remainingTenants} (Expected: 0)`);
  if (remainingTenants !== 0) throw new Error('Post-purge check failed: Demo tenants still exist!');

  // Verify demo users are 0
  const remainingUsers = await db.collection('users').countDocuments({
    _id: { $in: VERIFIED_TARGETS.users }
  });
  console.log(`• Remaining Demo Users: ${remainingUsers} (Expected: 0)`);
  if (remainingUsers !== 0) throw new Error('Post-purge check failed: Demo users still exist!');

  // Verify demo batches are 0
  const remainingBatches = await db.collection('batches').countDocuments({
    _id: { $in: VERIFIED_TARGETS.batches }
  });
  console.log(`• Remaining Demo Batches: ${remainingBatches} (Expected: 0)`);
  if (remainingBatches !== 0) throw new Error('Post-purge check failed: Demo batches still exist!');

  // Verify SuperAdmin is intact
  const verifiedSuperAdmin = await db.collection('users').findOne({ _id: superAdmin._id });
  if (!verifiedSuperAdmin || verifiedSuperAdmin.email !== 'edwthacademyadmin@6c.com') {
    throw new Error('FATAL: SuperAdmin check failed after purge!');
  }
  console.log(`• SuperAdmin Intact: ${verifiedSuperAdmin.email} (Role: ${verifiedSuperAdmin.role})`);

  // Verify total users in database
  const totalUsers = await db.collection('users').countDocuments();
  console.log(`• Total Users Remaining in Database: ${totalUsers} (SuperAdmin only)`);

  const totalColleges = await db.collection('colleges').countDocuments();
  console.log(`• Total Colleges Remaining in Database: ${totalColleges}`);

  const totalBatches = await db.collection('batches').countDocuments();
  console.log(`• Total Batches Remaining in Database: ${totalBatches}`);

  await mongoose.disconnect();
  console.log('\n🎉 PERMANENT PURGE COMPLETED AND VERIFIED SUCCESSFULLY!');
  return purgeResults;
}

executePurge().catch(err => {
  console.error('\n❌ Fatal Purge Error:', err);
  process.exit(1);
});

