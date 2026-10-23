import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import AcademicEvent from '../models/AcademicEvent.js';
import Announcement from '../models/Announcement.js';
import Attendance from '../models/Attendance.js';
import StudentProgress from '../models/StudentProgress.js';
import Course from '../models/Course.js';

// Seeded static course identifiers
const SEED_COURSE_IDS = ['sub-py-1', 'sub-sql-2', 'sub-cpp-3', 'sub-web-4', 'sub-algo-5'];

// Seeded static homework identifiers
const SEED_HOMEWORK_IDS = ['hw-py-01', 'hw-py-02', 'hw-sql-01', 'hw-cpp-01'];

// Seeded static assessment identifiers
const SEED_ASSESSMENT_IDS = ['diag-eval-01', 'midterm-py-01', 'exam-py-02', 'exam-sql-01'];

// Seeded static calendar titles
const SEED_CALENDAR_TITLES = [
  'Python Programming — Functions & Recursion Lab',
  'SQL & Relational Databases — Schema Design Lab',
  'Mid-Term Algorithms & Logic Building Review',
  'School Hackathon & Computational Olympiad 2026'
];

// Seeded attendance dates (10 sessions)
const SEED_ATTENDANCE_DATES = [
  '2026-09-15', '2026-09-17', '2026-09-19', '2026-09-22', '2026-09-24',
  '2026-09-26', '2026-09-29', '2026-10-01', '2026-10-03', '2026-10-06'
];

// Audit patterns (matching generated timestamp identifiers or explicit audit labels)
const AUDIT_HW_REGEX = /(Physics Motion Lab|Section B Special Assignment|E2E Verify Assignment|\[AUDIT_TEST\])\s*\d*/i;
const AUDIT_TEST_REGEX = /(Quarterly Physics Assessment|\[AUDIT_TEST\])\s*\d*/i;
const AUDIT_EVENT_REGEX = /(Physics Lab Demonstration|Midterm Review Session|Unauthorized Student Event|\[AUDIT_TEST\])\s*\d*/i;
const AUDIT_ANN_REGEX = /(Important Examination Instructions|Important Lab Notice|Unauthorized Student Announcement|\[AUDIT_TEST\])\s*\d*/i;

/**
 * Identify, categorize, and count candidate records for deletion plan.
 */
