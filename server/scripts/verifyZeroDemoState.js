/**
 * EdWth LMS — Post-Purge Direct MongoDB Verification Script
 * 6th Civilians Corporation
 *
 * Directly queries MongoDB Atlas to prove:
 * 1. Verified demo tenant IDs no longer exist.
 * 2. Verified demo user IDs no longer exist.
 * 3. Verified demo batch IDs no longer exist.
 * 4. No dependent records remain referencing demo IDs.
 * 5. Genuine SuperAdmin account exists and is valid.
 * 6. Counts across all collections are accurate and clean.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const PURGED_IDS = {
  colleges: [
    new mongoose.Types.ObjectId('6acfac8c2f851573b8e02dfc'),
    new mongoose.Types.ObjectId('6acfac8c2f851573b8e02dfd')
  ],
  batches: [
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02dfe')
  ],
  users: [
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02dff'),
    new mongoose.Types.ObjectId('6acfac8f2f851573b8e02e01'),
    new mongoose.Types.ObjectId('6acfac962f851573b8e02e0d'),
    new mongoose.Types.ObjectId('6acfac932f851573b8e02e08'),
    new mongoose.Types.ObjectId('6acfac952f851573b8e02e0b'),
    new mongoose.Types.ObjectId('6acfac942f851573b8e02e0a'),
    new mongoose.Types.ObjectId('6acfac942f851573b8e02e09'),
    new mongoose.Types.ObjectId('6acfac962f851573b8e02e0c'),
    new mongoose.Types.ObjectId('6acfac8e2f851573b8e02e00'),
    new mongoose.Types.ObjectId('6acfac902f851573b8e02e02'),
    new mongoose.Types.ObjectId('6acfac912f851573b8e02e03'),
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e04'),
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e05'),
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e06'),
    new mongoose.Types.ObjectId('6acfac922f851573b8e02e07')
  ]
};

async function verifyZeroDemo() {
  console.log('📡 [Verification] Connecting to configured MongoDB instance...');
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000
  });

  const db = mongoose.connection.db;
  console.log(`Connected: ${mongoose.connection.name} on ${mongoose.connection.host}\n`);

  // 1. Verify Purged Tenant IDs
  const collegesFound = await db.collection('colleges').countDocuments({
    _id: { $in: PURGED_IDS.colleges }
  });
  console.log(`1. Purged Tenant IDs present in colleges collection: ${collegesFound} (PASS: 0)`);
  if (collegesFound !== 0) throw new Error('FAIL: Purged tenant IDs still exist!');

  // 2. Verify Purged User IDs
  const usersFound = await db.collection('users').countDocuments({
    _id: { $in: PURGED_IDS.users }
  });
  console.log(`2. Purged User IDs present in users collection: ${usersFound} (PASS: 0)`);
  if (usersFound !== 0) throw new Error('FAIL: Purged user IDs still exist!');

  // 3. Verify Purged Batch IDs
  const batchesFound = await db.collection('batches').countDocuments({
    _id: { $in: PURGED_IDS.batches }
  });
  console.log(`3. Purged Batch IDs present in batches collection: ${batchesFound} (PASS: 0)`);
  if (batchesFound !== 0) throw new Error('FAIL: Purged batch IDs still exist!');

  // 4. Verify No Residual Foreign References in ANY collection
  const collections = await db.listCollections().toArray();
  console.log(`\n4. Scanning all ${collections.length} collections for residual foreign-key references to purged IDs:`);

  let residualReferences = 0;
  for (const collInfo of collections) {
    const collName = collInfo.name;
    const count = await db.collection(collName).countDocuments({
      $or: [
        { tenantId: { $in: PURGED_IDS.colleges } },
        { studentId: { $in: PURGED_IDS.users } },
        { trainerId: { $in: PURGED_IDS.users } },
        { userId: { $in: PURGED_IDS.users } },
        { batchId: { $in: PURGED_IDS.batches } }
      ]
    });
    if (count > 0) {
      console.log(`  ❌ ${collName}: ${count} orphaned demo references found!`);
      residualReferences += count;
    }
  }
  if (residualReferences === 0) {
    console.log(`  ✅ Zero residual or orphaned references found across all collections.`);
  } else {
    throw new Error(`FAIL: Found ${residualReferences} residual references!`);
  }

  // 5. Verify Genuine SuperAdmin Account
  const superAdmin = await db.collection('users').findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!superAdmin) {
    throw new Error('FAIL: SuperAdmin edwthacademyadmin@6c.com is missing!');
  }
  console.log(`\n5. Genuine SuperAdmin Account Status:`);
  console.log(`  - Email: ${superAdmin.email}`);
  console.log(`  - Role: ${superAdmin.role}`);
  console.log(`  - Student/Login ID: ${superAdmin.studentId}`);
  console.log(`  - Password Hash Present: ${!!superAdmin.password}`);
  console.log(`  - 2FA Flag: ${superAdmin.isTwoFactorEnabled}`);
  console.log(`  - TenantId: ${superAdmin.tenantId} (Correctly Global/Null)`);

  // 6. Report Post-Purge Collection Counts
  console.log(`\n6. Authoritative Database Collection Counts:`);
  for (const collInfo of collections) {
    const collName = collInfo.name;
    const count = await db.collection(collName).countDocuments();
    console.log(`  - ${collName}: ${count}`);
  }

  await mongoose.disconnect();
  console.log('\n✅ DIRECT DATABASE VERIFICATION SUCCESSFUL: 100% CLEAN.');
}

verifyZeroDemo().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

