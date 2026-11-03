import mongoose from 'mongoose';
import User from '../models/User.js';
import College from '../models/College.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import StudentProgress from '../models/StudentProgress.js';
import Doubt from '../models/Doubt.js';
import Grade from '../models/Grade.js';
import Note from '../models/Note.js';
import TeacherNote from '../models/TeacherNote.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import Session from '../models/Session.js';
import Passkey from '../models/Passkey.js';
import EmailOtp from '../models/EmailOtp.js';
import bcrypt from 'bcrypt';
import generateSecureTemporaryPassword from '../utils/passwordGenerator.js';
import { allocateUniqueStudentId } from '../utils/studentIdGenerator.js';
import { validatePasswordAgainstEffectivePolicy } from '../utils/passwordPolicyValidator.js';
import { createCriticalAuditLog, actorFromRequest } from '../utils/auditLogger.js';
import { revokeAllUserSessions } from '../services/sessionService.js';
import { handleDatabaseError } from '../utils/errorHandler.js';
import { cascadeDeleteStudent } from '../services/cascadeDeletionService.js';

export const getDatasheet = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const filter = { role: 'student', soft_deleted: { $ne: true } };
    let targetTenantId = null;

    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
      targetTenantId = req.tenantId;
    } else if (req.query.tenantId && mongoose.Types.ObjectId.isValid(req.query.tenantId)) {
      filter.tenantId = req.query.tenantId;
      targetTenantId = req.query.tenantId;
    }

    // Determine whether this is a School Mode or College Mode context
    let isSchool = false;
    let collegeDoc = null;
    if (targetTenantId) {
      collegeDoc = await College.findById(targetTenantId).select('name institutionType settings').lean();
      if (collegeDoc?.institutionType === 'school') {
        isSchool = true;
      }
    }

    const students = await User.find(filter)
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('batchId', 'name code department semester')
      .sort({ createdAt: -1 })
      .lean();

    const formattedStudents = (students || []).map((s) => {
      const base = {
        _id: s._id,
        id: s.studentId || s._id.toString(),
        studentId: s.studentId || `STU-${s._id.toString().slice(-4)}`,
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        address: s.address || '',
        avatar: s.avatar || '',
        role: 'student',
        status: s.status || s.accountStatus || 'Active',
        accountStatus: s.accountStatus || s.status || 'Active',
        tenantId: s.tenantId,
        enrolledCourses: s.enrolledCourses || [],
        joinedDate: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };

      // Determine if this specific student belongs to a school or has school-specific attributes
      const studentIsSchool = isSchool || Boolean(s.standard || s.schoolProfile?.standard || s.group || s.rollNumber);

      if (studentIsSchool) {
        const std = s.standard || s.schoolProfile?.standard || (s.className && s.className.includes('11') ? 'Class 11' : (s.className && s.className.includes('12') ? 'Class 12' : s.className)) || '';
        const grp = s.group || s.schoolProfile?.group || '';
        const sec = s.section || s.schoolProfile?.section || '';
        const rNo = s.rollNumber || s.schoolProfile?.rollNumber || '';
        const med = s.medium || s.schoolProfile?.medium || 'English';
        const pName = s.parentName || s.schoolProfile?.parentName || s.emergencyContact?.name || '';
        const pPhone = s.parentPhone || s.schoolProfile?.parentPhone || s.emergencyContact?.phone || '';
        const dobVal = s.dob || s.schoolProfile?.dob || '';
        const genderVal = s.gender || s.schoolProfile?.gender || '';

        return {
          ...base,
          standard: std,
          group: grp,
          section: sec,
          rollNumber: rNo,
          medium: med,
          parentName: pName,
          parentPhone: pPhone,
          dob: dobVal,
          gender: genderVal,
          schoolProfile: {
            academicYear: s.schoolProfile?.academicYear || collegeDoc?.settings?.academicConfig?.academicSession || '',
            standard: std,
            group: grp,
            section: sec,
            rollNumber: rNo,
            medium: med,
            parentName: pName,
            parentPhone: pPhone,
            gender: genderVal,
            dob: dobVal
          },
          className: std ? (sec ? `${std}-${sec}` : std) : (s.className || ''),
          emergencyContact: {
            name: pName,
            phone: pPhone,
            relationship: 'Parent / Guardian'
          },
          major: undefined,
          department: undefined,
          year: std,
          university: undefined,
          stats: {
            attendanceRate: s.attendanceRate ?? null,
            assignmentCompletionRate: s.assignmentCompletionRate ?? null,
            gpa: null
          }
        };
      } else {
        // College Mode student
        return {
          ...base,
          className: s.className || s.batchId?.name || '',
          batchName: s.batchId?.name || s.className || '',
          batchId: s.batchId?._id || s.batchId,
          department: s.department || s.batchId?.department || 'General Academic',
          major: s.major || s.department || s.batchId?.department || 'General Academic',
          year: s.year || s.className || s.batchId?.name || 'Year 1',
          university: s.university || '',
          emergencyContact: s.emergencyContact || {},
          stats: {
            gpa: s.stats?.gpa || s.gpa || null,
            termGpa: s.stats?.termGpa || null,
            completedCredits: s.stats?.completedCredits ?? 0,
            totalCredits: s.stats?.totalCredits ?? 0,
            totalStudyHours: s.stats?.totalStudyHours ?? 0,
            assignmentCompletionRate: s.stats?.assignmentCompletionRate ?? null
          }
        };
      }
    });

    const totalStudents = formattedStudents.length;

    // School Mode vs College Mode statistics
    let class11Count = 0;
    let class12Count = 0;
    let otherClassCount = 0;

    formattedStudents.forEach((st) => {
      const cls = (st.standard || st.className || '').toLowerCase();
      if (cls.includes('11')) {
        class11Count++;
      } else if (cls.includes('12')) {
        class12Count++;
      } else if (cls) {
        otherClassCount++;
      }
    });

    let avgGpa = null;
    if (!isSchool) {
      const studentsWithGpa = formattedStudents.filter(s => s.stats?.gpa && !isNaN(parseFloat(s.stats.gpa)));
      if (studentsWithGpa.length > 0) {
        avgGpa = (
          studentsWithGpa.reduce((acc, s) => acc + parseFloat(s.stats.gpa), 0) / studentsWithGpa.length
        ).toFixed(2);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        total: totalStudents,
        institutionType: isSchool ? 'school' : 'college',
        averageGpa: isSchool ? null : avgGpa,
        class11Count,
        class12Count,
        otherClassCount,
        students: formattedStudents
      }
    });
  } catch (error) {
    console.error('[StudentController] getDatasheet error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentDetail = async (req, res) => {
  const { id } = req.params;
  const isSuperAdmin = req.user?.role === 'superadmin';

  try {
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { studentId: id }], role: 'student' }
      : { studentId: id, role: 'student' };

    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    }

    const student = await User.findOne(filter)
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('batchId', 'name code department semester')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Fetch verified attendance and recent submissions
    const [attendanceRecords, submissions] = await Promise.all([
      Attendance.find({ userId: student._id }).sort({ date: -1 }).limit(30).lean(),
      Submission.find({ studentId: student._id }).populate('assignmentId', 'title totalPoints dueDate').sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const totalAttendanceDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const attendancePercentage = totalAttendanceDays > 0 ? Math.round((presentDays / totalAttendanceDays) * 100) : null;

    res.status(200).json({
      success: true,
      student: {
        ...student,
        id: student.studentId || student._id.toString(),
        calculatedAttendanceRate: attendancePercentage,
        attendanceRecords,
        recentSubmissions: submissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStudent = async (req, res) => {
  const {
    name,
    email,
    password,
    studentId,
    phone,
    address,
    enrolledCourses,
    role,
    // School-specific attributes
    standard,
    group,
    section,
    rollNumber,
    medium,
    parentName,
    parentPhone,
    dob,
    gender,
    academicYear,
    // College-specific attributes
    major,
    department,
    year,
    gpa,
    batchId
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Student full name is required.' });
  }

  // SECURITY: Prevent privilege escalation through student provisioning endpoint
  if (role && role.toLowerCase().trim() !== 'student') {
    return res.status(403).json({
      success: false,
      code: 'ROLE_ELEVATION_PROHIBITED',
      message: 'Student provisioning endpoint cannot be used to create privileged roles.'
    });
  }

  const isSuperAdmin = req.user?.role === 'superadmin';
  const targetTenantId = (isSuperAdmin && req.body.tenantId) ? req.body.tenantId : req.tenantId;

  if (!targetTenantId) {
    return res.status(400).json({ success: false, message: 'Target institution (tenantId) is required to provision student.' });
  }

  const cleanName = name.trim();
  const sanitizedNameForEmail = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const randomEmailSuffix = Math.floor(10000 + Math.random() * 90000);
  const finalEmail = email ? email.trim().toLowerCase() : `${sanitizedNameForEmail || 'student'}.${randomEmailSuffix}@student.local`;

  try {
    // 1. Password policy verification (when administrator supplies explicit password)
    if (password) {
      const passwordValidation = await validatePasswordAgainstEffectivePolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          code: 'PASSWORD_POLICY_VIOLATION',
          message: passwordValidation.message
        });
      }
    }

    const finalPassword = password || generateSecureTemporaryPassword(12);

    // 2. Target tenant lookup
    const college = await College.findById(targetTenantId).lean();
    const isSchool = college?.institutionType === 'school' || Boolean(standard || group || rollNumber);

    // 3. Global email duplicate pre-check (enforces global email_1 index across all tenants)
    const existingEmailUser = await User.findOne({ email: finalEmail }).select('_id tenantId soft_deleted role');
    if (existingEmailUser) {
      if (existingEmailUser.soft_deleted && String(existingEmailUser.tenantId) === String(targetTenantId)) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_EMAIL',
          message: 'A deactivated student account with this email exists in this institution. You can restore this student.',
          canRestore: true,
          studentId: existingEmailUser._id
        });
      }

      const isSameTenant = String(existingEmailUser.tenantId) === String(targetTenantId);
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_EMAIL',
        message: isSameTenant
          ? 'A user with this email already exists in this institution.'
          : 'An account with this email address already exists in the system.'
      });
    }

    // 4. Student identifier resolution (explicit vs collision-resistant auto-allocation)
    const isExplicitStudentId = Boolean(studentId && studentId.trim());
    let resolvedStudentId = isExplicitStudentId ? studentId.trim() : null;

    if (isExplicitStudentId) {
      const existingIdUser = await User.findOne({ studentId: resolvedStudentId }).select('_id');
      if (existingIdUser) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_STUDENT_ID',
          message: `The student identifier "${resolvedStudentId}" is already assigned to another account.`
        });
      }
    } else {
      resolvedStudentId = await allocateUniqueStudentId({ maxAttempts: 10 });
      if (!resolvedStudentId) {
        return res.status(503).json({
          success: false,
          code: 'STUDENT_ID_ALLOCATION_FAILED',
          message: 'Unable to allocate a unique student identifier at this time. Please retry.'
        });
      }
    }

    // 5. Standardized 12-round bcrypt hash
    const hashedPassword = await bcrypt.hash(finalPassword, 12);

    let newStudentData = {
      tenantId: targetTenantId,
      name: cleanName,
      email: finalEmail,
      password: hashedPassword,
      role: 'student',
      status: 'Active',
      accountStatus: 'Active',
      phone: phone || '',
      address: address || '',
      enrolledCourses: enrolledCourses || [],
      mustChangePassword: true,
      streakDays: 0,
      xp: 0,
      level: 'Learner'
    };

    if (isSchool) {
      const resolvedStandard = standard || req.body.className || 'Class 11';
      const resolvedSection = section ? section.trim().toUpperCase() : 'A';
      const resolvedGroup = group ? group.trim() : '';
      const resolvedMedium = medium ? medium.trim() : 'English';
      const resolvedSession = academicYear || college?.settings?.academicConfig?.academicSession || '2026-2027';

      newStudentData = {
        ...newStudentData,
        standard: resolvedStandard,
        group: resolvedGroup,
        section: resolvedSection,
        rollNumber: rollNumber ? rollNumber.trim() : '',
        medium: resolvedMedium,
        parentName: parentName ? parentName.trim() : '',
        parentPhone: parentPhone ? parentPhone.trim() : '',
        dob: dob || '',
        gender: gender || '',
        className: `${resolvedStandard}-${resolvedSection}`,
        schoolProfile: {
          academicYear: resolvedSession,
          standard: resolvedStandard,
          group: resolvedGroup,
          section: resolvedSection,
          rollNumber: rollNumber ? rollNumber.trim() : '',
          medium: resolvedMedium,
          parentName: parentName ? parentName.trim() : '',
          parentPhone: parentPhone ? parentPhone.trim() : '',
          gender: gender || '',
          dob: dob || ''
        },
        emergencyContact: {
          name: parentName ? parentName.trim() : undefined,
          phone: parentPhone ? parentPhone.trim() : undefined,
          relationship: 'Parent / Guardian'
        }
      };
    } else {
      // College Mode provisioning
      newStudentData = {
        ...newStudentData,
        major: major || 'General Academic',
        department: department || 'General Education',
        university: college?.name || 'EdWth Academy',
        year: year || 'Year 1',
        className: req.body.className || undefined,
        batchId: batchId || undefined,
        stats: {
          gpa: gpa || null,
          termGpa: gpa || null,
          completedCredits: 0,
          totalCredits: 0,
          totalStudyHours: 0,
          assignmentCompletionRate: null
        }
      };
    }

    // 6. Bounded insert retry loop with MongoDB E11000 duplicate key handling
    let newStudent;
    let insertAttempts = 0;
    const maxInsertAttempts = isExplicitStudentId ? 1 : 3;

    while (!newStudent && insertAttempts < maxInsertAttempts) {
      insertAttempts++;
      try {
        newStudent = await User.create({
          ...newStudentData,
          studentId: resolvedStudentId
        });
      } catch (insertErr) {
        const isDuplicateKey = insertErr.code === 11000 || (insertErr.name === 'MongoServerError' && insertErr.code === 11000);
        if (!isDuplicateKey) {
          throw insertErr;
        }

        const isEmailConflict = insertErr.keyPattern?.email || insertErr.message?.includes('email_1');
        const isStudentIdConflict = insertErr.keyPattern?.studentId || insertErr.message?.includes('studentId_1');

        if (isEmailConflict) {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email address already exists.'
          });
        }

        if (isStudentIdConflict) {
          if (isExplicitStudentId) {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_STUDENT_ID',
              message: `The student identifier "${resolvedStudentId}" is already assigned to another account.`
            });
          }

          // Auto-generated studentId collided in a concurrent race condition
          if (insertAttempts < maxInsertAttempts) {
            resolvedStudentId = await allocateUniqueStudentId({ maxAttempts: 10 });
            if (!resolvedStudentId) {
              return res.status(503).json({
                success: false,
                code: 'STUDENT_ID_ALLOCATION_FAILED',
                message: 'Unable to allocate a unique student identifier at this time. Please retry.'
              });
            }
            continue;
          } else {
            return res.status(503).json({
              success: false,
              code: 'STUDENT_ID_ALLOCATION_FAILED',
              message: 'Unable to allocate a unique student identifier at this time. Please retry.'
            });
          }
        }

        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_RESOURCE',
          message: 'A unique constraint violation occurred while registering the student.'
        });
      }
    }

    createCriticalAuditLog({
      tenantId: targetTenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_STUDENT_PROVISIONED',
      targetRecord: newStudent._id,
      targetModel: 'User',
      details: { email: newStudent.email, studentId: newStudent.studentId, name: newStudent.name, institutionType: isSchool ? 'school' : 'college' }
    });

    const studentJson = newStudent.toObject();
    delete studentJson.password;

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      student: studentJson,
      temporaryPassword: password ? undefined : finalPassword,
      isTemporaryPassword: !password
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'Failed to register student.');
  }
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
  }

  const isSuperAdmin = req.user?.role === 'superadmin';

  // 1. Explicitly identify protected fields and reject attempts to tamper with them
  const protectedFields = [
    'role',
    'tenantId',
    'studentId',
    '_id',
    'id',
    'password',
    'isTwoFactorEnabled',
    'mustChangePassword',
    'twoFactorSecret',
    'twoFactorBackupCodes',
    'pendingTwoFactorSecret',
    'pendingTwoFactorBackupCodes',
    'pendingTwoFactorCreatedAt',
    'soft_deleted',
    'createdAt',
    'updatedAt'
  ];

  const attemptedProtectedFields = protectedFields.filter(
    (field) => req.body[field] !== undefined
  );

  if (attemptedProtectedFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Modification of protected fields is prohibited: ${attemptedProtectedFields.join(', ')}. Passwords must be updated via the dedicated password-reset workflow.`
    });
  }

  // 2. Build sanitized update payload strictly from permitted fields
  const allowedUpdates = {};

  if (req.body.name !== undefined) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: 'Student full name must be a non-empty string.' });
    }
    allowedUpdates.name = req.body.name.trim();
  }

  if (req.body.avatar !== undefined) {
    if (typeof req.body.avatar !== 'string') {
      return res.status(400).json({ success: false, message: 'Avatar must be a string URL.' });
    }
    allowedUpdates.avatar = req.body.avatar.trim();
  }

  // School-specific profile fields
  if (req.body.standard !== undefined) {
    allowedUpdates.standard = typeof req.body.standard === 'string' ? req.body.standard.trim() : '';
    allowedUpdates['schoolProfile.standard'] = allowedUpdates.standard;
  }
  if (req.body.group !== undefined) {
    allowedUpdates.group = typeof req.body.group === 'string' ? req.body.group.trim() : '';
    allowedUpdates['schoolProfile.group'] = allowedUpdates.group;
  }
  if (req.body.section !== undefined) {
    allowedUpdates.section = typeof req.body.section === 'string' ? req.body.section.trim().toUpperCase() : '';
    allowedUpdates['schoolProfile.section'] = allowedUpdates.section;
  }
  if (req.body.rollNumber !== undefined) {
    allowedUpdates.rollNumber = typeof req.body.rollNumber === 'string' ? req.body.rollNumber.trim() : '';
    allowedUpdates['schoolProfile.rollNumber'] = allowedUpdates.rollNumber;
  }
  if (req.body.medium !== undefined) {
    allowedUpdates.medium = typeof req.body.medium === 'string' ? req.body.medium.trim() : 'English';
    allowedUpdates['schoolProfile.medium'] = allowedUpdates.medium;
  }
  if (req.body.parentName !== undefined) {
    allowedUpdates.parentName = typeof req.body.parentName === 'string' ? req.body.parentName.trim() : '';
    allowedUpdates['schoolProfile.parentName'] = allowedUpdates.parentName;
    allowedUpdates['emergencyContact.name'] = allowedUpdates.parentName;
  }
  if (req.body.parentPhone !== undefined) {
    allowedUpdates.parentPhone = typeof req.body.parentPhone === 'string' ? req.body.parentPhone.trim() : '';
    allowedUpdates['schoolProfile.parentPhone'] = allowedUpdates.parentPhone;
    allowedUpdates['emergencyContact.phone'] = allowedUpdates.parentPhone;
  }
  if (req.body.dob !== undefined) {
    allowedUpdates.dob = typeof req.body.dob === 'string' ? req.body.dob.trim() : '';
    allowedUpdates['schoolProfile.dob'] = allowedUpdates.dob;
  }
  if (req.body.gender !== undefined) {
    allowedUpdates.gender = typeof req.body.gender === 'string' ? req.body.gender.trim() : '';
    allowedUpdates['schoolProfile.gender'] = allowedUpdates.gender;
  }
  if (req.body.academicYear !== undefined) {
    allowedUpdates['schoolProfile.academicYear'] = typeof req.body.academicYear === 'string' ? req.body.academicYear.trim() : '';
  }
  if (req.body.className !== undefined) {
    allowedUpdates.className = typeof req.body.className === 'string' ? req.body.className.trim() : '';
  }

  // College-specific fields
  if (req.body.major !== undefined) {
    allowedUpdates.major = typeof req.body.major === 'string' ? req.body.major.trim() : '';
  }
  if (req.body.department !== undefined) {
    allowedUpdates.department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
  }
  if (req.body.university !== undefined) {
    allowedUpdates.university = typeof req.body.university === 'string' ? req.body.university.trim() : '';
  }
  if (req.body.year !== undefined) {
    allowedUpdates.year = typeof req.body.year === 'string' ? req.body.year.trim() : '';
  }

  // General fields
  if (req.body.phone !== undefined) {
    allowedUpdates.phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  }
  if (req.body.address !== undefined) {
    allowedUpdates.address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  }
  if (req.body.accountStatus !== undefined) {
    allowedUpdates.accountStatus = typeof req.body.accountStatus === 'string' ? req.body.accountStatus.trim() : 'Active';
  }
  if (req.body.status !== undefined) {
    allowedUpdates.status = typeof req.body.status === 'string' ? req.body.status.trim() : 'Active';
  }
  if (req.body.level !== undefined) {
    allowedUpdates.level = typeof req.body.level === 'string' ? req.body.level.trim() : '';
  }

  if (req.body.enrolledCourses !== undefined) {
    if (!Array.isArray(req.body.enrolledCourses) || req.body.enrolledCourses.some((c) => typeof c !== 'string')) {
      return res.status(400).json({ success: false, message: 'Enrolled courses must be an array of strings.' });
    }
    allowedUpdates.enrolledCourses = req.body.enrolledCourses.map((c) => c.trim()).filter(Boolean);
  }

  // 3. Validate nested stats fields individually with type and range enforcement
  if (req.body.stats !== undefined) {
    if (typeof req.body.stats !== 'object' || req.body.stats === null || Array.isArray(req.body.stats)) {
      return res.status(400).json({ success: false, message: 'Stats must be an object.' });
    }

    const { gpa, termGpa, completedCredits, totalCredits, totalStudyHours, assignmentCompletionRate } = req.body.stats;
    const sanitizedStats = {};

    if (gpa !== undefined) {
      const numGpa = parseFloat(gpa);
      if (isNaN(numGpa) || numGpa < 0 || numGpa > 4.0) {
        return res.status(400).json({ success: false, message: 'Cumulative GPA must be a numerical value between 0.0 and 4.0.' });
      }
      sanitizedStats.gpa = numGpa.toFixed(2);
    }

    if (termGpa !== undefined) {
      const numTermGpa = parseFloat(termGpa);
      if (isNaN(numTermGpa) || numTermGpa < 0 || numTermGpa > 4.0) {
        return res.status(400).json({ success: false, message: 'Term GPA must be a numerical value between 0.0 and 4.0.' });
      }
      sanitizedStats.termGpa = numTermGpa.toFixed(2);
    }

    if (completedCredits !== undefined) {
      const credits = Number(completedCredits);
      if (!Number.isInteger(credits) || credits < 0 || credits > 500) {
        return res.status(400).json({ success: false, message: 'Completed credits must be an integer between 0 and 500.' });
      }
      sanitizedStats.completedCredits = credits;
    }

    if (totalCredits !== undefined) {
      const totCredits = Number(totalCredits);
      if (!Number.isInteger(totCredits) || totCredits < 0 || totCredits > 500) {
        return res.status(400).json({ success: false, message: 'Total credits must be an integer between 0 and 500.' });
      }
      sanitizedStats.totalCredits = totCredits;
    }

    if (totalStudyHours !== undefined) {
      const hours = parseFloat(totalStudyHours);
      if (isNaN(hours) || hours < 0 || hours > 10000) {
        return res.status(400).json({ success: false, message: 'Total study hours must be a non-negative number.' });
      }
      sanitizedStats.totalStudyHours = hours;
    }

    if (assignmentCompletionRate !== undefined) {
      const rate = parseFloat(assignmentCompletionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ success: false, message: 'Assignment completion rate must be a percentage between 0 and 100.' });
      }
      sanitizedStats.assignmentCompletionRate = rate;
    }

    for (const [key, val] of Object.entries(sanitizedStats)) {
      allowedUpdates[`stats.${key}`] = val;
    }
  }

  if (req.body.gpa !== undefined && allowedUpdates['stats.gpa'] === undefined) {
    const numGpa = parseFloat(req.body.gpa);
    if (isNaN(numGpa) || numGpa < 0 || numGpa > 4.0) {
      return res.status(400).json({ success: false, message: 'GPA must be a numerical value between 0.0 and 4.0.' });
    }
    allowedUpdates['stats.gpa'] = numGpa.toFixed(2);
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid editable fields provided in update request.' });
  }

  try {
    // 4. Ensure target record is strictly a student belonging to the authorized tenant
    const query = isSuperAdmin
      ? { _id: id, role: 'student' }
      : { _id: id, tenantId: req.tenantId, role: 'student' };

    const student = await User.findOneAndUpdate(
      query,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!student) {
      const userExists = await User.findById(id);
      if (userExists && userExists.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'The student-update endpoint can only be used to manage student accounts.'
        });
      }
      return res.status(404).json({ success: false, message: 'Student record not found in this institution.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Student record updated successfully.',
      student
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
  const isSuperAdmin = req.user?.role === 'superadmin';

  try {
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = id.trim();

    // Support lookup by either MongoDB _id or school studentId without Mongoose CastError
    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const filter = { ...idFilter, role: 'student' };
    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    } else if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    const student = await User.findOne(filter);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found in this institution.' });
    }

    if (isPermanent) {
      const result = await cascadeDeleteStudent(student, actorFromRequest(req));
      return res.status(200).json({
        success: true,
        isTransactional: result.isTransactional,
        message: 'Student record and associated academic data permanently deleted.',
        journal: result.journal
      });
    } else {
      student.soft_deleted = true;
      student.accountStatus = 'Inactive';
      student.status = 'Inactive';
      await student.save();

      await revokeAllUserSessions(student._id.toString(), 'admin_revocation');

      await createCriticalAuditLog({
        tenantId: student.tenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENT_DEACTIVATED',
        targetRecord: student._id,
        targetModel: 'User',
        details: { email: student.email, studentId: student.studentId, name: student.name }
      });

      return res.status(200).json({
        success: true,
        message: 'Student account deactivated.'
      });
    }
  } catch (error) {
    console.error('[StudentController] deleteStudent error:', error);
    return handleDatabaseError(error, res, 'Failed to delete student.');
  }
};

export const restoreStudent = async (req, res) => {
  const { id } = req.params;
  const isSuperAdmin = req.user?.role === 'superadmin';

  try {
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = id.trim();

    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const filter = { ...idFilter, role: 'student' };
    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    } else if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    const student = await User.findOne(filter);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found in this institution.' });
    }

    if (!student.soft_deleted && student.status === 'Active' && student.accountStatus === 'Active') {
      return res.status(400).json({ success: false, message: 'Student account is already active.' });
    }

    // Check for collisions: does another active user have the same email or studentId?
    const conflictingActive = await User.findOne({
      _id: { $ne: student._id },
      $or: [
        { email: student.email },
        { studentId: student.studentId }
      ],
      soft_deleted: { $ne: true }
    });

    if (conflictingActive) {
      return res.status(409).json({
        success: false,
        code: 'RESTORATION_CONFLICT',
        message: `Cannot restore: an active account already uses this student's email (${student.email}) or identifier (${student.studentId}).`
      });
    }

    student.soft_deleted = false;
    student.accountStatus = 'Active';
    student.status = 'Active';
    await student.save();

    await createCriticalAuditLog({
      tenantId: student.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_STUDENT_RESTORED',
      targetRecord: student._id,
      targetModel: 'User',
      details: { email: student.email, studentId: student.studentId, name: student.name }
    });

    const studentJson = student.toObject();
    delete studentJson.password;
    delete studentJson.twoFactorSecret;
    delete studentJson.twoFactorBackupCodes;

    return res.status(200).json({
      success: true,
      message: 'Student account restored to active status.',
      student: studentJson
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'Failed to restore student.');
  }
};

