/**
 * Lumina LMS — School General Enrollment & Teacher Visibility Test Suite
 * 6th Civilians Corporation
 *
 * Verifies the 12 required scenarios for School Member Assignment and Teacher Visibility:
 * 1. General Enrollment creates or reuses the correct class cohort.
 * 2. A student is linked to the correct cohort.
 * 3. A teacher is linked to that cohort.
 * 4. Both 'trainer' and 'teacher' roles work as intended.
 * 5. A teacher sees only students in assigned cohorts.
 * 6. A teacher assigned to multiple cohorts sees all of those cohorts' students.
 * 7. An unassigned teacher sees zero students, even if other students exist in the same tenant.
 * 8. A teacher cannot access another tenant's students or cohorts.
 * 9. Analytics and roster counts agree.
 * 10. Repeated assignments do not create duplicate cohorts or duplicate relationships.
 * 11. Invalid IDs and partial failures do not produce false success messages.
 * 12. Existing college trainer workflows continue working.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';
import { createSession } from '../services/sessionService.js';

describe('Lumina LMS — School General Enrollment & Teacher Visibility Suite', () => {
  jest.setTimeout(120000);
  const testSuffix = Date.now();

  let schoolA;
  let schoolB;
  let collegeC;

  let superAdminUser;
  let superAdminToken;

  let schoolAdminUser;
  let schoolAdminToken;

  let collegeAdminUser;
  let collegeAdminToken;

  let teacher1User;
  let teacher1Token;

  let trainer1User;
  let trainer1Token;

  let unassignedTeacherUser;
  let unassignedTeacherToken;

  let collegeTrainerUser;
  let collegeTrainerToken;

  let student1;
  let student2;
  let student3OtherCohort;
  let studentUnassigned;
  let foreignStudent;
  let collegeStudent;

  let resolvedDefaultCohort;
  let cohort2SchoolA;
  let collegeBatch;

  const makeAuthToken = (user, sessionId) => {
    return jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        sessionId: sessionId ? sessionId.toString() : undefined
      },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const hashedPassword = await bcrypt.hash('SecurePassword!123', 10);

    // 1. Institutions
    schoolA = await College.create({
      name: `Apex High School ${testSuffix}`,
      code: `APX-${testSuffix}`,
      slug: `apex-high-${testSuffix}`,
      institutionType: 'school',
      status: 'active'
    });

    schoolB = await College.create({
      name: `Foreign School ${testSuffix}`,
      code: `FOR-${testSuffix}`,
      slug: `foreign-school-${testSuffix}`,
      institutionType: 'school',
      status: 'active'
    });

    collegeC = await College.create({
      name: `Nexus Engineering College ${testSuffix}`,
      code: `NEX-${testSuffix}`,
      slug: `nexus-eng-${testSuffix}`,
      institutionType: 'college',
      status: 'active'
    });

    // 2. Administrators
    superAdminUser = await User.create({
      tenantId: null,
      name: 'Super Administrator',
      email: `superadmin.${testSuffix}@6thcivilians.org`,
      studentId: `ADM-SA-${testSuffix}`,
      password: hashedPassword,
      role: 'superadmin',
      accountStatus: 'Active',
      status: 'Active'
    });
    const saSess = await createSession(superAdminUser, { userAgent: 'test-agent', ip: '127.0.0.1' });
    superAdminToken = makeAuthToken(superAdminUser, saSess.sessionId);

    schoolAdminUser = await User.create({
      tenantId: schoolA._id,
      name: 'School Administrator',
      email: `principal.${testSuffix}@apex.edu`,
      studentId: `ADM-SCH-${testSuffix}`,
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'Active',
      status: 'Active'
    });
    const sAdminSess = await createSession(schoolAdminUser, { userAgent: 'test-agent', ip: '127.0.0.1' });
    schoolAdminToken = makeAuthToken(schoolAdminUser, sAdminSess.sessionId);

    collegeAdminUser = await User.create({
      tenantId: collegeC._id,
      name: 'College Dean',
      email: `dean.${testSuffix}@nexus.edu`,
      studentId: `ADM-COL-${testSuffix}`,
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'Active',
      status: 'Active'
    });
    const cAdminSess = await createSession(collegeAdminUser, { userAgent: 'test-agent', ip: '127.0.0.1' });
    collegeAdminToken = makeAuthToken(collegeAdminUser, cAdminSess.sessionId);

    // 3. Educators
    teacher1User = await User.create({
      tenantId: schoolA._id,
      name: 'Ms. Sarah Teacher',
      email: `sarah.teacher.${testSuffix}@apex.edu`,
      studentId: `TCH-1-${testSuffix}`,
      password: hashedPassword,
      role: 'teacher',
      accountStatus: 'Active',
      status: 'Active',
      mustChangePassword: false
    });

    trainer1User = await User.create({
      tenantId: schoolA._id,
      name: 'Mr. David Trainer',
      email: `david.trainer.${testSuffix}@apex.edu`,
      studentId: `TRN-1-${testSuffix}`,
      password: hashedPassword,
      role: 'trainer',
      accountStatus: 'Active',
      status: 'Active',
      mustChangePassword: false
    });

    unassignedTeacherUser = await User.create({
      tenantId: schoolA._id,
      name: 'Mr. Unassigned Teacher',
      email: `unassigned.${testSuffix}@apex.edu`,
      studentId: `TCH-U-${testSuffix}`,
      password: hashedPassword,
      role: 'teacher',
      accountStatus: 'Active',
      status: 'Active',
      batchId: null,
      mustChangePassword: false
    });

    collegeTrainerUser = await User.create({
      tenantId: collegeC._id,
      name: 'Prof. College Trainer',
      email: `college.trainer.${testSuffix}@nexus.edu`,
      studentId: `TRN-COL-${testSuffix}`,
      password: hashedPassword,
      role: 'trainer',
      accountStatus: 'Active',
      status: 'Active',
      mustChangePassword: false
    });

    // 4. Students
    student1 = await User.create({
      tenantId: schoolA._id,
      name: 'Abitha Student',
      email: `abitha.${testSuffix}@apex.edu`,
      studentId: `STU-A-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      className: 'Class 11',
      accountStatus: 'Active',
      status: 'Active'
    });

    student2 = await User.create({
      tenantId: schoolA._id,
      name: 'Babu Student',
      email: `babu.${testSuffix}@apex.edu`,
      studentId: `STU-B-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      className: 'Class 11',
      accountStatus: 'Active',
      status: 'Active'
    });

    student3OtherCohort = await User.create({
      tenantId: schoolA._id,
      name: 'Chitra Student',
      email: `chitra.${testSuffix}@apex.edu`,
      studentId: `STU-C-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      className: 'Class 11',
      accountStatus: 'Active',
      status: 'Active'
    });

    studentUnassigned = await User.create({
      tenantId: schoolA._id,
      name: 'Dinesh Unassigned',
      email: `dinesh.${testSuffix}@apex.edu`,
      studentId: `STU-D-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      className: 'Class 11',
      accountStatus: 'Active',
      status: 'Active',
      batchId: null
    });

    foreignStudent = await User.create({
      tenantId: schoolB._id,
      name: 'Foreign Student',
      email: `foreign.${testSuffix}@foreign.edu`,
      studentId: `STU-F-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      className: 'Class 11',
      accountStatus: 'Active',
      status: 'Active'
    });

    collegeStudent = await User.create({
      tenantId: collegeC._id,
      name: 'College Student',
      email: `college.stu.${testSuffix}@nexus.edu`,
      studentId: `STU-COL-${testSuffix}`,
      password: hashedPassword,
      role: 'student',
      accountStatus: 'Active',
      status: 'Active'
    });

    // Create session tokens for educators
    const t1Sess = await createSession(teacher1User, { userAgent: 'test-agent', ip: '127.0.0.1' });
    teacher1Token = makeAuthToken(teacher1User, t1Sess.sessionId);

    const tr1Sess = await createSession(trainer1User, { userAgent: 'test-agent', ip: '127.0.0.1' });
    trainer1Token = makeAuthToken(trainer1User, tr1Sess.sessionId);

    const utSess = await createSession(unassignedTeacherUser, { userAgent: 'test-agent', ip: '127.0.0.1' });
    unassignedTeacherToken = makeAuthToken(unassignedTeacherUser, utSess.sessionId);

    const ctSess = await createSession(collegeTrainerUser, { userAgent: 'test-agent', ip: '127.0.0.1' });
    collegeTrainerToken = makeAuthToken(collegeTrainerUser, ctSess.sessionId);
  }, 120000);

  afterAll(async () => {
    const institutionIds = [schoolA?._id, schoolB?._id, collegeC?._id].filter(Boolean);
    if (institutionIds.length > 0) {
      await Promise.all([
        College.deleteMany({ _id: { $in: institutionIds } }),
        User.deleteMany({ tenantId: { $in: institutionIds } }),
        Batch.deleteMany({ tenantId: { $in: institutionIds } }),
        Session.deleteMany({
          userId: {
            $in: [
              superAdminUser?._id,
              schoolAdminUser?._id,
              collegeAdminUser?._id,
              teacher1User?._id,
              trainer1User?._id,
              unassignedTeacherUser?._id,
              collegeTrainerUser?._id
            ].filter(Boolean)
          }
        })
      ]);
    }
  }, 120000);

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: General Enrollment creates or reuses the correct class cohort
  // ───────────────────────────────────────────────────────────────────────────
  it('1. should resolve or create the default class cohort on General School Enrollment (cohortId: null)', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        studentIds: [student1._id.toString()],
        trainerIds: [teacher1User._id.toString()],
        cohortId: null,
        className: 'Class 11'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cohort).toBeDefined();
    expect(res.body.cohort.targetClass).toBe('Class 11');
    expect(res.body.updatedStudentsCount).toBe(1);
    expect(res.body.updatedTrainersCount).toBe(1);

    resolvedDefaultCohort = await Batch.findById(res.body.cohort._id);
    expect(resolvedDefaultCohort).not.toBeNull();
    expect(resolvedDefaultCohort.tenantId.toString()).toBe(schoolA._id.toString());
    expect(resolvedDefaultCohort.targetClass).toBe('Class 11');
    expect(resolvedDefaultCohort.name).toBe(`${schoolA.name} - Class 11`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: A student is linked to the correct cohort
  // ───────────────────────────────────────────────────────────────────────────
  it('2. should link the assigned student to the resolved default cohort via User.batchId', async () => {
    const updatedStudent = await User.findById(student1._id);
    expect(updatedStudent.tenantId.toString()).toBe(schoolA._id.toString());
    expect(updatedStudent.className).toBe('Class 11');
    expect(updatedStudent.batchId).not.toBeNull();
    expect(updatedStudent.batchId.toString()).toBe(resolvedDefaultCohort._id.toString());
    expect(updatedStudent.batch).toBe(resolvedDefaultCohort.name);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: A teacher is linked to that cohort
  // ───────────────────────────────────────────────────────────────────────────
  it('3. should link the assigned teacher via Batch.assignedTrainers and User.batchId', async () => {
    const updatedBatch = await Batch.findById(resolvedDefaultCohort._id);
    expect(updatedBatch.assignedTrainers.map(String)).toContain(teacher1User._id.toString());

    const updatedTeacher = await User.findById(teacher1User._id);
    expect(updatedTeacher.batchId.toString()).toBe(resolvedDefaultCohort._id.toString());
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Both 'trainer' and 'teacher' roles work as intended
  // ───────────────────────────────────────────────────────────────────────────
  it('4. should support both "trainer" and "teacher" roles in school member assignment', async () => {
    // Assign student2 together with trainer1User (role: 'trainer') to the same cohort
    const res = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [student2._id.toString()],
        trainerIds: [trainer1User._id.toString()],
        cohortId: resolvedDefaultCohort._id.toString(),
        className: 'Class 11'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedBatch = await Batch.findById(resolvedDefaultCohort._id);
    // Both teacher1 (role: 'teacher') and trainer1 (role: 'trainer') are assigned
    expect(updatedBatch.assignedTrainers.map(String)).toContain(teacher1User._id.toString());
    expect(updatedBatch.assignedTrainers.map(String)).toContain(trainer1User._id.toString());

    const updatedTrainer = await User.findById(trainer1User._id);
    expect(updatedTrainer.batchId.toString()).toBe(resolvedDefaultCohort._id.toString());
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: A teacher sees only students in assigned cohorts
  // ───────────────────────────────────────────────────────────────────────────
  it('5. should allow teacher to see only students in assigned cohorts in GET /trainer/students', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${teacher1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const studentIds = res.body.students.map((s) => s._id.toString());
    expect(studentIds).toContain(student1._id.toString());
    expect(studentIds).toContain(student2._id.toString());

    // Student without an assigned cohort must NOT be in the teacher's roster
    expect(studentIds).not.toContain(studentUnassigned._id.toString());
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: A teacher assigned to multiple cohorts sees all of those cohorts' students
  // ───────────────────────────────────────────────────────────────────────────
  it('6. should allow a teacher assigned to multiple cohorts to see all and only those cohorts\' students', async () => {
    // Create second cohort in School A
    cohort2SchoolA = await Batch.create({
      tenantId: schoolA._id,
      name: `${schoolA.name} - Class 11 Section B`,
      targetClass: 'Class 11',
      status: 'active',
      scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      assignedTrainers: [teacher1User._id] // teacher1 is also assigned here
    });

    // Assign student3 to cohort2
    await User.findByIdAndUpdate(student3OtherCohort._id, {
      batchId: cohort2SchoolA._id,
      batch: cohort2SchoolA.name
    });

    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${teacher1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.students.length).toBe(3);

    const studentIds = res.body.students.map((s) => s._id.toString());
    expect(studentIds).toContain(student1._id.toString()); // from cohort 1
    expect(studentIds).toContain(student2._id.toString()); // from cohort 1
    expect(studentIds).toContain(student3OtherCohort._id.toString()); // from cohort 2
    expect(studentIds).not.toContain(studentUnassigned._id.toString());
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: An unassigned teacher sees zero students
  // ───────────────────────────────────────────────────────────────────────────
  it('7. should return an empty list (0 students) for an unassigned teacher even if students exist in same tenant', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${unassignedTeacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.students).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: A teacher cannot access another tenant's students or cohorts
  // ───────────────────────────────────────────────────────────────────────────
  it('8. should prevent teacher from accessing another tenant\'s students or cohorts (strict isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/trainer/students/${foreignStudent._id}/dossier`)
      .set('Authorization', `Bearer ${teacher1Token}`);

    // Must return 404 (not found in tenant directory) and never leak foreign data
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 9: Analytics and roster counts agree
  // ───────────────────────────────────────────────────────────────────────────
  it('9. should ensure analytics and roster counts strictly agree for both assigned and unassigned educators', async () => {
    // 1. Assigned teacher (assigned to 2 cohorts with 3 students)
    const [analyticsRes, rosterRes, classesRes] = await Promise.all([
      request(app).get('/api/v1/trainer/analytics').set('Authorization', `Bearer ${teacher1Token}`),
      request(app).get('/api/v1/trainer/students').set('Authorization', `Bearer ${teacher1Token}`),
      request(app).get('/api/v1/trainer/classes').set('Authorization', `Bearer ${teacher1Token}`)
    ]);

    expect(analyticsRes.status).toBe(200);
    expect(rosterRes.status).toBe(200);
    expect(classesRes.status).toBe(200);

    expect(analyticsRes.body.data.totalStudents).toBe(3);
    expect(analyticsRes.body.data.activeCohortsCount).toBe(2);
    expect(rosterRes.body.students.length).toBe(3);
    expect(classesRes.body.classes.length).toBe(2);
    expect(analyticsRes.body.data.totalStudents).toBe(rosterRes.body.students.length);

    // 2. Unassigned teacher (0 cohorts, 0 students)
    const [unassignedAnalytics, unassignedRoster, unassignedClasses] = await Promise.all([
      request(app).get('/api/v1/trainer/analytics').set('Authorization', `Bearer ${unassignedTeacherToken}`),
      request(app).get('/api/v1/trainer/students').set('Authorization', `Bearer ${unassignedTeacherToken}`),
      request(app).get('/api/v1/trainer/classes').set('Authorization', `Bearer ${unassignedTeacherToken}`)
    ]);

    expect(unassignedAnalytics.body.data.totalStudents).toBe(0);
    expect(unassignedAnalytics.body.data.activeCohortsCount).toBe(0);
    expect(unassignedRoster.body.students.length).toBe(0);
    expect(unassignedClasses.body.classes.length).toBe(0);
    expect(unassignedAnalytics.body.data.totalStudents).toBe(unassignedRoster.body.students.length);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 10: Repeated assignments do not create duplicate cohorts or duplicate references
  // ───────────────────────────────────────────────────────────────────────────
  it('10. should ensure repeated assignments are idempotent and do not create duplicate cohorts or references', async () => {
    // Repeat General Enrollment assignment with student1 and teacher1
    const res = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        studentIds: [student1._id.toString()],
        trainerIds: [teacher1User._id.toString()],
        cohortId: null,
        className: 'Class 11'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify only ONE default cohort exists for Class 11 in schoolA
    const matchingCohorts = await Batch.find({
      tenantId: schoolA._id,
      targetClass: 'Class 11',
      name: `${schoolA.name} - Class 11`
    });
    expect(matchingCohorts.length).toBe(1);

    // Verify assignedTrainers array has no duplicate IDs
    const cohortDoc = matchingCohorts[0];
    const trainerStringIds = cohortDoc.assignedTrainers.map(String);
    const uniqueIds = new Set(trainerStringIds);
    expect(trainerStringIds.length).toBe(uniqueIds.size);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 11: Invalid IDs and partial failures do not produce false success messages
  // ───────────────────────────────────────────────────────────────────────────
  it('11. should reject invalid IDs and partial failures without producing false success messages', async () => {
    // 1. Malformed student ID
    const malformedRes = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        studentIds: ['not-a-valid-oid'],
        trainerIds: [teacher1User._id.toString()],
        className: 'Class 11'
      });
    expect(malformedRes.status).toBe(400);
    expect(malformedRes.body.code).toBe('INVALID_STUDENT_ID');

    // 2. Non-existent student ID
    const fakeStudentId = new mongoose.Types.ObjectId();
    const missingStudentRes = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        studentIds: [student1._id.toString(), fakeStudentId.toString()],
        trainerIds: [teacher1User._id.toString()],
        className: 'Class 11'
      });
    expect(missingStudentRes.status).toBe(400);
    expect(missingStudentRes.body.code).toBe('STUDENT_NOT_FOUND');

    // 3. Non-existent cohort ID
    const fakeCohortId = new mongoose.Types.ObjectId();
    const missingCohortRes = await request(app)
      .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        studentIds: [student1._id.toString()],
        cohortId: fakeCohortId.toString(),
        className: 'Class 11'
      });
    expect(missingCohortRes.status).toBe(404);
    expect(missingCohortRes.body.code).toBe('COHORT_NOT_FOUND');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 12: Existing college trainer workflows continue working
  // ───────────────────────────────────────────────────────────────────────────
  it('12. should preserve existing college trainer workflows without regressions', async () => {
    // 1. College Admin creates college batch
    collegeBatch = await Batch.create({
      tenantId: collegeC._id,
      name: 'B.Tech CS - Section A',
      targetClass: 'General',
      status: 'active',
      scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      assignedTrainers: []
    });

    // 2. Assign college student to college batch
    await User.findByIdAndUpdate(collegeStudent._id, {
      batchId: collegeBatch._id,
      batch: collegeBatch.name
    });

    // 3. College Admin assigns trainer to batch via PUT /admin/trainers/:id
    const assignRes = await request(app)
      .put(`/api/v1/admin/trainers/${collegeTrainerUser._id}`)
      .set('Authorization', `Bearer ${collegeAdminToken}`)
      .send({
        batchId: collegeBatch._id.toString()
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.success).toBe(true);

    // 4. College trainer portal check
    const [colRoster, colAnalytics] = await Promise.all([
      request(app).get('/api/v1/trainer/students').set('Authorization', `Bearer ${collegeTrainerToken}`),
      request(app).get('/api/v1/trainer/analytics').set('Authorization', `Bearer ${collegeTrainerToken}`)
    ]);

    expect(colRoster.status).toBe(200);
    expect(colRoster.body.students.length).toBe(1);
    expect(colRoster.body.students[0]._id.toString()).toBe(collegeStudent._id.toString());

    expect(colAnalytics.status).toBe(200);
    expect(colAnalytics.body.data.totalStudents).toBe(1);
    expect(colAnalytics.body.data.activeCohortsCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FAILURE-INJECTION & ATOMIC ROLLBACK TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Assignment Failure-Injection & Transaction Safety', () => {
    let failStudent;
    let failTeacher;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('SecurePassword!123', 10);
      failStudent = await User.create({
        tenantId: schoolA._id,
        name: 'Failure Test Student',
        email: `fail.student.${testSuffix}@apex.edu`,
        studentId: `STU-FAIL-${testSuffix}`,
        password: hashedPassword,
        role: 'student',
        className: 'Class 11',
        accountStatus: 'Active',
        status: 'Active',
        batchId: null
      });

      failTeacher = await User.create({
        tenantId: schoolA._id,
        name: 'Failure Test Teacher',
        email: `fail.teacher.${testSuffix}@apex.edu`,
        studentId: `TCH-FAIL-${testSuffix}`,
        password: hashedPassword,
        role: 'teacher',
        accountStatus: 'Active',
        status: 'Active',
        batchId: null,
        mustChangePassword: false
      });
    });

    afterAll(async () => {
      if (failStudent?._id || failTeacher?._id) {
        await User.deleteMany({ _id: { $in: [failStudent?._id, failTeacher?._id].filter(Boolean) } });
      }
    });

    it('13. should fail closed with 503 TRANSACTIONS_UNAVAILABLE when database transactions cannot start', async () => {
      const txError = new Error('Transactions are not supported by this deployment');
      txError.code = 20;
      txError.codeName = 'IllegalOperation';

      const startSessionSpy = jest.spyOn(mongoose, 'startSession').mockRejectedValueOnce(txError);

      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      startSessionSpy.mockRestore();

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TRANSACTIONS_UNAVAILABLE');

      // Verify no partial writes occurred in the database
      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).toBeNull();

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).toBeNull();
    });

    it('14. should abort transaction when student update fails, leaving no partial assignment', async () => {
      const origUpdateMany = User.updateMany;
      jest.spyOn(User, 'updateMany').mockImplementationOnce(() => {
        throw new Error('Simulated student update write failure');
      });

      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      User.updateMany = origUpdateMany;

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).toBeNull();

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).toBeNull();
    });

    it('15. should abort transaction and roll back student update when educator update fails', async () => {
      const origUpdateMany = User.updateMany;
      let callCount = 0;
      jest.spyOn(User, 'updateMany').mockImplementation((...args) => {
        callCount++;
        // 1st call is for students (let it succeed), 2nd call is for educators (simulate failure)
        if (callCount === 2) {
          throw new Error('Simulated educator write failure midway through transaction');
        }
        return origUpdateMany.apply(User, args);
      });

      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      User.updateMany = origUpdateMany;

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      // CRITICAL ATOMICITY CHECK: Even though student update was executed in the session,
      // the transaction abort MUST roll it back so student.batchId remains null!
      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).toBeNull();

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).toBeNull();
    });

    it('16. should abort transaction when cohort trainer update fails after user updates', async () => {
      const origFindByIdAndUpdate = Batch.findByIdAndUpdate;
      jest.spyOn(Batch, 'findByIdAndUpdate').mockImplementationOnce(() => {
        throw new Error('Simulated cohort findByIdAndUpdate failure');
      });

      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      Batch.findByIdAndUpdate = origFindByIdAndUpdate;

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).toBeNull();

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).toBeNull();
    });

    it('17. should abort transaction when critical audit log fails, rolling back all assignment writes', async () => {
      const origSave = AuditLog.prototype.save;
      jest.spyOn(AuditLog.prototype, 'save').mockImplementationOnce(() => {
        throw new Error('Simulated audit log write failure inside transaction');
      });

      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      AuditLog.prototype.save = origSave;

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      // CRITICAL CHECK: All writes must be rolled back because audit logging failed
      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).toBeNull();

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).toBeNull();

      // Verify no audit log exists for this aborted attempt
      const auditLog = await AuditLog.findOne({
        action: 'PLATFORM_ADMIN_MEMBERS_ASSIGNED',
        'details.studentIds': failStudent._id
      });
      expect(auditLog).toBeNull();
    });

    it('18. should successfully commit all assignment writes and critical audit log atomically in one transaction', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/assign`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentIds: [failStudent._id.toString()],
          trainerIds: [failTeacher._id.toString()],
          cohortId: null,
          className: 'Class 11'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedStudentsCount).toBe(1);
      expect(res.body.updatedTrainersCount).toBe(1);

      // Verify DB updates
      const studentAfter = await User.findById(failStudent._id);
      expect(studentAfter.batchId).not.toBeNull();
      expect(studentAfter.batch).toBe(res.body.cohort.name);

      const teacherAfter = await User.findById(failTeacher._id);
      expect(teacherAfter.batchId).not.toBeNull();

      const batchAfter = await Batch.findById(res.body.cohort._id);
      expect(batchAfter.assignedTrainers.map(String)).toContain(failTeacher._id.toString());

      // Verify audit log exists
      const auditLog = await AuditLog.findOne({
        action: 'PLATFORM_ADMIN_MEMBERS_ASSIGNED',
        'details.studentIds': failStudent._id
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog.details.schoolId.toString()).toBe(schoolA._id.toString());
      expect(auditLog.details.cohortId.toString()).toBe(res.body.cohort._id.toString());
    });
  });
});
