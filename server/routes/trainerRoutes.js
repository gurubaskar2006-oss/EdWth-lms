import express from 'express';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Batch from '../models/Batch.js';
import StudentProgress from '../models/StudentProgress.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import TeacherNote from '../models/TeacherNote.js';
import Assessment from '../models/Assessment.js';
import AcademicEvent from '../models/AcademicEvent.js';
import Announcement from '../models/Announcement.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import Doubt from '../models/Doubt.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { createCriticalAuditLog, actorFromRequest } from '../utils/auditLogger.js';
import generateSecureTemporaryPassword from '../utils/passwordGenerator.js';

const router = express.Router();

// All routes require trainer, teacher, admin, or superadmin under RBAC rules
router.use(verifyToken, requireRole('trainer', 'teacher', 'admin', 'superadmin'));

router.post('/attendance', async (req, res) => {
  try {
    const data = { ...req.body, trainerId: req.user._id, tenantId: req.tenantId };
    const record = await Attendance.create(data);
    res.status(201).json({ success: true, record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/attendance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Attendance.findOneAndDelete({
      _id: id,
      tenantId: req.tenantId
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Attendance record not found or unauthorized' });
    }
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/submissions', async (req, res) => {
  try {
    const query = { tenantId: req.tenantId };
    const submissions = await Submission.find(query)
      .populate('assignmentId', 'title courseId courseCode courseTitle points')
      .populate('studentId', 'name studentId email major')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const formatted = (submissions || []).map(s => ({
      _id: s._id,
      studentName: s.studentName || s.studentId?.name || 'Student',
      studentId: s.studentIdentifier || s.studentId?.studentId || 'SCH-STUDENT',
      studentEmail: s.studentId?.email || '',
      assignmentId: s.assignmentId?._id || s.assignmentId,
      assignmentTitle: s.assignmentId?.title || 'Homework Assignment',
      courseCode: s.assignmentId?.courseCode || 'CS-101',
      courseTitle: s.assignmentId?.courseTitle || 'Technical Curriculum',
      codeSnippet: s.submissionText || s.code || '',
      submittedAt: s.submittedAt || s.createdAt || new Date().toISOString(),
      status: s.status || 'pending',
      score: s.score ?? null,
      maxScore: s.assignmentId?.points || 20,
      feedback: s.feedback ?? null
    }));

    return res.json({ success: true, count: formatted.length, submissions: formatted });
  } catch (err) {
    console.error('Error fetching trainer submissions:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

router.post('/assignments/:id/grade', async (req, res) => {
  try {
    const { studentId, score, feedback, status: requestedStatus } = req.body;
    const targetStatus = requestedStatus === 'needs_revision' ? 'needs_revision' : 'graded';
    const numScore = score !== undefined && score !== null && score !== '' ? Number(score) : null;

    if (targetStatus === 'graded') {
      if (numScore === null || isNaN(numScore) || numScore < 0) {
        return res.status(400).json({ success: false, message: 'A valid non-negative numerical score is required for grading.' });
      }
    } else if (targetStatus === 'needs_revision') {
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ success: false, message: 'Trainer feedback is required when returning work for revision.' });
      }
    }

    // Try finding submission directly by ID, or by assignmentId + studentId
    let submission = null;
    let assignment = null;

    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      submission = await Submission.findOne({ _id: req.params.id, tenantId: req.tenantId });
    }

    if (submission) {
      assignment = await Assignment.findOne({ _id: submission.assignmentId, tenantId: req.tenantId }).lean();
    } else {
      // req.params.id might be assignmentId
      assignment = await Assignment.findOne({
        tenantId: req.tenantId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
          { id: req.params.id }
        ]
      }).lean();

      if (assignment && studentId) {
        submission = await Submission.findOne({
          tenantId: req.tenantId,
          assignmentId: assignment._id,
          studentId
        });
      }
    }

    if (!assignment && !submission) {
      return res.status(404).json({ success: false, message: 'Assignment or submission not found in this institution.' });
    }

    const maxAllowed = assignment?.points || 100;
    if (numScore !== null && numScore > maxAllowed) {
      return res.status(400).json({
        success: false,
        message: `Evaluation score (${numScore}) exceeds maximum points permitted (${maxAllowed}).`
      });
    }

    const targetStudentId = studentId || submission?.studentId;
    let studentUser = null;
    if (targetStudentId) {
      studentUser = await User.findOne({ _id: targetStudentId, tenantId: req.tenantId }).lean();
    }

    if (!submission && assignment && targetStudentId) {
      // Create new graded submission record if not submitted yet
      submission = new Submission({
        tenantId: req.tenantId,
        assignmentId: assignment._id,
        studentId: targetStudentId,
        studentName: studentUser?.name || 'Student',
        studentIdentifier: studentUser?.studentId || 'STUDENT',
        submissionText: '(Graded directly by educator)'
      });
    }

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Unable to locate student submission record to grade.' });
    }

    submission.status = targetStatus;
    submission.feedback = (feedback || '').trim();
    submission.gradedAt = new Date();
    if (numScore !== null) {
      submission.score = numScore;
    }

    await submission.save();

    // Socket.IO notification to student and trainer channels
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('homework:graded', {
        assignmentId: assignment?._id || submission.assignmentId,
        submissionId: submission._id,
        studentId: targetStudentId,
        score: numScore,
        maxScore: maxAllowed,
        status: targetStatus,
        feedback: submission.feedback
      });
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: targetStatus === 'needs_revision' ? 'TRAINER_ASSIGNMENT_RETURNED_FOR_REVISION' : 'TRAINER_ASSIGNMENT_GRADED',
      details: { submissionId: submission._id, score: numScore, feedback, status: targetStatus }
    });

    res.json({
      success: true,
      message: targetStatus === 'graded' ? 'Grade saved and published successfully.' : 'Work returned for revision.',
      submission
    });
  } catch (err) {
    console.error('Error grading assignment:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/students/:studentId/reset-password
 * Educator resets student password within tenant and authorized batch
 */
router.post('/students/:studentId/reset-password', async (req, res) => {
  const { studentId } = req.params;
  try {
    const student = await User.findOne({
      _id: studentId,
      tenantId: req.tenantId,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your institution.' });
    }

    // Role check: If trainer has an assigned batch, student must belong to it
    if (req.user.role === 'trainer' && req.user.batchId) {
      if (student.batchId && student.batchId.toString() !== req.user.batchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are only authorized to reset passwords for students in your assigned class/batch.'
        });
      }
    }

    const temporaryPassword = generateSecureTemporaryPassword(12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    student.password = hashedPassword;
    student.mustChangePassword = true;
    await student.save();

    try {
      await createCriticalAuditLog({
        tenantId: req.tenantId,
        actor: actorFromRequest(req),
        action: 'STUDENT_PASSWORD_RESET',
        targetRecord: student._id,
        targetModel: 'User',
        details: { studentId: student.studentId, email: student.email }
      });
    } catch (auditErr) {
      console.error('[TrainerRoutes] Audit log failed for student password reset:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Temporary password generated successfully.',
      temporaryPassword
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/trainer/students
 * Returns authorized student roster for the teacher within their tenant and assigned class
 */
router.get('/students', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is temporarily unavailable. Student records cannot be retrieved.'
      });
    }

    const tenantFilter = { tenantId: req.tenantId };
    const query = { ...tenantFilter, role: 'student', soft_deleted: { $ne: true } };

    if ((req.user.role === 'trainer' || req.user.role === 'teacher') && req.user.batchId) {
      query.batchId = req.user.batchId;
    }

    let students = await User.find(query).select('-password').sort({ name: 1 }).lean();

    if (!students || students.length === 0) {
      return res.json({ success: true, count: 0, students: [] });
    }

    const studentIds = students.map((s) => s._id);

    // 1. Real attendance rate per student
    const tenantObjectId = mongoose.Types.ObjectId.isValid(req.tenantId)
      ? new mongoose.Types.ObjectId(req.tenantId)
      : req.tenantId;

    const studentObjectIds = studentIds.map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    );

    const attendanceAgg = await Attendance.aggregate([
      { $match: { tenantId: tenantObjectId, studentId: { $in: studentObjectIds } } },
      {
        $group: {
          _id: '$studentId',
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }
        }
      }
    ]).catch(() => []);

    const attendanceMap = new Map();
    attendanceAgg.forEach((a) => {
      if (a.total > 0) {
        attendanceMap.set(a._id.toString(), Math.round((a.present / a.total) * 100));
      }
    });

    // 2. Real total assignments in tenant / batch
    const totalAssignments = await Assignment.countDocuments({ tenantId: req.tenantId });

    // 3. Real homework submissions per student
    const submissions = await Submission.find({
      tenantId: req.tenantId,
      studentId: { $in: studentIds }
    }).lean();

    const submissionMap = new Map();
    submissions.forEach((sub) => {
      const sid = sub.studentId.toString();
      if (!submissionMap.has(sid)) {
        submissionMap.set(sid, []);
      }
      submissionMap.get(sid).push(sub);
    });

    // 4. Real test attempts & examinations per student
    const testAttempts = await AssessmentAttempt.find({
      tenantId: req.tenantId,
      studentId: { $in: studentIds }
    }).lean();

    const testAttemptsMap = new Map();
    testAttempts.forEach((t) => {
      const sid = t.studentId.toString();
      if (!testAttemptsMap.has(sid)) testAttemptsMap.set(sid, []);
      testAttemptsMap.get(sid).push(t);
    });

    // 5. Real assessment integrity telemetry per student
    const integrityEvents = await AssessmentEvent.find({
      tenantId: req.tenantId,
      studentId: { $in: studentIds }
    }).lean();

    const integrityEventsMap = new Map();
    integrityEvents.forEach((ev) => {
      const sid = ev.studentId.toString();
      if (!integrityEventsMap.has(sid)) integrityEventsMap.set(sid, []);
      integrityEventsMap.get(sid).push(ev);
    });

    // 6. Real curriculum progress per student
    const progressList = await StudentProgress.find({
      tenantId: req.tenantId,
      studentId: { $in: studentIds }
    }).lean();

    const progressMap = new Map();
    progressList.forEach((p) => {
      progressMap.set(p.studentId.toString(), p.completedTopics || []);
    });

    // Courses in tenant to determine total topics
    const courses = await Course.find({ tenantId: req.tenantId }).lean();
    const totalCourseTopics = courses.reduce((sum, c) => {
      return sum + (c.units || []).reduce((uSum, u) => uSum + (u.topics?.length || 0), 0);
    }, 0);

    const formattedStudents = students.map((s) => {
      const sidStr = s._id.toString();
      const realAttendance = attendanceMap.get(sidStr);
      const studentSubs = submissionMap.get(sidStr) || [];
      const studentTests = testAttemptsMap.get(sidStr) || [];
      const studentEvents = integrityEventsMap.get(sidStr) || [];
      const completedTopics = progressMap.get(sidStr) || [];

      // Only calculate if records exist
      const attendanceRate = realAttendance != null ? realAttendance : null;

      // Homework metrics (STRICTLY Homework)
      const homeworkSubmitted = studentSubs.filter(
        (sub) => sub.status === 'submitted' || sub.status === 'graded'
      ).length;
      const homeworkPending = Math.max(0, totalAssignments - homeworkSubmitted);

      // Test metrics (STRICTLY AssessmentAttempt)
      const evaluatedTests = studentTests.filter((t) => t.percentage != null);
      let testAverage = null;
      if (evaluatedTests.length > 0) {
        const totalPct = evaluatedTests.reduce((sum, t) => sum + t.percentage, 0);
        testAverage = Math.round(totalPct / evaluatedTests.length);
      }

      // Assessment integrity violation count
      const violationCount = studentEvents.length;

      // Real curriculum progress
      const curriculumCompletion = totalCourseTopics > 0
        ? Math.round((completedTopics.length / totalCourseTopics) * 100)
        : 0;

      // Academic Status & Explicit Pedagogical Reasons
      const statusReasons = [];
      let status = 'Active';

      if (attendanceRate !== null && attendanceRate < 75) {
        status = 'Low Attendance';
        statusReasons.push(`Attendance (${attendanceRate}%) is critically below the 75% minimum threshold.`);
      } else if (attendanceRate !== null && attendanceRate < 85) {
        status = 'Needs Attention';
        statusReasons.push(`Attendance (${attendanceRate}%) has fallen below the recommended 85% benchmark.`);
      }

      if (testAverage !== null && testAverage < 60) {
        status = 'Needs Attention';
        statusReasons.push(`Recent test performance average (${testAverage}%) is below academic standard.`);
      }

      if (homeworkPending > 0) {
        if (status === 'Active') status = 'Pending Work';
        statusReasons.push(`${homeworkPending} homework assignment${homeworkPending > 1 ? 's are' : ' is'} pending submission.`);
      }

      if (violationCount > 0) {
        status = 'Needs Attention';
        statusReasons.push(`${violationCount} assessment integrity event${violationCount > 1 ? 's' : ''} recorded during testing.`);
      }

      if (statusReasons.length === 0) {
        statusReasons.push('Student is meeting all attendance, curriculum, and assignment benchmarks.');
      }

      // Actionable Teacher Recommendation
      let recommendedAction = 'Maintain current academic momentum.';
      if (status === 'Low Attendance') {
        recommendedAction = 'Schedule an attendance review meeting with parents/guardians.';
      } else if (testAverage !== null && testAverage < 60) {
        recommendedAction = 'Assign reinforcement practice on foundational topics and review difficult concepts in office hours.';
      } else if (homeworkPending > 0) {
        recommendedAction = 'Remind student to complete overdue homework exercises before next session.';
      } else if (violationCount > 0) {
        recommendedAction = 'Review proctored assessment logs and discuss academic integrity expectations.';
      }

      return {
        _id: s._id,
        studentId: s.studentId || 'STUDENT',
        name: s.name,
        email: s.email,
        className: s.className || s.major || 'Unassigned',
        attendanceRate, // Number or null
        attendancePercentage: attendanceRate,
        homeworkPending,
        homeworkSubmitted,
        totalAssignments,
        testAverage, // Number or null from AssessmentAttempt
        testsCount: studentTests.length,
        curriculumCompletion, // Real %
        completedTopicsCount: completedTopics.length,
        totalTopicsCount: totalCourseTopics,
        violationCount,
        statusReasons,
        recommendedAction,
        lastActivity: s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : 'Enrolled',
        status
      };
    });

    res.json({
      success: true,
      count: formattedStudents.length,
      students: formattedStudents
    });
  } catch (err) {
    console.error('Error fetching trainer students:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve students' });
  }
});

/**
 * GET /api/v1/trainer/students/:studentId/dossier
 * Comprehensive multi-dimensional student academic profile & diagnostic dossier
 */
router.get('/students/:studentId/dossier', async (req, res) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.tenantId;

    const student = await User.findOne({
      tenantId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : null },
        { studentId: studentId }
      ]
    }).select('-password').lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in institutional directory' });
    }

    const sIdObj = student._id;

    // 1. Attendance Records & Rate
    const attendanceRecords = await Attendance.find({
      tenantId,
      studentId: sIdObj
    }).sort({ date: -1 }).lean();

    const totalAttendanceSessions = attendanceRecords.length;
    const presentSessions = attendanceRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
    const absentSessions = attendanceRecords.filter((a) => a.status === 'absent').length;
    const lateSessions = attendanceRecords.filter((a) => a.status === 'late').length;
    const attendanceRate = totalAttendanceSessions > 0
      ? Math.round((presentSessions / totalAttendanceSessions) * 100)
      : null;

    // 2. Curriculum Progress & Unit Breakdown
    const progressDoc = await StudentProgress.findOne({
      tenantId,
      studentId: sIdObj
    }).lean();

    const rawCompletedTopics = progressDoc?.completedTopics || [];
    const completedTopicKeys = new Set(
      rawCompletedTopics.map((ct) =>
        typeof ct === 'string' ? ct : `${ct.unitNumber}-${ct.topicNumber}`
      )
    );
    const completedTopicTitles = new Set(
      rawCompletedTopics.map((ct) => (typeof ct === 'object' && ct?.topicTitle ? ct.topicTitle : String(ct)))
    );

    const courses = await Course.find({ tenantId }).lean();
    const subjectProgress = courses.map((course) => {
      const units = (course.units || []).map((u) => {
        const topics = u.topics || [];
        const completedCount = topics.filter((t) => {
          const key1 = `${u.unitNumber}-${t.topicNumber}`;
          const key2 = t.title;
          return completedTopicKeys.has(key1) || completedTopicTitles.has(key2);
        }).length;

        let unitStatus = 'not_started';
        if (completedCount === topics.length && topics.length > 0) {
          unitStatus = 'completed';
        } else if (completedCount > 0) {
          unitStatus = 'in_progress';
        }

        return {
          unitNumber: u.unitNumber,
          unitName: u.unitName || u.title || `Unit ${u.unitNumber}`,
          description: u.description || '',
          topicsCount: topics.length,
          completedCount,
          status: unitStatus
        };
      });

      const totalTopics = units.reduce((sum, u) => sum + u.topicsCount, 0);
      const completedTopics = units.reduce((sum, u) => sum + u.completedCount, 0);
      const curriculumCompletion = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      return {
        courseId: course._id,
        subject: course.name || course.title,
        code: course.code,
        teacher: course.teacher || 'Instructional Faculty',
        curriculumCompletion,
        completedTopics,
        totalTopics,
        units
      };
    });

    const primarySubject = subjectProgress.find((s) => s.units && s.units.length > 0) || subjectProgress[0] || null;
    const overallCurriculumCompletion = primarySubject?.curriculumCompletion ?? 0;
    const completedTopicsCount = primarySubject?.completedTopics ?? 0;
    const totalTopicsCount = primarySubject?.totalTopics ?? 0;

    // 3. Tests & Examinations
    const testAttempts = await AssessmentAttempt.find({
      tenantId,
      studentId: sIdObj
    }).sort({ startedAt: -1 }).lean();

    const evaluatedTests = testAttempts.filter((t) => t.percentage != null);
    const averageTestScore = evaluatedTests.length > 0
      ? Math.round(evaluatedTests.reduce((sum, t) => sum + t.percentage, 0) / evaluatedTests.length)
      : null;

    const testsList = testAttempts.map((t) => ({
      _id: t._id,
      assessmentId: t.assessmentId,
      title: t.assessmentTitle,
      subject: t.subject || 'Python Programming',
      score: t.score,
      maxScore: t.maxScore || 100,
      percentage: t.percentage,
      status: t.status,
      date: t.submittedAt ? new Date(t.submittedAt).toLocaleDateString() : t.startedAt ? new Date(t.startedAt).toLocaleDateString() : 'Scheduled',
      timeUsedMinutes: t.timeUsedMinutes || 0,
      violationCount: t.violationCount || 0,
      integrityStatus: t.integrityStatus || 'normal',
      feedback: t.teacherFeedback || ''
    }));

    // 4. Homework Assignments & Submissions
    const assignments = await Assignment.find({ tenantId }).sort({ dueDate: -1 }).lean();
    const submissions = await Submission.find({ tenantId, studentId: sIdObj }).lean();
    const submissionByAsgId = new Map(submissions.map((s) => [s.assignmentId.toString(), s]));

    const homeworkList = assignments.map((asg) => {
      const sub = submissionByAsgId.get(asg._id.toString());
      const status = sub?.status || 'pending';
      return {
        _id: asg._id,
        title: asg.title,
        subject: asg.subject || asg.courseTitle || 'Computer Studies',
        dueDate: asg.dueDate ? new Date(asg.dueDate).toLocaleDateString() : 'No Due Date',
        status,
        score: sub?.score ?? null,
        maxScore: asg.points || 20,
        feedback: sub?.feedback || '',
        submittedAt: sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString() : null
      };
    });

    const homeworkSubmitted = homeworkList.filter((h) => h.status === 'submitted' || h.status === 'graded').length;
    const pendingHomework = Math.max(0, homeworkList.length - homeworkSubmitted);

    // 5. Assessment Integrity Telemetry Events
    const integrityEvents = await AssessmentEvent.find({
      tenantId,
      studentId: sIdObj
    }).sort({ timestamp: -1 }).lean();

    const integrityEventsList = integrityEvents.map((ev) => ({
      _id: ev._id,
      eventType: ev.eventType,
      severity: ev.severity || 'low',
      reason: ev.reason || 'Assessment activity recorded',
      assessmentTitle: ev.assessmentTitle || 'Assessment',
      timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'Just now'
    }));

    // 6. Teacher Note
    const teacherNoteDoc = await TeacherNote.findOne({
      tenantId,
      studentId: sIdObj
    }).lean();

    // 7. Academic Status Derivation with Explicit Reasons
    const statusReasons = [];
    let status = 'Active';

    if (attendanceRate !== null && attendanceRate < 75) {
      status = 'Low Attendance';
      statusReasons.push(`Attendance (${attendanceRate}%) is critically below the 75% minimum threshold.`);
    } else if (attendanceRate !== null && attendanceRate < 85) {
      status = 'Needs Attention';
      statusReasons.push(`Attendance (${attendanceRate}%) has fallen below the recommended 85% benchmark.`);
    }

    if (averageTestScore !== null && averageTestScore < 60) {
      status = 'Needs Attention';
      statusReasons.push(`Recent test performance average (${averageTestScore}%) is below academic standard.`);
    }

    if (pendingHomework > 0) {
      if (status === 'Active') status = 'Pending Work';
      statusReasons.push(`${pendingHomework} homework assignment${pendingHomework > 1 ? 's are' : ' is'} pending submission.`);
    }

    if (integrityEventsList.length > 0) {
      status = 'Needs Attention';
      statusReasons.push(`${integrityEventsList.length} assessment integrity event${integrityEventsList.length > 1 ? 's' : ''} recorded during examinations.`);
    }

    if (statusReasons.length === 0) {
      statusReasons.push('Student is meeting all attendance, curriculum, and assignment benchmarks.');
    }

    let recommendedAction = 'Maintain current academic momentum.';
    if (status === 'Low Attendance') {
      recommendedAction = 'Schedule an attendance review meeting with parents/guardians.';
    } else if (averageTestScore !== null && averageTestScore < 60) {
      recommendedAction = 'Assign reinforcement practice on foundational topics and review difficult concepts in office hours.';
    } else if (pendingHomework > 0) {
      recommendedAction = 'Remind student to complete overdue homework exercises before next session.';
    } else if (integrityEventsList.length > 0) {
      recommendedAction = 'Review proctored assessment logs and discuss academic integrity expectations.';
    }

    res.json({
      success: true,
      dossier: {
        student: {
          id: student._id,
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          className: student.major || student.className || 'Class 10 - Section A',
          teacherName: req.user.name || 'Instructional Faculty'
        },
        overview: {
          attendanceRate,
          totalAttendanceSessions,
          presentSessions,
          absentSessions,
          lateSessions,
          curriculumCompletion: overallCurriculumCompletion,
          completedTopicsCount,
          totalTopicsCount,
          testsTaken: testsList.length,
          totalTests: testsList.length,
          averageTestScore,
          homeworkSubmitted,
          totalHomework: homeworkList.length,
          pendingHomework,
          violationCount: integrityEventsList.length,
          status,
          statusReasons,
          recommendedAction
        },
        subjectProgress,
        tests: testsList,
        homework: homeworkList,
        integrityEvents: integrityEventsList,
        teacherNote: teacherNoteDoc?.content || ''
      }
    });
  } catch (err) {
    console.error('Error fetching student dossier:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve student academic dossier' });
  }
});

