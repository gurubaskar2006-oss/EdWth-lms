/**
 * Lumina LMS — Multi-School Leaderboard & Performance Service
 * 6th Civilians Corporation
 *
 * Computes authoritative school-scoped rankings and performance metrics
 * strictly from verified, persisted MongoDB records (AssessmentAttempt, Submission, Attendance, User).
 * Handles ungraded submissions correctly without manufacturing artificial scores.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Submission from '../models/Submission.js';
import Attendance from '../models/Attendance.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';

export const computeSchoolLeaderboard = async ({ tenantId, batchId = null, className = null }) => {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new Error('Valid tenantId is required to compute school leaderboard');
  }

  const school = await College.findById(tenantId).lean();
  if (!school) {
    throw new Error('School institution not found');
  }

  // Query all active students enrolled in this school
  const studentQuery = {
    tenantId,
    role: 'student',
    soft_deleted: { $ne: true }
  };

  if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
    studentQuery.batchId = batchId;
  }
  if (className && typeof className === 'string' && className.trim()) {
    studentQuery.className = new RegExp(`^${className.trim()}$`, 'i');
  }

  const students = await User.find(studentQuery)
    .select('_id studentId name email avatar className batchId streakDays stats createdAt')
    .lean();

  if (!students || students.length === 0) {
    return {
      school: {
        id: school._id.toString(),
        name: school.name,
        code: school.code,
        institutionType: school.institutionType || 'school'
      },
      count: 0,
      leaderboard: []
    };
  }

  const studentIds = students.map(s => s._id);

  // Fetch verified records in parallel for all students in this cohort
  const [assessmentAttempts, submissions, attendanceRecords, batches] = await Promise.all([
    AssessmentAttempt.find({ tenantId, studentId: { $in: studentIds } }).lean(),
    Submission.find({ tenantId, studentId: { $in: studentIds } }).populate('assignmentId', 'points').lean(),
    Attendance.find({ tenantId, studentId: { $in: studentIds } }).lean(),
    Batch.find({ tenantId }).lean()
  ]);

  const batchMap = new Map();
  batches.forEach(b => batchMap.set(b._id.toString(), b.name));

  // Group assessments by student
  const attemptsByStudent = new Map();
  assessmentAttempts.forEach(att => {
    const sId = att.studentId?.toString();
    if (!attemptsByStudent.has(sId)) attemptsByStudent.set(sId, []);
    attemptsByStudent.get(sId).push(att);
  });

  // Group submissions by student
  const submissionsByStudent = new Map();
  submissions.forEach(sub => {
    const sId = sub.studentId?.toString();
    if (!submissionsByStudent.has(sId)) submissionsByStudent.set(sId, []);
    submissionsByStudent.get(sId).push(sub);
  });

  // Group attendance by student
  const attendanceByStudent = new Map();
  attendanceRecords.forEach(att => {
    const sId = att.studentId?.toString();
    if (!attendanceByStudent.has(sId)) attendanceByStudent.set(sId, []);
    attendanceByStudent.get(sId).push(att);
  });

  // Compute verified metrics per student
  const studentMetrics = students.map(student => {
    const sId = student._id.toString();
    const attempts = attemptsByStudent.get(sId) || [];
    const subs = submissionsByStudent.get(sId) || [];
    const atts = attendanceByStudent.get(sId) || [];

    // Evaluated assessments only (do not penalize ungraded/in-progress)
    const evaluatedAttempts = attempts.filter(a => a.status === 'evaluated');
    const pendingAttempts = attempts.filter(a => a.status === 'submitted' || a.status === 'in_progress');

    let assessmentAvg = null;
    if (evaluatedAttempts.length > 0) {
      const totalPct = evaluatedAttempts.reduce((sum, a) => {
        const pct = a.percentage != null
          ? a.percentage
          : (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0);
        return sum + pct;
      }, 0);
      assessmentAvg = Math.round((totalPct / evaluatedAttempts.length) * 10) / 10;
    }

    // Graded homework only
    const gradedSubmissions = subs.filter(s => s.status === 'graded' && s.score != null);
    const pendingSubmissions = subs.filter(s => s.status === 'submitted' || s.status === 'pending');

    let homeworkAvg = null;
    if (gradedSubmissions.length > 0) {
      const totalHwPct = gradedSubmissions.reduce((sum, s) => {
        const maxPts = s.assignmentId?.points || 20;
        const pct = maxPts > 0 ? (s.score / maxPts) * 100 : 0;
        return sum + pct;
      }, 0);
      homeworkAvg = Math.round((totalHwPct / gradedSubmissions.length) * 10) / 10;
    }

    // Attendance rate
    let attendanceRate = null;
    if (atts.length > 0) {
      const attended = atts.filter(a => a.status === 'present' || a.status === 'late').length;
      attendanceRate = Math.round((attended / atts.length) * 100);
    }

    // Authoritative Composite Academic Score (0 - 100 scale)
    // If student has both assessment and homework averages, combine 60% test + 40% homework.
    // If only one is available, use that.
    // If none evaluated yet, check if student.stats?.gpa exists, or report null (no artificial default).
    let compositeScore = 0;
    let scoreSource = 'none';

    if (assessmentAvg !== null && homeworkAvg !== null) {
      compositeScore = Math.round((assessmentAvg * 0.6 + homeworkAvg * 0.4) * 10) / 10;
      scoreSource = 'assessment_and_homework';
    } else if (assessmentAvg !== null) {
      compositeScore = assessmentAvg;
      scoreSource = 'assessment_only';
    } else if (homeworkAvg !== null) {
      compositeScore = homeworkAvg;
      scoreSource = 'homework_only';
    } else if (student.stats?.gpa) {
      const parsedGpa = parseFloat(student.stats.gpa);
      if (!isNaN(parsedGpa)) {
        compositeScore = Math.round((parsedGpa / 4.0) * 100 * 10) / 10;
        scoreSource = 'recorded_gpa';
      }
    }

    const batchName = student.batchId ? (batchMap.get(student.batchId.toString()) || 'Assigned Cohort') : 'Cohort Pending';

    return {
      id: student._id.toString(),
      _id: student._id,
      studentId: student.studentId,
      name: student.name,
      avatar: student.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(student.name)}`,
      email: student.email,
      className: student.className || (batchName.includes('12') ? 'Class 12' : (batchName.includes('11') ? 'Class 11' : 'Class 11')),
      batchId: student.batchId,
      batchName,
      compositeScore,
      scoreSource,
      assessmentAverage: assessmentAvg,
      homeworkAverage: homeworkAvg,
      attendanceRate,
      streakDays: student.streakDays || 0,
      totalEvaluatedAssessments: evaluatedAttempts.length,
      pendingAssessments: pendingAttempts.length,
      totalGradedHomework: gradedSubmissions.length,
      pendingHomework: pendingSubmissions.length,
      totalSessionsAttended: atts.filter(a => a.status === 'present' || a.status === 'late').length,
      totalSessionsTracked: atts.length
    };
  });

  // Sort descending: highest compositeScore, then highest assessmentAverage, then highest attendanceRate, then highest streakDays
  studentMetrics.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if ((b.assessmentAverage || 0) !== (a.assessmentAverage || 0)) return (b.assessmentAverage || 0) - (a.assessmentAverage || 0);
    if ((b.attendanceRate || 0) !== (a.attendanceRate || 0)) return (b.attendanceRate || 0) - (a.attendanceRate || 0);
    return (b.streakDays || 0) - (a.streakDays || 0);
  });

  // Assign verified ranks
  const rankedLeaderboard = studentMetrics.map((item, index) => ({
    rank: index + 1,
    ...item
  }));

  return {
    school: {
      id: school._id.toString(),
      name: school.name,
      code: school.code,
      institutionType: school.institutionType || 'school'
    },
    count: rankedLeaderboard.length,
    leaderboard: rankedLeaderboard
  };
};

/**
 * Computes aggregate comparative metrics across all schools for Platform Admin.
 * Does NOT mix individual student lists.
 */
