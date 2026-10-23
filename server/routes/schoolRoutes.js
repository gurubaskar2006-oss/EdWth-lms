/**
 * Lumina LMS — School Student Portal Academic Routes
 * Authoritative backend endpoints for curriculum, subjects, lessons, homework, and student progress.
 */

import express from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/authMiddleware.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import StudentProgress from '../models/StudentProgress.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Attendance from '../models/Attendance.js';
import College from '../models/College.js';
import User from '../models/User.js';
import AcademicEvent from '../models/AcademicEvent.js';
import Announcement from '../models/Announcement.js';
import Doubt from '../models/Doubt.js';
import { writeAuditLog } from '../utils/auditLogger.js';

const router = express.Router();
router.use(verifyToken);

/**
 * GET /api/v1/school/subjects
 * Retrieves authorized subject list for the student's tenant with calculated progress
 */
router.get('/subjects', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Institutional tenant context missing' });
    }

    const userId = req.user?._id;
    const studentUser = req.user || {};

    const filter = { tenantId };
    if (studentUser.batchId || studentUser.className || studentUser.batchName) {
      filter.$or = [
        { batchId: studentUser.batchId },
        { className: studentUser.className || studentUser.batchName },
        { batchId: { $exists: false }, className: { $exists: false } },
        { batchId: null, className: null },
        { className: '' }
      ];
    }
    const courses = await Course.find(filter).lean();

    if (!courses || courses.length === 0) {
      return res.json({ success: true, subjects: [] });
    }

    // For the logged-in student, fetch all their progress records
    const progressRecords = await StudentProgress.find({
      tenantId,
      studentId: userId
    }).lean();

    const progressMap = {};
    progressRecords.forEach((p) => {
      progressMap[p.courseId] = p.completedTopics || [];
    });

    // Query pending homework counts per course
    const assignments = await Assignment.find({ tenantId }).lean();
    const submissions = await Submission.find({ tenantId, studentId: userId }).lean();
    const submissionMap = {};
    submissions.forEach((s) => {
      submissionMap[s.assignmentId.toString()] = s.status;
    });

    const enrichedSubjects = courses.map((course) => {
      const completedList = progressMap[course.id] || [];
      const totalTopics = (course.units || []).reduce(
        (sum, u) => sum + (u.topics?.length || 0),
        0
      );

      const calculatedProgress = totalTopics > 0
        ? Math.round((completedList.length / totalTopics) * 100)
        : 0;

      // Calculate pending homework for this subject
      const subjectAssignments = assignments.filter(
        (a) => a.courseId === course.id || a.subject?.toLowerCase() === course.title?.toLowerCase()
      );
      const pendingHwCount = subjectAssignments.filter((a) => {
        const status = submissionMap[a._id.toString()];
        return !status || status === 'pending' || status === 'needs_revision';
      }).length;

      return {
        id: course.id,
        _id: course._id,
        title: course.title,
        name: course.title,
        code: course.code,
        teacher: course.instructor?.name || 'Assigned Educator',
        assignedTeacher: course.instructor?.name || 'Assigned Educator',
        room: course.schedule?.room || 'Laboratory',
        schedule: course.schedule,
        nextClass: course.schedule ? `${course.schedule.days?.[0] || 'Scheduled'}, ${course.schedule.time || '10:00 AM'}` : 'Schedule Pending',
        color: course.color || '#2563EB',
        icon: course.icon || '📚',
        progress: calculatedProgress,
        completedTopicsCount: completedList.length,
        totalTopics: totalTopics,
        totalTopicsCount: totalTopics,
        currentTeachingTopic: course.currentTeachingTopic || null,
        pendingHomeworkCount: pendingHwCount,
        description: course.description
      };
    });

    res.json({ success: true, subjects: enrichedSubjects });
  } catch (err) {
    console.error('Error fetching school subjects:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve subjects' });
  }
});

/**
 * GET /api/v1/school/subjects/:id
 * Retrieves complete curriculum hierarchy (Units -> Topics -> Lessons) and student progress
 */
