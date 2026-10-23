/**
 * Lumina LMS — Doubts, Help & Announcements Verification Test Suite
 * 6th Civilians Corporation
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import schoolRoutes from '../routes/schoolRoutes.js';
import trainerRoutes from '../routes/trainerRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import studentRoutes from '../routes/studentRoutes.js';
import Doubt from '../models/Doubt.js';
import Announcement from '../models/Announcement.js';
import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import AuditLog from '../models/AuditLog.js';

describe('Doubts, Help & Announcements End-to-End Suite', () => {
  const JWT_SECRET = 'test-secret-doubts-announcements-hardening-32ch';
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const noTenantStudentId = new mongoose.Types.ObjectId();
  const noTenantTrainerId = new mongoose.Types.ObjectId();
  const trainerAId = new mongoose.Types.ObjectId();
  const trainerBId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();
  const superadminId = new mongoose.Types.ObjectId();

  let studentAToken;
  let studentBToken;
  let noTenantStudentToken;
  let noTenantTrainerToken;
  let trainerAToken;
  let trainerBToken;
  let adminAToken;
  let superadminToken;

  let createdDoubtId;
  let createdAnnouncementId;

  // Stored mock state for isolation
  let mockDoubts = [];
  let mockAnnouncements = [];
  let mockColleges = {};
  let mockUsers = {};

  let originalFindById;
  let originalAuditCreate;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    studentAToken = jwt.sign(
      { id: studentAId.toString(), role: 'student', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    studentBToken = jwt.sign(
      { id: studentBId.toString(), role: 'student', tenantId: tenantBId.toString() },
      JWT_SECRET
    );
    noTenantStudentToken = jwt.sign(
      { id: noTenantStudentId.toString(), role: 'student', tenantId: null },
      JWT_SECRET
    );
    noTenantTrainerToken = jwt.sign(
      { id: noTenantTrainerId.toString(), role: 'trainer', tenantId: null },
      JWT_SECRET
    );
    trainerAToken = jwt.sign(
      { id: trainerAId.toString(), role: 'trainer', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    trainerBToken = jwt.sign(
      { id: trainerBId.toString(), role: 'trainer', tenantId: tenantBId.toString() },
      JWT_SECRET
    );
    adminAToken = jwt.sign(
      { id: adminAId.toString(), role: 'admin', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    superadminToken = jwt.sign(
      { id: superadminId.toString(), role: 'superadmin', tenantId: null },
      JWT_SECRET
    );

    mockUsers[noTenantTrainerId.toString()] = {
      _id: noTenantTrainerId,
      name: 'Orphan Trainer',
      role: 'trainer',
      tenantId: null
    };

    mockUsers[studentAId.toString()] = {
      _id: studentAId,
      name: 'Alice Student',
      role: 'student',
      tenantId: tenantAId,
      studentId: 'STU-001',
      className: 'Class 10-A'
    };
    mockUsers[studentBId.toString()] = {
      _id: studentBId,
      name: 'Bob Outsider',
      role: 'student',
      tenantId: tenantBId,
      studentId: 'STU-002',
      className: 'Class 10-B'
    };
    mockUsers[noTenantStudentId.toString()] = {
      _id: noTenantStudentId,
      name: 'No Tenant Student',
      role: 'student',
      tenantId: null,
      studentId: 'STU-NONE'
    };
    mockUsers[trainerAId.toString()] = {
      _id: trainerAId,
      name: 'Sarah Connor',
      role: 'trainer',
      tenantId: tenantAId
    };
    mockUsers[trainerBId.toString()] = {
      _id: trainerBId,
      name: 'Other Trainer',
      role: 'trainer',
      tenantId: tenantBId
    };
    mockUsers[adminAId.toString()] = {
      _id: adminAId,
      name: 'Admin Alice',
      role: 'admin',
      tenantId: tenantAId
    };
    mockUsers[superadminId.toString()] = {
      _id: superadminId,
      name: 'Super Admin',
      role: 'superadmin',
      tenantId: null
    };

    mockColleges[tenantAId.toString()] = {
      _id: tenantAId,
      name: 'Oakridge High School',
      code: 'OAKRIDGE',
      institutionType: 'school',
      settings: {
        contact: {
          helpline: '+1 (555) 234-5678',
          academicOffice: 'academic@oakridge.test',
          counselor: 'Room 204'
        }
      }
    };
    mockColleges[tenantBId.toString()] = {
      _id: tenantBId,
      name: 'Empty Contact School',
      code: 'EMPTY',
      institutionType: 'school',
      settings: {
        contact: {}
      }
    };

    // Ensure Mongoose connection state is active for mock lookup
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // Mock AuditLog.create to prevent buffering timeouts in isolated unit environment
    originalAuditCreate = AuditLog.create;
    AuditLog.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc });

    originalFindById = User.findById;
    User.findById = function (id) {
      const u = mockUsers[id?.toString()];
      return {
        select: () => Promise.resolve(u || null),
        lean: () => Promise.resolve(u || null),
        then: (onFulfilled, onRejected) => Promise.resolve(u || null).then(onFulfilled, onRejected)
      };
    };

    // Build Express App
    app = express();
    app.use(express.json());
    app.use('/api/v1/school', schoolRoutes);
    app.use('/api/v1/trainer', trainerRoutes);
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/students', studentRoutes);
  });

  afterAll(() => {
    if (originalFindById) {
      User.findById = originalFindById;
    }
    if (originalAuditCreate) {
      AuditLog.create = originalAuditCreate;
    }
  });

  describe('1. School Academic Contacts', () => {
    it('returns genuine contact details when configured for student tenant', async () => {
      const origFindById = College.findById;
      College.findById = (id) => ({
        lean: async () => mockColleges[id.toString()] || null
      });

      const res = await request(app)
        .get('/api/v1/school/academic-contacts')
        .set('Authorization', `Bearer ${studentAToken}`);

      College.findById = origFindById;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(true);
      expect(res.body.contacts.helpline).toBe('+1 (555) 234-5678');
      expect(res.body.contacts.email).toBe('academic@oakridge.test');
      expect(res.body.contacts.counselor).toBe('Room 204');
    });

    it('returns configured: false when school has not configured contacts', async () => {
      const origFindById = College.findById;
      College.findById = (id) => ({
        lean: async () => mockColleges[id.toString()] || null
      });

      const res = await request(app)
        .get('/api/v1/school/academic-contacts')
        .set('Authorization', `Bearer ${studentBToken}`);

      College.findById = origFindById;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(false);
      expect(res.body.contacts).toBeNull();
    });
  });

  describe('2. Student Help / Doubt Submission & Validation', () => {
    it('rejects doubt submission when question is missing or too short', async () => {
      const res = await request(app)
        .post('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherName: 'Sarah Connor',
          topic: 'Recursion',
          question: 'hi' // too short (<5 chars)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/between 5 and 2000 characters/i);
    });

    it('rejects doubt submission when topic is missing', async () => {
      const res = await request(app)
        .post('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherName: 'Sarah Connor',
          topic: '',
          question: 'How does memoization improve dynamic programming runtimes?'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Topic\/Chapter is required/i);
    });

    it('successfully persists student question in MongoDB and derives student identity from session', async () => {
      const origUserFindOne = User.findOne;
      const origDoubtCreate = Doubt.create;

      User.findOne = () => ({
        lean: async () => mockUsers[trainerAId.toString()]
      });

      Doubt.create = async (doc) => {
        const doubtItem = {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          createdAt: new Date(),
          replies: [],
          save: async function () { return this; }
        };
        mockDoubts.push(doubtItem);
        return doubtItem;
      };

      const res = await request(app)
        .post('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherName: 'Sarah Connor (Computer Science)',
          subject: 'Computer Science',
          topic: 'Binary Search Trees',
          question: 'Is in-order traversal guaranteed to yield keys in ascending order for all valid BSTs?'
        });

      User.findOne = origUserFindOne;
      Doubt.create = origDoubtCreate;

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.doubt.topic).toBe('Binary Search Trees');
      expect(res.body.doubt.status).toBe('Submitted');
      createdDoubtId = res.body.doubt.id;
    });

    it('rejects doubt submission when recipient belongs to another tenant (unauthorized recipient 403)', async () => {
      const origUserFindOne = User.findOne;
      User.findOne = () => ({
        lean: async () => null // Trainer B is not in student's tenant
      });

      const res = await request(app)
        .post('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherId: trainerBId.toString(), // belongs to tenantBId
          subject: 'Computer Science',
          topic: 'Graph Theory',
          question: 'Can Dijkstra handle negative weight cycles in directed graphs?'
        });

      User.findOne = origUserFindOne;

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not an authorized educator in your institution/i);
    });

    it('rejects doubt submission when tenant context is missing (403)', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${noTenantStudentToken}`)
        .send({
          subject: 'Computer Science',
          topic: 'Sorting Algorithms',
          question: 'What is the best case time complexity of QuickSort?'
        });

      process.env.NODE_ENV = prevEnv;

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/tenant/i);
    });
  });

  describe('3. Student Doubts Retrieval & Tenant Scoping', () => {
    it('student retrieves their own submitted doubts', async () => {
      const origDoubtFind = Doubt.find;
      Doubt.find = (query) => ({
        sort: () => ({
          lean: async () => mockDoubts.filter((d) => String(d.studentId) === String(query.studentId))
        })
      });

      const res = await request(app)
        .get('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`);

      Doubt.find = origDoubtFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.doubts.length).toBeGreaterThan(0);
      expect(res.body.doubts[0].topic).toBe('Binary Search Trees');
      expect(res.body.doubts[0].status).toBe('Submitted');
    });

    it('returns clean empty conversation list without false error when student has zero doubts', async () => {
      const origDoubtFind = Doubt.find;
      Doubt.find = () => ({
        sort: () => ({
          lean: async () => []
        })
      });

      const res = await request(app)
        .get('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentAToken}`);

      Doubt.find = origDoubtFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.doubts)).toBe(true);
      expect(res.body.doubts.length).toBe(0);
    });

    it('student from another tenant cannot see Tenant A questions (cross-tenant isolation)', async () => {
      const origDoubtFind = Doubt.find;
      Doubt.find = (query) => ({
        sort: () => ({
          lean: async () => mockDoubts.filter((d) => String(d.tenantId) === String(query.tenantId) && String(d.studentId) === String(query.studentId))
        })
      });

      const res = await request(app)
        .get('/api/v1/school/doubts')
        .set('Authorization', `Bearer ${studentBToken}`);

      Doubt.find = origDoubtFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.doubts.length).toBe(0);
    });
  });

  describe('4. Teacher Replies Workflow', () => {
    it('trainer retrieves questions within their tenant scope', async () => {
      const origDoubtFind = Doubt.find;
      Doubt.find = (filter) => ({
        sort: () => ({
          lean: async () => mockDoubts.filter((d) => String(d.tenantId) === String(filter.tenantId))
        })
      });

      const res = await request(app)
        .get('/api/v1/trainer/doubts')
        .set('Authorization', `Bearer ${trainerAToken}`);

      Doubt.find = origDoubtFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.doubts.length).toBeGreaterThan(0);
      expect(res.body.doubts[0].topic).toBe('Binary Search Trees');
    });

    it('trainer replies to student question and updates status to Answered in MongoDB', async () => {
      const origDoubtFindOne = Doubt.findOne;

      const targetDoubt = mockDoubts[0];
      const mockDoc = {
        ...targetDoubt,
        save: async function () {
          targetDoubt.status = this.status;
          targetDoubt.response = this.response;
          targetDoubt.repliedAt = this.repliedAt;
          targetDoubt.replies = this.replies;
          return this;
        }
      };

      Doubt.findOne = (query) => {
        if (String(query._id) === String(targetDoubt._id) && String(query.tenantId) === String(tenantAId)) {
          return Promise.resolve(mockDoc);
        }
        return Promise.resolve(null);
      };

      const res = await request(app)
        .post(`/api/v1/trainer/doubts/${targetDoubt._id}/reply`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({
          reply: 'Yes, an in-order traversal (Left, Root, Right) always visits BST nodes in non-decreasing sorted order.'
        });

      Doubt.findOne = origDoubtFindOne;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.doubt.status).toBe('Answered');
      expect(res.body.doubt.reply).toMatch(/in-order traversal/i);
      expect(targetDoubt.status).toBe('answered');
    });

    it('trainer from another tenant cannot reply to Tenant A doubt (cross-tenant 404)', async () => {
      const origDoubtFindOne = Doubt.findOne;
      const targetDoubt = mockDoubts[0];

      Doubt.findOne = (query) => {
        // A doubt belonging to tenantAId is NOT found when queried with tenantBId
        if (String(query._id) === String(targetDoubt._id) && String(query.tenantId) === String(targetDoubt.tenantId)) {
          return Promise.resolve(targetDoubt);
        }
        return Promise.resolve(null);
      };

      const res = await request(app)
        .post(`/api/v1/trainer/doubts/${targetDoubt._id}/reply`)
        .set('Authorization', `Bearer ${trainerBToken}`)
        .send({
          reply: 'Unauthorized cross-tenant reply attempt.'
        });

      Doubt.findOne = origDoubtFindOne;

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Trainer Announcements → Student Noticeboard', () => {
    it('missing tenant context returns 400 when unauthorized context attempts to publish', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/announcements')
        .set('Authorization', `Bearer ${noTenantTrainerToken}`)
        .send({
          title: 'Orphan Announcement',
          content: 'This should fail because there is no tenantId.',
          status: 'published'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Tenant context (missing|required)/i);
    });

    it('trainer creates a saved draft announcement (status: draft)', async () => {
      const origAnnCreate = Announcement.create;
      Announcement.create = async (doc) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          status: 'draft',
          publishedAt: null
        };
        mockAnnouncements.push(item);
        return item;
      };

      const res = await request(app)
        .post('/api/v1/trainer/announcements')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({
          title: 'Draft Exam Schedule',
          content: 'This is a preliminary draft and should not broadcast.',
          status: 'draft'
        });

      Announcement.create = origAnnCreate;

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.announcement.status).toBe('draft');
      expect(res.body.announcement.publishedAt).toBeNull();
    });

    it('trainer publishes an announcement persisted in MongoDB', async () => {
      const origAnnCreate = Announcement.create;
      Announcement.create = async (doc) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          publishedAt: new Date()
        };
        mockAnnouncements.push(item);
        return item;
      };

      const res = await request(app)
        .post('/api/v1/trainer/announcements')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({
          title: 'Final Project Submission Deadline',
          content: 'Please submit your project repository links by Friday 5 PM.',
          priority: 'urgent',
          status: 'published'
        });

      Announcement.create = origAnnCreate;

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.announcement.title).toBe('Final Project Submission Deadline');
      expect(res.body.announcement.status).toBe('published');
      createdAnnouncementId = res.body.announcement._id;
    });

    it('superadmin creates platform-wide broadcast announcement without tenantId', async () => {
      const origAnnCreate = Announcement.create;
      Announcement.create = async (doc) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          isPlatformWide: true,
          tenantId: null,
          publishedAt: new Date()
        };
        mockAnnouncements.push(item);
        return item;
      };

      const res = await request(app)
        .post('/api/v1/admin/announcements')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          title: 'Global System Maintenance Scheduled',
          content: 'Lumina LMS maintenance scheduled this weekend across all institutions.',
          priority: 'high',
          status: 'published'
        });

      Announcement.create = origAnnCreate;

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.announcement.isPlatformWide).toBe(true);
      expect(res.body.announcement.tenantId).toBeNull();
    });

    it('trainer cannot target a batch from a different tenant (403 INVALID_AUDIENCE_SCOPE)', async () => {
      const origBatchFindOne = Batch.findOne;
      Batch.findOne = () => Promise.resolve(null); // Simulated batch not found in trainer's tenant

      const wrongBatchId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/v1/trainer/announcements')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({
          title: 'Class Announcement for Wrong Tenant',
          content: 'Should be rejected because batch belongs to another tenant.',
          batchId: wrongBatchId.toString(),
          status: 'published'
        });

      Batch.findOne = origBatchFindOne;

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_AUDIENCE_SCOPE');
    });

    it('student in Tenant A sees published announcement', async () => {
      const origAnnFind = Announcement.find;
      Announcement.find = (query) => ({
        populate: () => ({
          sort: () => ({
            lean: async () => {
              const tid = query.tenantId || (query.$or && query.$or.find((c) => c.tenantId)?.tenantId);
              return mockAnnouncements.filter((a) => {
                const matchTenant = tid ? String(a.tenantId) === String(tid) || a.isPlatformWide : true;
                return matchTenant && a.status === 'published';
              });
            }
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${studentAToken}`);

      Announcement.find = origAnnFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.announcements.length).toBeGreaterThan(0);
      expect(res.body.announcements.some((a) => a.title === 'Final Project Submission Deadline')).toBe(true);
    });

    it('student in Tenant B does not see Tenant A announcement (isolation)', async () => {
      const origAnnFind = Announcement.find;
      Announcement.find = (query) => ({
        populate: () => ({
          sort: () => ({
            lean: async () => {
              const tid = query.tenantId || (query.$or && query.$or.find((c) => c.tenantId)?.tenantId);
              return mockAnnouncements.filter((a) => String(a.tenantId) === String(tid));
            }
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${studentBToken}`);

      Announcement.find = origAnnFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.announcements.length).toBe(0);
    });

    it('returns empty array without false error when tenant has zero announcements', async () => {
      const origAnnFind = Announcement.find;
      Announcement.find = () => ({
        populate: () => ({
          sort: () => ({
            lean: async () => []
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${studentAToken}`);

      Announcement.find = origAnnFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.announcements)).toBe(true);
      expect(res.body.announcements.length).toBe(0);
    });

    it('student is rejected when attempting to POST or DELETE announcements (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/school/announcements')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ title: 'Hacked announcement' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized to create, update, or delete/i);
    });
  });

  describe('6. Admin Students List & Datasheet Integrity', () => {
    it('admin students list returns populated students with major, year, and university', async () => {
      const origUserFind = User.find;
      User.find = () => ({
        select: () => ({
          populate: () => ({
            sort: () => ({
              lean: async () => [
                {
                  _id: studentAId,
                  name: 'Alice Student',
                  email: 'alice@oakridge.test',
                  role: 'student',
                  status: 'Active',
                  className: 'Class 10-A',
                  tenantId: tenantAId,
                  createdAt: new Date()
                }
              ]
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`);

      User.find = origUserFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.students.length).toBe(1);
      const stu = res.body.students[0];
      expect(stu.name).toBe('Alice Student');
      expect(stu.major).toBeDefined();
      expect(typeof stu.major).toBe('string');
      expect(stu.year).toBeDefined();
      expect(typeof stu.year).toBe('string');
      expect(stu.university).toBeDefined();
      expect(typeof stu.university).toBe('string');
      expect(stu.stats).toBeDefined();
    });

    it('admin students list returns clean empty list when tenant has zero students', async () => {
      const origUserFind = User.find;
      User.find = () => ({
        select: () => ({
          populate: () => ({
            sort: () => ({
              lean: async () => []
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`);

      User.find = origUserFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.students)).toBe(true);
      expect(res.body.students.length).toBe(0);
    });

    it('superadmin can access students datasheet across tenants', async () => {
      const origUserFind = User.find;
      User.find = () => ({
        select: () => ({
          populate: () => ({
            lean: async () => [
              {
                _id: studentAId,
                name: 'Alice Student',
                role: 'student',
                tenantId: tenantAId
              },
              {
                _id: studentBId,
                name: 'Bob Outsider',
                role: 'student',
                tenantId: tenantBId
              }
            ]
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/students/datasheet')
        .set('Authorization', `Bearer ${superadminToken}`);

      User.find = origUserFind;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.students[0].major).toBeDefined();
      expect(res.body.data.students[0].year).toBeDefined();
    });
  });
});