/**
 * GET /api/v1/trainer/analytics
 * Real educator dashboard metrics with robust cohort and tenant isolation
 */
router.get('/analytics', async (req, res) => {
  try {
    // Strictly enforce tenant isolation:
    // Non-superadmin users must have an authorized tenant context
    if (!req.tenantId && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required for cohort analytics.'
      });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const isTrainerOrTeacher = req.user.role === 'trainer' || req.user.role === 'teacher';
    const tenantFilter = isSuperAdmin ? (req.query.tenantId ? { tenantId: req.query.tenantId } : {}) : { tenantId: req.tenantId };

    const hasValidBatchId = req.user.batchId && mongoose.Types.ObjectId.isValid(req.user.batchId);

    // If an authenticated trainer has NO assigned cohort, return genuine zero-value metrics
    if (isTrainerOrTeacher && !hasValidBatchId) {
      return res.json({
        success: true,
        data: {
          totalStudents: 0,
          activeCourses: 0,
          totalAttendance: 0,
          attendanceRate: null,
          totalSubmissions: 0,
          gradedSubmissions: 0,
          averageScore: null
        }
      });
    }

    const studentFilter = { ...tenantFilter, role: 'student', soft_deleted: { $ne: true } };
    if (isTrainerOrTeacher && hasValidBatchId) {
      studentFilter.batchId = new mongoose.Types.ObjectId(req.user.batchId);
    }

    // Build attendance query scoped to cohort / tenant
    const attendanceFilter = { ...tenantFilter };
    if (isTrainerOrTeacher && hasValidBatchId) {
      attendanceFilter.batchId = new mongoose.Types.ObjectId(req.user.batchId);
    } else if (req.user._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
      attendanceFilter.$or = [{ trainerId: req.user._id }, tenantFilter];
    }

    // Build submissions query scoped to students in assigned cohort
    let submissionFilter = { ...tenantFilter };
    if (isTrainerOrTeacher && hasValidBatchId) {
      const cohortStudentIds = await User.find(studentFilter).select('_id').lean().catch(() => []);
      submissionFilter.studentId = { $in: cohortStudentIds.map(s => s._id) };
    }

    const courseFilter = isTrainerOrTeacher && hasValidBatchId
      ? { ...tenantFilter, $or: [{ batchId: new mongoose.Types.ObjectId(req.user.batchId) }, { instructorId: req.user._id }] }
      : tenantFilter;

    const [totalStudents, activeCourses, totalAttendance, presentAttendance, submissions] = await Promise.all([
      User.countDocuments(studentFilter).catch(err => {
        console.error('[TrainerAnalytics] Error counting students:', err.message);
        return 0;
      }),
      Course.countDocuments(courseFilter).catch(err => {
        console.error('[TrainerAnalytics] Error counting courses:', err.message);
        return 0;
      }),
      Attendance.countDocuments(attendanceFilter).catch(err => {
        console.error('[TrainerAnalytics] Error counting attendance:', err.message);
        return 0;
      }),
      Attendance.countDocuments({ ...attendanceFilter, status: { $in: ['present', 'late'] } }).catch(err => {
        console.error('[TrainerAnalytics] Error counting present attendance:', err.message);
        return 0;
      }),
      Submission.find(submissionFilter).select('score status').lean().catch(err => {
        console.error('[TrainerAnalytics] Error querying submissions:', err.message);
        return [];
      })
    ]);

    const totalSubmissions = Array.isArray(submissions) ? submissions.length : 0;
    const gradedSubmissions = Array.isArray(submissions) ? submissions.filter(s => s.status === 'graded') : [];
    const gradedCount = gradedSubmissions.length;

    const totalScore = gradedSubmissions.reduce((acc, s) => {
      const num = typeof s.score === 'number' ? s.score : parseFloat(s.score);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);

    const avgScore = gradedCount > 0 ? (totalScore / gradedCount).toFixed(1) : null;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : null;

    res.json({
      success: true,
      data: {
        totalStudents: totalStudents || 0,
        activeCourses: activeCourses || 0,
        totalAttendance: totalAttendance || 0,
        attendanceRate,
        totalSubmissions,
        gradedSubmissions: gradedCount,
        averageScore: avgScore
      }
    });
  } catch (err) {
    console.error('[TrainerAnalytics] Failed to compute cohort analytics:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve cohort analytics' });
  }
});