export const bulkDeleteStudents = async (req, res) => {
  const { studentIds, permanent } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, message: 'studentIds must be a non-empty array.' });
  }

  const isPermanent = permanent === true || req.query.permanent === 'true';
  const isSuperAdmin = req.user?.role === 'superadmin';

  try {
    const validObjectIds = studentIds.filter(sid => mongoose.Types.ObjectId.isValid(sid));
    const filter = {
      $or: [
        { _id: { $in: validObjectIds } },
        { studentId: { $in: studentIds } }
      ],
      role: 'student'
    };
    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    } else if (req.body.tenantId || req.query.tenantId) {
      filter.tenantId = req.body.tenantId || req.query.tenantId;
    }

    const students = await User.find(filter);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching students found for deletion in your institution.' });
    }

    const targetIds = students.map(s => s._id);

    if (isPermanent) {
      for (const s of students) {
        await revokeAllUserSessions(s._id.toString(), 'admin_revocation');
      }

      const allStudentIdentifiers = students.flatMap(s => [s._id.toString(), s.studentId]).filter(Boolean);

      await Promise.all([
        Attendance.deleteMany({ studentId: { $in: targetIds } }),
        Submission.deleteMany({ studentId: { $in: targetIds } }),
        AssessmentAttempt.deleteMany({ studentId: { $in: targetIds } }),
        StudentProgress.deleteMany({ studentId: { $in: targetIds } }),
        Doubt.deleteMany({ studentId: { $in: targetIds } }),
        Grade.deleteMany({ studentId: { $in: allStudentIdentifiers } }),
        Note.deleteMany({ owner: { $in: targetIds } }),
        TeacherNote.deleteMany({ studentId: { $in: allStudentIdentifiers } }),
        RetakeAuthorization.deleteMany({ studentId: { $in: targetIds } }),
        AssessmentEvent.deleteMany({ studentId: { $in: targetIds } }),
        Session.deleteMany({ userId: { $in: targetIds } }),
        Passkey.deleteMany({ userId: { $in: targetIds } }),
        EmailOtp.deleteMany({ userId: { $in: targetIds } }),
        User.deleteMany({ _id: { $in: targetIds } })
      ]);

      await createCriticalAuditLog({
        tenantId: req.tenantId || (isSuperAdmin ? students[0]?.tenantId : null),
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENTS_BULK_PERMANENTLY_DELETED',
        details: { count: targetIds.length, studentIds: targetIds }
      });

      return res.status(200).json({
        success: true,
        message: `Successfully permanently deleted ${targetIds.length} student record(s).`,
        count: targetIds.length
      });
    } else {
      await User.updateMany(
        { _id: { $in: targetIds } },
        { $set: { soft_deleted: true, accountStatus: 'Inactive', status: 'Inactive' } }
      );

      for (const s of students) {
        await revokeAllUserSessions(s._id.toString(), 'admin_revocation');
      }

      await createCriticalAuditLog({
        tenantId: req.tenantId || (isSuperAdmin ? students[0]?.tenantId : null),
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENTS_BULK_DEACTIVATED',
        details: { count: targetIds.length, studentIds: targetIds }
      });

      return res.status(200).json({
        success: true,
        message: `Successfully deactivated ${targetIds.length} student account(s).`,
        count: targetIds.length
      });
    }
  } catch (error) {
    console.error('[StudentController] bulkDeleteStudents error:', error);
    return handleDatabaseError(error, res, 'Failed to perform bulk student deletion.');
  }
};