export const buildDeletionPlan = async (tenantId = null) => {
  const filter = tenantId ? { tenantId } : {};

  const [
    assignments,
    submissions,
    assessments,
    attempts,
    assessmentEvents,
    calendarEvents,
    announcements,
    attendances,
    progresses,
    courses
  ] = await Promise.all([
    Assignment.find(filter).lean(),
    Submission.find(filter).lean(),
    Assessment.find(filter).lean(),
    AssessmentAttempt.find(filter).lean(),
    AssessmentEvent.find(filter).lean(),
    AcademicEvent.find(filter).lean(),
    Announcement.find(filter).lean(),
    Attendance.find(filter).lean(),
    StudentProgress.find(filter).lean(),
    Course.find(filter).lean()
  ]);

  const plan = {
    tenantId: tenantId || 'ALL',
    totals: {
      assignments: assignments.length,
      submissions: submissions.length,
      assessments: assessments.length,
      assessmentAttempts: attempts.length,
      assessmentEvents: assessmentEvents.length,
      calendarEvents: calendarEvents.length,
      announcements: announcements.length,
      attendance: attendances.length,
      studentProgress: progresses.length,
      courses: courses.length
    },
    auditCandidates: {
      assignments: [],
      submissions: [],
      assessments: [],
      assessmentAttempts: [],
      assessmentEvents: [],
      calendarEvents: [],
      announcements: [],
      attendance: [],
      courses: []
    },
    demoCandidates: {
      assignments: [],
      submissions: [],
      assessments: [],
      assessmentAttempts: [],
      assessmentEvents: [],
      calendarEvents: [],
      announcements: [],
      attendance: [],
      studentProgress: [],
      courses: []
    },
    preservedUncertain: {
      assignments: [],
      submissions: [],
      assessments: [],
      calendarEvents: [],
      announcements: []
    }
  };

  // 1. Assignments
  const auditAssignmentIdSet = new Set();
  const demoAssignmentIdSet = new Set();

  assignments.forEach((a) => {
    const isAudit = AUDIT_HW_REGEX.test(a.title || '');
    const isDemo = SEED_HOMEWORK_IDS.includes(a.id) ||
      (a.title && (a.title.includes('Palindrome') || a.title.includes('Multiples Accumulator') || a.title.includes('Library Database Inner Joins') || a.title.includes('BankAccount Class')));

    if (isAudit) {
      plan.auditCandidates.assignments.push({ id: a._id.toString(), title: a.title, subject: a.subject });
      auditAssignmentIdSet.add(a._id.toString());
      if (a.id) auditAssignmentIdSet.add(a.id);
    } else if (isDemo) {
      plan.demoCandidates.assignments.push({ id: a._id.toString(), code: a.id, title: a.title, subject: a.subject });
      demoAssignmentIdSet.add(a._id.toString());
      if (a.id) demoAssignmentIdSet.add(a.id);
    } else {
      plan.preservedUncertain.assignments.push({ id: a._id.toString(), title: a.title, subject: a.subject, reason: 'Non-matching title and ID; preserved as potentially genuine' });
    }
  });

  // 2. Submissions
  submissions.forEach((s) => {
    const asgIdStr = s.assignmentId ? s.assignmentId.toString() : '';
    const isAudit = auditAssignmentIdSet.has(asgIdStr) ||
      (s.submissionText && (s.submissionText.includes('Vector acceleration') || s.submissionText.includes('factorial')));
    const isDemo = demoAssignmentIdSet.has(asgIdStr) ||
      (s.submissionText && (s.submissionText.includes('BankAccount') || s.submissionText.includes('is_palindrome')));

    if (isAudit) {
      plan.auditCandidates.submissions.push({ id: s._id.toString(), assignmentId: asgIdStr, student: s.studentName });
    } else if (isDemo) {
      plan.demoCandidates.submissions.push({ id: s._id.toString(), assignmentId: asgIdStr, student: s.studentName });
    } else {
      plan.preservedUncertain.submissions.push({ id: s._id.toString(), assignmentId: asgIdStr, student: s.studentName, reason: 'Linked to preserved assignment' });
    }
  });

  // 3. Assessments
  const auditAssessmentIdSet = new Set();
  const demoAssessmentIdSet = new Set();

  assessments.forEach((t) => {
    const isAudit = AUDIT_TEST_REGEX.test(t.title || '') || (t.id && /^test-\d+/.test(t.id));
    const isDemo = SEED_ASSESSMENT_IDS.includes(t.id) ||
      (t.title && (t.title.includes('Python Fundamentals Diagnostic') || t.title.includes('Conditional Statements & Loops Test') || t.title.includes('Functions & Algorithmic Logic Test') || t.title.includes('Relational Queries & JOINs Mid-Term')));

    if (isAudit) {
      plan.auditCandidates.assessments.push({ id: t._id.toString(), customId: t.id, title: t.title, subject: t.subject });
      auditAssessmentIdSet.add(t._id.toString());
      if (t.id) auditAssessmentIdSet.add(t.id);
    } else if (isDemo) {
      plan.demoCandidates.assessments.push({ id: t._id.toString(), customId: t.id, title: t.title, subject: t.subject });
      demoAssessmentIdSet.add(t._id.toString());
      if (t.id) demoAssessmentIdSet.add(t.id);
    } else {
      plan.preservedUncertain.assessments.push({ id: t._id.toString(), title: t.title, subject: t.subject, reason: 'Preserved assessment' });
    }
  });

  // 4. AssessmentAttempts
  attempts.forEach((at) => {
    const isAudit = auditAssessmentIdSet.has(at.assessmentId) || AUDIT_TEST_REGEX.test(at.assessmentTitle || '');
    const isDemo = demoAssessmentIdSet.has(at.assessmentId) || SEED_ASSESSMENT_IDS.includes(at.assessmentId);

    if (isAudit) {
      plan.auditCandidates.assessmentAttempts.push({ id: at._id.toString(), assessmentId: at.assessmentId, student: at.studentName });
    } else if (isDemo) {
      plan.demoCandidates.assessmentAttempts.push({ id: at._id.toString(), assessmentId: at.assessmentId, student: at.studentName });
    }
  });

  // 5. AssessmentEvents
  assessmentEvents.forEach((ev) => {
    const isAudit = auditAssessmentIdSet.has(ev.assessmentId) || AUDIT_TEST_REGEX.test(ev.assessmentTitle || '');
    const isDemo = demoAssessmentIdSet.has(ev.assessmentId) || SEED_ASSESSMENT_IDS.includes(ev.assessmentId);

    if (isAudit) {
      plan.auditCandidates.assessmentEvents.push({ id: ev._id.toString(), assessmentId: ev.assessmentId, type: ev.eventType });
    } else if (isDemo) {
      plan.demoCandidates.assessmentEvents.push({ id: ev._id.toString(), assessmentId: ev.assessmentId, type: ev.eventType });
    }
  });

  // 6. AcademicEvents (Calendar)
  calendarEvents.forEach((e) => {
    const isAudit = AUDIT_EVENT_REGEX.test(e.title || '');
    const isDemo = SEED_CALENDAR_TITLES.includes(e.title);

    if (isAudit) {
      plan.auditCandidates.calendarEvents.push({ id: e._id.toString(), title: e.title });
    } else if (isDemo) {
      plan.demoCandidates.calendarEvents.push({ id: e._id.toString(), title: e.title });
    } else {
      plan.preservedUncertain.calendarEvents.push({ id: e._id.toString(), title: e.title, reason: 'Custom event preserved' });
    }
  });

  // 7. Announcements
  announcements.forEach((an) => {
    const isAudit = AUDIT_ANN_REGEX.test(an.title || '');

    if (isAudit) {
      plan.auditCandidates.announcements.push({ id: an._id.toString(), title: an.title });
    } else {
      plan.preservedUncertain.announcements.push({ id: an._id.toString(), title: an.title, reason: 'Custom announcement preserved' });
    }
  });

  // 8. Attendance
  const seedDateStrings = new Set(SEED_ATTENDANCE_DATES);
  attendances.forEach((att) => {
    const dStr = att.date ? new Date(att.date).toISOString().split('T')[0] : '';
    const isSeedDate = seedDateStrings.has(dStr);

    if (isSeedDate) {
      plan.demoCandidates.attendance.push({ id: att._id.toString(), date: dStr, studentId: att.studentId });
    } else {
      // Created during audit run on today's date
      plan.auditCandidates.attendance.push({ id: att._id.toString(), date: dStr, studentId: att.studentId });
    }
  });

  // 9. StudentProgress (Demo progress for Leo Miller on sub-py-1)
  progresses.forEach((p) => {
    if (p.courseId === 'sub-py-1') {
      plan.demoCandidates.studentProgress.push({ id: p._id.toString(), courseId: p.courseId, student: p.studentIdentifier });
    }
  });

  // 10. Courses / Subjects
  courses.forEach((c) => {
    const isDemo = SEED_COURSE_IDS.includes(c.id) || (c.title && (c.title === 'Python Programming' || c.title === 'SQL & Relational Databases' || c.title === 'C++ Fundamentals' || c.title === 'Web Development (HTML/CSS/JS)' || c.title === 'Algorithms & Logic Building'));
    if (isDemo) {
      plan.demoCandidates.courses.push({ id: c._id.toString(), title: c.title, code: c.code });
    }
  });

  return plan;
};