router.get('/analytics/batch/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid cohort identifier' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const isTrainerOrTeacher = req.user.role === 'trainer' || req.user.role === 'teacher';

    // Role and cohort scope check: trainer can ONLY access their assigned cohort
    if (isTrainerOrTeacher) {
      if (!req.user.batchId || req.user.batchId.toString() !== id) {
        return res.status(403).json({ success: false, message: 'Access denied: not authorized for this cohort.' });
      }
    }

    // Verify batch exists in caller's tenant
    const targetBatch = await Batch.findOne({
      _id: id,
      ...(isSuperAdmin ? {} : { tenantId: req.tenantId })
    }).lean();

    if (!targetBatch) {
      return res.status(404).json({ success: false, message: 'Cohort not found in this institution.' });
    }

    const batchFilter = {
      tenantId: targetBatch.tenantId,
      batchId: new mongoose.Types.ObjectId(id)
    };

    const totalStudents = await User.countDocuments({
      ...batchFilter,
      role: 'student',
      soft_deleted: { $ne: true }
    }).catch(err => {
      console.error('[TrainerBatchAnalytics] Error counting students:', err.message);
      return 0;
    });

    const attendanceRecords = await Attendance.countDocuments(batchFilter).catch(err => {
      console.error('[TrainerBatchAnalytics] Error counting attendance:', err.message);
      return 0;
    });

    res.json({
      success: true,
      data: {
        batchId: id,
        totalStudents,
        attendanceRecords
      }
    });
  } catch (err) {
    console.error('[TrainerBatchAnalytics] Internal failure:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve cohort batch analytics' });
  }
});