export const resetPassword = async (req, res) => {
  const { id } = req.params;
  
  try {
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = id.trim();
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Support lookup by either MongoDB _id or school studentId without Mongoose CastError
    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const query = {
      ...idFilter,
      role: 'student',
      soft_deleted: { $ne: true }
    };

    // Tenant isolation: non-superadmin callers are strictly bounded by tenantId
    if (!isSuperAdmin) {
      if (!req.tenantId) {
        return res.status(403).json({ success: false, message: 'Tenant identifier required for institution admin.' });
      }
      query.tenantId = req.tenantId;
    }

    const student = await User.findOne(query);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in this institution.' });
    }

    // Role check: If educator/trainer, check batch assignment boundary
    if (req.user && req.user.role === 'trainer' && req.user.batchId) {
      if (student.batchId && student.batchId.toString() !== req.user.batchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Educators can only reset passwords for students in their assigned class/batch.'
        });
      }
    }

    // Generate cryptographically secure random temporary password
    const temporaryPassword = generateSecureTemporaryPassword(12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    student.password = hashedPassword;
    student.mustChangePassword = true;
    await student.save();

    // Invalidate active sessions upon password reset
    await revokeAllUserSessions(student._id, 'educator_password_reset');

    // Critical audit log — NEVER log the temporary password
    try {
      await createCriticalAuditLog({
        tenantId: req.tenantId || student.tenantId,
        actor: actorFromRequest(req),
        action: 'STUDENT_PASSWORD_RESET',
        targetRecord: student._id,
        targetModel: 'User',
        details: {
          studentId: student.studentId,
          email: student.email
        }
      });
    } catch (auditErr) {
      console.error('[StudentController] Audit log failed for student password reset:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Temporary password generated successfully.',
      temporaryPassword
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: `Invalid student identifier format: ${error.value}` });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadCsv = (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented' });
};

export const downloadJson = (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented' });
};
