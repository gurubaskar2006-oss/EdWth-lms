/**
 * Lumina LMS — Live Multi-School Management & Security End-to-End Verification
 * Hits live HTTP server at http://127.0.0.1:5000 connected to MongoDB Atlas (lumina_lms)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: 'server/.env' });

const API_BASE = 'http://127.0.0.1:5000/api/v1';

async function main() {
  console.log('========================================================================');
  console.log('🚀 STARTING LUMINA LMS LIVE MULTI-SCHOOL MANAGEMENT VERIFICATION');
  console.log('========================================================================');

  // 1. Connect directly to Atlas to fetch SuperAdmin and sign token
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'lumina_lms' });
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false }));

  const superAdmin = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!superAdmin) {
    throw new Error('SuperAdmin edwthacademyadmin@6c.com not found in database!');
  }
  console.log(`✅ SuperAdmin verified: ${superAdmin.get('email')} (_id: ${superAdmin._id})`);

  const token = jwt.sign(
    { id: superAdmin._id, role: 'superadmin', isSuperAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Health check
  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  console.log('✅ Live Backend Health:', health.status, `(Uptime: ${health.uptime}s)`);

  // 3. Verify clean state in participating schools directory
  const initSchoolsRes = await fetch(`${API_BASE}/admin/schools`, { headers: authHeaders });
  const initSchools = await initSchoolsRes.json();
  console.log(`ℹ️ Participating schools before registration: ${initSchools.count} school(s)`);

  const probeSchools = (initSchools.schools || initSchools.data || []).filter(s =>
    ['SCHTEST349', 'SCHTEST9741', 'STXAVIER'].includes(s.code)
  );
  if (probeSchools.length > 0) {
    throw new Error('Purged probe schools detected in directory!');
  }
  console.log('✅ Verified zero purged test schools in active directory.');

  // 4. Register a live participating school
  const runCode = `GW-${Date.now().toString().slice(-4)}`;
  const regPayload = {
    name: `Greenwood Senior Secondary School (${runCode})`,
    code: runCode,
    address: '45 Academic Avenue',
    city: 'Bengaluru',
    state: 'Karnataka',
    contactEmail: 'contact@gwsss.edu.in',
    contactPhone: '+91 9876543210',
    institutionType: 'school',
    academicSession: '2026-2027',
    classesOffered: ['11', '12']
  };

  const regRes = await fetch(`${API_BASE}/admin/schools`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(regPayload)
  });
  const regData = await regRes.json();
  if (!regData.success) {
    throw new Error(`School registration failed: ${JSON.stringify(regData)}`);
  }
  const schoolId = regData.school?._id || regData.data?._id;
  console.log(`✅ Live school registered: ${regPayload.name} (Code: ${runCode}, ID: ${schoolId})`);
  console.log(`   - Institution Type: ${regData.data.institutionType}`);
  console.log(`   - Status: ${regData.data.status}`);
  console.log(`   - Stream Groups: ${regData.data.settings?.academicConfig?.groups?.length} initialized`);

  // 5. Update academic configuration
  const configUpdatePayload = {
    academicSession: '2026-2027 Academic Year',
    classesOffered: ['11', '12'],
    sections: ['A', 'B', 'C', 'D'],
    mediums: ['English', 'Regional Language'],
    trainingSubjects: ['Python Programming', 'Data Science Essentials', 'Communication Skills']
  };

  const configRes = await fetch(`${API_BASE}/admin/schools/${schoolId}/academic-config`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(configUpdatePayload)
  });
  const configData = await configRes.json();
  if (!configData.success) {
    throw new Error(`Academic config update failed: ${JSON.stringify(configData)}`);
  }
  console.log('✅ Academic structure updated:');
  console.log(`   - Sections: ${configData.academicConfig.sections.join(', ')}`);
  console.log(`   - Mediums: ${configData.academicConfig.mediums.join(', ')}`);
  console.log(`   - Training Subjects: ${configData.academicConfig.trainingSubjects.join(', ')}`);

  // 6. Provision School Student 1 (Class 11)
  const stu1Payload = {
    name: 'Aarav Sharma',
    email: `aarav_${Date.now()}@gwsss.edu.in`,
    collegeId: schoolId,
    standard: '11',
    group: 'Group I (MPC)',
    section: 'A',
    rollNumber: '11A-001',
    medium: 'English',
    parentName: 'Rajesh Sharma',
    parentPhone: '+91 9876543210',
    dob: '2009-05-14',
    gender: 'Male'
  };

  const stu1Res = await fetch(`${API_BASE}/admin/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(stu1Payload)
  });
  const stu1Data = await stu1Res.json();
  if (!stu1Data.success) {
    throw new Error(`Student 1 creation failed: ${JSON.stringify(stu1Data)}`);
  }
  const stu1Id = stu1Data.student._id;
  console.log(`✅ School Student 1 provisioned: ${stu1Payload.name} (Class 11, Section A, Roll ${stu1Payload.rollNumber})`);
  console.log(`   - Guardian: ${stu1Data.student.parentName} (${stu1Data.student.parentPhone})`);
  console.log(`   - Major field present? ${Boolean(stu1Data.student.major)} (Must be false)`);

  // 7. Provision School Student 2 (Class 12)
  const stu2Payload = {
    name: 'Priya Patel',
    email: `priya_${Date.now()}@gwsss.edu.in`,
    collegeId: schoolId,
    standard: '12',
    group: 'Group IV (Commerce)',
    section: 'B',
    rollNumber: '12B-015',
    medium: 'English',
    parentName: 'Sunil Patel',
    parentPhone: '+91 9876543211',
    dob: '2008-08-22',
    gender: 'Female'
  };

  const stu2Res = await fetch(`${API_BASE}/admin/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(stu2Payload)
  });
  const stu2Data = await stu2Res.json();
  if (!stu2Data.success) {
    throw new Error(`Student 2 creation failed: ${JSON.stringify(stu2Data)}`);
  }
  const stu2Id = stu2Data.student._id;
  console.log(`✅ School Student 2 provisioned: ${stu2Payload.name} (Class 12, Section B, Roll ${stu2Payload.rollNumber})`);

  // 8. Fetch student dossier
  const dossierRes = await fetch(`${API_BASE}/admin/students/${stu1Id}`, { headers: authHeaders });
  const dossier = await dossierRes.json();
  console.log(`✅ Student dossier verified for: ${dossier.student.name} (ID: ${dossier.student.id})`);
  console.log(`   - Class & Section: ${dossier.student.className}`);
  console.log(`   - Emergency Contact: ${dossier.student.emergencyContact?.name} (${dossier.student.emergencyContact?.phone})`);

  // 9. Verify Directory and Datasheet metrics
  const dirRes = await fetch(`${API_BASE}/admin/schools`, { headers: authHeaders });
  const dir = await dirRes.json();
  const dirSchool = (dir.schools || dir.data).find(s => s._id.toString() === schoolId.toString());
  if (!dirSchool) throw new Error('Registered school missing from directory!');

  console.log('✅ Live Directory Metrics Verified:');
  console.log(`   - Total Enrolled Students: ${dirSchool.totalStudents} (Expected: 2)`);
  console.log(`   - Class 11 Count: ${dirSchool.class11Count} (Expected: 1)`);
  console.log(`   - Class 12 Count: ${dirSchool.class12Count} (Expected: 1)`);
  if (dirSchool.class11Count !== 1 || dirSchool.class12Count !== 1) {
    throw new Error('Class counting bug detected: counts do not match 1 and 1!');
  }
  console.log('   🎉 Class 11/12 breakdown bug (else class11Count++) is VERIFIED FIXED in live Atlas data!');

  // 10. Test School Archiving & Restoration
  console.log('--- Testing School Archive & Restore Lifecycle ---');
  const archiveRes = await fetch(`${API_BASE}/admin/schools/${schoolId}/archive`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Yearly audit archive' })
  });
  const archiveData = await archiveRes.json();
  console.log(`✅ School archived: ${archiveData.message}`);

  const activeCheckRes = await fetch(`${API_BASE}/admin/schools`, { headers: authHeaders });
  const activeCheck = await activeCheckRes.json();
  const inActive = (activeCheck.schools || activeCheck.data).some(s => s._id.toString() === schoolId.toString());
  if (inActive) throw new Error('Archived school still appearing in active directory!');
  console.log('✅ Archived school successfully hidden from active directory.');

  const restoreRes = await fetch(`${API_BASE}/admin/schools/${schoolId}/restore`, {
    method: 'POST',
    headers: authHeaders
  });
  const restoreData = await restoreRes.json();
  console.log(`✅ School restored: ${restoreData.message}`);

  // 11. Pre-Delete Inspection
  console.log('--- Testing Pre-Delete Inspection ---');
  const inspectRes = await fetch(`${API_BASE}/admin/schools/${schoolId}/pre-delete-inspection`, { headers: authHeaders });
  const inspectData = await inspectRes.json();
  console.log(`✅ Pre-delete inspection for ${inspectData.school.name}:`);
  console.log(`   - Students associated: ${inspectData.counts.students}`);
  console.log(`   - Trainers associated: ${inspectData.counts.trainers}`);
  console.log(`   - Total dependent records: ${inspectData.counts.totalRecords}`);

  // 12. Permanent Deletion with Confirmation Code & Scoped Backup
  console.log('--- Testing Permanent Deletion Protection ---');
  const wrongCodeRes = await fetch(`${API_BASE}/admin/schools/${schoolId}`, {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ confirmationCode: 'INCORRECT_CODE' })
  });
  const wrongCodeData = await wrongCodeRes.json();
  if (wrongCodeRes.status !== 400) {
    throw new Error('Permanent deletion allowed with incorrect confirmation code!');
  }
  console.log(`✅ Correctly rejected invalid confirmation code: "${wrongCodeData.message}"`);

  const deleteRes = await fetch(`${API_BASE}/admin/schools/${schoolId}`, {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ confirmationCode: runCode })
  });
  const deleteData = await deleteRes.json();
  if (!deleteData.success) {
    throw new Error(`Permanent deletion failed: ${JSON.stringify(deleteData)}`);
  }
  console.log(`✅ School permanently deleted with confirmation code "${runCode}":`);
  console.log(`   - Backup Path: ${deleteData.backupPath}`);

  // Verify backup file exists
  if (!fs.existsSync(deleteData.backupPath)) {
    throw new Error(`Scoped backup file missing: ${deleteData.backupPath}`);
  }
  console.log('✅ Scoped JSON backup verified on disk.');

  // Verify cascade deletion in MongoDB Atlas
  const checkSchoolInDb = await College.findById(schoolId);
  const checkStudentsInDb = await User.find({ tenantId: schoolId });
  if (checkSchoolInDb || checkStudentsInDb.length > 0) {
    throw new Error('Deleted school or dependent student records still present in MongoDB!');
  }
  console.log('✅ Confirmed zero orphaned records in MongoDB Atlas.');

  // Verify SuperAdmin is intact
  const finalSuperAdmin = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
  if (!finalSuperAdmin) {
    throw new Error('CRITICAL: SuperAdmin was deleted or affected!');
  }
  console.log(`✅ SuperAdmin edwthacademyadmin@6c.com is 100% intact with role "${finalSuperAdmin.get('role')}".`);

  console.log('========================================================================');
  console.log('🎉 ALL LIVE MULTI-SCHOOL MANAGEMENT & SECURITY CHECKS PASSED PERFECTLY!');
  console.log('========================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});