router.get('/subjects/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { id } = req.params;
    const userId = req.user?._id;

    const course = await Course.findOne({
      tenantId,
      $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    }).lean();

    if (!course) {
      return res.status(404).json({ success: false, message: 'Subject curriculum not found' });
    }

    // Student's progress record
    const progress = await StudentProgress.findOne({
      tenantId,
      studentId: userId,
      courseId: course.id
    }).lean();

    const completedTopics = progress?.completedTopics || [];
    const completedSet = new Set(completedTopics.map((ct) => `${ct.unitNumber}-${ct.topicNumber}`));

    const totalTopics = (course.units || []).reduce(
      (sum, u) => sum + (u.topics?.length || 0),
      0
    );

    const calculatedProgress = totalTopics > 0
      ? Math.round((completedTopics.length / totalTopics) * 100)
      : 0;

    res.json({
      success: true,
      subject: {
        id: course.id,
        _id: course._id,
        name: course.title,
        code: course.code,
        teacher: course.instructor?.name || 'Assigned Educator',
        room: course.schedule?.room || 'Laboratory',
        schedule: course.schedule,
        nextClass: course.schedule ? `${course.schedule.days?.[0] || 'Scheduled'}, ${course.schedule.time || '10:00 AM'}` : 'Schedule Pending',
        color: course.color || '#2563EB',
        icon: course.icon || '📚',
        progress: calculatedProgress,
        completedTopicsCount: completedTopics.length,
        totalTopicsCount: totalTopics,
        currentTeachingTopic: course.currentTeachingTopic,
        description: course.description,
        units: (course.units || []).map((u) => ({
          ...u,
          unitName: u.unitName || u.title || `Unit ${u.unitNumber}`,
          title: u.title || u.unitName || `Unit ${u.unitNumber}`
        })),
        completedKeys: Array.from(completedSet)
      }
    });
  } catch (err) {
    console.error('Error fetching subject detail:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve subject detail' });
  }
});

/**
 * POST /api/v1/school/topics/complete
 * Authoritatively marks a curriculum topic as completed for the authenticated student
 */
router.post('/topics/complete', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;
    const studentIdentifier = req.user?.studentId || '';
    const { courseId, unitNumber, topicNumber, topicTitle } = req.body;

    if (!courseId || unitNumber == null || topicNumber == null) {
      return res.status(400).json({ success: false, message: 'courseId, unitNumber, and topicNumber are required' });
    }

    const course = await Course.findOne({
      tenantId,
      $or: [{ id: courseId }, { _id: mongoose.Types.ObjectId.isValid(courseId) ? courseId : null }]
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const canonicalCourseId = course.id;

    let progress = await StudentProgress.findOne({
      tenantId,
      studentId: userId,
      $or: [{ courseId: canonicalCourseId }, { courseId: course._id.toString() }]
    });

    if (!progress) {
      progress = new StudentProgress({
        tenantId,
        studentId: userId,
        studentIdentifier,
        courseId: canonicalCourseId,
        completedTopics: []
      });
    }

    // Check if already completed
    const alreadyCompleted = progress.completedTopics.some(
      (ct) => ct.unitNumber === Number(unitNumber) && ct.topicNumber === Number(topicNumber)
    );

    if (!alreadyCompleted) {
      progress.completedTopics.push({
        unitNumber: Number(unitNumber),
        topicNumber: Number(topicNumber),
        topicTitle: topicTitle || '',
        completedAt: new Date()
      });
    }

    progress.lastActiveTopic = {
      unitNumber: Number(unitNumber),
      topicNumber: Number(topicNumber),
      topicTitle: topicTitle || ''
    };
    progress.lastActivityAt = new Date();

    await progress.save();

    const totalTopics = (course.units || []).reduce(
      (sum, u) => sum + (u.topics?.length || 0),
      0
    );

    const calculatedProgress = totalTopics > 0
      ? Math.round((progress.completedTopics.length / totalTopics) * 100)
      : 0;

    res.json({
      success: true,
      message: 'Topic marked as completed',
      progress: calculatedProgress,
      completedTopicsCount: progress.completedTopics.length,
      totalTopicsCount: totalTopics,
      completedKeys: progress.completedTopics.map((ct) => `${ct.unitNumber}-${ct.topicNumber}`)
    });
  } catch (err) {
    console.error('Error completing topic:', err);
    res.status(500).json({ success: false, message: 'Failed to record topic completion' });
  }
});

/**
 * GET /api/v1/school/homework
 * Retrieves real homework tasks for the student with individual submission status
 */
