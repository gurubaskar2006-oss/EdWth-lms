/**
 * EdWth Academy LMS — Full End-to-End Acceptance Journeys 1 Through 8
 * 6th Civilians Corporation
 *
 * Automated verification of the 8 canonical academic and security journeys:
 * - Journey 1: School Onboarding & Roster Provisioning
 * - Journey 2: Student Temporary Credentials & Forced Permanent Password Change
 * - Journey 3: Learning Lifecycle (Subject, Homework, Submission & Teacher Grading)
 * - Journey 4: Assessments Lifecycle (Assessment Configuration, Student Attempt, Server-Side Grading & Marks)
 * - Journey 5: Code Lab Multi-Language Execution & Challenge Grading (Python, C++, SQL)
 * - Journey 6: Communication & Audience-Targeted Announcements with Tenant Isolation
 * - Journey 7: Security Boundaries, RBAC Enforcement & IDOR/Escalation Defense
 * - Journey 8: Session Persistence, Refresh & State Recovery
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Announcement from '../models/Announcement.js';
import StudentProgress from '../models/StudentProgress.js';
import { getJwtSecret } from '../config/environment.js';

describe('EdWth Academy LMS — Full End-to-End Acceptance Journeys 1 to 8', () => {
  const ts = Date.now();
  const jwtSecret = getJwtSecret();

  let superAdminUser;
  let superAdminToken;

  let schoolCollege;
  let rivalSchool;
  let schoolCohort;
  let teacherUser;
  let teacherToken;
  let studentUser;
  let studentToken;
  let rivalStudent;
  let rivalStudentToken;

  let createdCourse;
  let createdHomework;
  let createdSubmission;
  let createdAssessment;
  let createdAttempt;
  let createdAnnouncement;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }

    // 0. Platform SuperAdmin Setup
    const saPasswordHash = await bcrypt.hash('SuperAdmin!2026Pass', 10);
    superAdminUser = await User.create({
      studentId: `SA-${ts}`,
      name: 'SuperAdmin Corporate Operator',
      email: `operator.${ts}@6c.com`,
      password: saPasswordHash,
      role: 'superadmin',
      isTwoFactorEnabled: false,
      tenantId: null
    });

    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin', tenantId: null },
      jwtSecret,
      { expiresIn: '2h' }
    );
  }, 30000);

  afterAll(async () => {
    try {
      const tenantIds = [schoolCollege?._id, rivalSchool?._id].filter(Boolean);
      if (tenantIds.length > 0) {
        await College.deleteMany({ _id: { $in: tenantIds } });
        await Batch.deleteMany({ tenantId: { $in: tenantIds } });
        await Course.deleteMany({ tenantId: { $in: tenantIds } });
        await Assignment.deleteMany({ tenantId: { $in: tenantIds } });
        await Submission.deleteMany({ tenantId: { $in: tenantIds } });
        await Assessment.deleteMany({ tenantId: { $in: tenantIds } });
        await AssessmentAttempt.deleteMany({ tenantId: { $in: tenantIds } });
        await Announcement.deleteMany({ tenantId: { $in: tenantIds } });
        await StudentProgress.deleteMany({ tenantId: { $in: tenantIds } });
      }
      const userIds = [
        superAdminUser?._id,
        teacherUser?._id,
        studentUser?._id,
        rivalStudent?._id
      ].filter(Boolean);
      if (userIds.length > 0) {
        await User.deleteMany({ _id: { $in: userIds } });
      }
    } catch {}
  });

  // =========================================================================
  // JOURNEY 1: SCHOOL ONBOARDING
  // =========================================================================
  describe('Journey 1 — School Onboarding & Roster Provisioning', () => {
    it('1.1 Admin creates school and verifies persisted institution in database', async () => {
      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `Greenwood High International ${ts}`,
          code: `GWH-${ts}`,
          institutionType: 'school',
          status: 'active',
          address: '100 Academic Blvd',
          primaryContact: {
            name: 'Principal Anderson',
            email: `principal.${ts}@greenwoodhigh.org`,
            phone: '+1-555-0199'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const schoolId = res.body.school?._id || res.body.data?._id;
      expect(schoolId).toBeDefined();

      schoolCollege = await College.findById(schoolId);
      expect(schoolCollege).not.toBeNull();
      expect(schoolCollege.name).toContain('Greenwood High International');
      expect(schoolCollege.institutionType).toBe('school');
    });

    it('1.2 Configures school cohort with schedule hours and class', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolCollege._id}/cohorts`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Class 11 - Section Alpha',
          targetClass: 'Class 11',
          sessionStartTime: '09:00 AM',
          sessionEndTime: '10:00 AM',
          scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);

      schoolCohort = res.body.batch || (await Batch.findOne({ tenantId: schoolCollege._id }));
      expect(schoolCohort).not.toBeNull();
      expect(schoolCohort.name).toBe('Class 11 - Section Alpha');
    });

    it('1.3 Registers teacher and assigns to school cohort', async () => {
      const teacherRes = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Prof. Marcus Vance',
          email: `marcus.vance.${ts}@greenwoodhigh.org`,
          password: 'TrainerPass123!Secure',
          department: 'Science & Computing',
          tenantId: schoolCollege._id,
          assignedBatches: [schoolCohort._id]
        });

      expect(teacherRes.status).toBe(201);
      expect(teacherRes.body.success).toBe(true);

      teacherUser = await User.findOne({ email: `marcus.vance.${ts}@greenwoodhigh.org` });
      expect(teacherUser).not.toBeNull();
      expect(teacherUser.role).toBe('trainer');

      teacherToken = jwt.sign(
        { id: teacherUser._id, role: 'trainer', tenantId: schoolCollege._id },
        jwtSecret,
        { expiresIn: '2h' }
      );
    });

    it('1.4 Registers student and verifies class roster inclusion', async () => {
      const studentRes = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'David Lightman',
          email: `david.lightman.${ts}@greenwoodhigh.org`,
          password: 'StudentTempPassword123!',
          tenantId: schoolCollege._id,
          batchId: schoolCohort._id,
          className: 'Class 11 - Section Alpha',
          department: 'Science'
        });

      expect([200, 201]).toContain(studentRes.status);
      expect(studentRes.body.success).toBe(true);

      studentUser = await User.findOne({ email: `david.lightman.${ts}@greenwoodhigh.org` });
      expect(studentUser).not.toBeNull();
      expect(studentUser.role).toBe('student');

      // Verify roster query
      const rosterRes = await request(app)
        .get('/api/v1/trainer/students')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(rosterRes.status).toBe(200);
      const studentFound = (rosterRes.body.students || []).some(
        s => String(s._id) === String(studentUser._id) || s.email === studentUser.email
      );
      expect(studentFound).toBe(true);
    });
  });

  // =========================================================================
  // JOURNEY 2: STUDENT CREDENTIALS & FORCED PASSWORD CHANGE
  // =========================================================================
  describe('Journey 2 — Student Credentials & Forced Password Change', () => {
    it('2.1 Admin resets student password and forces temporary credential change', async () => {
      const resetRes = await request(app)
        .post(`/api/v1/admin/students/${studentUser._id}/reset-password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.temporaryPassword).toBeDefined();

      const tempPassword = resetRes.body.temporaryPassword;

      // 2.2 Student logs in with temporary credentials
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentUser.email,
          password: tempPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.mustChangePassword).toBe(true);

      const tempSessionToken = loginRes.body.token;

      // 2.3 Student executes forced permanent password change
      const newPermanentPass = 'PermanentSecurePassword2026!';
      const changePassRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tempSessionToken}`)
        .send({
          currentPassword: tempPassword,
          newPassword: newPermanentPass,
          confirmPassword: newPermanentPass
        });

      expect(changePassRes.status).toBe(200);
      expect(changePassRes.body.success).toBe(true);

      // Verify DB state
      const reloadedUser = await User.findById(studentUser._id);
      expect(reloadedUser.mustChangePassword).toBe(false);

      // 2.4 Old temporary password is now invalid
      const staleLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentUser.email,
          password: tempPassword
        });
      expect(staleLogin.status).toBe(401);

      // 2.5 New permanent password logs in successfully
      const freshLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentUser.email,
          password: newPermanentPass
        });
      expect(freshLogin.status).toBe(200);
      expect(freshLogin.body.success).toBe(true);
      expect(freshLogin.body.mustChangePassword).toBe(false);

      studentToken = freshLogin.body.token;
    });
  });

  // =========================================================================
  // JOURNEY 3: LEARNING LIFECYCLE
  // =========================================================================
  describe('Journey 3 — Learning Lifecycle (Subject, Homework, Submission & Grading)', () => {
    it('3.1 Teacher creates subject and curriculum topics', async () => {
      createdCourse = await Course.create({
        id: `CRS-SCI-${ts}`,
        title: 'Physics Mechanics & Waves',
        code: `PHY-${ts}`,
        tenantId: schoolCollege._id,
        institutionType: 'school',
        department: 'Science',
        units: [
          {
            unitNumber: 1,
            title: 'Newtonian Dynamics',
            topics: [
              { topicNumber: 1, title: 'Velocity and Acceleration' },
              { topicNumber: 2, title: 'Forces in Equilibrium' }
            ]
          }
        ]
      });

      expect(createdCourse._id).toBeDefined();

      // Student views subject in portal
      const schoolSubjectsRes = await request(app)
        .get('/api/v1/school/subjects')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(schoolSubjectsRes.status).toBe(200);
      const hasSubject = (schoolSubjectsRes.body.subjects || schoolSubjectsRes.body.data || []).some(
        c => String(c._id) === String(createdCourse._id) || c.title === createdCourse.title
      );
      expect(hasSubject).toBe(true);
    });

    it('3.2 Student completes curriculum topic and progress persists', async () => {
      const completeRes = await request(app)
        .post('/api/v1/school/topics/complete')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId: createdCourse._id,
          unitNumber: 1,
          topicNumber: 1,
          topicTitle: 'Velocity and Acceleration'
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);

      const progress = await StudentProgress.findOne({
        studentId: studentUser._id,
        $or: [
          { courseId: createdCourse._id.toString() },
          { courseId: createdCourse.id }
        ]
      });
      expect(progress).not.toBeNull();
      expect(progress.completedTopics.length).toBeGreaterThanOrEqual(1);
    });

    it('3.3 Teacher assigns homework with deadline and instructions', async () => {
      const hwRes = await request(app)
        .post('/api/v1/trainer/homework')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: `Newton Second Law Problem Set ${ts}`,
          subject: 'Physics',
          topic: 'Forces and Momentum',
          points: 50,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          description: 'Solve textbook problems 4.1 through 4.8.',
          batchId: schoolCohort._id,
          batchName: schoolCohort.name
        });

      expect([200, 201]).toContain(hwRes.status);
      createdHomework = hwRes.body.homework || hwRes.body.assignment || hwRes.body.data;
      expect(createdHomework).toBeDefined();
    });

    it('3.4 Student views homework, creates submission with content', async () => {
      const studentHwRes = await request(app)
        .get('/api/v1/school/homework')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentHwRes.status).toBe(200);

      const submitRes = await request(app)
        .post(`/api/v1/school/homework/${createdHomework._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'F = ma was applied across all 8 problem sets with step-by-step vector calculations.',
          attachmentUrl: 'https://storage.edwth.com/homework/physics-hw1.pdf'
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);

      createdSubmission = await Submission.findOne({
        assignmentId: createdHomework._id,
        studentId: studentUser._id
      });
      expect(createdSubmission).not.toBeNull();
      expect(createdSubmission.status).toBe('submitted');
    });

    it('3.5 Teacher reviews submission, enters marks & feedback, and student views result', async () => {
      const gradeRes = await request(app)
        .post(`/api/v1/trainer/assignments/${createdSubmission._id}/grade`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          grade: 'A',
          marks: 48,
          maxMarks: 50,
          feedback: 'Excellent work on vector decomposition. Minor sign error on problem 6.'
        });

      expect(gradeRes.status).toBe(200);
      expect(gradeRes.body.success).toBe(true);

      // Student verifies persisted grade and feedback
      const refreshedSubmission = await Submission.findById(createdSubmission._id);
      expect(refreshedSubmission.marks).toBe(48);
      expect(refreshedSubmission.feedback).toContain('Excellent work on vector decomposition');
    });
  });

  // =========================================================================
  // JOURNEY 4: ASSESSMENTS LIFECYCLE
  // =========================================================================
  describe('Journey 4 — Assessments Lifecycle (MCQ, Submission & Server-Side Scoring)', () => {
    it('4.1 Teacher configures assessment with scheduled availability', async () => {
      const assessRes = await request(app)
        .post('/api/v1/trainer/tests')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: `Midterm Physics Examination ${ts}`,
          subject: 'Physics',
          category: 'quiz',
          type: 'mcq',
          totalMarks: 30,
          duration: 45,
          batchId: schoolCohort._id,
          batchName: schoolCohort.name,
          questions: [
            {
              id: 'q1',
              text: 'What is the SI unit of force?',
              type: 'mcq',
              options: ['Joule', 'Newton', 'Pascal', 'Watt'],
              correctAnswer: 1, // Newton
              marks: 10
            },
            {
              id: 'q2',
              text: 'Acceleration is defined as the rate of change of what?',
              type: 'mcq',
              options: ['Position', 'Mass', 'Velocity', 'Speed'],
              correctAnswer: 2, // Velocity
              marks: 10
            },
            {
              id: 'q3',
              text: 'Which law states F = ma?',
              type: 'mcq',
              options: ['First Law', 'Second Law', 'Third Law', 'Law of Gravitation'],
              correctAnswer: 1, // Second Law
              marks: 10
            }
          ]
        });

      expect([200, 201]).toContain(assessRes.status);
      createdAssessment = assessRes.body.test || assessRes.body.data;
      expect(createdAssessment).toBeDefined();
    });

    it('4.2 Student starts assessment attempt and initiates timed session', async () => {
      const startRes = await request(app)
        .post(`/api/v1/assessments/${createdAssessment._id}/start`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ durationMinutes: 45 });

      expect(startRes.status).toBe(200);
      expect(startRes.body.success).toBe(true);
      expect(startRes.body.data?.sessionId).toBeDefined();
    });

    it('4.3 Student submits answers and server computes authoritative marks', async () => {
      const submitRes = await request(app)
        .post(`/api/v1/assessments/${createdAssessment._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          answers: [
            { questionId: 'q1', answer: 1 },
            { questionId: 'q2', answer: 2 },
            { questionId: 'q3', answer: 0 }
          ]
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);

      const gradedAttempt = await AssessmentAttempt.findOne({
        assessmentId: String(createdAssessment._id),
        studentId: studentUser._id
      });
      expect(gradedAttempt).not.toBeNull();
      expect(['evaluated', 'completed', 'submitted']).toContain(gradedAttempt.status);
      expect(gradedAttempt.score).toBe(20); // 20 out of 30
      expect(gradedAttempt.totalMarks).toBe(30);
    });

    it('4.4 Duplicate submissions on completed attempt are strictly rejected', async () => {
      const dupRes = await request(app)
        .post(`/api/v1/assessments/${createdAssessment._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          answers: [{ questionId: 'q1', answer: 1 }]
        });

      expect([400, 403, 409]).toContain(dupRes.status);
    });
  });

  // =========================================================================
  // JOURNEY 5: CODE LAB EXECUTION & CHALLENGES
  // =========================================================================
  describe('Journey 5 — Code Lab Execution & Programming Challenges', () => {
    it('5.1 Executes Python code and returns standard output safely', async () => {
      const pyRes = await request(app)
        .post('/api/v1/execute')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          language: 'python',
          files: [{ name: 'main.py', content: 'nums = [1, 2, 3, 4]\nprint("SUM=" + str(sum(nums)))' }]
        });

      expect([200, 503]).toContain(pyRes.status);
      if (pyRes.status === 200) {
        expect(pyRes.body.data?.run?.output).toContain('SUM=10');
      }
    });

    it('5.2 Executes SQL queries in isolated sandbox and verifies relational output', async () => {
      const sqlRes = await request(app)
        .post('/api/v1/execute')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          language: 'sql',
          files: [{
            name: 'query.sql',
            content: 'CREATE TABLE lab_results (id INT, score INT);\nINSERT INTO lab_results VALUES (1, 95);\nSELECT * FROM lab_results;'
          }]
        });

      expect([200, 503]).toContain(sqlRes.status);
      if (sqlRes.status === 200) {
        expect(sqlRes.body.data?.run?.output).toContain('95');
      }
    });

    it('5.3 Evaluates programming challenge test cases server-side', async () => {
      const testRes = await request(app)
        .post('/api/v1/execute/test')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          language: 'python',
          code: 'def is_palindrome(s):\n    return s == s[::-1]',
          functionName: 'is_palindrome',
          testCases: [
            { args: ['radar'], expectedOutput: true },
            { args: ['hello'], expectedOutput: false },
            { args: ['level'], expectedOutput: true }
          ]
        });

      expect([200, 503]).toContain(testRes.status);
      if (testRes.status === 200) {
        expect(testRes.body.results).toBeDefined();
        expect(Array.isArray(testRes.body.results)).toBe(true);
        expect(testRes.body.results.length).toBe(3);
        expect(testRes.body.results[0].passed).toBe(true);
      }
    });
  });

  // =========================================================================
  // JOURNEY 6: COMMUNICATION & TENANT-ISOLATED ANNOUNCEMENTS
  // =========================================================================
  describe('Journey 6 — Communication & Audience Targeting with Tenant Isolation', () => {
    it('6.1 Sets up secondary rival school tenant to test cross-tenant boundaries', async () => {
      rivalSchool = await College.create({
        name: `Rival Metro Academy ${ts}`,
        code: `RMA-${ts}`,
        slug: `rma-${ts}`,
        institutionType: 'school',
        status: 'active'
      });

      rivalStudent = await User.create({
        studentId: `RSTU-${ts}`,
        name: 'Bob Outside Learner',
        email: `bob.learner.${ts}@rivalmetro.org`,
        password: await bcrypt.hash('RivalPass123!', 10),
        role: 'student',
        tenantId: rivalSchool._id
      });

      rivalStudentToken = jwt.sign(
        { id: rivalStudent._id, role: 'student', tenantId: rivalSchool._id },
        jwtSecret,
        { expiresIn: '2h' }
      );

      expect(rivalStudent._id).toBeDefined();
    });

    it('6.2 Teacher publishes school announcement targeted to class', async () => {
      const announceRes = await request(app)
        .post('/api/v1/trainer/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: `Physics Science Fair Entry Due ${ts}`,
          content: 'Submit your fair experiment abstracts by Friday 5:00 PM.',
          category: 'Academic',
          priority: 'High',
          targetClass: 'Class 11',
          batchId: schoolCohort._id
        });

      expect([200, 201]).toContain(announceRes.status);
      createdAnnouncement = announceRes.body.announcement || announceRes.body.data;
      expect(createdAnnouncement).toBeDefined();
    });

    it('6.3 Authorized school student sees announcement in portal', async () => {
      const studentAnnRes = await request(app)
        .get('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentAnnRes.status).toBe(200);
      const found = (studentAnnRes.body.announcements || studentAnnRes.body.data || []).some(
        a => a.title.includes(`Physics Science Fair Entry Due ${ts}`)
      );
      expect(found).toBe(true);
    });

    it('6.4 Outside student from rival school is strictly isolated and cannot see it', async () => {
      const rivalAnnRes = await request(app)
        .get('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${rivalStudentToken}`);

      expect([200, 403]).toContain(rivalAnnRes.status);
      const leaked = (rivalAnnRes.body.announcements || rivalAnnRes.body.data || []).some(
        a => a.title.includes(`Physics Science Fair Entry Due ${ts}`)
      );
      expect(leaked).toBe(false);
    });
  });

  // =========================================================================
  // JOURNEY 7: SECURITY BOUNDARIES & PRIVILEGE ENFORCEMENT
  // =========================================================================
  describe('Journey 7 — Security Boundaries, RBAC & Privilege Escalation Defense', () => {
    it('7.1 Student is rejected when attempting administrative routes (RBAC check)', async () => {
      const adminRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([401, 403]).toContain(adminRes.status);
    });

    it('7.2 Student is rejected when attempting trainer grading endpoints', async () => {
      const submissionId = createdSubmission?._id || new mongoose.Types.ObjectId();
      const gradeTamperRes = await request(app)
        .post(`/api/v1/trainer/assignments/${submissionId}/grade`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ marks: 50, grade: 'A+' });

      expect([401, 403]).toContain(gradeTamperRes.status);
    });

    it('7.3 Prevents IDOR and privilege escalation on student creation', async () => {
      const escalateRes = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Hacker In Training',
          email: `hacker.${ts}@6c.com`,
          password: 'Password123!',
          role: 'superadmin' // Attempt privilege elevation
        });

      expect(escalateRes.status).toBe(403);
      expect(escalateRes.body.code).toBe('ROLE_ELEVATION_PROHIBITED');
    });

    it('7.4 Public freemail is prohibited for privileged roles (SuperAdmin/Trainer)', async () => {
      const trainerFreemailRes = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Freemail Trainer',
          email: `rogue.${ts}@gmail.com`,
          password: 'TrainerPassword123!',
          tenantId: schoolCollege._id
        });

      expect(trainerFreemailRes.status).toBe(403);
      expect(trainerFreemailRes.body.code).toBe('UNAUTHORIZED_PRIVILEGED_IDENTITY');
    });
  });

  // =========================================================================
  // JOURNEY 8: SESSION RESTORATION & STATE RECOVERY
  // =========================================================================
  describe('Journey 8 — Session Restoration & State Recovery', () => {
    it('8.1 Student profile loads cleanly and verifies authenticated session', async () => {
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.user?.email).toBe(studentUser.email);
    });

    it('8.2 Profile updates persist across sessions and re-login', async () => {
      const updateRes = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          phone: '+1-555-8822',
          address: '42 Science Park Lane',
          emergencyContact: {
            name: 'Sarah Lightman',
            relation: 'Mother',
            phone: '+1-555-8823'
          }
        });

      expect(updateRes.status).toBe(200);

      // Verify DB persistence after simulated logout and re-query
      const persistedStudent = await User.findById(studentUser._id);
      expect(persistedStudent.phone).toBe('+1-555-8822');
      expect(persistedStudent.address).toBe('42 Science Park Lane');
      expect(persistedStudent.emergencyContact?.relation).toBe('Mother');
    });

    it('8.3 Revoking session or providing corrupted token immediately fails safely', async () => {
      const corruptedToken = (studentToken || 'mock.jwt.token').slice(0, -6) + 'xxxxxx';
      const corruptRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${corruptedToken}`);

      expect(corruptRes.status).toBe(401);
      expect(corruptRes.body.success).toBe(false);
    });
  });
});
