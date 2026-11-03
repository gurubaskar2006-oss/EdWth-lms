/**
 * EdWth LMS — Pre-Purge MongoDB Live Inspection & Safety Backup Script
 * 6th Civilians Corporation
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runInspection() {
  console.log('📡 [Inspection] Connecting to configured MongoDB instance...');
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('FATAL: MONGO_URI is missing in server/.env');
  }

  // Connect directly
  await mongoose.connect(mongoURI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000
  });

  const db = mongoose.connection.db;
  console.log(`✅ [Inspection] Connected to Host: ${mongoose.connection.host}`);
  console.log(`✅ [Inspection] Connected to Database: ${mongoose.connection.name}`);

  // 1. Verify SuperAdmin Account
  const usersColl = db.collection('users');
  const superAdmin = await usersColl.findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!superAdmin) {
    throw new Error('FATAL SAFETY CHECK FAILED: SuperAdmin edwthacademyadmin@6c.com NOT FOUND in database!');
  }
  console.log('\n👑 [Safety Check: SuperAdmin Account Verified]');
  console.log({
    _id: superAdmin._id.toString(),
    email: superAdmin.email,
    role: superAdmin.role,
    tenantId: superAdmin.tenantId,
    studentId: superAdmin.studentId,
    isTwoFactorEnabled: superAdmin.isTwoFactorEnabled,
    mfaEnforced: superAdmin.mfaEnforced
  });

  if (superAdmin.role !== 'superadmin') {
    throw new Error(`FATAL SAFETY CHECK FAILED: Role is ${superAdmin.role}, expected 'superadmin'!`);
  }

  // 2. Discover all collections
  const collections = await db.listCollections().toArray();
  console.log(`\n📦 Discovered ${collections.length} collections in database ${mongoose.connection.name}:`);
  const collectionStats = {};
  for (const collInfo of collections) {
    const collName = collInfo.name;
    const count = await db.collection(collName).countDocuments();
    collectionStats[collName] = count;
    console.log(` - ${collName}: ${count} documents`);
  }

  // 3. Locate demo tenants
  const collegesColl = db.collection('colleges');
  const demoTenants = await collegesColl.find({
    $or: [
      { code: { $in: ['NEXUS', 'OAKRIDGE'] } },
      { slug: { $in: ['nexus', 'oakridge'] } }
    ]
  }).toArray();

  console.log(`\n🏢 Found ${demoTenants.length} Demo Tenants:`);
  const demoTenantIds = demoTenants.map(t => t._id);
  demoTenants.forEach(t => {
    console.log(` - ${t.name} (Code: ${t.code}, ID: ${t._id})`);
  });

  // 4. Locate demo users under demo tenants
  const demoUsers = await usersColl.find({
    tenantId: { $in: demoTenantIds }
  }).toArray();

  console.log(`\n👥 Found ${demoUsers.length} Demo Users under demo tenants:`);
  demoUsers.forEach(u => {
    console.log(` - [${u.role}] ${u.name} <${u.email}> (ID: ${u._id})`);
  });

  const demoUserIds = demoUsers.map(u => u._id);

  // Check if any demo users have tenantId null or different
  const otherDemoUsers = await usersColl.find({
    email: { $in: ['admin@nexus.edu', 'trainer@nexus.edu', 'admin@oakridge.edu', 'teacher@oakridge.edu'] },
    _id: { $nin: demoUserIds }
  }).toArray();
  if (otherDemoUsers.length > 0) {
    console.log(`⚠️ Found ${otherDemoUsers.length} other demo users outside tenant filter!`);
  }

  // 5. Locate demo batches
  const batchesColl = db.collection('batches');
  const demoBatches = await batchesColl.find({
    tenantId: { $in: demoTenantIds }
  }).toArray();
  console.log(`\n📚 Found ${demoBatches.length} Demo Batches:`);
  demoBatches.forEach(b => {
    console.log(` - ${b.name} (Code: ${b.code}, ID: ${b._id})`);
  });
  const demoBatchIds = demoBatches.map(b => b._id);

  // 6. Check all other collections for references to demoTenantIds or demoUserIds
  const dependentRecordsBackup = {};
  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (['colleges', 'users', 'batches'].includes(collName)) continue;

    const coll = db.collection(collName);
    const records = await coll.find({
      $or: [
        { tenantId: { $in: demoTenantIds } },
        { studentId: { $in: demoUserIds } },
        { trainerId: { $in: demoUserIds } },
        { userId: { $in: demoUserIds } },
        { batchId: { $in: demoBatchIds } }
      ]
    }).toArray();

    if (records.length > 0) {
      console.log(` - ${collName}: ${records.length} dependent demo records found`);
      dependentRecordsBackup[collName] = records;
    }
  }

  // 7. Check for any genuine / non-demo data
  const genuineTenants = await collegesColl.find({
    _id: { $nin: demoTenantIds }
  }).toArray();
  console.log(`\n✨ Genuine Non-Demo Tenants: ${genuineTenants.length}`);
  genuineTenants.forEach(t => {
    console.log(` - ${t.name} (Code: ${t.code}, ID: ${t._id})`);
  });

  const genuineUsers = await usersColl.find({
    _id: { $nin: demoUserIds, $ne: superAdmin._id }
  }).toArray();
  console.log(`✨ Genuine Non-Demo Users (excluding SuperAdmin): ${genuineUsers.length}`);
  genuineUsers.forEach(u => {
    console.log(` - [${u.role}] ${u.name} <${u.email}> (ID: ${u._id})`);
  });

  // 8. Create temporary backup snapshot
  const snapshot = {
    timestamp: new Date().toISOString(),
    connection: {
      host: mongoose.connection.host,
      database: mongoose.connection.name
    },
    superAdminVerified: {
      _id: superAdmin._id.toString(),
      email: superAdmin.email,
      role: superAdmin.role
    },
    prePurgeCounts: collectionStats,
    targets: {
      colleges: demoTenants,
      users: demoUsers,
      batches: demoBatches,
      dependencies: dependentRecordsBackup
    }
  };

  const backupDir = path.resolve('server/scripts/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `pre_purge_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`\n💾 [Safety Backup Created]: ${backupPath}`);
  console.log(`   (Protected snapshot of all ${demoTenants.length} tenants, ${demoUsers.length} users, ${demoBatches.length} batches, and dependencies)`);

  await mongoose.disconnect();
  console.log('\n✅ Safety check and snapshot complete.');
}

runInspection().catch(err => {
  console.error('\n❌ Fatal Inspection Error:', err);
  process.exit(1);
});