router.get('/homework', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;

    const hwFilter = { tenantId, status: { $ne: 'archived' } };
    if (req.user?.batchId) {
      hwFilter.$or = [{ batchId: null }, { batchId: req.user.batchId }, { batchId: { $exists: false } }];
    }

    const assignments = await Assignment.find(hwFilter).sort({ dueDate: 1 }).lean();
    const submissions = await Submission.find({ tenantId, studentId: userId }).lean();

    const submissionMap = {};
    submissions.forEach((s) => {
      submissionMap[s.assignmentId.toString()] = s;
    });

    const formatted = assignments.map((hw) => {
      const sub = submissionMap[hw._id.toString()];
      const status = sub?.status || 'pending';

      return {
        id: hw.id || hw._id.toString(),
        _id: hw._id,
        title: hw.title,
        subject: hw.subject || hw.courseTitle || 'General',
        topic: hw.topic || '',
        courseId: hw.courseId,
        courseCode: hw.courseCode,
        dueDate: hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Due Date',
        dueTimestamp: hw.dueDate,
        priority: hw.priority || 'Normal',
        points: hw.points || 20,
        description: hw.description || '',
        requirements: hw.requirements || [],
        status, // 'pending', 'submitted', 'graded', 'needs_revision'
        score: sub?.score ?? null,
        grade: sub?.score ?? null,
        feedback: sub?.feedback ?? null,
        submittedAt: sub?.submittedAt ?? null,
        submissionText: sub?.submissionText ?? null,
        submissionFile: sub?.submissionFile ?? null
      };
    });

    res.json({ success: true, homework: formatted });
  } catch (err) {
    console.error('Error fetching homework:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve homework' });
  }
});

/**
 * POST /api/v1/school/homework/:assignmentId/submit
 * Submits student work for a homework assignment
 */
router.post('/homework/:assignmentId/submit', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;
    const studentName = req.user?.name || 'Student';
    const studentIdentifier = req.user?.studentId || '';
    const { assignmentId } = req.params;
    const { submissionText = '', code = '', submissionFile = '' } = req.body;

    const textToSave = submissionText || code;
    if (!textToSave.trim() && !submissionFile) {
      return res.status(400).json({ success: false, message: 'Submission content or attachment cannot be empty' });
    }

    const assignment = await Assignment.findOne({
      tenantId,
      $or: [{ _id: mongoose.Types.ObjectId.isValid(assignmentId) ? assignmentId : null }, { id: assignmentId }]
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Homework assignment not found' });
    }

    const updatePayload = {
      tenantId,
      assignmentId: assignment._id,
      studentId: userId,
      studentName,
      studentIdentifier,
      submissionText: textToSave || '(Attachment submitted)',
      status: 'submitted',
      submittedAt: new Date(),
      score: null,
      feedback: null
    };

    if (submissionFile) {
      updatePayload.submissionFile = submissionFile;
    }

    const submission = await Submission.findOneAndUpdate(
      {
        tenantId,
        assignmentId: assignment._id,
        studentId: userId
      },
      updatePayload,
      { upsert: true, new: true }
    );

    // Notify trainer via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:role:trainer`).emit('homework:submitted', {
        assignmentId: assignment._id,
        assignmentTitle: assignment.title,
        studentName,
        studentId: studentIdentifier,
        submittedAt: submission.submittedAt
      });
    }

    res.json({
      success: true,
      message: 'Homework submitted successfully',
      submission: {
        id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        submissionText: submission.submissionText
      }
    });
  } catch (err) {
    console.error('Error submitting homework:', err);
    res.status(500).json({ success: false, message: 'Failed to submit homework' });
  }
});

/**
 * GET /api/v1/school/tests
 * Retrieves all scheduled/active school examinations and assessments for the student's tenant,
 * mapping each test to its live lifecycle status for this student:
 * 'Upcoming' | 'Available' | 'In Progress' | 'Submitted' | 'Evaluated' | 'Missed' | 'Disqualified'
 */
