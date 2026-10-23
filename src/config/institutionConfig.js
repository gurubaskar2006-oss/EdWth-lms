/**
 * Lumina LMS — Centralized Institution Terminology & Feature Visibility Configuration
 * 6th Civilians Corporation
 *
 * Supports unified multi-institution architecture (Schools and Colleges).
 * Provides centralized terminology mappings and feature visibility matrices
 * to prevent ad-hoc checks throughout components.
 */

export const schoolStudentFeatures = {
  subjects: true,
  homework: true,
  tests: true,
  schedule: true,
  results: true,
  attendance: true,
  announcements: true,
  help: true,
  codeLab: false,
  advancedAnalytics: false,
  projects: false,
  flashcards: false,
  pomodoro: false
};

export const collegeStudentFeatures = {
  courses: true,
  assignments: true,
  assessments: true,
  projects: true,
  codeLab: true,
  notes: true,
  submissions: true,
  grades: true,
  attendance: true,
  schedule: true,
  announcements: true,
  doubts: true,
  progress: true,
  analytics: true,
  flashcards: true,
  pomodoro: true
};

export const schoolEducatorFeatures = {
  classes: true,
  subjects: true,
  homework: true,
  tests: true,
  materials: true,
  studentRoster: true,
  performance: true,
  submissions: true,
  grades: true,
  attendance: true,
  announcements: true,
  doubts: true,
  schedule: true,
  analytics: true,
  projects: false
};

export const collegeEducatorFeatures = {
  batches: true,
  courses: true,
  assignments: true,
  assessments: true,
  materials: true,
  projects: true,
  studentRoster: true,
  performance: true,
  submissions: true,
  grades: true,
  attendance: true,
  announcements: true,
  doubts: true,
  schedule: true,
  analytics: true
};

export const INSTITUTION_CONFIGS = {
  school: {
    institutionType: 'school',
    typeLabel: 'School',
    educatorLabel: 'Teacher',
    educatorPlural: 'Teachers',
    groupLabel: 'Class',
    groupPlural: 'Classes',
    learnerLabel: 'Student',
    learnerPlural: 'Students',
    courseLabel: 'Subject',
    coursePlural: 'Subjects',
    assignmentLabel: 'Homework',
    assignmentPlural: 'Homework',
    testLabel: 'Test',
    testPlural: 'Tests',
    gradeLabel: 'Marks',
    gradePlural: 'Marks',
    materialsLabel: 'Study Material',
    scheduleLabel: 'Timetable',
    dashboardLabel: 'School Dashboard',
    portalSubtitle: 'School Learning Portal',
    rosterLabel: 'Teacher Roster',
    groupsMenuLabel: 'Classes & Sections',
    subjectsMenuLabel: 'My Subjects',
    classesMenuLabel: 'My Classes',
    analyticsCohortLabel: 'Class Performance Analytics',
    adminConsoleRole: 'School Admin',
    welcomeHeading: 'Empowering Young Scholars & Innovators',
    studentFeatures: schoolStudentFeatures,
    educatorFeatures: schoolEducatorFeatures,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    nonWorkingDays: ['Saturday', 'Sunday']
  },
  college: {
    institutionType: 'college',
    typeLabel: 'College',
    educatorLabel: 'Trainer',
    educatorPlural: 'Trainers',
    groupLabel: 'Batch',
    groupPlural: 'Batches',
    learnerLabel: 'Student',
    learnerPlural: 'Students',
    courseLabel: 'Course',
    coursePlural: 'Courses',
    assignmentLabel: 'Assignment',
    assignmentPlural: 'Assignments',
    testLabel: 'Assessment',
    testPlural: 'Assessments',
    gradeLabel: 'Grade',
    gradePlural: 'Grades',
    materialsLabel: 'Notes & Materials',
    scheduleLabel: 'Academic Calendar',
    dashboardLabel: 'College Dashboard',
    portalSubtitle: 'Enterprise Student Learning Portal',
    rosterLabel: 'Faculty Roster',
    groupsMenuLabel: 'Tenants & Batches',
    subjectsMenuLabel: 'My Courses',
    classesMenuLabel: 'My Batches',
    analyticsCohortLabel: 'Cohort Performance Analytics',
    adminConsoleRole: 'College Admin',
    welcomeHeading: 'Empowering World-Class AI Engineers & Scholars',
    studentFeatures: collegeStudentFeatures,
    educatorFeatures: collegeEducatorFeatures,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    nonWorkingDays: ['Sunday']
  }
};

export const getInstitutionConfig = (type = 'college') => {
  const normalized = (type || '').toLowerCase().trim();
  return INSTITUTION_CONFIGS[normalized] || INSTITUTION_CONFIGS.college;
};

export default getInstitutionConfig;