/**
 * PUT /api/v1/trainer/subjects/:courseId/current-topic
 * Trainer sets the authoritative current teaching topic for a subject
 */
router.put('/subjects/:courseId/current-topic', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { unitNumber, unitTitle, unitName, topicNumber, topicTitle, topicName, scheduledTime } = req.body;

    const course = await Course.findOne({
      tenantId: req.tenantId,
      $or: [{ id: courseId }, { _id: mongoose.Types.ObjectId.isValid(courseId) ? courseId : null }]
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const finalUnitTitle = unitTitle || unitName || `Unit ${unitNumber || 1}`;
    const finalTopicTitle = topicTitle || topicName || `Topic ${topicNumber || 1}`;

    course.currentTeachingTopic = {
      unitNumber: Number(unitNumber) || 1,
      unitTitle: finalUnitTitle,
      unitName: finalUnitTitle,
      topicNumber: Number(topicNumber) || 1,
      topicTitle: finalTopicTitle,
      topicName: finalTopicTitle,
      scheduledTime: scheduledTime || 'Today, 10:00 AM',
      teacherName: req.user.name || course.instructor?.name || 'Assigned Educator',
      className: course.className || 'Class 10 - Section A',
      progressText: `${finalUnitTitle} — ${finalTopicTitle}`
    };

    await course.save();

    res.json({
      success: true,
      message: 'Current teaching topic updated successfully',
      currentTeachingTopic: course.currentTeachingTopic
    });
  } catch (err) {
    console.error('Error updating current topic:', err);
    res.status(500).json({ success: false, message: 'Failed to update current teaching topic' });
  }
});

/**
 * GET /api/v1/trainer/courses
 * Retrieves courses/subjects in trainer's tenant
 */
router.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find({ tenantId: req.tenantId }).lean();
    res.json({ success: true, courses, subjects: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/courses
 * RESTRICTED: Academic structure, subjects, and course assignments are strictly managed centrally by
 * 6th Civilians Corporation Company Administrators. Trainers/teachers cannot create subjects.
 */
router.post('/courses', async (req, res) => {
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_ACTION',
    message: 'Subject creation and subject assignment are restricted to Company Administrators. Educators can only view assigned curriculum.'
  });
});

/**
 * DELETE /api/v1/trainer/courses/:id
 * RESTRICTED: Academic structure, subjects, and course assignments are strictly managed centrally by
 * 6th Civilians Corporation Company Administrators. Trainers/teachers cannot delete subjects.
 */
router.delete('/courses/:id', async (req, res) => {
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_ACTION',
    message: 'Subject deletion is restricted to Company Administrators. Educators can only view assigned curriculum.'
  });
});

/**
 * GET /api/v1/trainer/homework
 * Retrieves all homework assignments with authoritative assignment-centred statistics and student roster
 */
router.get('/homework', async (req, res) => {
  try {
    const tenantFilter = { tenantId: req.tenantId };
    if (req.query.includeArchived !== 'true') {
      tenantFilter.status = { $ne: 'archived' };
    }
    const assignments = await Assignment.find(tenantFilter)
      .populate('batchId', 'name grade section')
      .sort({ dueDate: -1 })
      .lean();

    const students = await User.find({ ...tenantFilter, role: 'student', soft_deleted: { $ne: true } })
      .populate('batchId', 'name grade section')
      .lean();

    const submissions = await Submission.find(tenantFilter).lean();
    const now = new Date();

    const formatted = assignments.map((hw) => {
      const hwSubs = submissions.filter((s) => s.assignmentId.toString() === hw._id.toString());
      const isPastDue = hw.dueDate ? new Date(hw.dueDate) < now : false;

      // Identify students genuinely assigned to this specific homework
      let assignedStudents = students;
      if (hw.batchId) {
        const targetBatchIdStr = (hw.batchId._id ? hw.batchId._id.toString() : hw.batchId.toString());
        assignedStudents = students.filter((st) => {
          if (!st.batchId) return false;
          const studentBatchIdStr = (st.batchId._id ? st.batchId._id.toString() : st.batchId.toString());
          return studentBatchIdStr === targetBatchIdStr;
        });
      }

      // Build authoritative student-level roster for this assignment
      const roster = assignedStudents.map((st) => {
        const sub = hwSubs.find(
          (s) => (s.studentId && s.studentId.toString() === st._id.toString()) || s.studentIdentifier === st.studentId
        );

        let canonicalStatus = 'not_submitted';
        let displayStatus = 'NOT_SUBMITTED';

        if (sub) {
          if (sub.status === 'graded') {
            canonicalStatus = 'graded';
            displayStatus = 'EVALUATED';
          } else if (sub.status === 'needs_revision') {
            canonicalStatus = 'needs_revision';
            displayStatus = 'RETURNED_FOR_REVISION';
          } else {
            canonicalStatus = 'submitted';
            displayStatus = 'AWAITING_EVALUATION';
          }
        } else {
          if (isPastDue) {
            canonicalStatus = 'not_submitted';
            displayStatus = 'OVERDUE';
          } else {
            canonicalStatus = 'not_submitted';
            displayStatus = 'NOT_SUBMITTED';
          }
        }

        const isOverdue = isPastDue && (!sub || (sub.submittedAt && new Date(sub.submittedAt) > new Date(hw.dueDate)));

        return {
          studentDbId: st._id,
          studentId: st.studentId, // Institution student ID (e.g. OAK-ST-001)
          studentName: st.name,
          email: st.email,
          batchName: st.batchId?.name || hw.batchId?.name || hw.batchName || 'Class 10 - Section A',
          status: canonicalStatus, // 'submitted' | 'graded' | 'needs_revision' | 'not_submitted'
          displayStatus, // 'SUBMITTED' | 'AWAITING_EVALUATION' | 'EVALUATED' | 'RETURNED_FOR_REVISION' | 'NOT_SUBMITTED' | 'OVERDUE'
          isOverdue,
          submissionId: sub ? sub._id : null,
          submittedAt: sub?.submittedAt || null,
          submissionText: sub ? (sub.submissionText || sub.submissionFile || '') : null,
          submissionFile: sub?.submissionFile || null,
          score: sub?.score ?? null,
          maxScore: hw.points || 20,
          feedback: sub?.feedback || null,
          evaluated: sub?.status === 'graded'
        };
      });

      const totalAssigned = assignedStudents.length;
      const submittedCount = roster.filter((r) => r.submissionId !== null).length;
      const awaitingEvaluationCount = roster.filter((r) => r.status === 'submitted').length;
      const evaluatedCount = roster.filter((r) => r.status === 'graded').length;
      const returnedForRevisionCount = roster.filter((r) => r.status === 'needs_revision').length;
      const notSubmittedCount = roster.filter((r) => r.submissionId === null).length;
      const overdueCount = roster.filter((r) => r.submissionId === null && isPastDue).length;

      const batchDisplayName = hw.batchId?.name || hw.batchName || (hw.batchId ? 'Assigned Class' : 'All Classes');

      return {
        _id: hw._id,
        id: hw.id || hw._id.toString(),
        title: hw.title,
        subject: hw.subject || hw.courseTitle || 'Technical Subject',
        topic: hw.topic || '',
        description: hw.description || '',
        batchId: hw.batchId?._id || hw.batchId || null,
        batchName: batchDisplayName,
        className: batchDisplayName,
        dueDate: hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Due Date',
        dueTimestamp: hw.dueDate,
        priority: hw.priority || 'Normal',
        points: hw.points || 20,
        // Centrally normalized metrics required by Phase 2
        totalAssigned,
        totalStudents: totalAssigned,
        enrolledCount: totalAssigned,
        submittedCount,
        awaitingEvaluationCount,
        pendingCount: awaitingEvaluationCount,
        evaluatedCount,
        returnedForRevisionCount,
        needsRevisionCount: returnedForRevisionCount,
        notSubmittedCount,
        overdueCount,
        roster,
        submissions: hwSubs.map((s) => ({
          _id: s._id,
          studentId: s.studentIdentifier || s.studentId?.toString(),
          studentName: s.studentName || 'Student',
          status: s.status,
          score: s.score,
          feedback: s.feedback,
          submittedAt: s.submittedAt
        }))
      };
    });

    res.json({ success: true, count: formatted.length, assignments: formatted });
  } catch (err) {
    console.error('Error fetching trainer homework:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve homework' });
  }
});