router.get('/tests', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;

    const assessments = await Assessment.find({ tenantId }).sort({ date: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ tenantId, studentId: userId }).lean();

    const attemptMap = new Map();
    attempts.forEach((att) => {
      attemptMap.set(att.assessmentId, att);
    });

    const now = new Date();

    const tests = assessments.map((exam) => {
      const att = attemptMap.get(exam.id) || attemptMap.get(exam._id.toString());
      let lifecycleStatus = 'Upcoming';

      if (att) {
        if (att.status === 'evaluated') {
          lifecycleStatus = 'Evaluated';
        } else if (att.status === 'submitted') {
          lifecycleStatus = 'Submitted';
        } else if (att.status === 'disqualified') {
          lifecycleStatus = 'Disqualified';
        } else if (att.status === 'in_progress') {
          lifecycleStatus = 'In Progress';
        } else if (att.status === 'missed') {
          lifecycleStatus = 'Missed';
        }
      } else {
        const examDate = new Date(exam.date);
        const examEnd = new Date(examDate.getTime() + (exam.durationMinutes || 60) * 60000);
        if (now > examEnd) {
          lifecycleStatus = 'Missed';
        } else if (now >= examDate) {
          lifecycleStatus = 'Available';
        } else {
          lifecycleStatus = 'Upcoming';
        }
      }

      return {
        id: exam.id || exam._id.toString(),
        _id: exam._id,
        title: exam.title,
        subject: exam.subject,
        courseId: exam.courseId,
        date: exam.date ? new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Scheduled',
        rawDate: exam.date,
        time: exam.time || '10:00 AM - 10:45 AM',
        room: exam.room || 'Coding Lab 1',
        totalMarks: exam.totalMarks || 20,
        durationMinutes: exam.durationMinutes || 45,
        isCodingExam: exam.isCodingExam ?? true,
        status: lifecycleStatus,
        score: att?.score ?? null,
        percentage: att?.percentage ?? null,
        timeUsedMinutes: att?.timeUsedMinutes ?? null,
        violationCount: att?.violationCount ?? 0,
        integrityStatus: att?.integrityStatus ?? 'normal',
        teacherFeedback: att?.teacherFeedback ?? null,
        challenge: exam.challenge || null
      };
    });

    res.json({ success: true, tests });
  } catch (err) {
    console.error('Error fetching school tests:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve tests' });
  }
});

/**
 * GET /api/v1/school/attendance
 * Retrieves student's actual attendance record and rate from MongoDB Attendance
 */