export const computeAllSchoolsComparison = async () => {
  const schools = await College.find({ institutionType: 'school' }).sort({ name: 1 }).lean();

  const comparison = await Promise.all(schools.map(async school => {
    const sId = school._id;

    const [
      students,
      batches,
      attempts,
      submissions,
      attendance
    ] = await Promise.all([
      User.find({ tenantId: sId, role: 'student', soft_deleted: { $ne: true } })
        .select('_id className batchId')
        .lean(),
      Batch.find({ tenantId: sId }).lean(),
      AssessmentAttempt.find({ tenantId: sId, status: 'evaluated' }).select('score maxScore percentage').lean(),
      Submission.find({ tenantId: sId }).select('status score').lean(),
      Attendance.find({ tenantId: sId }).select('status').lean()
    ]);

    // Student counts by class
    let class11Count = 0;
    let class12Count = 0;
    let otherClassCount = 0;

    const batchNameMap = new Map();
    batches.forEach(b => batchNameMap.set(b._id.toString(), b.name));

    students.forEach(st => {
      const cls = (st.className || '').toLowerCase();
      const bName = (st.batchId ? batchNameMap.get(st.batchId.toString()) : '')?.toLowerCase() || '';

      if (cls.includes('11') || bName.includes('11')) {
        class11Count++;
      } else if (cls.includes('12') || bName.includes('12')) {
        class12Count++;
      } else {
        // Default or unclassified
        class11Count++;
      }
    });

    // Average Assessment Score %
    let avgAssessmentScore = null;
    if (attempts.length > 0) {
      const totalPct = attempts.reduce((sum, a) => {
        const pct = a.percentage != null
          ? a.percentage
          : (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0);
        return sum + pct;
      }, 0);
      avgAssessmentScore = Math.round((totalPct / attempts.length) * 10) / 10;
    }

    // Homework Completion Rate %
    let homeworkCompletionRate = null;
    if (submissions.length > 0) {
      const completed = submissions.filter(s => s.status === 'graded' || s.status === 'submitted').length;
      homeworkCompletionRate = Math.round((completed / submissions.length) * 100);
    }

    // Attendance Rate %
    let avgAttendanceRate = null;
    if (attendance.length > 0) {
      const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
      avgAttendanceRate = Math.round((present / attendance.length) * 100);
    }

    const activeCohorts = batches.filter(b => b.status === 'active' || !b.status);
    const completedCohorts = batches.filter(b => b.status === 'completed');
    const upcomingCohorts = batches.filter(b => b.status === 'upcoming');

    return {
      schoolId: sId.toString(),
      id: sId.toString(),
      name: school.name,
      code: school.code,
      status: school.status || 'active',
      totalStudents: students.length,
      class11Count,
      class12Count,
      otherClassCount,
      totalCohorts: batches.length,
      activeCohortsCount: activeCohorts.length,
      completedCohortsCount: completedCohorts.length,
      upcomingCohortsCount: upcomingCohorts.length,
      cohorts: batches.map(b => ({
        id: b._id.toString(),
        name: b.name,
        targetClass: b.targetClass || (b.name.includes('12') ? 'Class 12' : 'Class 11'),
        startDate: b.startDate,
        endDate: b.endDate,
        sessionStartTime: b.sessionStartTime || '11:00 AM',
        sessionEndTime: b.sessionEndTime || '12:00 PM',
        scheduleDays: b.scheduleDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        status: b.status || 'active'
      })),
      metrics: {
        averageAssessmentScore: avgAssessmentScore,
        homeworkCompletionRate: homeworkCompletionRate,
        averageAttendanceRate: avgAttendanceRate,
        totalEvaluatedAttempts: attempts.length,
        totalSubmissionsTracked: submissions.length,
        totalAttendanceTracked: attendance.length
      }
    };
  }));

  return comparison;
};