/**
 * Execute verified removal according to the deletion plan.
 */
export const executeDataCleanup = async ({ removeAudit = true, removeDemo = true, tenantId = null }) => {
  const plan = await buildDeletionPlan(tenantId);
  const deletedCounts = {
    assignments: 0,
    submissions: 0,
    assessments: 0,
    assessmentAttempts: 0,
    assessmentEvents: 0,
    calendarEvents: 0,
    announcements: 0,
    attendance: 0,
    studentProgress: 0
  };

  const assignmentIdsToDelete = [];
  const submissionIdsToDelete = [];
  const assessmentIdsToDelete = [];
  const attemptIdsToDelete = [];
  const eventIdsToDelete = [];
  const calendarEventIdsToDelete = [];
  const announcementIdsToDelete = [];
  const attendanceIdsToDelete = [];
  const progressIdsToDelete = [];

  if (removeAudit) {
    plan.auditCandidates.assignments.forEach(a => assignmentIdsToDelete.push(a.id));
    plan.auditCandidates.submissions.forEach(s => submissionIdsToDelete.push(s.id));
    plan.auditCandidates.assessments.forEach(t => assessmentIdsToDelete.push(t.id));
    plan.auditCandidates.assessmentAttempts.forEach(at => attemptIdsToDelete.push(at.id));
    plan.auditCandidates.assessmentEvents.forEach(ev => eventIdsToDelete.push(ev.id));
    plan.auditCandidates.calendarEvents.forEach(e => calendarEventIdsToDelete.push(e.id));
    plan.auditCandidates.announcements.forEach(an => announcementIdsToDelete.push(an.id));
    plan.auditCandidates.attendance.forEach(att => attendanceIdsToDelete.push(att.id));
  }

  if (removeDemo) {
    plan.demoCandidates.assignments.forEach(a => assignmentIdsToDelete.push(a.id));
    plan.demoCandidates.submissions.forEach(s => submissionIdsToDelete.push(s.id));
    plan.demoCandidates.assessments.forEach(t => assessmentIdsToDelete.push(t.id));
    plan.demoCandidates.assessmentAttempts.forEach(at => attemptIdsToDelete.push(at.id));
    plan.demoCandidates.assessmentEvents.forEach(ev => eventIdsToDelete.push(ev.id));
    plan.demoCandidates.calendarEvents.forEach(e => calendarEventIdsToDelete.push(e.id));
    plan.demoCandidates.announcements.forEach(an => announcementIdsToDelete.push(an.id));
    plan.demoCandidates.attendance.forEach(att => attendanceIdsToDelete.push(att.id));
    plan.demoCandidates.studentProgress.forEach(p => progressIdsToDelete.push(p.id));
  }

  // Perform surgical deletions
  if (assignmentIdsToDelete.length > 0) {
    const res = await Assignment.deleteMany({ _id: { $in: assignmentIdsToDelete } });
    deletedCounts.assignments = res.deletedCount;
  }
  if (submissionIdsToDelete.length > 0) {
    const res = await Submission.deleteMany({ _id: { $in: submissionIdsToDelete } });
    deletedCounts.submissions = res.deletedCount;
  }
  if (assessmentIdsToDelete.length > 0) {
    const res = await Assessment.deleteMany({ _id: { $in: assessmentIdsToDelete } });
    deletedCounts.assessments = res.deletedCount;
  }
  if (attemptIdsToDelete.length > 0) {
    const res = await AssessmentAttempt.deleteMany({ _id: { $in: attemptIdsToDelete } });
    deletedCounts.assessmentAttempts = res.deletedCount;
  }
  if (eventIdsToDelete.length > 0) {
    const res = await AssessmentEvent.deleteMany({ _id: { $in: eventIdsToDelete } });
    deletedCounts.assessmentEvents = res.deletedCount;
  }
  if (calendarEventIdsToDelete.length > 0) {
    const res = await AcademicEvent.deleteMany({ _id: { $in: calendarEventIdsToDelete } });
    deletedCounts.calendarEvents = res.deletedCount;
  }
  if (announcementIdsToDelete.length > 0) {
    const res = await Announcement.deleteMany({ _id: { $in: announcementIdsToDelete } });
    deletedCounts.announcements = res.deletedCount;
  }
  if (attendanceIdsToDelete.length > 0) {
    const res = await Attendance.deleteMany({ _id: { $in: attendanceIdsToDelete } });
    deletedCounts.attendance = res.deletedCount;
  }
  if (progressIdsToDelete.length > 0) {
    const res = await StudentProgress.deleteMany({ _id: { $in: progressIdsToDelete } });
    deletedCounts.studentProgress = res.deletedCount;
  }
  const courseIdsToDelete = [];
  if (removeAudit) {
    (plan.auditCandidates.courses || []).forEach(c => courseIdsToDelete.push(c.id));
  }
  if (removeDemo) {
    (plan.demoCandidates.courses || []).forEach(c => courseIdsToDelete.push(c.id));
  }
  if (courseIdsToDelete.length > 0) {
    const res = await Course.deleteMany({ _id: { $in: courseIdsToDelete } });
    deletedCounts.courses = res.deletedCount;
  }

  // Count remaining records
  const remainingFilter = tenantId ? { tenantId } : {};
  const [
    remAssignments,
    remSubmissions,
    remAssessments,
    remAttempts,
    remEvents,
    remAnnouncements,
    remAttendance
  ] = await Promise.all([
    Assignment.countDocuments(remainingFilter),
    Submission.countDocuments(remainingFilter),
    Assessment.countDocuments(remainingFilter),
    AssessmentAttempt.countDocuments(remainingFilter),
    AcademicEvent.countDocuments(remainingFilter),
    Announcement.countDocuments(remainingFilter),
    Attendance.countDocuments(remainingFilter)
  ]);

  return {
    success: true,
    initialCounts: plan.totals,
    deletedCounts,
    preservedCounts: {
      assignments: plan.preservedUncertain.assignments.length,
      submissions: plan.preservedUncertain.submissions.length,
      assessments: plan.preservedUncertain.assessments.length,
      calendarEvents: plan.preservedUncertain.calendarEvents.length,
      announcements: plan.preservedUncertain.announcements.length
    },
    preservedDetails: plan.preservedUncertain,
    remainingCounts: {
      assignments: remAssignments,
      submissions: remSubmissions,
      assessments: remAssessments,
      assessmentAttempts: remAttempts,
      calendarEvents: remEvents,
      announcements: remAnnouncements,
      attendance: remAttendance,
      courses: await Course.countDocuments(remainingFilter)
    }
  };
};