router.get('/attendance', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;

    const records = await Attendance.find({ tenantId, studentId: userId }).sort({ date: -1 }).lean();
    const totalSessions = records.length;
    const presentSessions = records.filter((r) => r.status === 'present').length;
    const lateSessions = records.filter((r) => r.status === 'late').length;
    const absentSessions = records.filter((r) => r.status === 'absent').length;

    const attendanceRate = totalSessions > 0
      ? Math.round(((presentSessions + lateSessions) / totalSessions) * 100)
      : null;

    res.json({
      success: true,
      attendance: {
        attendanceRate,
        totalSessions,
        presentSessions,
        lateSessions,
        absentSessions,
        history: records.slice(0, 10).map((r) => ({
          id: r._id,
          date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: r.status,
          recordedAt: r.createdAt || r.date
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching school attendance:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance' });
  }
});

/**
 * GET /api/v1/school/results
 * Authoritatively separates Test Results (AssessmentAttempt) from Homework Results (Submission)
 */
router.get('/results', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;

    // 1. Strictly Test Results from AssessmentAttempt
    const testAttempts = await AssessmentAttempt.find({
      tenantId,
      studentId: userId,
      status: 'evaluated'
    }).sort({ startedAt: -1 }).lean();

    const testResults = testAttempts.map((t) => ({
      id: t._id.toString(),
      type: 'test',
      subject: t.subject || 'Python Programming',
      title: t.assessmentTitle,
      assessment: t.assessmentTitle,
      date: t.submittedAt ? new Date(t.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Evaluated',
      marks: `${t.score}/${t.maxScore}`,
      score: t.score,
      maxScore: t.maxScore,
      percentage: t.percentage != null ? t.percentage : Math.round((t.score / t.maxScore) * 100),
      grade: t.percentage >= 90 ? 'A+' : t.percentage >= 80 ? 'A' : t.percentage >= 70 ? 'B' : t.percentage >= 60 ? 'C' : 'F',
      timeUsedMinutes: t.timeUsedMinutes,
      violationCount: t.violationCount,
      attemptNumber: t.attemptNumber || 1,
      remarks: t.teacherFeedback || 'Evaluation complete.'
    }));

    // 2. Strictly Homework Results from Submission
    const gradedSubmissions = await Submission.find({
      tenantId,
      studentId: userId,
      status: 'graded'
    })
      .populate('assignmentId')
      .sort({ gradedAt: -1 })
      .lean();

    const homeworkResults = gradedSubmissions.map((s) => ({
      id: s._id.toString(),
      type: 'homework',
      subject: s.assignmentId?.subject || s.assignmentId?.courseTitle || 'General',
      title: s.assignmentId?.title || 'Homework Exercise',
      assessment: s.assignmentId?.title || 'Homework Exercise',
      date: s.gradedAt ? new Date(s.gradedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Graded',
      marks: `${s.score}/${s.assignmentId?.points || 20}`,
      score: s.score,
      maxScore: s.assignmentId?.points || 20,
      percentage: Math.round(((s.score || 0) / (s.assignmentId?.points || 20)) * 100),
      grade: s.score >= 18 ? 'A+' : s.score >= 16 ? 'A' : s.score >= 14 ? 'B' : 'C',
      remarks: s.feedback || 'Homework feedback recorded.'
    }));

    // 3. Calculated Aggregates (Strictly Separated)
    const overallTestAverage = testResults.length > 0
      ? Math.round(testResults.reduce((sum, t) => sum + t.percentage, 0) / testResults.length)
      : null;

    const overallHomeworkAverage = homeworkResults.length > 0
      ? Math.round(homeworkResults.reduce((sum, h) => sum + h.percentage, 0) / homeworkResults.length)
      : null;

    res.json({
      success: true,
      testResults,
      homeworkResults,
      overallTestAverage,
      overallHomeworkAverage,
      // Unified list for backward compatibility with existing view components, with explicit type flags
      results: [...testResults, ...homeworkResults]
    });
  } catch (err) {
    console.error('Error fetching student results:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve results' });
  }
});

/**
 * GET /api/v1/school/calendar/events
 * Authoritative read-only academic calendar for student.
 * Filters strictly by student's tenant and enrolled class/batch.
 */
router.get('/calendar/events', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?._id;
    const userBatchId = req.user?.batchId;

    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context missing.' });
    }

    // 1. Fetch persistent institutional events for this tenant and class
    const eventFilter = { tenantId };
    if (userBatchId) {
      eventFilter.$or = [{ batchId: null }, { batchId: userBatchId }, { batchId: { $exists: false } }];
    }

    const events = await AcademicEvent.find(eventFilter).sort({ startTime: 1 }).lean();

    // 2. Fetch published assessments for this tenant
    const assessments = await Assessment.find({ tenantId }).lean();
    const attempts = await AssessmentAttempt.find({ tenantId, studentId: userId }).lean();
    const attemptMap = new Map();
    attempts.forEach((a) => attemptMap.set(String(a.assessmentId), a));

    // 3. Fetch homework assignments for this tenant
    const assignments = await Assignment.find({ tenantId }).lean();
    const submissions = await Submission.find({ tenantId, studentId: userId }).lean();
    const submissionMap = new Map();
    submissions.forEach((s) => submissionMap.set(String(s.assignmentId), s));

    // Linked record deduplication
    const linkedSet = new Set(
      events.filter((e) => e.linkedRecordId).map((e) => `${e.linkedRecordType}:${e.linkedRecordId}`)
    );

    const projectedEvents = [];

    const parseSafeDate = (val) => {
      if (!val) return new Date();
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    // Project assessments (only scheduled/active, not drafts)
    assessments.forEach((exam) => {
      const examKey = `Assessment:${exam._id.toString()}`;
      const examKeyId = `Assessment:${exam.id}`;
      if (!linkedSet.has(examKey) && !linkedSet.has(examKeyId)) {
        const start = parseSafeDate(exam.date);
        const duration = Number(exam.durationMinutes) || 45;
        const end = new Date(start.getTime() + duration * 60000);
        const ymd = start.toISOString().split('T')[0];
        const studentAttempt = attemptMap.get(exam.id) || attemptMap.get(exam._id.toString());

        projectedEvents.push({
          _id: `proj-test-${exam._id}`,
          id: `proj-test-${exam._id}`,
          tenantId,
          title: exam.title,
          eventType: 'test',
          subject: exam.subject || 'Assessment',
          description: `Scheduled Examination (${duration} min). Room: ${exam.room || 'Computer Lab 1'}`,
          room: exam.room || 'Computer Lab 1',
          startTime: start,
          endTime: end,
          dateStr: ymd,
          status: studentAttempt?.status ? (studentAttempt.status === 'evaluated' ? 'completed' : studentAttempt.status) : 'scheduled',
          linkedRecordId: exam._id.toString(),
          linkedRecordType: 'Assessment',
          isProjected: true,
          studentAttempt: studentAttempt ? {
            score: studentAttempt.score,
            percentage: studentAttempt.percentage,
            status: studentAttempt.status
          } : null
        });
      }
    });

    // Project homework deadlines
    assignments.forEach((hw) => {
      const hwKey = `Assignment:${hw._id.toString()}`;
      if (!linkedSet.has(hwKey) && hw.dueDate) {
        const end = parseSafeDate(hw.dueDate);
        const start = new Date(end.getTime() - 60 * 60000);
        const ymd = end.toISOString().split('T')[0];
        const studentSub = submissionMap.get(hw._id.toString());

        projectedEvents.push({
          _id: `proj-hw-${hw._id}`,
          id: `proj-hw-${hw._id}`,
          tenantId,
          title: `Due: ${hw.title}`,
          eventType: 'homework',
          subject: hw.subject || hw.courseTitle || 'Homework',
          description: hw.description || 'Homework Deadline',
          room: 'Online Portal',
          startTime: start,
          endTime: end,
          dateStr: ymd,
          status: studentSub?.status ? (studentSub.status === 'graded' ? 'completed' : studentSub.status) : 'scheduled',
          linkedRecordId: hw._id.toString(),
          linkedRecordType: 'Assignment',
          isProjected: true,
          studentSubmission: studentSub ? {
            status: studentSub.status,
            score: studentSub.score
          } : null
        });
      }
    });

    const unifiedList = [...events, ...projectedEvents].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    res.json({
      success: true,
      count: unifiedList.length,
      events: unifiedList
    });
  } catch (err) {
    console.error('Error fetching student calendar events:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic calendar' });
  }
});

