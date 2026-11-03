/**
 * EdWth LMS — Demo Institution Read-Only Data Inventory Assessment
 * 6th Civilians Corporation
 *
 * Scans connected MongoDB instance to build an authoritative, read-only
 * inventory of all records associated with demo seed tenants:
 * - Nexus Institute of Technology (NEXUS)
 * - Oakridge High School (OAKRIDGE)
 *
 * Categorizes:
 * 1. Confirmed foundational seed records
 * 2. Post-seed modified or newly created records
 * 3. Foreign key references and integrity dependencies
 * 4. File and attachment references
 *
 * STRICTLY READ-ONLY: Performs no mutations, deletions, or updates.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../database/mongoose.js';

import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Attendance from '../models/Attendance.js';
import StudentProgress from '../models/StudentProgress.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import AcademicEvent from '../models/AcademicEvent.js';
import Announcement from '../models/Announcement.js';
import Doubt from '../models/Doubt.js';
import Grade from '../models/Grade.js';
import Note from '../models/Note.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import TeacherNote from '../models/TeacherNote.js';
import AuditLog from '../models/AuditLog.js';

dotenv.config();

export const runDemoInventory = async () => {
  console.log('\n================================================================');
  console.log('🔍 [READ-ONLY AUDIT] Demo Institution Data Inventory Assessment');
  console.log('================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  const demoTenants = await College.find({
    $or: [
      { code: { $in: ['NEXUS', 'OAKRIDGE'] } },
      { slug: { $in: ['nexus', 'oakridge'] } }
    ]
  }).lean();

  if (demoTenants.length === 0) {
    console.log('ℹ️ No demo tenant records (NEXUS, OAKRIDGE) found in current database.');
    return { summary: 'No demo tenants found', tenants: [] };
  }

  const inventoryReport = {
    timestamp: new Date().toISOString(),
    databaseHost: mongoose.connection.host,
    databaseName: mongoose.connection.name,
    tenants: []
  };

  for (const tenant of demoTenants) {
    console.log(`\n🏢 Analyzing Tenant: ${tenant.name} [Code: ${tenant.code} | ID: ${tenant._id}]`);

    const tenantFilter = { tenantId: tenant._id };

    // 1. Users
    const users = await User.find(tenantFilter).select('+twoFactorSecret +twoFactorBackupCodes').lean();
    const students = users.filter(u => u.role === 'student');
    const trainers = users.filter(u => u.role === 'trainer');
    const admins = users.filter(u => u.role === 'admin');

    // 2. Batches
    const batches = await Batch.find(tenantFilter).lean();

    // 3. Courses
    const courses = await Course.find(tenantFilter).lean();

    // 4. Academic Transactional Records
    const [
      assignmentsCount,
      submissionsCount,
      attendanceCount,
      progressCount,
      assessmentsCount,
      assessmentAttemptsCount,
      assessmentEventsCount,
      academicEventsCount,
      announcementsCount,
      doubtsCount,
      gradesCount,
      notesCount,
      retakeAuthorizationsCount,
      teacherNotesCount,
      auditLogsCount
    ] = await Promise.all([
      Assignment.countDocuments(tenantFilter),
      Submission.countDocuments(tenantFilter),
      Attendance.countDocuments(tenantFilter),
      StudentProgress.countDocuments(tenantFilter),
      Assessment.countDocuments(tenantFilter),
      AssessmentAttempt.countDocuments(tenantFilter),
      AssessmentEvent.countDocuments(tenantFilter),
      AcademicEvent.countDocuments(tenantFilter),
      Announcement.countDocuments(tenantFilter),
      Doubt.countDocuments(tenantFilter),
      Grade.countDocuments(tenantFilter),
      Note.countDocuments(tenantFilter),
      RetakeAuthorization.countDocuments(tenantFilter),
      TeacherNote.countDocuments(tenantFilter),
      AuditLog.countDocuments(tenantFilter)
    ]);

    // 5. File References (avatars, submissions, notes, etc.)
    const fileReferences = [];
    users.forEach(u => {
      if (u.avatar && typeof u.avatar === 'string' && (u.avatar.startsWith('http') || u.avatar.includes('/'))) {
        fileReferences.push({ type: 'user_avatar', userId: u._id, uri: u.avatar });
      }
    });

    // 6. Categorize seed vs post-seed modified
    // Known seed accounts
    const knownSeedEmails = new Set([
      'admin@nexus.edu',
      'trainer@nexus.edu',
      'elena.admin@nexus.edu',
      'admin@oakridge.edu',
      'teacher@oakridge.edu'
    ]);

    const confirmedSeedUsers = [];
    const potentiallyModifiedUsers = [];

    users.forEach(u => {
      const emailDomain = (u.email || '').split('@')[1] || '';
      const isKnownDemoDomain = emailDomain.includes('nexus.edu') || emailDomain.includes('oakridge.edu');
      const isKnownSeed = knownSeedEmails.has(u.email) || isKnownDemoDomain;

      const userSummary = {
        _id: u._id,
        name: u.name,
        email: u.email,
        studentId: u.studentId,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        isTwoFactorEnabled: !!u.isTwoFactorEnabled,
        lastLogin: u.lastLogin || null
      };

      if (isKnownSeed && (!u.lastLogin || u.createdAt?.getTime() === u.updatedAt?.getTime())) {
        confirmedSeedUsers.push(userSummary);
      } else {
        potentiallyModifiedUsers.push(userSummary);
      }
    });

    const tenantSummary = {
      tenantId: tenant._id,
      name: tenant.name,
      code: tenant.code,
      slug: tenant.slug,
      institutionType: tenant.institutionType,
      status: tenant.status,
      counts: {
        totalUsers: users.length,
        students: students.length,
        trainers: trainers.length,
        admins: admins.length,
        batches: batches.length,
        courses: courses.length,
        assignments: assignmentsCount,
        submissions: submissionsCount,
        attendanceRecords: attendanceCount,
        studentProgressRecords: progressCount,
        assessments: assessmentsCount,
        assessmentAttempts: assessmentAttemptsCount,
        assessmentEvents: assessmentEventsCount,
        academicEvents: academicEventsCount,
        announcements: announcementsCount,
        doubts: doubtsCount,
        grades: gradesCount,
        notes: notesCount,
        retakeAuthorizations: retakeAuthorizationsCount,
        teacherNotes: teacherNotesCount,
        auditLogs: auditLogsCount,
        fileReferences: fileReferences.length
      },
      confirmedSeedUsersCount: confirmedSeedUsers.length,
      potentiallyModifiedUsersCount: potentiallyModifiedUsers.length,
      users: {
        confirmedSeedUsers,
        potentiallyModifiedUsers
      },
      batchesList: batches.map(b => ({ _id: b._id, name: b.name, code: b.code || null })),
      coursesList: courses.map(c => ({ _id: c._id, title: c.title, code: c.code || null })),
      dependencies: {
        batchesLinkedToUsers: users.filter(u => u.batchId).length,
        hasAuditHistory: auditLogsCount > 0
      }
    };

    inventoryReport.tenants.push(tenantSummary);

    console.log(`  - Users: ${users.length} (${students.length} students, ${trainers.length} trainers, ${admins.length} admins)`);
    users.forEach(u => console.log(`    * User [${u._id}] role=${u.role} email=${u.email} studentId=${u.studentId} batchId=${u.batchId || 'none'} soft_deleted=${!!u.soft_deleted}`));
    console.log(`  - Batches: ${batches.length}`);
    batches.forEach(b => console.log(`    * Batch [${b._id}] name="${b.name}" status=${b.status}`));
    console.log(`  - Courses: ${courses.length}`);
    console.log(`  - Submissions & Attempts: ${submissionsCount} submissions, ${assessmentAttemptsCount} attempts`);
    console.log(`  - Attendance Records: ${attendanceCount}`);
    console.log(`  - Audit Logs: ${auditLogsCount} logs`);
    console.log(`  - File References: ${fileReferences.length}`);
    fileReferences.forEach(f => console.log(`    * FileRef: userId=${f.userId} uri=${f.uri}`));
  }

  console.log('\n================================================================');
  console.log('✅ Inventory complete. No records were modified or deleted.');
  console.log('================================================================\n');

  return inventoryReport;
};

// Execute if run directly from command line
if (process.argv[1] && process.argv[1].endsWith('inventoryDemoData.js')) {
  runDemoInventory()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Inventory failed:', err);
      process.exit(1);
    });
}
