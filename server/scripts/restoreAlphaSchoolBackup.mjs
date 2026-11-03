import fs from 'fs';
import mongoose from 'mongoose';
import { connectDB } from '../database/mongoose.js';
import College from '../models/College.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

async function restore() {
  console.log('=== RESTORING ALPHA SCHOOL & STUDENT FROM SAFETY BACKUP ===\n');
  await connectDB();

  const backupPath = 'server/scripts/backups/school_purge_2101_1793353413901.json';
  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found:', backupPath);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const schoolData = backupData.school;
  const userData = backupData.records.users[0];

  // 1. Restore School
  const existingSchool = await College.findById(schoolData._id);
  if (!existingSchool) {
    const schoolDoc = new College({
      _id: new mongoose.Types.ObjectId(schoolData._id),
      name: schoolData.name,
      code: schoolData.code,
      slug: schoolData.slug,
      institutionType: schoolData.institutionType,
      status: schoolData.status || 'active',
      settings: schoolData.settings,
      createdAt: new Date(schoolData.createdAt),
      updatedAt: new Date(schoolData.updatedAt)
    });
    await schoolDoc.save();
    console.log(`✅ Restored School: ${schoolDoc.name} (${schoolDoc.code}) with ID ${schoolDoc._id}`);
  } else {
    console.log(`ℹ️ School already exists: ${existingSchool.name} (${existingSchool._id})`);
  }

  // 2. Restore Student
  if (userData) {
    const existingUser = await User.findById(userData._id);
    if (!existingUser) {
      const userDoc = new User({
        _id: new mongoose.Types.ObjectId(userData._id),
        studentId: userData.studentId,
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        tenantId: new mongoose.Types.ObjectId(userData.tenantId),
        isTwoFactorEnabled: userData.isTwoFactorEnabled,
        mustChangePassword: userData.mustChangePassword,
        soft_deleted: userData.soft_deleted,
        className: userData.className,
        standard: userData.standard,
        group: userData.group,
        section: userData.section,
        rollNumber: userData.rollNumber,
        medium: userData.medium,
        parentName: userData.parentName,
        parentPhone: userData.parentPhone,
        dob: userData.dob,
        gender: userData.gender,
        schoolProfile: userData.schoolProfile,
        status: userData.status,
        accountStatus: userData.accountStatus,
        createdAt: new Date(userData.createdAt),
        updatedAt: new Date(userData.updatedAt)
      });
      await userDoc.save();
      console.log(`✅ Restored Student: ${userDoc.name} (${userDoc.studentId}) under School ${userDoc.tenantId}`);
    } else {
      console.log(`ℹ️ Student already exists: ${existingUser.name} (${existingUser._id})`);
    }
  }

  // 3. Create Audit Log
  await AuditLog.create({
    action: 'PLATFORM_ADMIN_SCHOOL_RESTORED_FROM_PURGE_BACKUP',
    tenantId: new mongoose.Types.ObjectId(schoolData._id),
    actor: {
      email: 'edwthacademyadmin@6c.com',
      role: 'superadmin'
    },
    resource: 'College',
    details: {
      schoolId: schoolData._id,
      name: schoolData.name,
      code: schoolData.code,
      backupFile: backupPath,
      recoveredUsers: userData ? [userData.email] : []
    }
  });

  console.log('\n🎉 Exact restoration completed with original IDs intact!');
  process.exit(0);
}

restore().catch(err => {
  console.error('Restoration failed:', err);
  process.exit(1);
});