/**
 * GET /api/v1/school/announcements
 * Authoritative school noticeboard for student.
 * Strictly queries published announcements for student's tenant and enrolled class.
 */
router.get('/announcements', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context missing.' });
    }

    const batchFilter = req.user?.batchId
      ? [{ batchId: null }, { batchId: req.user.batchId }, { batchId: { $exists: false } }]
      : [{ batchId: null }, { batchId: { $exists: false } }];

    const query = {
      $and: [
        { $or: [{ tenantId }, { isPlatformWide: true }] },
        { $or: batchFilter }
      ],
      status: 'published' // DRAFTS AND ARCHIVED ARE STRICTLY EXCLUDED
    };

    const notices = await Announcement.find(query)
      .populate('batchId', 'name')
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    const formatted = notices.map((n) => ({
      _id: n._id,
      id: n._id.toString(),
      title: n.title,
      content: n.content,
      message: n.content,
      author: n.authorName || 'School Administration',
      authorName: n.authorName || 'School Administration',
      authorId: n.authorId,
      batchId: n.batchId?._id || n.batchId || null,
      batchName: n.batchId?.name || n.batchName || 'All Classes',
      audience: n.batchId?.name || n.batchName || 'All Classes',
      priority: n.priority || 'normal',
      badge: n.badge || 'Notice',
      status: n.status,
      attachments: n.attachments || [],
      publishedAt: n.publishedAt,
      date: n.publishedAt
        ? new Date(n.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recent Notice'
    }));

    res.json({ success: true, count: formatted.length, announcements: formatted });
  } catch (err) {
    console.error('Error fetching student announcements:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve announcements' });
  }
});

/**
 * GET /api/v1/school/announcements/:id
 * Retrieve single announcement details with attachments
 */
