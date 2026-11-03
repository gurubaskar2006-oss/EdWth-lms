import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { apiService } from '../services/apiService';
import {
  Users,
  Search,
  Plus,
  Download,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  Award,
  BookOpen,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  CheckSquare,
  Square,
  School,
  Building
} from 'lucide-react';
import { ResetStudentPasswordModal } from '../components/ResetStudentPasswordModal';
import { CredentialConfirmationModal } from '../components/CredentialConfirmationModal';

export const StudentsDataSheetView = ({
  selectedSchool: propSelectedSchool,
  institutionType: propInstitutionType,
  collegeId: propCollegeId,
  isSuperAdmin: propIsSuperAdmin
} = {}) => {
  usePageTitle('Students Data');
  const {
    students: contextStudents,
    user,
    addStudent,
    updateStudent,
    deleteStudent,
    restoreStudent,
    resetStudentPassword,
    exportStudentsData,
    addToast,
    courses,
    setLoginModalOpen,
    terms,
    institutionType: contextInstitutionType,
    selectedInstitution,
    setSelectedInstitution
  } = useLMS();

  const storedUserRole = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('lumina_current_user') || 'null');
      return (u?.role || '').toLowerCase();
    } catch {
      return '';
    }
  })();
  const isSuperAdmin = typeof propIsSuperAdmin === 'boolean'
    ? propIsSuperAdmin
    : ((user?.role || storedUserRole || '').toLowerCase() === 'superadmin');

  // Authoritative Context Resolution
  const rawStoredSchool = (() => {
    try {
      const stored = sessionStorage.getItem('lumina_selected_institution');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed && (parsed._id || parsed.id) && parsed.name) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  })();

  const effectiveSchool = (propSelectedSchool && (propSelectedSchool._id || propSelectedSchool.id))
    ? propSelectedSchool
    : (selectedInstitution && (selectedInstitution._id || selectedInstitution.id))
      ? selectedInstitution
      : rawStoredSchool;
  const effectiveCollegeId = propCollegeId || effectiveSchool?._id || effectiveSchool?.id || (isSuperAdmin ? null : user?.tenantId) || null;

  // Authoritative Institution Type:
  // For SuperAdmin: If no institution is explicitly selected, effectiveInstitutionType MUST be null
  // so that the SuperAdmin Institution Context Selector ("Select an Institution to Manage Students") renders!
  const rawEffectiveType = isSuperAdmin
    ? (propInstitutionType || effectiveSchool?.institutionType || null)
    : (propInstitutionType || effectiveSchool?.institutionType || contextInstitutionType || user?.institutionType || null);
  const effectiveInstitutionType = (rawEffectiveType && rawEffectiveType !== 'unconfigured') ? rawEffectiveType : null;

  const isSchool = effectiveInstitutionType === 'school';
  const isCollege = effectiveInstitutionType === 'college';
  const hasResolvedType = isSchool || isCollege;

  // SuperAdmin Institution Discovery (When no institution is currently selected)
  const [availableInstitutions, setAvailableInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && (!hasResolvedType || !effectiveCollegeId)) {
      let isMounted = true;
      setLoadingInstitutions(true);
      Promise.all([
        apiService.getAdminSchools().catch(() => ({ schools: [] })),
        apiService.getAdminInstitutions().catch(() => ({ institutions: [] }))
      ]).then(([schoolsRes, instsRes]) => {
        if (!isMounted) return;
        const schoolsList = (schoolsRes?.schools || []).map(s => ({
          _id: s._id || s.id,
          id: s._id || s.id,
          name: s.name,
          code: s.code,
          institutionType: 'school',
          status: s.status || 'active',
          studentsCount: s.studentsCount || 0
        }));
        const instsList = (instsRes?.institutions || []).map(i => ({
          _id: i._id || i.id,
          id: i._id || i.id,
          name: i.name,
          code: i.code,
          institutionType: i.institutionType || 'college',
          status: i.status || 'active',
          studentsCount: i.studentsCount || 0
        }));
        const map = new Map();
        schoolsList.forEach(s => map.set(s._id, s));
        instsList.forEach(i => {
          if (!map.has(i._id)) map.set(i._id, i);
        });
        const allList = Array.from(map.values());
        setAvailableInstitutions(allList);

        // Auto-select when exactly 1 active institution exists and none is explicitly selected:
        if (allList.length === 1 && !selectedInstitution && setSelectedInstitution) {
          setSelectedInstitution(allList[0]);
        }
      }).finally(() => {
        if (isMounted) setLoadingInstitutions(false);
      });
      return () => { isMounted = false; };
    }
  }, [isSuperAdmin, hasResolvedType, effectiveCollegeId]);

  // Scoped Students Loading for the active institution
  const [scopedStudents, setScopedStudents] = useState(null);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadScoped = async () => {
      if (!effectiveCollegeId) {
        setScopedStudents(null);
        return;
      }
      setIsFetchingStudents(true);
      try {
        const res = await apiService.getStudentsDataSheet(effectiveCollegeId);
        if (isMounted && res?.data?.students) {
          setScopedStudents(res.data.students);
        }
      } catch (err) {
        console.error('Error fetching scoped students:', err);
      } finally {
        if (isMounted) setIsFetchingStudents(false);
      }
    };
    loadScoped();
    return () => { isMounted = false; };
  }, [effectiveCollegeId]);

  const students = scopedStudents !== null ? scopedStudents : (contextStudents || []);

  const [resetTargetStudent, setResetTargetStudent] = useState(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterClass, setFilterClass] = useState('all'); // 'all' | '11' | '12'
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Bulk Selection State
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
  const [bulkPermanent, setBulkPermanent] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Single Student Delete Confirmation Modal
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deletePermanentChoice, setDeletePermanentChoice] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [restoringStudentId, setRestoringStudentId] = useState(null);

  // Student Dossier View Modal
  const [viewingStudentDossier, setViewingStudentDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [modalSelectedInstitution, setModalSelectedInstitution] = useState(null);

  // Password Visibility Toggle Map (studentId -> boolean)
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudentModal, setEditStudentModal] = useState(null);
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [createdCredentialInfo, setCreatedCredentialInfo] = useState(null);

  // New Student Form State
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    // School-specific
    standard: 'Class 11',
    group: 'Group I (MPC)',
    section: 'A',
    rollNumber: '',
    medium: 'English',
    parentName: '',
    parentPhone: '',
    dob: '',
    gender: 'Male',
    academicYear: '2026-2027',
    // College-specific
    major: 'Computer Science & AI',
    department: 'School of Computing',
    year: 'Junior (Year 3)',
    gpa: '',
    // Common
    email: '',
    studentId: '',
    password: '',
    role: 'Student',
    phone: '',
    address: '',
    enrolledCourses: []
  });

  useEffect(() => {
    if (addModalOpen) {
      setModalSelectedInstitution(effectiveSchool || null);
    }
  }, [addModalOpen, effectiveSchool]);

  const [isLocked, setIsLocked] = useState(false);

  // Check Team Clearance Level
  const isTeamUser =
    user?.role?.toLowerCase().includes('admin') ||
    user?.role?.toLowerCase().includes('superadmin') ||
    user?.role?.toLowerCase().includes('trainer') ||
    user?.role?.toLowerCase().includes('teacher') ||
    user?.role?.toLowerCase().includes('instructor') ||
    user?.role?.toLowerCase().includes('faculty') ||
    user?.role?.toLowerCase().includes('chair');

  const hasTeamAccess = Boolean(isTeamUser && !isLocked);

  const lockTeamAccess = () => {
    setIsLocked(true);
    addToast?.('Data Sheet Locked', 'Student credentials sheet locked. Click unlock to view.', 'amber');
  };

  // Toggle Password Visibility
  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard helper
  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    addToast?.('Copied to Clipboard', text, 'emerald');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Auto-generate helper for Add Modal
  const generateNewCredentials = () => {
    const firstName = newStudentForm.name.trim().split(' ')[0] || 'Student';
    const lastName = newStudentForm.name.trim().split(' ')[1] || 'Scholar';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.edwth.org`;
    const studentId = `STU-${new Date().getFullYear()}-${randomDigits}`;
    const password = `${firstName}#Lumina${Math.floor(10 + Math.random() * 89)}!`;

    setNewStudentForm((prev) => ({
      ...prev,
      email,
      studentId,
      password
    }));
  };

  const handleCreateStudentSubmit = async (e) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    const targetTenantId = effectiveCollegeId || modalSelectedInstitution?._id || modalSelectedInstitution?.id || selectedInstitution?._id || selectedInstitution?.id || (isSuperAdmin ? null : user?.tenantId);
    if (!targetTenantId) {
      addToast?.('Institution Required', 'Please select a specific school or college before provisioning a student.', 'amber');
      return;
    }

    const effectiveIsSchool = modalSelectedInstitution ? (modalSelectedInstitution.institutionType === 'school') : isSchool;

    let payload = {
      tenantId: targetTenantId,
      collegeId: targetTenantId,
      name: newStudentForm.name.trim(),
      email: newStudentForm.email || undefined,
      password: newStudentForm.password || undefined,
      studentId: newStudentForm.studentId || undefined,
      phone: newStudentForm.phone || undefined,
      address: newStudentForm.address || undefined
    };

    if (effectiveIsSchool) {
      payload = {
        ...payload,
        standard: newStudentForm.standard,
        group: newStudentForm.group,
        section: newStudentForm.section,
        rollNumber: newStudentForm.rollNumber || undefined,
        medium: newStudentForm.medium,
        parentName: newStudentForm.parentName || undefined,
        parentPhone: newStudentForm.parentPhone || undefined,
        dob: newStudentForm.dob || undefined,
        gender: newStudentForm.gender || undefined,
        academicYear: newStudentForm.academicYear || '2026-2027',
        className: `${newStudentForm.standard}-${newStudentForm.section}`
      };
    } else {
      payload = {
        ...payload,
        major: newStudentForm.major,
        department: newStudentForm.department,
        year: newStudentForm.year,
        gpa: newStudentForm.gpa || undefined
      };
    }

    const result = await addStudent(payload);
    if (result) {
      const created = result.student || result;
      if (scopedStudents !== null) {
        setScopedStudents((prev) => [created, ...(prev || [])]);
      }
      setAddModalOpen(false);
      setNewStudentForm({
        name: '',
        standard: 'Class 11',
        group: 'Group I (MPC)',
        section: 'A',
        rollNumber: '',
        medium: 'English',
        parentName: '',
        parentPhone: '',
        dob: '',
        gender: 'Male',
        academicYear: '2026-2027',
        major: 'Computer Science & AI',
        department: 'School of Computing',
        year: 'Junior (Year 3)',
        gpa: '',
        email: '',
        studentId: '',
        password: '',
        role: 'Student',
        phone: '',
        address: '',
        enrolledCourses: []
      });

      const credentialPassword = result.temporaryPassword || payload.password;
      if (credentialPassword) {
        setCreatedCredentialInfo({
          studentName: created.name || payload.name,
          studentId: created.studentId || created.id || result.loginIdentifier || 'Allocated',
          email: created.email || payload.email,
          temporaryPassword: credentialPassword,
          isTemporaryPassword: Boolean(result.temporaryPassword)
        });
      }
    }
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    if (!editStudentModal) return;

    setEditError('');
    setIsSubmittingEdit(true);

    try {
      const payload = {
        name: editStudentModal.name?.trim(),
        phone: editStudentModal.phone || '',
        address: editStudentModal.address || '',
        accountStatus: editStudentModal.accountStatus || 'Active',
        status: editStudentModal.status || 'Active'
      };

      if (isSchool) {
        payload.standard = editStudentModal.standard || editStudentModal.schoolProfile?.standard || '';
        payload.group = editStudentModal.group || editStudentModal.schoolProfile?.group || '';
        payload.section = editStudentModal.section || editStudentModal.schoolProfile?.section || '';
        payload.rollNumber = editStudentModal.rollNumber || editStudentModal.schoolProfile?.rollNumber || '';
        payload.medium = editStudentModal.medium || editStudentModal.schoolProfile?.medium || 'English';
        payload.parentName = editStudentModal.parentName || editStudentModal.schoolProfile?.parentName || '';
        payload.parentPhone = editStudentModal.parentPhone || editStudentModal.schoolProfile?.parentPhone || '';
        payload.dob = editStudentModal.dob || editStudentModal.schoolProfile?.dob || '';
        payload.gender = editStudentModal.gender || editStudentModal.schoolProfile?.gender || '';
        payload.className = payload.standard ? (payload.section ? `${payload.standard}-${payload.section}` : payload.standard) : '';
      } else {
        payload.major = editStudentModal.major || '';
        payload.department = editStudentModal.department || '';
        payload.year = editStudentModal.year || '';
        const gpaVal = editStudentModal.stats?.gpa || editStudentModal.gpa;
        if (gpaVal !== undefined && gpaVal !== '') {
          payload.stats = { ...(editStudentModal.stats || {}), gpa: String(gpaVal) };
        }
      }

      const res = await updateStudent(editStudentModal.id || editStudentModal._id, payload);

      if (res && res.success) {
        setEditStudentModal(null);
        setEditError('');
      } else {
        setEditError(res?.message || 'Failed to update student profile.');
      }
    } catch (err) {
      setEditError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Student Dossier View
  const handleOpenDossier = async (student) => {
    setViewingStudentDossier(student);
    setDossierLoading(true);
    try {
      const res = await apiService.getStudentDetail(student._id || student.id);
      if (res?.success && res.student) {
        setViewingStudentDossier(res.student);
      }
    } catch (e) {
      console.error('Error fetching dossier:', e);
    } finally {
      setDossierLoading(false);
    }
  };

  // Handle Single Student Delete
  const handleConfirmSingleDelete = async () => {
    if (!studentToDelete) return;
    setIsDeletingSingle(true);
    try {
      const targetId = studentToDelete._id || studentToDelete.id || studentToDelete.studentId;
      const res = await deleteStudent(targetId, deletePermanentChoice);
      if (res && res.success) {
        setScopedStudents((prev) => (prev || []).filter(
          (s) => s._id !== targetId && s.id !== targetId && s.studentId !== targetId
        ));
      }
      setStudentToDelete(null);
      setDeletePermanentChoice(false);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Handle Restore Student
  const handleRestoreStudent = async (st) => {
    const targetId = st._id || st.id || st.studentId;
    setRestoringStudentId(targetId);
    try {
      const res = await restoreStudent(targetId);
      if (res && res.success) {
        addToast?.('Student Restored', `Account for ${st.name || 'student'} has been reactivated.`, 'emerald');
        if (res.student) {
          setScopedStudents((prev) => (prev || []).map((s) => 
            (s._id === targetId || s.id === targetId || s.studentId === targetId)
              ? { ...s, ...res.student, status: 'active', isDeleted: false }
              : s
          ));
        }
      } else {
        addToast?.('Restore Failed', res?.message || 'Failed to restore student.', 'rose');
      }
    } catch (err) {
      addToast?.('Error', err.message || 'Error restoring student', 'rose');
    } finally {
      setRestoringStudentId(null);
    }
  };

  // Handle Bulk Selection
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === paginatedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(paginatedStudents.map(s => s._id || s.id));
    }
  };

  const handleToggleSelectStudent = (id) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Handle Bulk Delete Submit
  const handleBulkDeleteSubmit = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await apiService.bulkDeleteStudents(selectedStudentIds, bulkPermanent);
      if (res?.success) {
        addToast?.(
          bulkPermanent ? 'Bulk Permanent Deletion' : 'Bulk Deactivation',
          res.message || `Processed ${selectedStudentIds.length} students.`,
          'emerald'
        );
        const deletedSet = new Set(selectedStudentIds);
        setScopedStudents((prev) => (prev || []).filter(
          (s) => !deletedSet.has(s._id) && !deletedSet.has(s.id) && !deletedSet.has(s.studentId)
        ));
        setSelectedStudentIds([]);
        setBulkActionModalOpen(false);
      } else {
        alert(res?.message || 'Failed to execute bulk deletion');
      }
    } catch (err) {
      alert('Error during bulk action: ' + err.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Filtered and Sorted Students
  const safeStudents = Array.isArray(students) ? students : [];

  const filteredStudents = safeStudents
    .filter((s) => {
      if (!s) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      const name = (s.name || '').toLowerCase();
      const studentId = (s.studentId || s.id || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const roll = (s.rollNumber || s.schoolProfile?.rollNumber || '').toLowerCase();
      const grp = (s.group || s.schoolProfile?.group || s.major || '').toLowerCase();
      const guardian = (s.parentName || s.schoolProfile?.parentName || s.emergencyContact?.name || '').toLowerCase();

      const matchesSearch = !q || (
        name.includes(q) ||
        studentId.includes(q) ||
        email.includes(q) ||
        roll.includes(q) ||
        grp.includes(q) ||
        guardian.includes(q)
      );

      // Class filtering for School Mode
      let matchesClassOrYear = true;
      if (isSchool) {
        if (filterClass !== 'all') {
          const std = (s.standard || s.schoolProfile?.standard || s.className || '').toLowerCase();
          matchesClassOrYear = std.includes(filterClass.toLowerCase());
        }
        if (matchesClassOrYear && filterGroup !== 'all') {
          const studentGrp = (s.group || s.schoolProfile?.group || '').toLowerCase();
          matchesClassOrYear = studentGrp.includes(filterGroup.toLowerCase());
        }
      } else {
        const yearStr = (s.year || s.className || '').toLowerCase();
        matchesClassOrYear = filterYear === 'all' || yearStr.includes(filterYear.toLowerCase());
      }

      const statusStr = (s.accountStatus || s.status || '').toLowerCase();
      const matchesStatus = filterStatus === 'all' || statusStr === filterStatus.toLowerCase();

      return matchesSearch && matchesClassOrYear && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'id') return (a.studentId || a.id || '').localeCompare(b.studentId || b.id || '');
      if (sortBy === 'gpa' && !isSchool) {
        return parseFloat(b.stats?.gpa || b.gpa || 0) - parseFloat(a.stats?.gpa || a.gpa || 0);
      }
      return 0;
    });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Statistics Calculation
  const totalRegistered = safeStudents.length;
  let class11Count = 0;
  let class12Count = 0;
  safeStudents.forEach(st => {
    const std = (st.standard || st.schoolProfile?.standard || st.className || '').toLowerCase();
    if (std.includes('11')) class11Count++;
    else if (std.includes('12')) class12Count++;
  });

  const avgGpa = !isSchool
    ? (safeStudents.reduce((acc, s) => acc + parseFloat(s?.stats?.gpa || s?.gpa || 0), 0) / (safeStudents.length || 1)).toFixed(2)
    : null;

  // RESTRICTED VIEW WHEN NOT LOGGED IN AS STAFF
  if (!hasTeamAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '2rem 1rem' }}>
        <div className="card" style={{ maxWidth: '580px', width: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: '#FEF3C7', border: '1.5px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={36} color="#D97706" strokeWidth={2.2} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.7rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '0.5rem' }}>
              Team & Faculty Clearance Required
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5, maxWidth: '440px' }}>
              Access is restricted strictly to authorized platform administrators and educators.
            </p>
          </div>
          <button
            onClick={() => isTeamUser ? setIsLocked(false) : setLoginModalOpen(true)}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          >
            <Unlock size={17} strokeWidth={2.5} />
            <span>{isTeamUser ? 'Unlock Data Sheet' : 'Login as Administrator'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* SuperAdmin Active Context Banner */}
      {isSuperAdmin && hasResolvedType && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-default)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {isSchool ? <School size={18} color="var(--accent-primary)" /> : <Building size={18} color="#10B981" />}
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Active Institution Context:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {effectiveSchool?.name || 'Selected Institution'}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.12rem 0.45rem',
                  borderRadius: '4px',
                  backgroundColor: isSchool ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: isSchool ? 'var(--accent-primary)' : '#10B981'
                }}>
                  {isSchool ? 'School Mode (Class 11 & 12)' : 'College Mode'}
                </span>
                {effectiveSchool?.code && (
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    ({effectiveSchool.code})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                if (setSelectedInstitution) setSelectedInstitution(null);
                setScopedStudents(null);
              }}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              Switch Institution
            </button>
          </div>
        </div>
      )}

      {/* INSTITUTION CONTEXT SELECTOR (When no institution has been selected) */}
      {!hasResolvedType ? (
        <div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center', maxWidth: '780px', margin: '1rem auto' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <School size={28} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            Select an Institution to Manage Students
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 1.75rem auto', lineHeight: 1.5 }}>
            To view student rosters, manage academic records, and provision student logins, please choose a participating school (School Mode) or affiliated college (College Mode).
          </p>

          {loadingInstitutions ? (
            <div style={{ padding: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <RefreshCw size={18} className="animate-spin" /> Loading available institutions...
            </div>
          ) : availableInstitutions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', textAlign: 'left' }}>
              {availableInstitutions.map((inst) => {
                const isInstSchool = inst.institutionType === 'school';
                return (
                  <div
                    key={inst._id || inst.id}
                    data-institution-id={inst._id || inst.id}
                    onClick={() => {
                      if (setSelectedInstitution) setSelectedInstitution(inst);
                    }}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: isInstSchool ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isInstSchool ? 'var(--accent-primary)' : '#10B981'
                        }}>
                          {isInstSchool ? 'School Mode (Class 11 & 12)' : 'College Mode'}
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Code: {inst.code}
                        </span>
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {inst.name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {isInstSchool ? 'Classes 11 & 12 Roster' : 'Higher Ed Roster'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (setSelectedInstitution) setSelectedInstitution(inst);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Open Roster <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0 }}>
                No active institutions found. Please register a school in Multi-School Operations or an institution in Institution Directory first.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top Banner & Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-emerald">Team Console</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: isSchool ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: isSchool ? 'var(--accent-primary)' : '#10B981'
                }}>
                  {isSchool ? 'School Mode (Class 11 & 12)' : 'College Mode'}
                </span>
              </div>
              <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                {isSchool ? 'School Student Roster & Records' : 'Student Data Sheet & Login Credentials'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                {isSchool
                  ? 'Class 11 & 12 student registries, academic stream groupings, guardian contacts, and login provisioning'
                  : 'Store student profiles, generate secure passwords, manage enrollment data, and export rosters'}
              </p>
            </div>

            {/* Global Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => exportStudentsData('csv')}
                className="btn-secondary"
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  console.log('[DIAGNOSTIC] opening Add Student modal:', {
                    effectiveInstitutionType,
                    isSchool,
                    effectiveCollegeId,
                    schoolName: effectiveSchool?.name,
                    source: 'StudentsDataSheetView'
                  });
                  setAddModalOpen(true);
                  generateNewCredentials();
                }}
                className="btn-primary"
                style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>{isSchool ? 'Register School Student' : 'Add Student & Generate Login'}</span>
              </button>
            </div>
          </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Students
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalRegistered}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Authorized In Roster
          </div>
        </div>

        {isSchool ? (
          <>
            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Class 11
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>
                {class11Count}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Class 11 Scholars
              </div>
            </div>

            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Class 12
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706' }}>
                {class12Count}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Class 12 Senior Scholars
              </div>
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Average GPA
              </span>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EEF2FF', color: 'var(--accent-academic)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={16} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {avgGpa || 'N/A'} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 4.00</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-academic)', marginTop: '2px' }}>
              College Honors Average
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Operating Mode
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {isSchool ? 'School Mode' : 'College Mode'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Isolated Tenant Scope
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={isSchool ? "Search by Name, Roll No, ID, Stream Group, or Guardian..." : "Search by Student Name, ID, Email, or Major..."}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '0.3rem 0',
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="btn-icon" style={{ width: '24px', height: '24px' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dynamic Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isSchool ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <Filter size={13} />
                <span>Class:</span>
                <select
                  value={filterClass}
                  onChange={(e) => {
                    setFilterClass(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                >
                  <option value="all">All Classes</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>Stream:</span>
                <select
                  value={filterGroup}
                  onChange={(e) => {
                    setFilterGroup(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                >
                  <option value="all">All Streams</option>
                  <option value="mpc">Group I (MPC)</option>
                  <option value="bpc">Group II (BPC)</option>
                  <option value="pure science">Group III (Pure Science)</option>
                  <option value="commerce">Group IV (Commerce)</option>
                  <option value="arts">Arts / Humanities</option>
                  <option value="vocational">Vocational</option>
                </select>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <Filter size={13} />
              <span>Year:</span>
              <select
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
              >
                <option value="all">All Years</option>
                <option value="year 1">Year 1</option>
                <option value="year 2">Year 2</option>
                <option value="year 3">Year 3</option>
                <option value="year 4">Year 4</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Floating Toolbar */}
      {selectedStudentIds.length > 0 && (
        <div style={{
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            <CheckSquare size={16} />
            <span>{selectedStudentIds.length} student(s) selected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setBulkPermanent(false);
                setBulkActionModalOpen(true);
              }}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Bulk Deactivate
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkPermanent(true);
                setBulkActionModalOpen(true);
              }}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Bulk Permanently Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Students Data Sheet Table */}
      <div className="card table-responsive-wrapper" style={{ padding: 0, border: '1px solid var(--border-default)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '0.85rem 1rem', width: '36px' }}>
                <input
                  type="checkbox"
                  checked={paginatedStudents.length > 0 && selectedStudentIds.length === paginatedStudents.length}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '0.85rem 1rem' }}>Student Profile</th>
              <th style={{ padding: '0.85rem 1rem' }}>Student ID</th>
              {isSchool ? (
                <>
                  <th style={{ padding: '0.85rem 1rem' }}>Class & Section</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Stream / Group</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Roll No</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Guardian Contact</th>
                </>
              ) : (
                <>
                  <th style={{ padding: '0.85rem 1rem' }}>Email / Login ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Major & Dept</th>
                  <th style={{ padding: '0.85rem 1rem' }}>GPA</th>
                </>
              )}
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedStudents.length > 0 ? (
              paginatedStudents.map((st, index) => {
                const sId = st._id || st.id;
                const isSelected = selectedStudentIds.includes(sId);
                const isCurrentUser = user.id === sId || user.studentId === st.studentId;

                return (
                  <tr
                    key={sId}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : (index % 2 === 0 ? '#FFFFFF' : 'var(--bg-surface-subtle)'),
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectStudent(sId)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Student Profile */}
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            color: '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            flexShrink: 0
                          }}
                        >
                          {(st.name || 'S').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{st.name}</span>
                            {isCurrentUser && (
                              <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#059669', fontWeight: 800 }}>
                                YOU
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {st.email || 'No email registered'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Student ID */}
                    <td style={{ padding: '0.8rem 1rem', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-learning)' }}>{st.studentId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(st.studentId, `id_${sId}`)}
                          className="btn-icon"
                          style={{ width: '20px', height: '20px', border: 'none', background: 'transparent' }}
                          title="Copy Student ID"
                        >
                          {copiedField === `id_${sId}` ? <Check size={11} color="var(--accent-primary)" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>

                    {/* School vs College Columns */}
                    {isSchool ? (
                      <>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {st.standard || st.className || 'Class 11'}
                          </span>
                          {st.section && (
                            <span style={{ marginLeft: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              ({st.section})
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.8rem 1rem' }}>
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            color: 'var(--accent-primary)'
                          }}>
                            {st.group || st.schoolProfile?.group || 'General Academic'}
                          </span>
                        </td>

                        <td style={{ padding: '0.8rem 1rem', fontFamily: 'var(--font-mono)' }}>
                          {st.rollNumber || st.schoolProfile?.rollNumber || '—'}
                        </td>

                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {st.parentName || st.emergencyContact?.name || '—'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {st.parentPhone || st.emergencyContact?.phone || ''}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '0.8rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {st.email}
                        </td>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{st.major}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{st.department}</div>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                          {st.stats?.gpa || st.gpa || '—'}
                        </td>
                      </>
                    )}

                    {/* Status */}
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: (st.accountStatus === 'Active' || st.status === 'Active') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: (st.accountStatus === 'Active' || st.status === 'Active') ? '#10B981' : '#EF4444',
                          fontWeight: 700
                        }}
                      >
                        {st.accountStatus || st.status || 'Active'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDossier(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="View Student Dossier"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditStudentModal(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="Edit Student Record"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setResetTargetStudent(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#D97706' }}
                          title="Reset Password"
                        >
                          <KeyRound size={13} />
                        </button>

                        {st.status === 'inactive' && (
                          <button
                            type="button"
                            onClick={() => handleRestoreStudent(st)}
                            disabled={restoringStudentId === (st._id || st.id || st.studentId)}
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', color: '#10B981' }}
                            title="Reactivate / Restore Student Account"
                          >
                            <UserCheck size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setStudentToDelete(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#EF4444' }}
                          title="Delete / Deactivate"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isSchool ? 9 : 8} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    No students match your filter criteria
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Try clearing filters or register a new student to begin.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>Prev</button>
            <span style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>Next</button>
          </div>
        )}
      </div>
      </>
    )}

      {/* MODAL: ADD STUDENT (MODE-AWARE) */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                {(() => {
                  const isSchoolForm = modalSelectedInstitution ? (modalSelectedInstitution.institutionType === 'school') : isSchool;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
                          {isSchoolForm ? 'Register School Student' : 'Register College Student'}
                        </h3>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent-primary)' }}>
                          {isSchoolForm ? 'School Mode' : 'College Mode'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                        {isSchoolForm
                          ? 'Provision Class 11 or 12 student profile with stream, section, and guardian details.'
                          : 'Auto-generates student ID, institutional email, and secure password.'}
                      </p>
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setAddModalOpen(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {isSuperAdmin && !effectiveCollegeId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Select Target Institution *
                  </label>
                  <select
                    required
                    value={modalSelectedInstitution?._id || modalSelectedInstitution?.id || ''}
                    onChange={(e) => {
                      const chosen = availableInstitutions.find(i => (i._id || i.id) === e.target.value);
                      setModalSelectedInstitution(chosen || null);
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Choose School or College --</option>
                    {availableInstitutions.map((inst) => (
                      <option key={inst._id || inst.id} value={inst._id || inst.id}>
                        {inst.name} ({inst.institutionType === 'school' ? 'School Mode - Classes 11 & 12' : 'College Mode'} - Code: {inst.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Full Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStudentForm.name}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, name: e.target.value }))}
                    onBlur={generateNewCredentials}
                    placeholder="e.g. Aarav Sharma"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                {(modalSelectedInstitution ? (modalSelectedInstitution.institutionType === 'school') : isSchool) ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Standard / Class *
                    </label>
                    <select
                      value={newStudentForm.standard}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, standard: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    >
                      <option value="Class 11">Class 11</option>
                      <option value="Class 12">Class 12</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Major & Field of Study
                    </label>
                    <input
                      type="text"
                      value={newStudentForm.major}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, major: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              {/* School Profile Fields */}
              {(modalSelectedInstitution ? (modalSelectedInstitution.institutionType === 'school') : isSchool) ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Academic Stream / Group *
                      </label>
                      <select
                        value={newStudentForm.group}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, group: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="Group I (MPC)">Group I (MPC) — Maths, Physics, Chemistry</option>
                        <option value="Group II (BPC)">Group II (BPC) — Biology, Physics, Chemistry</option>
                        <option value="Group III (Pure Science)">Group III (Pure Science) — Pure Science</option>
                        <option value="Group IV (Commerce)">Group IV (Commerce) — Commerce & Accounts</option>
                        <option value="Arts / Humanities">Arts / Humanities</option>
                        <option value="Vocational">Vocational Studies</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Section *
                      </label>
                      <select
                        value={newStudentForm.section}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, section: e.target.value.toUpperCase() }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Roll Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 11A-042"
                        value={newStudentForm.rollNumber}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, rollNumber: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Medium of Instruction
                      </label>
                      <select
                        value={newStudentForm.medium}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, medium: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Gender
                      </label>
                      <select
                        value={newStudentForm.gender}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, gender: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={newStudentForm.dob}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, dob: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Parent / Guardian Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Sharma"
                        value={newStudentForm.parentName}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, parentName: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Guardian Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +91 9876543210"
                        value={newStudentForm.parentPhone}
                        onChange={(e) => setNewStudentForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Academic Year
                    </label>
                    <select
                      value={newStudentForm.year}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, year: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    >
                      <option value="Freshman (Year 1)">Freshman (Year 1)</option>
                      <option value="Sophomore (Year 2)">Sophomore (Year 2)</option>
                      <option value="Junior (Year 3)">Junior (Year 3)</option>
                      <option value="Senior (Year 4)">Senior (Year 4)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Initial GPA
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="4.00"
                      value={newStudentForm.gpa}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, gpa: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {/* Login Credentials Slip */}
              <div style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <KeyRound size={14} /> Student Login Account
                  </span>
                  <button
                    type="button"
                    onClick={generateNewCredentials}
                    style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Student ID</span>
                    <input
                      type="text"
                      value={newStudentForm.studentId}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, studentId: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Login Email</span>
                    <input
                      type="email"
                      value={newStudentForm.email}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, email: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Temporary Initial Password</span>
                  <input
                    type="text"
                    value={newStudentForm.password}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, password: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.35rem' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={15} />
                  <span>Register Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT PROFILE (MODE-AWARE) */}
      {editStudentModal && (
        <div className="modal-overlay" onClick={() => setEditStudentModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
                  Edit Student Profile
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Update records for {editStudentModal.name} ({editStudentModal.studentId})
                </p>
              </div>
              <button onClick={() => setEditStudentModal(null)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editStudentModal.name || ''}
                  onChange={(e) => setEditStudentModal({ ...editStudentModal, name: e.target.value })}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              {isSchool ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Standard / Class
                      </label>
                      <select
                        value={editStudentModal.standard || editStudentModal.schoolProfile?.standard || 'Class 11'}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, standard: e.target.value })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <option value="Class 11">Class 11</option>
                        <option value="Class 12">Class 12</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Section
                      </label>
                      <input
                        type="text"
                        value={editStudentModal.section || editStudentModal.schoolProfile?.section || 'A'}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, section: e.target.value.toUpperCase() })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Academic Stream / Group
                      </label>
                      <input
                        type="text"
                        value={editStudentModal.group || editStudentModal.schoolProfile?.group || ''}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, group: e.target.value })}
                        placeholder="e.g. Group I (MPC)"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Roll Number
                      </label>
                      <input
                        type="text"
                        value={editStudentModal.rollNumber || editStudentModal.schoolProfile?.rollNumber || ''}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, rollNumber: e.target.value })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Parent / Guardian Name
                      </label>
                      <input
                        type="text"
                        value={editStudentModal.parentName || editStudentModal.schoolProfile?.parentName || ''}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, parentName: e.target.value })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        Parent / Guardian Phone
                      </label>
                      <input
                        type="text"
                        value={editStudentModal.parentPhone || editStudentModal.schoolProfile?.parentPhone || ''}
                        onChange={(e) => setEditStudentModal({ ...editStudentModal, parentPhone: e.target.value })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Major
                    </label>
                    <input
                      type="text"
                      value={editStudentModal.major || ''}
                      onChange={(e) => setEditStudentModal({ ...editStudentModal, major: e.target.value })}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Cumulative GPA
                    </label>
                    <input
                      type="text"
                      value={editStudentModal.stats?.gpa || editStudentModal.gpa || ''}
                      onChange={(e) => setEditStudentModal({ ...editStudentModal, gpa: e.target.value })}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Student Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.phone || ''}
                    onChange={(e) => setEditStudentModal({ ...editStudentModal, phone: e.target.value })}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Account Status
                  </label>
                  <select
                    value={editStudentModal.accountStatus || editStudentModal.status || 'Active'}
                    onChange={(e) => setEditStudentModal({ ...editStudentModal, accountStatus: e.target.value, status: e.target.value })}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {editError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', padding: '0.65rem', color: '#EF4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditStudentModal(null)} className="btn-secondary" disabled={isSubmittingEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmittingEdit}>
                  {isSubmittingEdit ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW STUDENT DOSSIER */}
      {viewingStudentDossier && (
        <div className="modal-overlay" onClick={() => setViewingStudentDossier(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '620px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem'
                }}>
                  {(viewingStudentDossier.name || 'S').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {viewingStudentDossier.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {viewingStudentDossier.studentId}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: 700 }}>
                      {viewingStudentDossier.accountStatus || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingStudentDossier(null)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Academic Overview Box */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {isSchool ? 'School Academic Registry' : 'College Academic Record'}
                </div>
                {isSchool ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div>Class & Section: <strong>{viewingStudentDossier.standard || viewingStudentDossier.className || 'Class 11'} ({viewingStudentDossier.section || 'A'})</strong></div>
                    <div>Stream / Group: <strong>{viewingStudentDossier.group || viewingStudentDossier.schoolProfile?.group || 'General'}</strong></div>
                    <div>Roll Number: <strong>{viewingStudentDossier.rollNumber || viewingStudentDossier.schoolProfile?.rollNumber || 'Not assigned'}</strong></div>
                    <div>Medium: <strong>{viewingStudentDossier.medium || viewingStudentDossier.schoolProfile?.medium || 'English'}</strong></div>
                    <div>Academic Session: <strong>{viewingStudentDossier.schoolProfile?.academicYear || '2026-2027'}</strong></div>
                    <div>Gender: <strong>{viewingStudentDossier.gender || viewingStudentDossier.schoolProfile?.gender || 'Not specified'}</strong></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div>Major: <strong>{viewingStudentDossier.major || 'General Academic'}</strong></div>
                    <div>Department: <strong>{viewingStudentDossier.department || 'General Education'}</strong></div>
                    <div>Year: <strong>{viewingStudentDossier.year || 'Year 1'}</strong></div>
                    <div>Cumulative GPA: <strong>{viewingStudentDossier.stats?.gpa || viewingStudentDossier.gpa || 'N/A'}</strong></div>
                  </div>
                )}
              </div>

              {/* Guardian & Contact Info Box */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Guardian & Contact Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', fontSize: '0.82rem' }}>
                  <div>Parent / Guardian: <strong>{viewingStudentDossier.parentName || viewingStudentDossier.emergencyContact?.name || 'Not provided'}</strong></div>
                  <div>Guardian Phone: <strong>{viewingStudentDossier.parentPhone || viewingStudentDossier.emergencyContact?.phone || 'Not provided'}</strong></div>
                  <div>Student Email: <strong>{viewingStudentDossier.email}</strong></div>
                  <div>Student Phone: <strong>{viewingStudentDossier.phone || 'Not provided'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}>Address: <strong>{viewingStudentDossier.address || 'Not registered'}</strong></div>
                </div>
              </div>

              {/* Attendance & Session Participation */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Verified Attendance Record
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Verified Attendance Rate:</span>
                  <strong>
                    {viewingStudentDossier.calculatedAttendanceRate !== null && viewingStudentDossier.calculatedAttendanceRate !== undefined
                      ? `${viewingStudentDossier.calculatedAttendanceRate}%`
                      : '0 sessions recorded'}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setViewingStudentDossier(null)} className="btn-secondary">
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SINGLE STUDENT DELETE (DEACTIVATE VS PERMANENT) */}
      {studentToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '14px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            maxWidth: '500px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#EF4444', marginBottom: '0.75rem' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Delete Student Record
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Choose how you want to remove <strong>{studentToDelete.name}</strong> ({studentToDelete.studentId}):
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem',
                borderRadius: '8px',
                border: !deletePermanentChoice ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                backgroundColor: !deletePermanentChoice ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="deleteChoice"
                  checked={!deletePermanentChoice}
                  onChange={() => setDeletePermanentChoice(false)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Deactivate Account (Recommended)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Soft-deletes the student, revokes login sessions, but preserves all historical attendance, submissions, and academic records.
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem',
                borderRadius: '8px',
                border: deletePermanentChoice ? '2px solid #EF4444' : '1px solid var(--border-default)',
                backgroundColor: deletePermanentChoice ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="deleteChoice"
                  checked={deletePermanentChoice}
                  onChange={() => setDeletePermanentChoice(true)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#EF4444' }}>
                    Permanently Delete from Database
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Irreversibly purges the student record, attendance marks, submissions, and credentials from the institution database.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setStudentToDelete(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleConfirmSingleDelete}
                style={{
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  backgroundColor: deletePermanentChoice ? '#EF4444' : 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDeletingSingle ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeletingSingle ? 'Processing...' : (deletePermanentChoice ? 'Permanently Delete' : 'Deactivate Student')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK DELETE ACTION */}
      {bulkActionModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '14px',
            border: '1px solid var(--border-default)',
            maxWidth: '480px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <AlertTriangle size={24} color={bulkPermanent ? '#EF4444' : '#D97706'} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {bulkPermanent ? 'Bulk Permanent Deletion' : 'Bulk Deactivation'}
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              You have selected <strong>{selectedStudentIds.length}</strong> student record(s).
            </p>

            <div style={{
              backgroundColor: bulkPermanent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(217, 119, 6, 0.08)',
              border: `1px solid ${bulkPermanent ? 'rgba(239, 68, 68, 0.25)' : 'rgba(217, 119, 6, 0.25)'}`,
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.25rem'
            }}>
              {bulkPermanent
                ? 'Warning: This will permanently erase the selected student profiles and all their associated attendance and assessment records from MongoDB. This cannot be undone.'
                : 'Selected student accounts will be marked inactive and prevented from signing in. All historical academic records remain preserved.'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={() => setBulkActionModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={handleBulkDeleteSubmit}
                style={{
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  backgroundColor: bulkPermanent ? '#EF4444' : 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isBulkProcessing ? 'Executing...' : (bulkPermanent ? `Delete ${selectedStudentIds.length} Records` : `Deactivate ${selectedStudentIds.length} Students`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SECURE STUDENT PASSWORD RESET */}
      <ResetStudentPasswordModal
        isOpen={!!resetTargetStudent}
        student={resetTargetStudent}
        educatorLabel={terms?.educatorLabel || 'Educator'}
        onClose={() => setResetTargetStudent(null)}
        onConfirmReset={async (id) => {
          return await resetStudentPassword(id);
        }}
      />

      {/* MODAL: ONE-TIME CREDENTIAL CONFIRMATION */}
      <CredentialConfirmationModal
        isOpen={Boolean(createdCredentialInfo)}
        credentialData={createdCredentialInfo}
        onClose={() => setCreatedCredentialInfo(null)}
      />
    </div>
  );
};