/**
 * POST /api/v1/trainer/homework
 * Creates a new authoritative homework assignment for student cohort
 */
router.post('/homework', async (req, res) => {
  try {
    const { title, subject, topic, dueDate, points, description, batchId, batchName, requirements } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Homework title is required' });
    }

    let resolvedBatchName = batchName;
    if (batchId && !resolvedBatchName) {
      const b = await Batch.findOne({ _id: batchId, tenantId: req.tenantId }).lean();
      if (b) resolvedBatchName = b.name;
    }

    const assignment = await Assignment.create({
      tenantId: req.tenantId,
      trainerId: req.user._id,
      batchId: batchId || null,
      batchName: resolvedBatchName || 'All Classes',
      title: title.trim(),
      subject: subject || 'Python Programming',
      topic: topic || '',
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      points: Number(points) || 20,
      description: description || 'Complete practice exercises and submit implementation.',
      requirements: Array.isArray(requirements) ? requirements : [],
      status: 'pending'
    });

    // Notify student cohorts via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('homework:created', {
        assignmentId: assignment._id,
        title: assignment.title,
        subject: assignment.subject,
        dueDate: assignment.dueDate
      });
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_ASSIGNMENT_CREATED',
      details: { assignmentId: assignment._id, title: assignment.title }
    });

    res.status(201).json({ success: true, message: 'Homework published to student dashboards', assignment });
  } catch (err) {
    console.error('Error creating homework:', err);
    res.status(500).json({ success: false, message: 'Failed to assign homework' });
  }
});

/**
 * PUT /api/v1/trainer/homework/:id
 * Updates an existing homework assignment while strictly preserving student submission history
 */
router.put('/homework/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, topic, dueDate, points, description, batchId, batchName, requirements, status, attachments } = req.body;

    const assignment = await Assignment.findOne({ _id: id, tenantId: req.tenantId });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found or unauthorized' });
    }

    if (title && title.trim()) assignment.title = title.trim();
    if (subject) assignment.subject = subject;
    if (topic !== undefined) assignment.topic = topic;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (points !== undefined) assignment.points = Number(points);
    if (description !== undefined) assignment.description = description;
    if (status) assignment.status = status;
    if (Array.isArray(requirements)) assignment.requirements = requirements;
    if (Array.isArray(attachments)) assignment.attachments = attachments;

    if (batchId) {
      assignment.batchId = batchId;
      if (batchName) {
        assignment.batchName = batchName;
      } else {
        const b = await Batch.findOne({ _id: batchId, tenantId: req.tenantId }).lean();
        if (b) assignment.batchName = b.name;
      }
    }

    await assignment.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('homework:updated', {
        assignmentId: assignment._id,
        title: assignment.title,
        status: assignment.status
      });
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_ASSIGNMENT_UPDATED',
      details: { assignmentId: assignment._id, title: assignment.title }
    });

    res.json({ success: true, message: 'Assignment updated successfully', assignment });
  } catch (err) {
    console.error('Error updating homework:', err);
    res.status(500).json({ success: false, message: 'Failed to update homework' });
  }
});

/**
 * DELETE /api/v1/trainer/homework/:id
 * Safely archives an assignment without deleting student academic records or submissions
 */