router.get('/announcements/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { id } = req.params;

    const notice = await Announcement.findOne({
      _id: id,
      tenantId,
      status: 'published'
    })
      .populate('batchId', 'name')
      .lean();

    if (!notice) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    // Check audience isolation
    if (notice.batchId && req.user?.batchId) {
      const noticeBatchStr = (notice.batchId._id ? notice.batchId._id.toString() : notice.batchId.toString());
      const userBatchStr = req.user.batchId.toString();
      if (noticeBatchStr !== userBatchStr) {
        return res.status(403).json({ success: false, message: 'Unauthorized to view this announcement.' });
      }
    }

    res.json({
      success: true,
      announcement: {
        _id: notice._id,
        id: notice._id.toString(),
        title: notice.title,
        content: notice.content,
        message: notice.content,
        author: notice.authorName || 'School Administration',
        authorName: notice.authorName || 'School Administration',
        batchName: notice.batchId?.name || notice.batchName || 'All Classes',
        badge: notice.badge || 'Notice',
        attachments: notice.attachments || [],
        publishedAt: notice.publishedAt,
        date: notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : 'Recent'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Explicitly reject any modification attempts on notices by student accounts
router.all(['/announcements', '/announcements/*'], (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      message: 'Students are not authorized to create, update, or delete school announcements.'
    });
  }
  next();
});

/**
 * GET /api/v1/school/academic-contacts
 * Retrieves authorized institutional contact details for student's tenant.
 * Returns configured: false if school administration has not configured genuine contacts.
 */
router.get('/academic-contacts', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }

    const college = await College.findById(tenantId).lean();
    if (!college) {
      return res.json({ success: true, configured: false, contacts: null });
    }

    const contact = college.settings?.contact || {};
    const helpline = contact.helpline || contact.phone || null;
    const email = contact.academicOffice || contact.email || null;
    const counselor = contact.counselor || null;

    const isConfigured = Boolean(helpline || email || counselor);

    res.json({
      success: true,
      configured: isConfigured,
      contacts: isConfigured ? { helpline, email, counselor } : null
    });
  } catch (err) {
    console.error('Error fetching academic contacts:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic contacts' });
  }
});

/**
 * GET /api/v1/school/doubts
 * Returns questions submitted by the authenticated student in their tenant.
 */
router.get('/doubts', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }

    const studentId = req.user?._id;
    const doubts = await Doubt.find({ tenantId, studentId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = doubts.map((d) => ({
      _id: d._id,
      id: d._id.toString(),
      teacher: d.teacherName,
      teacherId: d.teacherId,
      topic: d.topic,
      subject: d.subject,
      question: d.question,
      response: d.response || (d.replies?.[d.replies.length - 1]?.text) || null,
      reply: d.response || (d.replies?.[d.replies.length - 1]?.text) || null,
      status: d.status === 'answered' ? 'Answered' : 'Submitted',
      createdAt: d.createdAt,
      repliedAt: d.repliedAt,
      replies: d.replies || []
    }));

    res.json({ success: true, count: formatted.length, doubts: formatted });
  } catch (err) {
    console.error('Error fetching student doubts:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve doubts' });
  }
});

/**
 * POST /api/v1/school/doubts
 * Submits a question to an authorized teacher in the student's tenant.
 */
