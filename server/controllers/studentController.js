import mongoose from 'mongoose';
import User from '../models/User.js';
import bcrypt from 'bcrypt';
import generateSecureTemporaryPassword from '../utils/passwordGenerator.js';
import { createCriticalAuditLog, actorFromRequest } from '../utils/auditLogger.js';

export const getDatasheet = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const filter = { role: 'student', soft_deleted: { $ne: true } };
    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    } else if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    const students = await User.find(filter)
      .select('-password')
      .populate('batchId', 'name code department semester')
      .lean();

    const formattedStudents = (students || []).map((s) => ({
      ...s,
      id: s.studentId || s._id.toString(),
      major: s.major || s.department || s.batchId?.department || 'General Academic',
      year: s.year || s.className || s.batchId?.name || 'Year 1',
      university: s.university || 'Nexus Institute of Technology',
      stats: {
        gpa: s.stats?.gpa || s.gpa || '3.8',
        termGpa: s.stats?.termGpa || s.gpa || '3.85',
        completedCredits: s.stats?.completedCredits ?? 30,
        totalCredits: s.stats?.totalCredits ?? 120,
        totalStudyHours: s.stats?.totalStudyHours ?? 20.0,
        assignmentCompletionRate: s.stats?.assignmentCompletionRate ?? 90
      }
    }));

    const totalStudents = formattedStudents.length;
    let avgGpa = 0;
    
    if (totalStudents > 0) {
      avgGpa = (
        formattedStudents.reduce((acc, s) => acc + parseFloat(s.stats?.gpa || 0), 0) / totalStudents
      ).toFixed(2);
    }

    return res.status(200).json({
      success: true,
      data: {
        total: totalStudents,
        averageGpa: avgGpa,
        students: formattedStudents
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStudent = async (req, res) => {
  const { name, major, department, year, gpa, email, studentId, password, phone, enrolledCourses, role } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Student full name is required.' });
  }

  const firstName = name.trim().split(' ')[0] || 'Student';
  const lastName = name.trim().split(' ')[1] || 'Nexus';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);

  const finalStudentId = studentId || `NX-${new Date().getFullYear()}-${randomDigits}`;
  const finalEmail = email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus.edu`;
  const finalPassword = password || `${firstName}#Nexus${Math.floor(10 + Math.random() * 89)}!`;

  try {
    const hashedPassword = await bcrypt.hash(finalPassword, 10);
    const newStudent = await User.create({
      tenantId: req.tenantId, // Force tenant isolation
      studentId: finalStudentId,
      name: name.trim(),
      email: finalEmail.toLowerCase(),
      password: hashedPassword,
      role: role || 'student',
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 50000000)}?w=150&auto=format&fit=crop&q=80`,
      major: major || 'Computer Science & AI',
      department: department || 'School of Computing',
      university: 'Nexus Institute of Technology',
      year: year || 'Junior (Year 3)',
      streakDays: 1,
      xp: 100,
      level: 'Novice Scholar',
      status: 'Online',
      accountStatus: 'Active',
      phone: phone || `+1 (617) 555-${Math.floor(1000 + Math.random() * 9000)}`,
      lastLogin: null,
      enrolledCourses: enrolledCourses || ['CS 401', 'CS 330'],
      stats: {
        gpa: gpa || '3.80',
        termGpa: gpa || '3.85',
        completedCredits: 30,
        totalCredits: 120,
        totalStudyHours: 20.0,
        assignmentCompletionRate: 90
      }
    });

    // Remove password from response
    newStudent.password = undefined;

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      student: newStudent
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
  }

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

  if (req.body.major !== undefined) {
    if (typeof req.body.major !== 'string') {
      return res.status(400).json({ success: false, message: 'Major must be a string.' });
    }
    allowedUpdates.major = req.body.major.trim();
  }

  if (req.body.department !== undefined) {
    if (typeof req.body.department !== 'string') {
      return res.status(400).json({ success: false, message: 'Department must be a string.' });
    }
    allowedUpdates.department = req.body.department.trim();
  }

  if (req.body.university !== undefined) {
    if (typeof req.body.university !== 'string') {
      return res.status(400).json({ success: false, message: 'University must be a string.' });
    }
    allowedUpdates.university = req.body.university.trim();
  }

  if (req.body.year !== undefined) {
    if (typeof req.body.year !== 'string') {
      return res.status(400).json({ success: false, message: 'Academic year must be a string.' });
    }
    allowedUpdates.year = req.body.year.trim();
  }

  if (req.body.phone !== undefined) {
    if (typeof req.body.phone !== 'string') {
      return res.status(400).json({ success: false, message: 'Phone number must be a string.' });
    }
    allowedUpdates.phone = req.body.phone.trim();
  }

  if (req.body.accountStatus !== undefined) {
    if (typeof req.body.accountStatus !== 'string' || !req.body.accountStatus.trim()) {
      return res.status(400).json({ success: false, message: 'Account status must be a non-empty string.' });
    }
    allowedUpdates.accountStatus = req.body.accountStatus.trim();
  }

  if (req.body.status !== undefined) {
    if (typeof req.body.status !== 'string') {
      return res.status(400).json({ success: false, message: 'Status must be a string.' });
    }
    allowedUpdates.status = req.body.status.trim();
  }

  if (req.body.level !== undefined) {
    if (typeof req.body.level !== 'string') {
      return res.status(400).json({ success: false, message: 'Level must be a string.' });
    }
    allowedUpdates.level = req.body.level.trim();
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

    // Apply individual stats properties to avoid wiping unmentioned nested values
    for (const [key, val] of Object.entries(sanitizedStats)) {
      allowedUpdates[`stats.${key}`] = val;
    }
  }

  // Also support top-level gpa payload if passed by legacy UI
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
    // 4. Ensure the target record is strictly a student belonging to the authenticated tenant
    const student = await User.findOneAndUpdate(
      { _id: id, tenantId: req.tenantId, role: 'student' },
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!student) {
      // Differentiate whether student does not exist or user is not a student
      const userExists = await User.findOne({ _id: id, tenantId: req.tenantId });
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
  
  try {
    const student = await User.findOneAndDelete({ _id: id, tenantId: req.tenantId });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Student record removed.'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
  // Not implemented in DB version yet
  res.status(501).json({ success: false, message: 'Not implemented' });
};

export const downloadJson = (req, res) => {
  // Not implemented in DB version yet
  res.status(501).json({ success: false, message: 'Not implemented' });
};
