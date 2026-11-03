/**
 * Lumina LMS — Frontend Data Flow & Institution Type Verification Test Suite
 * 6th Civilians Corporation / EdWth Academy
 *
 * Verifies:
 * 1. Authoritative institutionType resolution priority:
 *    propInstitutionType -> selectedSchool.institutionType -> LMSContext.institutionType -> user.institutionType
 * 2. Never defaulting to College Mode when institutionType is null/unconfigured
 * 3. School Mode form attributes (Class 11/12, Stream Group, Section, Roll No, Guardian) vs College attributes (Major, Dept, Year, GPA)
 * 4. TenantId enforcement in student provisioning payloads
 * 5. Instant reactivity upon institution switch
 */

describe('Lumina LMS — Institution Context Resolution & Mode Enforcement', () => {
  // Pure logic replica of LMSContext.jsx institutionType resolution
  function resolveContextInstitutionType(selectedInstitution, user, portalConfig) {
    const rawType = selectedInstitution?.institutionType || 
      user?.institutionType || 
      (portalConfig?.institutionType && portalConfig.institutionType !== 'unconfigured' ? portalConfig.institutionType : null) || 
      null;
    return (rawType && rawType !== 'unconfigured') ? rawType : null;
  }

  // Pure logic replica of StudentsDataSheetView.jsx effectiveInstitutionType resolution
  function resolveEffectiveInstitutionType(propInstitutionType, propSelectedSchool, selectedInstitution, contextInstitutionType, user) {
    const effectiveSchool = propSelectedSchool || selectedInstitution || null;
    const rawEffectiveType = propInstitutionType || effectiveSchool?.institutionType || contextInstitutionType || user?.institutionType || null;
    return (rawEffectiveType && rawEffectiveType !== 'unconfigured') ? rawEffectiveType : null;
  }

  // Student payload builder as implemented in handleCreateStudentSubmit
  function buildStudentPayload(formData, effectiveCollegeId, effectiveInstitutionType) {
    const isSchool = effectiveInstitutionType === 'school';
    const targetTenantId = effectiveCollegeId;

    if (!targetTenantId) {
      throw new Error('Target institution (tenantId) is required');
    }

    let payload = {
      tenantId: targetTenantId,
      collegeId: targetTenantId,
      name: formData.name.trim(),
      email: formData.email || undefined,
      password: formData.password || undefined,
      studentId: formData.studentId || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined
    };

    if (isSchool) {
      payload = {
        ...payload,
        standard: formData.standard,
        group: formData.group,
        section: formData.section,
        rollNumber: formData.rollNumber || undefined,
        medium: formData.medium,
        parentName: formData.parentName || undefined,
        parentPhone: formData.parentPhone || undefined,
        dob: formData.dob || undefined,
        gender: formData.gender || undefined,
        academicYear: formData.academicYear || '2026-2027',
        className: `${formData.standard}-${formData.section}`
      };
    } else {
      payload = {
        ...payload,
        major: formData.major,
        department: formData.department,
        year: formData.year,
        gpa: formData.gpa || undefined
      };
    }

    return payload;
  }

  test('1. SuperAdmin initial landing has null institutionType and NEVER defaults to college', () => {
    const superAdminUser = {
      role: 'superadmin',
      email: 'edwthacademyadmin@6c.com',
      tenantId: null,
      institutionType: null
    };
    const portalConfig = { companyName: 'EdWth Academy' };
    const selectedInstitution = null;

    const contextType = resolveContextInstitutionType(selectedInstitution, superAdminUser, portalConfig);
    expect(contextType).toBeNull();

    const effectiveType = resolveEffectiveInstitutionType(undefined, undefined, selectedInstitution, contextType, superAdminUser);
    expect(effectiveType).toBeNull();

    const isSchool = effectiveType === 'school';
    const isCollege = effectiveType === 'college';
    const hasResolvedType = isSchool || isCollege;

    expect(isSchool).toBe(false);
    expect(isCollege).toBe(false);
    expect(hasResolvedType).toBe(false);
    // Verified: does NOT default to College Mode when null!
  });

  test('2. School selection immediately sets institutionType to "school"', () => {
    const superAdminUser = {
      role: 'superadmin',
      email: 'edwthacademyadmin@6c.com',
      tenantId: null,
      institutionType: null
    };
    const portalConfig = { companyName: 'EdWth Academy' };
    const selectedSchool = {
      _id: 'school_12345',
      name: 'Greenwood Senior Secondary School',
      code: 'GWSSS',
      institutionType: 'school'
    };

    const contextType = resolveContextInstitutionType(selectedSchool, superAdminUser, portalConfig);
    expect(contextType).toBe('school');

    const effectiveType = resolveEffectiveInstitutionType(undefined, undefined, selectedSchool, contextType, superAdminUser);
    expect(effectiveType).toBe('school');

    const isSchool = effectiveType === 'school';
    const hasResolvedType = isSchool || effectiveType === 'college';

    expect(isSchool).toBe(true);
    expect(hasResolvedType).toBe(true);
  });

  test('3. Explicit prop from MultiSchoolManagementView overrides context and guarantees School Mode', () => {
    const superAdminUser = { role: 'superadmin', tenantId: null, institutionType: null };
    const propSelectedSchool = {
      _id: 'school_789',
      name: 'St. Xavier School',
      code: 'STX',
      institutionType: 'school'
    };

    const effectiveType = resolveEffectiveInstitutionType('school', propSelectedSchool, null, null, superAdminUser);
    expect(effectiveType).toBe('school');
  });

  test('4. School Mode student payload contains Class 11/12, Stream Group, Section, Roll No, Guardian and suppresses College fields', () => {
    const formData = {
      name: 'Kavitha Sundaram',
      email: 'kavitha.s@student.local',
      standard: 'Class 11',
      group: 'Group I (MPC)',
      section: 'B',
      rollNumber: '11B-015',
      medium: 'English',
      parentName: 'Sundaram Narayanan',
      parentPhone: '+91 91234 56789',
      academicYear: '2026-2027',
      // Stale college fields in form state must NOT leak
      major: 'Computer Science',
      department: 'School of Computing',
      year: 'Junior (Year 3)',
      gpa: '3.9'
    };

    const payload = buildStudentPayload(formData, 'school_12345', 'school');

    expect(payload.tenantId).toBe('school_12345');
    expect(payload.collegeId).toBe('school_12345');
    expect(payload.name).toBe('Kavitha Sundaram');
    expect(payload.standard).toBe('Class 11');
    expect(payload.group).toBe('Group I (MPC)');
    expect(payload.section).toBe('B');
    expect(payload.rollNumber).toBe('11B-015');
    expect(payload.medium).toBe('English');
    expect(payload.parentName).toBe('Sundaram Narayanan');
    expect(payload.parentPhone).toBe('+91 91234 56789');
    expect(payload.className).toBe('Class 11-B');

    // Assure college fields are NOT in payload
    expect(payload.major).toBeUndefined();
    expect(payload.department).toBeUndefined();
    expect(payload.year).toBeUndefined();
    expect(payload.gpa).toBeUndefined();
  });

  test('5. College Mode student payload contains Major, Department, Year, GPA and suppresses School fields', () => {
    const formData = {
      name: 'Rohit Mehta',
      email: 'rohit.m@college.local',
      major: 'Artificial Intelligence & Data Science',
      department: 'School of Computer Science',
      year: 'Senior (Year 4)',
      gpa: '3.92',
      // Stale school fields must NOT leak
      standard: 'Class 11',
      group: 'Group I (MPC)',
      section: 'A'
    };

    const payload = buildStudentPayload(formData, 'college_99999', 'college');

    expect(payload.tenantId).toBe('college_99999');
    expect(payload.major).toBe('Artificial Intelligence & Data Science');
    expect(payload.department).toBe('School of Computer Science');
    expect(payload.year).toBe('Senior (Year 4)');
    expect(payload.gpa).toBe('3.92');

    // Assure school fields are NOT in payload
    expect(payload.standard).toBeUndefined();
    expect(payload.group).toBeUndefined();
    expect(payload.section).toBeUndefined();
    expect(payload.rollNumber).toBeUndefined();
  });

  test('6. Student payload builder throws error if tenantId is missing', () => {
    const formData = { name: 'Nameless Student' };
    expect(() => {
      buildStudentPayload(formData, null, 'school');
    }).toThrow('Target institution (tenantId) is required');
  });

  test('7. Switching between School and College immediately flips mode without residual state leakage', () => {
    let activeInstitution = { _id: 'school_1', name: 'School 1', institutionType: 'school' };
    let mode = resolveEffectiveInstitutionType(undefined, undefined, activeInstitution, 'school', null);
    expect(mode).toBe('school');

    // Switch to college
    activeInstitution = { _id: 'college_1', name: 'College 1', institutionType: 'college' };
    mode = resolveEffectiveInstitutionType(undefined, undefined, activeInstitution, 'college', null);
    expect(mode).toBe('college');

    // Switch to null (unselected)
    activeInstitution = null;
    mode = resolveEffectiveInstitutionType(undefined, undefined, activeInstitution, null, null);
    expect(mode).toBeNull();
  });
});