router.post('/doubts', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }

    const { teacherId, recipientId, teacherName, subject, topic, question, codeSnippet } = req.body;
    const targetTeacherId = teacherId || recipientId;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question content is required' });
    }
    if (question.trim().length < 5 || question.trim().length > 2000) {
      return res.status(400).json({ success: false, message: 'Question must be between 5 and 2000 characters' });
    }
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ success: false, message: 'Topic/Chapter is required' });
    }
    if (topic.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'Topic must not exceed 200 characters' });
    }

    // Resolve teacher within student's tenant
    let resolvedTeacher = null;
    if (targetTeacherId) {
      if (!mongoose.Types.ObjectId.isValid(targetTeacherId)) {
        return res.status(400).json({ success: false, code: 'INVALID_RECIPIENT_ID', message: 'Invalid recipient teacher ID' });
      }
      resolvedTeacher = await User.findOne({
        _id: targetTeacherId,
        tenantId,
        role: { $in: ['trainer', 'teacher', 'admin', 'superadmin'] }
      }).lean();

      if (!resolvedTeacher) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_RECIPIENT',
          message: 'Selected teacher is not an authorized educator in your institution'
        });
      }
    }

    if (!resolvedTeacher && teacherName) {
      const cleanName = teacherName.split('(')[0].trim();
      resolvedTeacher = await User.findOne({
        name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        tenantId,
        role: { $in: ['trainer', 'teacher', 'admin', 'superadmin'] }
      }).lean();
    }

    // Fallback: if student did not specify a recipient, find any educator in student's tenant
    if (!resolvedTeacher && !targetTeacherId) {
      const anyTeacher = await User.findOne({ tenantId, role: { $in: ['trainer', 'teacher'] } }).lean();
      if (anyTeacher) {
        resolvedTeacher = anyTeacher;
      }
    }

    const assignedTeacherId = resolvedTeacher?._id || null;
    const assignedTeacherName = resolvedTeacher?.name || (teacherName ? teacherName.split('(')[0].trim() : 'Subject Teacher');

    const doubt = await Doubt.create({
      tenantId,
      studentId: req.user._id,
      studentName: req.user.name || 'Student',
      studentIdNumber: req.user.studentId || '',
      teacherId: assignedTeacherId,
      teacherName: assignedTeacherName,
      subject: (subject || 'General Academic Doubt').trim(),
      batchId: req.user.batchId || null,
      className: req.user.className || req.user.batchName || '',
      topic: topic.trim(),
      question: question.trim(),
      codeSnippet: codeSnippet ? String(codeSnippet).substring(0, 5000) : '',
      status: 'submitted'
    });

    // Notify connected trainer and admin via socket if online
    const io = req.app.get('io');
    if (io) {
      const doubtPayload = {
        id: doubt._id.toString(),
        studentId: req.user.studentId || doubt.studentId,
        studentName: doubt.studentName,
        subject: doubt.subject,
        topic: doubt.topic,
        question: doubt.question,
        status: 'Submitted',
        createdAt: doubt.createdAt
      };
      io.to(`tenant:${tenantId}:role:trainer`).emit('doubt:new', doubtPayload);
      io.to(`tenant:${tenantId}:role:teacher`).emit('doubt:new', doubtPayload);
      io.to(`tenant:${tenantId}:role:admin`).emit('doubt:new', doubtPayload);
      io.to(`tenant:${tenantId}`).emit('doubt:new', doubtPayload);
      if (resolvedTeacher) {
        io.to(`user:${resolvedTeacher._id}`).emit('doubt:new', doubt);
      }
    }

    await writeAuditLog({
      tenantId,
      actor: { userId: req.user._id, role: req.user.role, name: req.user.name },
      action: 'STUDENT_DOUBT_SUBMITTED',
      targetModel: 'Doubt',
      targetRecord: doubt._id,
      details: { topic: doubt.topic, subject: doubt.subject, teacherName: assignedTeacherName }
    });

    res.status(201).json({
      success: true,
      message: 'Question delivered to teacher.',
      doubt: {
        _id: doubt._id,
        id: doubt._id.toString(),
        teacher: doubt.teacherName,
        teacherId: doubt.teacherId,
        topic: doubt.topic,
        subject: doubt.subject,
        question: doubt.question,
        response: null,
        status: 'Submitted',
        createdAt: doubt.createdAt
      }
    });
  } catch (err) {
    console.error('Error submitting doubt:', err);
    res.status(500).json({ success: false, message: 'Failed to submit question' });
  }
});

/**
 * GET /api/v1/school/leaderboard
 * School-scoped student leaderboard.
 * STRICT ISOLATION:
 * - Students can ONLY view rankings for their authenticated school institution.
 * - Any parameter tampering (?tenantId=... or ?schoolId=...) that targets another school
 *   is strictly rejected with 403 Forbidden.
 * - Rankings are derived purely from real persisted AssessmentAttempt and Submission records.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const requestedTenantId = req.query.tenantId || req.query.schoolId;
    const authTenantId = req.tenantId || req.user?.tenantId;
    const userRole = req.user?.role?.toLowerCase();

    // Cross-tenant tampering guard: Students & trainers cannot query another school's leaderboard
    if (userRole === 'student' || userRole === 'trainer' || userRole === 'teacher') {
      if (!authTenantId) {
        return res.status(403).json({
          success: false,
          code: 'MISSING_SCHOOL_CONTEXT',
          message: 'Your account is not assigned to a valid school institution.'
        });
      }
      if (requestedTenantId && requestedTenantId.toString() !== authTenantId.toString()) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_CROSS_SCHOOL_ACCESS',
          message: 'Security Violation: You are not authorized to view another school\'s student leaderboard.'
        });
      }
    }

    const effectiveTenantId = (userRole === 'superadmin' && requestedTenantId)
      ? requestedTenantId
      : authTenantId;

    if (!effectiveTenantId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_TARGET_SCHOOL',
        message: 'A target school ID is required.'
      });
    }

    const batchId = req.query.batchId || (userRole === 'student' ? req.user?.batchId : null);
    const className = req.query.className || (userRole === 'student' ? req.user?.className : null);

    const { computeSchoolLeaderboard } = await import('../services/schoolLeaderboardService.js');
    const result = await computeSchoolLeaderboard({
      tenantId: effectiveTenantId,
      batchId,
      className
    });

    res.json({
      success: true,
      school: result.school,
      count: result.count,
      leaderboard: result.leaderboard
    });
  } catch (err) {
    console.error('Error fetching school leaderboard:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve school leaderboard'
    });
  }
});

export default router;