router.delete('/homework/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findOne({
      tenantId: req.tenantId,
      $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { id }]
    });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found or unauthorized' });
    }

    if (req.query.purge === 'true' || req.query.hardDelete === 'true') {
      await Promise.all([
        Assignment.deleteOne({ _id: assignment._id }),
        Submission.deleteMany({ assignmentId: assignment._id, tenantId: req.tenantId })
      ]);

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${req.tenantId}`).emit('homework:deleted', {
          assignmentId: assignment._id,
          title: assignment.title
        });
      }

      createCriticalAuditLog({
        tenantId: req.tenantId,
        actor: actorFromRequest(req),
        action: 'TRAINER_ASSIGNMENT_PURGED',
        details: { assignmentId: assignment._id, title: assignment.title }
      });

      return res.json({ success: true, message: 'Assignment and associated submissions permanently purged', assignmentId: id });
    }

    // Set status to archived to preserve student marks and submissions
    assignment.status = 'archived';
    await assignment.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('homework:archived', {
        assignmentId: assignment._id,
        title: assignment.title
      });
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_ASSIGNMENT_ARCHIVED',
      details: { assignmentId: assignment._id, title: assignment.title }
    });

    res.json({ success: true, message: 'Assignment archived successfully without loss of student submissions', assignmentId: id });
  } catch (err) {
    console.error('Error archiving homework:', err);
    res.status(500).json({ success: false, message: 'Failed to archive homework' });
  }
});

/**
 * ─── ANNOUNCEMENTS CRUD (PHASE 3) ───────────────────────────────────────────
 */

/**
 * GET /api/v1/trainer/announcements
 * Retrieves all notices/announcements for trainer's tenant (drafts, published, archived)
 */
router.get('/announcements', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const tenantFilter = tenantId
      ? { $or: [{ tenantId }, { isPlatformWide: true }] }
      : { isPlatformWide: true };

    if (req.query.status && req.query.status !== 'all') {
      tenantFilter.status = req.query.status;
    }
    if (req.query.batchId) {
      tenantFilter.batchId = req.query.batchId;
    }

    const announcements = await Announcement.find(tenantFilter)
      .populate('batchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = announcements.map((a) => ({
      _id: a._id,
      id: a._id.toString(),
      title: a.title,
      content: a.content,
      message: a.content,
      author: a.authorName,
      authorName: a.authorName,
      authorId: a.authorId,
      batchId: a.batchId?._id || a.batchId || null,
      batchName: a.batchId?.name || a.batchName || 'All Classes',
      audience: a.batchId?.name || a.batchName || 'All Classes',
      priority: a.priority || 'normal',
      urgency: a.priority === 'urgent' ? 'Urgent' : a.priority === 'important' ? 'Important' : 'Normal',
      badge: a.badge || 'Notice',
      status: a.status || 'published',
      attachments: a.attachments || [],
      publishedAt: a.publishedAt,
      date: a.publishedAt
        ? new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Draft',
      createdAt: a.createdAt
    }));

    res.json({ success: true, count: formatted.length, announcements: formatted });
  } catch (err) {
    console.error('Error fetching trainer announcements:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve announcements' });
  }
});

/**
 * POST /api/v1/trainer/announcements
 * Creates a new announcement (draft or published)
 */
router.post('/announcements', async (req, res) => {
  try {
    const { title, content, message, batchId, batchName, priority, badge, status, attachments } = req.body;
    const bodyContent = content || message;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Announcement title is required' });
    }
    if (!bodyContent || !bodyContent.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Announcement content is required' });
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context required' });
    }

    let resolvedBatchName = batchName;
    let resolvedBatchId = null;
    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, code: 'INVALID_BATCH_ID', message: 'Invalid cohort identifier' });
      }
      const b = await Batch.findOne({ _id: batchId, tenantId });
      if (!b) {
        return res.status(403).json({
          success: false,
          code: 'INVALID_AUDIENCE_SCOPE',
          errorCode: 'INVALID_AUDIENCE_SCOPE',
          message: 'The selected cohort/batch does not belong to your authorized institution.'
        });
      }
      resolvedBatchName = b.name;
      resolvedBatchId = b._id;
    }

    const noticeStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'published';
    const isPublished = noticeStatus === 'published';

    const announcement = await Announcement.create({
      tenantId,
      isPlatformWide: false,
      batchId: resolvedBatchId,
      batchName: resolvedBatchName || 'All Classes',
      authorId: req.user._id,
      authorName: req.user.name || 'Educator',
      title: title.trim(),
      content: bodyContent.trim(),
      priority: ['normal', 'important', 'urgent', 'high', 'low'].includes(priority) ? priority : 'normal',
      badge: badge || 'Notice',
      status: noticeStatus,
      attachments: Array.isArray(attachments) ? attachments : [],
      publishedAt: isPublished ? new Date() : null
    });

    if (isPublished) {
      const io = req.app.get('io');
      if (io) {
        if (announcement.batchId) {
          io.to(`tenant:${tenantId}:batch:${announcement.batchId}`).emit('announcement:new', announcement);
          io.to(`tenant:${tenantId}:role:trainer`).emit('announcement:new', announcement);
          io.to(`tenant:${tenantId}:role:teacher`).emit('announcement:new', announcement);
          io.to(`tenant:${tenantId}:role:admin`).emit('announcement:new', announcement);
        } else {
          io.to(`tenant:${tenantId}`).emit('announcement:new', announcement);
        }
      }
    }

    await createCriticalAuditLog({
      tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_ANNOUNCEMENT_CREATED',
      details: { announcementId: announcement._id, title: announcement.title, status: noticeStatus }
    });

    res.status(201).json({
      success: true,
      message: isPublished ? 'Announcement published successfully' : 'Draft saved successfully',
      announcement
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join('; ');
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: msg || 'Announcement validation failed' });
    }
    console.error('Error creating announcement:', err);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

/**
 * PUT /api/v1/trainer/announcements/:id
 * Updates an authorized announcement
 */
router.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, message, batchId, batchName, priority, badge, status, attachments } = req.body;

    const notice = await Announcement.findOne({ _id: id, tenantId: req.tenantId });
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const bodyContent = content || message;
    if (title && title.trim()) notice.title = title.trim();
    if (bodyContent && bodyContent.trim()) notice.content = bodyContent.trim();
    if (batchId !== undefined) notice.batchId = batchId || null;
    if (batchName) notice.batchName = batchName;
    if (priority) notice.priority = priority;
    if (badge) notice.badge = badge;
    if (Array.isArray(attachments)) notice.attachments = attachments;

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      if (notice.status !== 'published' && status === 'published') {
        notice.publishedAt = new Date();
      }
      notice.status = status;
    }

    await notice.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('announcement:updated', notice);
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_ANNOUNCEMENT_UPDATED',
      details: { announcementId: notice._id, title: notice.title }
    });

    res.json({ success: true, message: 'Announcement updated successfully', announcement: notice });
  } catch (err) {
    console.error('Error updating announcement:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to update announcement' });
  }
});

/**
 * PATCH /api/v1/trainer/announcements/:id/status
 * Quickly updates announcement status (publish, draft, archive)
 */
router.patch('/announcements/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status: draft, published, or archived' });
    }

    const notice = await Announcement.findOne({ _id: id, tenantId: req.tenantId });
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    if (notice.status !== 'published' && status === 'published') {
      notice.publishedAt = new Date();
    }
    notice.status = status;
    await notice.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('announcement:updated', notice);
    }

    res.json({ success: true, message: `Status updated to ${status}`, announcement: notice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/v1/trainer/announcements/:id
 * Permanently deletes an authorized announcement
 */
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Announcement.findOneAndDelete({ _id: id, tenantId: req.tenantId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Announcement not found or unauthorized.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('announcement:deleted', { id });
    }

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/trainer/classes
 * Retrieves real cohorts/classes for the current tenant with live student count & attendance
 */
router.get('/classes', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is temporarily unavailable. Class rosters cannot be retrieved.'
      });
    }

    const tenantFilter = { tenantId: req.tenantId };
    const batchFilter = { ...tenantFilter, status: { $ne: 'deleted' } };
    if ((req.user.role === 'trainer' || req.user.role === 'teacher') && req.user.batchId) {
      batchFilter._id = req.user.batchId;
    }
    const batches = await Batch.find(batchFilter).lean();

    const classesList = await Promise.all(
      batches.map(async (b) => {
        const studentCount = await User.countDocuments({
          tenantId: req.tenantId,
          batchId: b._id,
          role: 'student',
          soft_deleted: { $ne: true }
        });

        const repUser = await User.findOne({
          tenantId: req.tenantId,
          batchId: b._id,
          role: 'student',
          soft_deleted: { $ne: true }
        })
          .sort({ name: 1 })
          .select('name')
          .lean();

        // Calculate actual attendance rate for this batch
        const attAgg = await Attendance.aggregate([
          { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId), batchId: b._id } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              present: {
                $sum: {
                  $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0]
                }
              }
            }
          }
        ]);

        const attendanceRate =
          attAgg[0]?.total > 0
            ? Math.round((attAgg[0].present / attAgg[0].total) * 100)
            : 100;

        const code = b.name.includes('-')
          ? b.name.replace('Class ', 'CLS-').replace(' - Section ', '')
          : b.name.replace(/\s+/g, '-');

        return {
          _id: b._id,
          id: b._id.toString(),
          code,
          name: b.name,
          room: 'Room 102',
          students: studentCount,
          attendanceRate,
          rep: repUser?.name || 'Class Representative',
          timing: 'Mon - Fri, 09:00 AM'
        };
      })
    );

    res.json({ success: true, count: classesList.length, classes: classesList });
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve classes' });
  }
});

/**
 * GET /api/v1/trainer/tests
 * Retrieves all assessments scheduled for the tenant and authorized cohort
 */
router.get('/tests', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is currently unavailable. Displaying safe offline state.'
      });
    }

    const query = { tenantId: req.tenantId };
    if ((req.user.role === 'trainer' || req.user.role === 'teacher') && req.user.batchId) {
      query.$or = [
        { batchId: req.user.batchId },
        { batchId: null },
        { batchId: { $exists: false } }
      ];
    }

    const tests = await Assessment.find(query).sort({ date: 1, createdAt: -1 }).lean();
    res.json({ success: true, count: tests.length, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/tests
 * Schedules a new test/assessment for the tenant and optionally assigns to cohort
 */
router.post('/tests', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is currently unavailable.'
      });
    }

    const { title, subject, date, time, room, totalMarks, durationMinutes, isCodingExam, batchId, className } = req.body;
    if (!title || !subject) {
      return res.status(400).json({ success: false, message: 'Title and subject are required' });
    }

    let targetBatchId = batchId || req.user.batchId || null;
    let targetClassName = className || '';

    if (targetBatchId) {
      if (!mongoose.Types.ObjectId.isValid(targetBatchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batchId format' });
      }
      const bDoc = await Batch.findOne({ _id: targetBatchId, tenantId: req.tenantId });
      if (!bDoc) {
        return res.status(404).json({ success: false, message: 'Assigned batch cohort not found in this institution.' });
      }
      targetClassName = bDoc.name;
    }

    const testId = `test-${Date.now()}`;
    const newExam = await Assessment.create({
      tenantId: req.tenantId,
      id: testId,
      title: title.trim(),
      subject: subject.trim(),
      batchId: targetBatchId,
      className: targetClassName,
      date: date ? new Date(date) : new Date(Date.now() + 2 * 86400000),
      time: time || '10:00 - 10:45 AM',
      room: room || 'Computer Lab 1',
      totalMarks: Number(totalMarks) || 20,
      durationMinutes: Number(durationMinutes) || 45,
      isCodingExam: isCodingExam ?? true,
      status: 'scheduled'
    });

    res.status(201).json({ success: true, test: newExam });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/tests/:id/assign
 * Assigns an existing test/assessment to a cohort / batch of students within trainer's tenant
 */
router.post('/tests/:id/assign', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is currently unavailable.'
      });
    }

    const { id } = req.params;
    const { batchId, className } = req.body;

    const testDoc = await Assessment.findOne({
      tenantId: req.tenantId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { id }
      ]
    });

    if (!testDoc) {
      return res.status(404).json({ success: false, message: 'Assessment not found or unauthorized.' });
    }

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batchId format.' });
      }
      const batchExistsAnywhere = await Batch.findById(batchId);
      if (batchExistsAnywhere && batchExistsAnywhere.tenantId?.toString() !== req.tenantId?.toString()) {
        return res.status(403).json({
          success: false,
          code: 'CROSS_TENANT_FORBIDDEN',
          message: 'Unauthorized: Cannot assign assessment to cohort outside authorized tenant.'
        });
      }
      const targetBatch = await Batch.findOne({ _id: batchId, tenantId: req.tenantId });
      if (!targetBatch) {
        return res.status(404).json({ success: false, message: 'Selected batch cohort not found in this institution.' });
      }
      testDoc.batchId = targetBatch._id;
      testDoc.className = targetBatch.name;
    } else if (className) {
      testDoc.className = className.trim();
    }

    testDoc.status = 'active';
    await testDoc.save();

    res.status(200).json({
      success: true,
      message: `Assessment "${testDoc.title}" successfully assigned to ${testDoc.className || 'all eligible students'}.`,
      test: testDoc
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/v1/trainer/tests/:id
 * Permanently deletes a scheduled test assessment and associated attempts
 */
router.delete('/tests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const testDoc = await Assessment.findOne({
      tenantId: req.tenantId,
      $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { id }]
    });

    if (!testDoc) {
      return res.status(404).json({ success: false, message: 'Test assessment not found or unauthorized.' });
    }

    const canonicalId = testDoc.id;
    await Promise.all([
      Assessment.deleteOne({ _id: testDoc._id }),
      AssessmentAttempt.deleteMany({
        tenantId: req.tenantId,
        $or: [{ assessmentId: canonicalId }, { assessmentId: testDoc._id.toString() }]
      }),
      AssessmentEvent.deleteMany({
        tenantId: req.tenantId,
        $or: [{ assessmentId: canonicalId }, { assessmentId: testDoc._id.toString() }]
      })
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('test:deleted', { testId: testDoc._id });
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_TEST_DELETED',
      details: { testId: testDoc._id, title: testDoc.title }
    });

    res.json({ success: true, message: 'Test assessment and attempts deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/trainer/calendar/events
 * Retrieves authoritative academic calendar events and synchronised projections (homework, tests)
 */
router.get('/calendar/events', async (req, res) => {
  try {
    const tenantFilter = { tenantId: req.tenantId };

    // 1. Fetch persisted Institutional Academic Events
    const events = await AcademicEvent.find(tenantFilter).sort({ startTime: 1 }).lean();

    // 2. Fetch scheduled assessments to project as calendar events
    const assessments = await Assessment.find(tenantFilter).lean();

    // 3. Fetch assignments with due dates to project as calendar events
    const assignments = await Assignment.find(tenantFilter).lean();

    // Map existing linked records to avoid duplicates
    const linkedRecordSet = new Set(
      events.filter((e) => e.linkedRecordId).map((e) => `${e.linkedRecordType}:${e.linkedRecordId}`)
    );

    const projectedEvents = [];

    const parseSafeDate = (val) => {
      if (!val) return new Date();
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    // Project assessments if not already represented as an explicit AcademicEvent
    assessments.forEach((exam) => {
      const examKey = `Assessment:${exam._id.toString()}`;
      const examKeyId = `Assessment:${exam.id}`;
      if (!linkedRecordSet.has(examKey) && !linkedRecordSet.has(examKeyId)) {
        const start = parseSafeDate(exam.date);
        const duration = Number(exam.durationMinutes) || 45;
        const end = new Date(start.getTime() + duration * 60000);
        const ymd = start.toISOString().split('T')[0];

        projectedEvents.push({
          _id: `proj-test-${exam._id}`,
          id: `proj-test-${exam._id}`,
          tenantId: req.tenantId,
          title: exam.title,
          eventType: 'test',
          subject: exam.subject || 'Technical Assessment',
          description: `Scheduled proctored examination (${duration} mins). Total Marks: ${exam.totalMarks || 20}`,
          room: exam.room || 'Coding Lab 1',
          startTime: start,
          endTime: end,
          dateStr: ymd,
          status: 'scheduled',
          linkedRecordId: exam._id.toString(),
          linkedRecordType: 'Assessment',
          isProjected: true
        });
      }
    });

    // Project assignments if not already represented
    assignments.forEach((hw) => {
      const hwKey = `Assignment:${hw._id.toString()}`;
      if (!linkedRecordSet.has(hwKey) && hw.dueDate) {
        const end = parseSafeDate(hw.dueDate);
        const start = new Date(end.getTime() - 60 * 60000); // 1 hour window prior to deadline
        const ymd = end.toISOString().split('T')[0];

        projectedEvents.push({
          _id: `proj-hw-${hw._id}`,
          id: `proj-hw-${hw._id}`,
          tenantId: req.tenantId,
          title: `Due: ${hw.title}`,
          eventType: 'homework',
          subject: hw.subject || hw.courseTitle || 'Homework',
          description: hw.description || 'Homework deadline',
          room: 'Portal Submission',
          startTime: start,
          endTime: end,
          dateStr: ymd,
          status: 'scheduled',
          linkedRecordId: hw._id.toString(),
          linkedRecordType: 'Assignment',
          isProjected: true
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
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve academic calendar events' });
  }
});

/**
 * POST /api/v1/trainer/calendar/events
 * Creates a new authoritative institutional academic event
 */
router.post('/calendar/events', async (req, res) => {
  try {
    const { title, eventType, subject, description, room, startTime, endTime, dateStr, batchId, batchName } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required.' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Start time and end time are required.' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date format.' });
    }

    if (end <= start) {
      return res.status(400).json({ success: false, message: 'Event end time must be after the start time.' });
    }

    const calculatedDateStr = dateStr || start.toISOString().split('T')[0];

    const newEvent = await AcademicEvent.create({
      tenantId: req.tenantId,
      batchId: batchId || null,
      batchName: batchName || 'All Classes',
      title: title.trim(),
      eventType: eventType || 'class',
      subject: subject || 'General',
      description: (description || '').trim(),
      room: room || 'Room 102',
      startTime: start,
      endTime: end,
      dateStr: calculatedDateStr,
      status: 'scheduled',
      creatorId: req.user._id,
      creatorName: req.user.name || 'Faculty'
    });

    // Notify connected clients via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('calendar:event:created', newEvent);
    }

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'CALENDAR_EVENT_CREATED',
      details: { eventId: newEvent._id, title: newEvent.title, eventType: newEvent.eventType }
    });

    res.status(201).json({ success: true, message: 'Academic event scheduled successfully', event: newEvent });
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/v1/trainer/calendar/events/:id
 * Updates or reschedules an existing academic event
 */
router.put('/calendar/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, room, startTime, endTime, dateStr, status, cancellationReason, batchId, batchName } = req.body;

    const event = await AcademicEvent.findOne({
      _id: id,
      tenantId: req.tenantId
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Academic event not found in your institution.' });
    }

    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start or end date format.' });
      }
      if (end <= start) {
        return res.status(400).json({ success: false, message: 'Event end time must be after start time.' });
      }
      event.startTime = start;
      event.endTime = end;
      event.dateStr = dateStr || start.toISOString().split('T')[0];
      if (event.status === 'scheduled') {
        event.status = 'rescheduled';
      }
    }

    if (title) event.title = title.trim();
    if (subject) event.subject = subject.trim();
    if (description !== undefined) event.description = description.trim();
    if (room) event.room = room.trim();
    if (status) event.status = status;
    if (cancellationReason !== undefined) event.cancellationReason = cancellationReason.trim();
    if (batchId !== undefined) event.batchId = batchId;
    if (batchName) event.batchName = batchName;

    await event.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('calendar:event:updated', event);
    }

    res.json({ success: true, message: 'Academic event updated successfully', event });
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/calendar/events/:id/cancel
 * Cancels an institutional academic event
 */
router.post('/calendar/events/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const event = await AcademicEvent.findOne({
      _id: id,
      tenantId: req.tenantId
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Academic event not found.' });
    }

    event.status = 'cancelled';
    event.cancellationReason = cancellationReason || 'Cancelled by instructor';
    await event.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('calendar:event:cancelled', {
        eventId: event._id,
        title: event.title,
        cancellationReason: event.cancellationReason
      });
    }

    res.json({ success: true, message: 'Event cancelled successfully', event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/v1/trainer/calendar/events/:id
 * Removes an event permanently
 */
router.delete('/calendar/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AcademicEvent.findOneAndDelete({
      _id: id,
      tenantId: req.tenantId
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('calendar:event:deleted', { eventId: id });
    }

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/assessments/attempts/:attemptId/grade
 * Authoritative evaluation of an assessment attempt with tenant isolation and audit logging.
 */
router.post('/assessments/attempts/:attemptId/grade', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { score, teacherFeedback = '' } = req.body;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Institutional tenant context missing' });
    }

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ success: false, message: 'Invalid attemptId' });
    }

    const numScore = Number(score);
    if (score === undefined || score === null || score === '' || isNaN(numScore) || numScore < 0) {
      return res.status(400).json({ success: false, message: 'A valid non-negative numerical score is required for evaluation.' });
    }

    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    const attempt = await AssessmentAttempt.findOne({
      _id: new mongoose.Types.ObjectId(attemptId),
      tenantId: tenantObjId
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Assessment attempt not found or unauthorized' });
    }

    if (attempt.status === 'disqualified') {
      return res.status(400).json({ success: false, message: 'Cannot evaluate an attempt that was disqualified due to policy violations.' });
    }

    const assessmentDoc = await Assessment.findOne({
      tenantId: tenantObjId,
      $or: [
        { id: String(attempt.assessmentId) },
        { _id: mongoose.Types.ObjectId.isValid(attempt.assessmentId) ? new mongoose.Types.ObjectId(attempt.assessmentId) : null }
      ]
    }).lean();

    const maxScore = assessmentDoc?.totalMarks != null ? Number(assessmentDoc.totalMarks) : (attempt.maxScore || 100);
    if (numScore > maxScore) {
      return res.status(400).json({ success: false, message: `Score cannot exceed maximum score of ${maxScore}.` });
    }

    const percentage = Math.round((numScore / maxScore) * 100);

    attempt.maxScore = maxScore;
    attempt.score = numScore;
    attempt.percentage = percentage;
    attempt.teacherFeedback = teacherFeedback.trim();
    attempt.status = 'evaluated';
    await attempt.save();

    // Critical audit log for manual grading
    try {
      await createCriticalAuditLog({
        tenantId,
        actor: actorFromRequest(req),
        action: 'ASSESSMENT_MANUALLY_GRADED',
        targetRecord: attempt._id,
        targetModel: 'AssessmentAttempt',
        details: {
          assessmentId: attempt.assessmentId,
          studentId: attempt.studentId,
          score: numScore,
          maxScore,
          percentage
        }
      });
    } catch (auditErr) {
      console.error('[TrainerRoutes] Audit log error on grading attempt:', auditErr.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}`).emit('assessment:evaluated', {
        attemptId: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
        score: numScore,
        percentage
      });
    }

    res.json({
      success: true,
      message: 'Assessment attempt evaluated and marks recorded successfully.',
      attempt: {
        _id: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        teacherFeedback: attempt.teacherFeedback
      }
    });
  } catch (err) {
    console.error('Error evaluating assessment attempt:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/trainer/assessments/:assessmentId/students/:studentId/authorize-retake
 * Trainer-authorized retake for a student who previously submitted or was disqualified.
 */
router.post('/assessments/:assessmentId/students/:studentId/authorize-retake', async (req, res) => {
  try {
    const { assessmentId, studentId } = req.params;
    const { reason = 'Trainer-authorized re-examination' } = req.body;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Institutional tenant context missing' });
    }

    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    // 1. Validate student exists in this tenant
    const student = await User.findOne({
      tenantId: tenantObjId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : null },
        { studentId: String(studentId) }
      ]
    }).lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in institutional directory.' });
    }

    const targetStudentObjId = student._id;

    // 2. Validate that student has an existing completed or disqualified attempt
    const existingAttempt = await AssessmentAttempt.findOne({
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: targetStudentObjId
    }).sort({ startedAt: -1 }).lean();

    if (!existingAttempt) {
      return res.status(400).json({
        success: false,
        message: 'Student has not attempted this assessment yet. First attempt does not require retake authorization.'
      });
    }

    if (!['submitted', 'evaluated', 'result_published', 'disqualified'].includes(existingAttempt.status)) {
      return res.status(400).json({
        success: false,
        message: `Student currently has an active attempt in status "${existingAttempt.status}". Retake cannot be authorized until current attempt concludes.`
      });
    }

    // 3. Prevent duplicate active authorizations
    const existingAuth = await RetakeAuthorization.findOne({
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: targetStudentObjId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (existingAuth) {
      return res.status(409).json({
        success: false,
        message: `An active retake authorization is already ${existingAuth.status} for this student.`,
        authorization: existingAuth
      });
    }

    // 4. Determine target attempt number
    const targetAttemptNumber = (existingAttempt.attemptNumber || 1) + 1;

    // 5. Create authorization record
    const authorization = await RetakeAuthorization.create({
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: targetStudentObjId,
      authorizedBy: req.user._id,
      targetAttemptNumber,
      status: 'pending',
      reason: reason.trim()
    });

    // 6. Audit logging with fail-closed safety (rollback authorization if audit logging fails)
    try {
      await createCriticalAuditLog({
        tenantId,
        actor: actorFromRequest(req),
        action: 'ASSESSMENT_RETAKE_AUTHORIZED',
        targetRecord: authorization._id,
        targetModel: 'RetakeAuthorization',
        details: {
          assessmentId: String(assessmentId),
          studentId: targetStudentObjId,
          targetAttemptNumber,
          reason: reason.trim()
        }
      });
    } catch (auditErr) {
      // Rollback to prevent usable unauthorized retake
      await RetakeAuthorization.findByIdAndDelete(authorization._id).catch(() => {});
      console.error('[TrainerRoutes] Critical audit logging failed during retake authorization, rolled back:', auditErr.message);
      return res.status(500).json({
        success: false,
        message: 'Security compliance failure: Unable to record critical audit log for retake authorization. Operation rolled back.'
      });
    }

    // 7. Real-time alert
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:user:${targetStudentObjId}`).emit('assessment:retake_authorized', {
        assessmentId: String(assessmentId),
        targetAttemptNumber,
        authorizedAt: authorization.authorizedAt
      });
    }

    res.status(201).json({
      success: true,
      message: `Retake authorization for Attempt #${targetAttemptNumber} granted successfully.`,
      authorization
    });
  } catch (err) {
    console.error('Error authorizing assessment retake:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/trainer/assessments/:assessmentId/students/:studentId/retakes
 * Retrieves all retake authorizations and attempt history for a student.
 */
router.get('/assessments/:assessmentId/students/:studentId/retakes', async (req, res) => {
  try {
    const { assessmentId, studentId } = req.params;
    const tenantId = req.tenantId;

    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    const student = await User.findOne({
      tenantId: tenantObjId,
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : null },
        { studentId: String(studentId) }
      ]
    }).lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const authorizations = await RetakeAuthorization.find({
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: student._id
    }).sort({ createdAt: -1 }).populate('authorizedBy', 'name email').lean();

    const attempts = await AssessmentAttempt.find({
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: student._id
    }).sort({ startedAt: 1 }).lean();

    res.json({
      success: true,
      student: { id: student._id, name: student.name, studentId: student.studentId },
      authorizations,
      attempts
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * ─── STUDENT DOUBTS & ASSISTANCE DESK (PHASE 4) ──────────────────────────────
 * GET /api/v1/trainer/doubts
 * Retrieves real questions submitted to trainer or in trainer's tenant scope
 */
router.get('/doubts', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }

    const tenantFilter = { tenantId };
    if (req.user.role === 'trainer' || req.user.role === 'teacher') {
      tenantFilter.$or = [
        { teacherId: req.user._id },
        { teacherName: new RegExp(`^${(req.user.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { teacherId: null }
      ];
    }

    const doubts = await Doubt.find(tenantFilter).sort({ createdAt: -1 }).lean();

    const formatted = doubts.map((d) => ({
      _id: d._id,
      id: d._id.toString(),
      studentName: d.studentName,
      studentId: d.studentIdNumber || (d.studentId ? d.studentId.toString().substring(0, 8) : 'Student'),
      subject: d.subject,
      topic: d.topic,
      question: d.question,
      codeSnippet: d.codeSnippet || '',
      status: d.status === 'answered' ? 'Answered' : 'Submitted',
      reply: d.response || '',
      response: d.response || '',
      createdAt: d.createdAt,
      repliedAt: d.repliedAt,
      replies: d.replies || []
    }));

    res.json({ success: true, count: formatted.length, doubts: formatted });
  } catch (err) {
    console.error('Error fetching trainer doubts:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve doubts' });
  }
});

/**
 * POST /api/v1/trainer/doubts/:id/reply
 * Replies to an authorized student question and marks it Answered
 */
router.post('/doubts/:id/reply', async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid doubt ID' });
    }

    const doubt = await Doubt.findOne({ _id: id, tenantId });
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt inquiry not found' });
    }

    const replyText = (req.body.reply || req.body.response || '').trim();
    if (!replyText) {
      return res.status(400).json({ success: false, message: 'Reply text cannot be empty' });
    }
    if (replyText.length > 2000) {
      return res.status(400).json({ success: false, message: 'Reply cannot exceed 2000 characters' });
    }

    doubt.status = 'answered';
    doubt.response = replyText;
    doubt.repliedAt = new Date();
    doubt.teacherId = req.user._id;
    doubt.teacherName = req.user.name || 'Educator';
    doubt.replies.push({
      authorId: req.user._id,
      authorName: req.user.name || 'Educator',
      authorRole: 'trainer',
      text: replyText,
      createdAt: new Date()
    });

    await doubt.save();

    // Notify student and connected admins/trainers via socket
    const io = req.app.get('io');
    if (io) {
      const answeredPayload = {
        id: doubt._id.toString(),
        studentId: doubt.studentId,
        status: 'Answered',
        reply: replyText,
        response: replyText,
        teacherName: doubt.teacherName,
        repliedAt: doubt.repliedAt
      };
      io.to(`tenant:${tenantId}`).emit('doubt:answered', answeredPayload);
      io.to(`tenant:${tenantId}`).emit('doubt:updated', answeredPayload);
      io.to(`user:${doubt.studentId}`).emit('doubt:answered', answeredPayload);
      io.to(`user:${doubt.studentId}`).emit('doubt:resolved', answeredPayload);
    }

    await createCriticalAuditLog({
      tenantId,
      actor: actorFromRequest(req),
      action: 'TRAINER_DOUBT_ANSWERED',
      details: { doubtId: doubt._id, studentId: doubt.studentId, topic: doubt.topic }
    });

    res.json({
      success: true,
      message: 'Reply sent successfully',
      doubt: {
        _id: doubt._id,
        id: doubt._id.toString(),
        studentName: doubt.studentName,
        studentId: doubt.studentIdNumber || doubt.studentId.toString(),
        subject: doubt.subject,
        topic: doubt.topic,
        question: doubt.question,
        status: 'Answered',
        reply: doubt.response,
        repliedAt: doubt.repliedAt
      }
    });
  } catch (err) {
    console.error('Error answering doubt:', err);
    res.status(500).json({ success: false, message: 'Failed to submit reply' });
  }
});

export default router;
