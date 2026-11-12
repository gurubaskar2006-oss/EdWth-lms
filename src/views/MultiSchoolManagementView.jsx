import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { apiService } from '../services/apiService';
import { StudentsDataSheetView } from './StudentsDataSheetView';
import {
  School,
  Building,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Eye,
  FileText,
  UserCheck,
  Send,
  BarChart3,
  Search,
  Filter,
  Shield,
  Layers,
  ArrowRight,
  Trash2,
  Archive,
  RefreshCw,
  AlertTriangle,
  X
} from 'lucide-react';

export const MultiSchoolManagementView = () => {
  usePageTitle('Multi-School Training Management');
  const { user, addToast, setSelectedInstitution, selectedInstitution, setLoginModalOpen } = useLMS();

  const isSuperAdmin = user?.role === 'superadmin';
  const [activeSection, setActiveSection] = useState('schools'); // 'schools' | 'academic' | 'students' | 'cohorts' | 'assign' | 'content' | 'performance' | 'comparison'
  const [loading, setLoading] = useState(true);

  // Core data states
  const [schools, setSchools] = useState([]);
  const [schoolsError, setSchoolsError] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [schoolPerformance, setSchoolPerformance] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [allTrainers, setAllTrainers] = useState([]);

  // Filter state for directory
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'

  // Archive & Permanent Delete States
  const [archiveLoadingId, setArchiveLoadingId] = useState(null);
  const [deleteSchoolModalOpen, setDeleteSchoolModalOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [deleteInspectionData, setDeleteInspectionData] = useState(null);
  const [deleteInspectionLoading, setDeleteInspectionLoading] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [isDeletingSchool, setIsDeletingSchool] = useState(false);

  // Academic Structure State
  const [academicConfigData, setAcademicConfigData] = useState({
    academicSession: '2026-2027',
    classesOffered: ['Class 11', 'Class 12'],
    groups: [
      { id: 'grp-mpc', name: 'Group I (MPC)', stream: 'Science', subjects: ['Mathematics', 'Physics', 'Chemistry'], description: 'Maths, Physics, Chemistry' },
      { id: 'grp-bpc', name: 'Group II (BPC)', stream: 'Science', subjects: ['Biology', 'Physics', 'Chemistry'], description: 'Biology, Physics, Chemistry' },
      { id: 'grp-pure-science', name: 'Group III (Pure Science)', stream: 'Science', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'], description: 'Pure Science' },
      { id: 'grp-commerce', name: 'Group IV (Commerce)', stream: 'Commerce', subjects: ['Commerce', 'Accountancy', 'Economics', 'Computer Applications'], description: 'Commerce & Accountancy' }
    ],
    sections: ['A', 'B', 'C'],
    mediums: ['English'],
    trainingSubjects: ['Python Programming', 'Aptitude & Logical Reasoning', 'Soft Skills']
  });
  const [academicConfigLoading, setAcademicConfigLoading] = useState(false);
  const [isSavingAcademicConfig, setIsSavingAcademicConfig] = useState(false);
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    stream: 'Science',
    subjects: '',
    description: ''
  });

  // Modals / Forms
  const [newSchoolModalOpen, setNewSchoolModalOpen] = useState(false);
  const [newSchoolData, setNewSchoolData] = useState({
    name: '',
    code: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    academicSession: '2026-2027'
  });

  const [newCohortModalOpen, setNewCohortModalOpen] = useState(false);
  const [cohortFormData, setCohortFormData] = useState({
    cohortId: null, // null for create, ID for edit
    name: '',
    targetClass: 'Class 11',
    startDate: '',
    endDate: '',
    sessionStartTime: '11:00 AM',
    sessionEndTime: '12:00 PM',
    scheduleDays: 'Mon, Tue, Wed, Thu, Fri',
    status: 'active',
    liveSessionNotes: ''
  });

  const [contentFormData, setContentFormData] = useState({
    contentType: 'homework', // 'homework' | 'assessment' | 'announcement'
    cohortId: '',
    title: '',
    description: '',
    subject: 'Python Programming',
    dueDate: '',
    points: 20,
    durationMinutes: 45
  });

  const [assignmentFormData, setAssignmentFormData] = useState({
    cohortId: '',
    className: 'Class 11',
    selectedStudentIds: [],
    selectedTrainerIds: []
  });

  // Section 3: Assignment Filters & Search State
  const [assignStudentSchoolFilter, setAssignStudentSchoolFilter] = useState('target'); // 'target' | 'unassigned' | 'all'
  const [assignStudentClassFilter, setAssignStudentClassFilter] = useState('match'); // 'match' | 'all' | 'Class 11' | 'Class 12'
  const [assignStudentSearch, setAssignStudentSearch] = useState('');
  const [assignTrainerFilter, setAssignTrainerFilter] = useState('all'); // 'all' | 'target' | 'unassigned'
  const [assignTrainerSearch, setAssignTrainerSearch] = useState('');

  // Lookup map of school ID -> School Name
  const schoolMap = useMemo(() => {
    const map = new Map();
    (schools || []).forEach((s) => {
      const sId = (s._id || s.id)?.toString();
      if (sId) map.set(sId, s.name);
    });
    return map;
  }, [schools]);

  const getStudentTenantId = (st) => {
    if (!st?.tenantId) return null;
    return (typeof st.tenantId === 'object' ? (st.tenantId._id || st.tenantId.id) : st.tenantId)?.toString();
  };

  const getStudentClass = (st) => {
    return st.standard || st.schoolProfile?.standard || (st.className && st.className.includes('11') ? 'Class 11' : (st.className && st.className.includes('12') ? 'Class 12' : st.className)) || '';
  };

  const targetSchoolStudentCount = useMemo(() => {
    if (!selectedSchoolId) return 0;
    return (allStudents || []).filter((st) => getStudentTenantId(st) === selectedSchoolId.toString()).length;
  }, [allStudents, selectedSchoolId]);

  const unassignedStudentCount = useMemo(() => {
    return (allStudents || []).filter((st) => {
      const tId = getStudentTenantId(st);
      return !tId || !schoolMap.has(tId);
    }).length;
  }, [allStudents, schoolMap]);

  const filteredStudentsForAssignment = useMemo(() => {
    return (allStudents || []).filter((st) => {
      const stTenantId = getStudentTenantId(st);
      const isTarget = Boolean(stTenantId && selectedSchoolId && stTenantId === selectedSchoolId.toString());
      const isUnassigned = !stTenantId || !schoolMap.has(stTenantId);

      // School Affiliation Filter
      if (assignStudentSchoolFilter === 'target' && !isTarget) return false;
      if (assignStudentSchoolFilter === 'unassigned' && !isUnassigned) return false;

      // Class Filter
      const activeClassTarget = assignStudentClassFilter === 'match' ? assignmentFormData.className : assignStudentClassFilter;
      if (activeClassTarget && activeClassTarget !== 'all') {
        const std = getStudentClass(st);
        if (activeClassTarget.includes('11') && !std.includes('11') && !st.className?.includes('11')) return false;
        if (activeClassTarget.includes('12') && !std.includes('12') && !st.className?.includes('12')) return false;
      }

      // Search Filter
      if (assignStudentSearch.trim()) {
        const q = assignStudentSearch.toLowerCase().trim();
        const nameMatch = (st.name || '').toLowerCase().includes(q);
        const emailMatch = (st.email || '').toLowerCase().includes(q);
        const idMatch = (st.studentId || st.id || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch) return false;
      }

      return true;
    });
  }, [allStudents, selectedSchoolId, assignStudentSchoolFilter, assignStudentClassFilter, assignmentFormData.className, assignStudentSearch, schoolMap]);

  const getTrainerTenantId = (tr) => {
    if (!tr?.tenantId) return null;
    return (typeof tr.tenantId === 'object' ? (tr.tenantId._id || tr.tenantId.id) : tr.tenantId)?.toString();
  };

  const targetSchoolTrainerCount = useMemo(() => {
    if (!selectedSchoolId) return 0;
    return (allTrainers || []).filter((tr) => getTrainerTenantId(tr) === selectedSchoolId.toString()).length;
  }, [allTrainers, selectedSchoolId]);

  const unassignedTrainerCount = useMemo(() => {
    return (allTrainers || []).filter((tr) => {
      const tId = getTrainerTenantId(tr);
      return !tId || !schoolMap.has(tId);
    }).length;
  }, [allTrainers, schoolMap]);

  const filteredTrainersForAssignment = useMemo(() => {
    return (allTrainers || []).filter((tr) => {
      const trTenantId = getTrainerTenantId(tr);
      const isTarget = Boolean(trTenantId && selectedSchoolId && trTenantId === selectedSchoolId.toString());
      const isUnassigned = !trTenantId || !schoolMap.has(trTenantId);

      if (assignTrainerFilter === 'target' && !isTarget) return false;
      if (assignTrainerFilter === 'unassigned' && !isUnassigned) return false;

      if (assignTrainerSearch.trim()) {
        const q = assignTrainerSearch.toLowerCase().trim();
        const nameMatch = (tr.name || '').toLowerCase().includes(q);
        const emailMatch = (tr.email || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [allTrainers, selectedSchoolId, assignTrainerFilter, assignTrainerSearch, schoolMap]);

  // Load all schools
  const loadSchools = async (status = directoryStatusFilter) => {
    setLoading(true);
    setSchoolsError(null);
    try {
      const res = await apiService.getAdminSchools();
      if (res?.success && Array.isArray(res.schools)) {
        setSchools(res.schools);
        if (res.schools.length > 0) {
          const defaultId = selectedSchoolId && res.schools.some(s => (s._id || s.id) === selectedSchoolId)
            ? selectedSchoolId
            : res.schools[0]._id || res.schools[0].id;
          setSelectedSchoolId(defaultId);
          loadSchoolDetail(defaultId);
          loadAcademicConfig(defaultId);
        } else {
          setSelectedSchool(null);
          setSelectedSchoolId('');
        }
      } else {
        const isInsufficient = res?.code === 'INSUFFICIENT_PRIVILEGES' || res?.status === 403;
        const isStale = res?.code === 'SESSION_STALE_IDENTITY_MISMATCH';
        const errorInfo = {
          code: res?.code || (isInsufficient ? 'INSUFFICIENT_PRIVILEGES' : 'FETCH_FAILED'),
          message: isInsufficient
            ? 'Insufficient Privileges (403): The active session lacks Super Admin permissions for multi-school operations.'
            : isStale
            ? 'Session Context Stale: Another browser tab authenticated with a different identity. Please log in as Super Admin.'
            : (res?.message || 'Failed to load participating schools. Please verify session credentials.')
        };
        setSchoolsError(errorInfo);
        addToast?.('Session / Fetch Notice', errorInfo.message, 'amber');
      }
    } catch (e) {
      console.error('Error loading schools:', e);
      setSchoolsError({
        code: 'NETWORK_ERROR',
        message: e.message || 'Network error loading participating schools.'
      });
      addToast?.('Error', 'Failed to load participating schools', 'amber');
    } finally {
      setLoading(false);
    }
  };

  // Load detailed single school
  const loadSchoolDetail = async (id) => {
    if (!id) return;
    try {
      const res = await apiService.getAdminSchoolDetail(id);
      if (res?.success && res.school) {
        console.log('[DIAGNOSTIC] getAdminSchoolDetail resolved:', {
          id: res.school._id || res.school.id,
          name: res.school.name,
          institutionType: res.school.institutionType,
          source: 'getAdminSchoolDetail'
        });
        setSelectedSchool(res.school);
        if (setSelectedInstitution) {
          setSelectedInstitution(res.school);
        }
      }
    } catch (e) {
      console.error('Error loading school details:', e);
    }
  };

  // Load academic config for selected school
  const loadAcademicConfig = async (id) => {
    if (!id) return;
    setAcademicConfigLoading(true);
    try {
      const res = await apiService.getAdminSchoolAcademicConfig(id);
      if (res?.success && res.academicConfig) {
        setAcademicConfigData({
          academicSession: res.academicConfig.academicSession || '2026-2027',
          classesOffered: res.academicConfig.classesOffered || ['Class 11', 'Class 12'],
          groups: res.academicConfig.groups || [],
          sections: res.academicConfig.sections || ['A', 'B', 'C'],
          mediums: res.academicConfig.mediums || ['English'],
          trainingSubjects: res.academicConfig.trainingSubjects || ['Python Programming', 'Aptitude & Logical Reasoning', 'Soft Skills'],
          trainingSchedules: res.academicConfig.trainingSchedules || []
        });
      }
    } catch (e) {
      console.error('Error loading academic config:', e);
    } finally {
      setAcademicConfigLoading(false);
    }
  };

  // Save academic config
  const handleSaveAcademicConfig = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedSchoolId) return;

    setIsSavingAcademicConfig(true);
    try {
      const res = await apiService.updateAdminSchoolAcademicConfig(selectedSchoolId, academicConfigData);
      if (res?.success) {
        addToast?.('Academic Structure Saved', 'Academic configuration updated successfully.', 'emerald');
        await loadSchoolDetail(selectedSchoolId);
        await loadSchools();
      } else {
        alert(res?.message || 'Failed to save academic structure.');
      }
    } catch (err) {
      console.error('Error saving academic config:', err);
      alert('Error updating academic structure: ' + err.message);
    } finally {
      setIsSavingAcademicConfig(false);
    }
  };

  // Add a new Group/Stream to academic config
  const handleAddGroupSubmit = (e) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) {
      alert('Group name is required.');
      return;
    }
    const subjectsArray = newGroupForm.subjects
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const newGroup = {
      id: `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newGroupForm.name.trim(),
      stream: newGroupForm.stream.trim(),
      subjects: subjectsArray,
      description: newGroupForm.description.trim()
    };

    setAcademicConfigData(prev => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup]
    }));

    setNewGroupForm({ name: '', stream: 'Science', subjects: '', description: '' });
    setNewGroupModalOpen(false);
    addToast?.('Stream Added', `Added ${newGroup.name}. Remember to click 'Save Academic Structure'.`, 'emerald');
  };

  // Remove Group/Stream from academic config
  const handleRemoveGroup = (groupId) => {
    setAcademicConfigData(prev => ({
      ...prev,
      groups: (prev.groups || []).filter(g => g.id !== groupId)
    }));
  };

  // Archive School Action
  const handleArchiveSchool = async (schoolId) => {
    if (!window.confirm('Archive this participating school? It will be hidden from active operations, but all records will remain safely preserved.')) {
      return;
    }
    setArchiveLoadingId(schoolId);
    try {
      const res = await apiService.archiveAdminSchool(schoolId);
      if (res?.success) {
        addToast?.('School Archived', res.message, 'subtle');
        await loadSchools();
      } else {
        alert(res?.message || 'Failed to archive school');
      }
    } catch (err) {
      alert('Error archiving school: ' + err.message);
    } finally {
      setArchiveLoadingId(null);
    }
  };

  // Restore School Action
  const handleRestoreSchool = async (schoolId) => {
    setArchiveLoadingId(schoolId);
    try {
      const res = await apiService.restoreAdminSchool(schoolId);
      if (res?.success) {
        addToast?.('School Restored', res.message, 'emerald');
        await loadSchools();
      } else {
        alert(res?.message || 'Failed to restore school');
      }
    } catch (err) {
      alert('Error restoring school: ' + err.message);
    } finally {
      setArchiveLoadingId(null);
    }
  };

  // Open Permanent Delete Modal
  const openDeleteSchoolModal = async (school) => {
    setSchoolToDelete(school);
    setDeleteConfirmCode('');
    setDeleteSchoolModalOpen(true);
    setDeleteInspectionLoading(true);
    try {
      const res = await apiService.getAdminSchoolPreDeleteInspection(school._id || school.id);
      if (res?.success) {
        setDeleteInspectionData(res);
      }
    } catch (err) {
      console.error('Error inspecting school dependencies:', err);
    } finally {
      setDeleteInspectionLoading(false);
    }
  };

  // Confirm Permanent Deletion
  const handleConfirmDeleteSchool = async () => {
    if (!schoolToDelete) return;
    setIsDeletingSchool(true);
    try {
      const res = await apiService.deleteAdminSchool(schoolToDelete._id || schoolToDelete.id, deleteConfirmCode);
      if (res?.success) {
        addToast?.('School Permanently Deleted', res.message, 'rose');
        setDeleteSchoolModalOpen(false);
        setSchoolToDelete(null);
        setDeleteConfirmCode('');
        await loadSchools();
        await loadComparison();
      } else {
        alert(res?.message || 'Failed to delete school');
      }
    } catch (err) {
      alert('Error deleting school: ' + err.message);
    } finally {
      setIsDeletingSchool(false);
    }
  };

  // Load comparison
  const loadComparison = async () => {
    try {
      const res = await apiService.getAdminSchoolsComparison();
      if (res?.success && Array.isArray(res.comparison)) {
        setComparisonData(res.comparison);
      }
    } catch (e) {
      console.error('Error loading comparison:', e);
    }
  };

  // Load performance for selected school
  const loadPerformance = async (id) => {
    if (!id) return;
    try {
      const res = await apiService.getAdminSchoolPerformance(id);
      if (res?.success) {
        setSchoolPerformance(res);
      }
    } catch (e) {
      console.error('Error loading school performance:', e);
    }
  };

  // Load members for assignment
  const loadMembersForAssignment = async () => {
    try {
      const res = await apiService.getStudentsDataSheet();
      const studentsList = Array.isArray(res) ? res : (res?.data?.students || res?.students || []);
      setAllStudents(studentsList);

      const trainersData = await apiService.getAdminTrainers();
      if (trainersData?.success && Array.isArray(trainersData.trainers)) {
        setAllTrainers(trainersData.trainers);
      }
    } catch (e) {
      console.error('Error loading members for assignment:', e);
    }
  };

  useEffect(() => {
    loadSchools();
    loadComparison();
    loadMembersForAssignment();
  }, []);

  const handleSelectSchool = (schoolId) => {
    console.log('[DIAGNOSTIC] handleSelectSchool called with schoolId:', schoolId);
    setSelectedSchoolId(schoolId);
    loadSchoolDetail(schoolId);
    loadAcademicConfig(schoolId);
    if (activeSection === 'performance') {
      loadPerformance(schoolId);
    }
  };

  // Create New School
  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!newSchoolData.name.trim() || !newSchoolData.code.trim()) {
      alert('Please fill in both school name and school code.');
      return;
    }
    try {
      const res = await apiService.createAdminSchool(newSchoolData);
      if (res?.success) {
        addToast?.('Success', 'Participating school registered successfully', 'emerald');
        setNewSchoolModalOpen(false);
        setNewSchoolData({ name: '', code: '', contactEmail: '', contactPhone: '', address: '' });
        await loadSchools();
        await loadComparison();
      } else {
        alert(res?.message || 'Failed to create school');
      }
    } catch (e) {
      console.error('Create school error:', e);
      alert('Failed to register school.');
    }
  };

  // Create or Update Cohort
  const handleSaveCohort = async (e) => {
    e.preventDefault();
    if (!cohortFormData.name.trim()) {
      alert('Cohort name is required.');
      return;
    }

    const payload = {
      name: cohortFormData.name,
      targetClass: cohortFormData.targetClass,
      startDate: cohortFormData.startDate || undefined,
      endDate: cohortFormData.endDate || undefined,
      sessionStartTime: cohortFormData.sessionStartTime,
      sessionEndTime: cohortFormData.sessionEndTime,
      scheduleDays: cohortFormData.scheduleDays.split(',').map(s => s.trim()).filter(Boolean),
      status: cohortFormData.status,
      liveSessionNotes: cohortFormData.liveSessionNotes
    };

    try {
      let res;
      if (cohortFormData.cohortId) {
        res = await apiService.updateAdminSchoolCohort(selectedSchoolId, cohortFormData.cohortId, payload);
      } else {
        res = await apiService.createAdminSchoolCohort(selectedSchoolId, payload);
      }

      if (res?.success) {
        addToast?.(
          'Success',
          cohortFormData.cohortId ? 'Training cohort updated' : 'Training cohort created',
          'emerald'
        );
        if (res.scheduleWarning) {
          alert(res.scheduleWarning);
        }
        setNewCohortModalOpen(false);
        setCohortFormData({
          cohortId: null,
          name: '',
          targetClass: 'Class 11',
          startDate: '',
          endDate: '',
          sessionStartTime: '11:00 AM',
          sessionEndTime: '12:00 PM',
          scheduleDays: 'Mon, Tue, Wed, Thu, Fri',
          status: 'active',
          liveSessionNotes: ''
        });
        loadSchools();
        loadSchoolDetail(selectedSchoolId);
      } else {
        alert(res?.message || 'Failed to save cohort');
      }
    } catch (err) {
      console.error('Save cohort error:', err);
      alert('Failed to save cohort schedule.');
    }
  };

  // Assign Content to Cohort
  const handleAssignContent = async (e) => {
    e.preventDefault();
    if (!contentFormData.title.trim()) {
      alert('Title is required.');
      return;
    }
    try {
      const res = await apiService.assignAdminSchoolContent(selectedSchoolId, contentFormData);
      if (res?.success) {
        addToast?.('Content Assigned', res.message || 'Content successfully assigned to cohort', 'emerald');
        setContentFormData({
          contentType: 'homework',
          cohortId: '',
          title: '',
          description: '',
          subject: 'Python Programming',
          dueDate: '',
          points: 20,
          durationMinutes: 45
        });
      } else {
        alert(res?.message || 'Failed to assign content');
      }
    } catch (err) {
      console.error('Assign content error:', err);
      alert('Failed to assign content.');
    }
  };

  // Assign Members to School & Cohort
  const handleAssignMembers = async (e) => {
    e.preventDefault();
    if (assignmentFormData.selectedStudentIds.length === 0 && assignmentFormData.selectedTrainerIds.length === 0) {
      if (addToast) {
        addToast('Selection Required', 'Please select at least one student or trainer to assign.', 'amber');
      } else {
        alert('Please select at least one student or trainer to assign.');
      }
      return;
    }

    try {
      const res = await apiService.assignAdminSchoolMembers(selectedSchoolId, {
        studentIds: assignmentFormData.selectedStudentIds,
        trainerIds: assignmentFormData.selectedTrainerIds,
        cohortId: assignmentFormData.cohortId || null,
        className: assignmentFormData.className
      });
      if (res?.success) {
        addToast?.('Success', res.message, 'emerald');
        setAssignmentFormData({
          cohortId: '',
          className: 'Class 11',
          selectedStudentIds: [],
          selectedTrainerIds: []
        });
        await loadMembersForAssignment();
        await loadSchools();
        await loadSchoolDetail(selectedSchoolId);
      } else {
        if (addToast) {
          addToast('Assignment Notice', res?.message || 'Failed to assign members', 'rose');
        } else {
          alert(res?.message || 'Failed to assign members');
        }
      }
    } catch (err) {
      console.error('Assign members error:', err);
      if (addToast) {
        addToast('Error', 'Failed to assign members: ' + err.message, 'rose');
      } else {
        alert('Failed to assign members.');
      }
    }
  };

  // Aggregate metrics
  const totalParticipatingSchools = schools.length;
  const totalStudentsEnrolled = schools.reduce((sum, s) => sum + (s.totalStudents || 0), 0);
  const totalClass11 = schools.reduce((sum, s) => sum + (s.class11Count || 0), 0);
  const totalClass12 = schools.reduce((sum, s) => sum + (s.class12Count || 0), 0);
  const totalActiveCohorts = schools.reduce((sum, s) => sum + (s.activeCohortsCount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(37, 99, 235, 0.25)'
          }}>
            <School size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Multi-School Training Operations
              </h1>
              <span style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                color: '#D97706',
                fontWeight: 700
              }}>
                6th Civilians Platform Admin
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0.2rem 0 0 0' }}>
              Centralized cohort scheduling, cross-school data isolation, attendance, and performance oversight.
            </p>
          </div>
        </div>

        {/* Global Action: Register School */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setNewSchoolModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={18} /> Register Participating School
          </button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Participating Schools</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            {schoolsError ? '—' : totalParticipatingSchools}
          </div>
          <div style={{ fontSize: '0.78rem', color: schoolsError ? '#EF4444' : 'var(--text-secondary)' }}>
            {schoolsError ? `Error: ${schoolsError.code}` : '2–3 Schools Trained Weekly'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Enrolled Students</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: schoolsError ? 'var(--text-muted)' : '#2563EB', margin: '0.25rem 0' }}>
            {schoolsError ? '—' : totalStudentsEnrolled}
          </div>
          <div style={{ fontSize: '0.78rem', color: schoolsError ? '#EF4444' : 'var(--text-secondary)' }}>
            {schoolsError ? 'Session verification required' : '~20 Students per School'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classes 11 & 12</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981', margin: '0.25rem 0' }}>
            {totalClass11} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalClass12}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Class 11 / Class 12 Distribution</div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Training Cohorts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706', margin: '0.25rem 0' }}>{totalActiveCohorts}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Configurable Live Sessions</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '0.25rem',
        overflowX: 'auto'
      }}>
        {[
          { id: 'schools', label: 'Schools Directory', icon: School },
          { id: 'students', label: 'School Students & Roster', icon: Users },
          { id: 'academic', label: 'Academic Structure & Streams', icon: BookOpen },
          { id: 'cohorts', label: 'Cohorts & Scheduling', icon: Calendar },
          { id: 'assign', label: 'Student & Trainer Assignments', icon: UserCheck },
          { id: 'content', label: 'Cohort Content Assignment', icon: FileText },
          { id: 'performance', label: 'School Reports & Performance', icon: BarChart3 },
          { id: 'comparison', label: 'Cross-School Comparison', icon: Layers }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSection(tab.id);
                if (tab.id === 'performance') loadPerformance(selectedSchoolId);
                if (tab.id === 'academic') loadAcademicConfig(selectedSchoolId);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1rem',
                fontSize: '0.86rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: SCHOOLS DIRECTORY */}
      {activeSection === 'schools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Directory Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '10px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('active')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: directoryStatusFilter === 'active' ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                  color: directoryStatusFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Active Only
              </button>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('all')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: directoryStatusFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                  color: directoryStatusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                All (incl. Archived)
              </button>
              <button
                type="button"
                onClick={() => setDirectoryStatusFilter('archived')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: directoryStatusFilter === 'archived' ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                  color: directoryStatusFilter === 'archived' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Archived Only
              </button>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Showing {schools.filter(s => directoryStatusFilter === 'all' ? true : (directoryStatusFilter === 'archived' ? s.status === 'archived' : s.status !== 'archived')).length} school(s)
            </div>
          </div>

          {/* Error Banner */}
          {schoolsError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH'
                ? 'rgba(245, 158, 11, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.25)'}`,
              color: schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH' ? '#D97706' : '#EF4444',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
                <AlertTriangle size={22} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    {schoolsError.code === 'INSUFFICIENT_PRIVILEGES'
                      ? 'Administrator Authorization Required (403)'
                      : schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH'
                      ? 'Authentication Identity Changed (Session Stale)'
                      : `Unable to Load Participating Schools (${schoolsError.code})`}
                  </div>
                  <div style={{ fontSize: '0.84rem', opacity: 0.95, marginTop: '0.15rem' }}>
                    {schoolsError.message}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH') && (
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen?.(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.95rem',
                      borderRadius: '6px',
                      backgroundColor: '#2563EB',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Shield size={14} /> Log In as Super Admin
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => loadSchools()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    backgroundColor: schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH' ? 'rgba(0,0,0,0.06)' : '#EF4444',
                    color: schoolsError.code === 'INSUFFICIENT_PRIVILEGES' || schoolsError.code === 'SESSION_STALE_IDENTITY_MISMATCH' ? 'var(--text-primary)' : '#fff',
                    border: '1px solid var(--border-default)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!schoolsError && schools.filter(s => directoryStatusFilter === 'all' ? true : (directoryStatusFilter === 'archived' ? s.status === 'archived' : s.status !== 'archived')).length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px dashed var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <School size={30} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                  {directoryStatusFilter === 'archived' ? 'No Archived Schools Found' : 'No Participating Schools Registered'}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: 0 }}>
                  {directoryStatusFilter === 'archived'
                    ? 'No schools are currently archived. Active schools remain available in the directory.'
                    : 'The multi-school directory is currently empty. Register a school to start configuring Class 11 and Class 12 groups, cohorts, and training schedules.'}
                </p>
              </div>
              {isSuperAdmin && directoryStatusFilter !== 'archived' && (
                <button
                  type="button"
                  onClick={() => setNewSchoolModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.35rem',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <Plus size={18} /> Register First Participating School
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {schools
                .filter(sch => directoryStatusFilter === 'all' ? true : (directoryStatusFilter === 'archived' ? sch.status === 'archived' : sch.status !== 'archived'))
                .map(sch => {
                  const isSelected = (sch._id || sch.id) === selectedSchoolId;
                  const isArchived = sch.status === 'archived';

                  return (
                    <div
                      key={sch._id || sch.id}
                      className="card"
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        opacity: isArchived ? 0.75 : 1,
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--accent-blue)'
                          }}>
                            {sch.code}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: isArchived ? 'rgba(107, 114, 128, 0.15)' : (sch.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                              color: isArchived ? '#6B7280' : (sch.status === 'active' ? '#10B981' : '#EF4444')
                            }}>
                              {sch.status?.toUpperCase() || 'ACTIVE'}
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(37, 99, 235, 0.08)',
                              color: 'var(--accent-primary)'
                            }}>
                              School Mode
                            </span>
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                          {sch.name}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.85rem 0' }}>
                          {sch.settings?.contact?.address || sch.settings?.contact?.email || 'Institutional address pending'}
                        </p>

                        {/* Counts breakdown */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', padding: '0.65rem', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sch.totalStudents || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Class 11 / 12</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2563EB' }}>
                              {sch.class11Count || 0} / {sch.class12Count || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cohorts</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10B981' }}>{sch.batchesCount || 0}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-default)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectSchool(sch._id || sch.id);
                              setActiveSection('students');
                            }}
                            style={{
                              flex: 1,
                              padding: '0.45rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: isSelected && activeSection === 'students' ? 'var(--accent-primary)' : 'var(--bg-card)',
                              color: isSelected && activeSection === 'students' ? '#ffffff' : 'var(--text-primary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Users size={13} /> Students
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectSchool(sch._id || sch.id);
                              setActiveSection('cohorts');
                            }}
                            style={{
                              flex: 1,
                              padding: '0.45rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: isSelected && activeSection === 'cohorts' ? 'var(--accent-primary)' : 'var(--bg-card)',
                              color: isSelected && activeSection === 'cohorts' ? '#ffffff' : 'var(--text-primary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Calendar size={13} /> Cohorts
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectSchool(sch._id || sch.id);
                              setActiveSection('academic');
                              loadAcademicConfig(sch._id || sch.id);
                            }}
                            style={{
                              flex: 1,
                              padding: '0.45rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <BookOpen size={13} /> Streams & Config
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectSchool(sch._id || sch.id);
                              setActiveSection('performance');
                              loadPerformance(sch._id || sch.id);
                            }}
                            title="View School Performance & Dossier"
                            style={{
                              padding: '0.45rem 0.65rem',
                              fontSize: '0.8rem',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} />
                          </button>
                        </div>

                        {/* Admin Security Actions: Archive & Delete */}
                        {isSuperAdmin && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px dashed var(--border-default)', paddingTop: '0.4rem' }}>
                            {isArchived ? (
                              <button
                                type="button"
                                disabled={archiveLoadingId === (sch._id || sch.id)}
                                onClick={() => handleRestoreSchool(sch._id || sch.id)}
                                style={{
                                  flex: 1,
                                  padding: '0.35rem',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                  color: '#10B981',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <RefreshCw size={12} /> Restore School
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={archiveLoadingId === (sch._id || sch.id)}
                                onClick={() => handleArchiveSchool(sch._id || sch.id)}
                                style={{
                                  flex: 1,
                                  padding: '0.35rem',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(107, 114, 128, 0.08)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-default)',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <Archive size={12} /> Archive School
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openDeleteSchoolModal(sch)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: SCHOOL STUDENTS & ROSTER */}
      {activeSection === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* School Selector Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <School size={20} color="var(--accent-blue)" />
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Managing Student Roster for School:
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => handleSelectSchool(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                {schools.map(sch => (
                  <option key={sch._id || sch.id} value={sch._id || sch.id}>
                    {sch.name} ({sch.code}) {sch.status === 'archived' ? '[Archived]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedSchool && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--accent-primary)'
                }}>
                  School Mode
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Code: <strong>{selectedSchool.code}</strong>
                </span>
              </div>
            )}
          </div>

          {(() => {
            console.log('[DIAGNOSTIC] before rendering student management:', {
              selectedTenantId: selectedSchool?._id || selectedSchoolId,
              institutionType: selectedSchool?.institutionType || 'school',
              schoolName: selectedSchool?.name,
              source: 'MultiSchoolManagementView -> activeSection === students'
            });
            return (
              <StudentsDataSheetView
                selectedSchool={selectedSchool}
                institutionType={selectedSchool?.institutionType || 'school'}
                collegeId={selectedSchool?._id || selectedSchoolId}
                isSuperAdmin={isSuperAdmin}
                key={`school-students-${selectedSchool?._id || selectedSchoolId}`}
              />
            );
          })()}
        </div>
      )}

      {/* SECTION: ACADEMIC STRUCTURE & STREAMS SETTINGS */}
      {activeSection === 'academic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* School Selector Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BookOpen size={20} color="var(--accent-blue)" />
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Configuring Academic Structure for:
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => handleSelectSchool(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                {schools.map(sch => (
                  <option key={sch._id || sch.id} value={sch._id || sch.id}>
                    {sch.name} ({sch.code}) {sch.status === 'archived' ? '[Archived]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedSchool && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--accent-primary)'
                }}>
                  Session: {academicConfigData.academicSession || '2026-2027'}
                </span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => openDeleteSchoolModal(selectedSchool)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#EF4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} /> Delete School
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Academic Settings Form */}
          {academicConfigLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading academic configuration...
            </div>
          ) : (
            <form onSubmit={handleSaveAcademicConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
                backgroundColor: 'var(--bg-card)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border-default)'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Academic Session * (e.g. 2026-2027)
                  </label>
                  <input
                    type="text"
                    required
                    value={academicConfigData.academicSession || ''}
                    onChange={(e) => setAcademicConfigData({ ...academicConfigData, academicSession: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sets the current active school academic year</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Classes Offered
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {['Class 11', 'Class 12'].map(cls => {
                      const checked = (academicConfigData.classesOffered || []).includes(cls);
                      return (
                        <label key={cls} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const curr = academicConfigData.classesOffered || [];
                              const updated = e.target.checked
                                ? [...curr, cls]
                                : curr.filter(c => c !== cls);
                              setAcademicConfigData({ ...academicConfigData, classesOffered: updated });
                            }}
                          />
                          {cls}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Class Sections (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(academicConfigData.sections || []).join(', ')}
                    onChange={(e) => {
                      const secs = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                      setAcademicConfigData({ ...academicConfigData, sections: secs });
                    }}
                    placeholder="A, B, C"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>e.g. A, B, C</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Medium of Instruction (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(academicConfigData.mediums || []).join(', ')}
                    onChange={(e) => {
                      const meds = e.target.value.split(',').map(m => m.trim()).filter(Boolean);
                      setAcademicConfigData({ ...academicConfigData, mediums: meds });
                    }}
                    placeholder="English, Tamil"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Specialized Training Subjects (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(academicConfigData.trainingSubjects || []).join(', ')}
                    onChange={(e) => {
                      const subs = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setAcademicConfigData({ ...academicConfigData, trainingSubjects: subs });
                    }}
                    placeholder="Python Programming, Aptitude & Logical Reasoning, Soft Skills"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Subjects delivered by 6th Civilians / EdWth Academy trainers</span>
                </div>
              </div>

              {/* Dynamic Academic Groups & Streams Section */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-primary)' }}>
                      Academic Groups & Streams
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Define stream groupings (e.g. MPC, BPC, Pure Science, Commerce) and their associated core subjects.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewGroupModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} /> Add Stream Group
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {(academicConfigData.groups || []).map(group => (
                    <div
                      key={group.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {group.name}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#10B981'
                          }}>
                            {group.stream || 'Stream'}
                          </span>
                        </div>
                        {group.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            {group.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {(group.subjects || []).map(subj => (
                            <span
                              key={subj}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {subj}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(group.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.72rem',
                            color: '#EF4444',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={isSavingAcademicConfig}
                  style={{
                    padding: '0.65rem 1.5rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  {isSavingAcademicConfig ? 'Saving Academic Structure...' : 'Save Academic Structure'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SECTION 2: COHORTS & SCHEDULING */}
      {activeSection === 'cohorts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* School Selector Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <School size={20} color="var(--accent-blue)" />
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Managing School:
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => handleSelectSchool(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                {schools.map(sch => (
                  <option key={sch._id || sch.id} value={sch._id || sch.id}>
                    {sch.name} ({sch.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setCohortFormData({
                  cohortId: null,
                  name: `${selectedSchool?.name || 'School'} - Cohort ${String.fromCharCode(65 + (selectedSchool?.batches?.length || 0))}`,
                  targetClass: 'Class 11',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  sessionStartTime: '11:00 AM',
                  sessionEndTime: '12:00 PM',
                  scheduleDays: 'Mon, Tue, Wed, Thu, Fri',
                  status: 'active',
                  liveSessionNotes: ''
                });
                setNewCohortModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 1rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Configure New Cohort
            </button>
          </div>

          {/* Cohorts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(!selectedSchool?.batches || selectedSchool.batches.length === 0) ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                No training cohorts configured for this school yet. Click "Configure New Cohort" to set session timing and training dates.
              </div>
            ) : (
              selectedSchool.batches.map(cohort => {
                const isCompleted = cohort.status === 'completed' || cohort.isCompleted;
                return (
                  <div
                    key={cohort._id || cohort.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      padding: '1.25rem',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '12px',
                      border: isCompleted ? '1px dashed var(--border-default)' : '1px solid var(--border-default)',
                      opacity: isCompleted ? 0.85 : 1
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {cohort.name}
                        </h4>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--accent-blue)'
                        }}>
                          {cohort.targetClass || 'Class 11'}
                        </span>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isCompleted ? 'rgba(100, 116, 139, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: isCompleted ? '#64748B' : '#10B981'
                        }}>
                          {isCompleted ? 'COMPLETED (HISTORICAL)' : (cohort.status?.toUpperCase() || 'ACTIVE')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={14} color="#D97706" />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {cohort.sessionStartTime || '11:00 AM'} – {cohort.sessionEndTime || '12:00 PM'}
                          </span>
                        </div>
                        <span>•</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={14} color="var(--accent-blue)" />
                          <span>
                            {cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : 'Dates Pending'} to {cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : 'Active'}
                          </span>
                        </div>
                        <span>•</span>
                        <span>Days: {Array.isArray(cohort.scheduleDays) ? cohort.scheduleDays.join(', ') : 'Mon-Fri'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCohortFormData({
                            cohortId: cohort._id || cohort.id,
                            name: cohort.name,
                            targetClass: cohort.targetClass || 'Class 11',
                            startDate: cohort.startDate ? new Date(cohort.startDate).toISOString().split('T')[0] : '',
                            endDate: cohort.endDate ? new Date(cohort.endDate).toISOString().split('T')[0] : '',
                            sessionStartTime: cohort.sessionStartTime || '11:00 AM',
                            sessionEndTime: cohort.sessionEndTime || '12:00 PM',
                            scheduleDays: Array.isArray(cohort.scheduleDays) ? cohort.scheduleDays.join(', ') : 'Mon, Tue, Wed, Thu, Fri',
                            status: cohort.status || 'active',
                            liveSessionNotes: cohort.liveSessionNotes || ''
                          });
                          setNewCohortModalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit2 size={14} /> Edit Schedule / Status
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: ASSIGN STUDENTS & TRAINERS */}
      {activeSection === 'assign' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Assign Students & Trainers to School / Cohort
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
              Assign newly enrolled students to participating school cohorts and designate subject trainers.
            </p>

            <form onSubmit={handleAssignMembers} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Target School
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => handleSelectSchool(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    {schools.map(sch => (
                      <option key={sch._id || sch.id} value={sch._id || sch.id}>{sch.name} ({sch.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Assign to Cohort
                  </label>
                  <select
                    value={assignmentFormData.cohortId}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, cohortId: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="">General School Enrollment (No specific cohort)</option>
                    {(selectedSchool?.batches || []).map(b => (
                      <option key={b._id || b.id} value={b._id || b.id}>{b.name} ({b.targetClass || 'Class 11'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Student Class
                  </label>
                  <select
                    value={assignmentFormData.className}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, className: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>
              </div>

              {/* Student Multi-Select & Filter Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Select Students to Enroll in this School ({assignmentFormData.selectedStudentIds.length} selected)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredStudentsForAssignment.map(st => st._id || st.id);
                        const merged = Array.from(new Set([...assignmentFormData.selectedStudentIds, ...visibleIds]));
                        setAssignmentFormData({ ...assignmentFormData, selectedStudentIds: merged });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Select All Visible ({filteredStudentsForAssignment.length})
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFormData({ ...assignmentFormData, selectedStudentIds: [] });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  {/* Affiliation Tabs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setAssignStudentSchoolFilter('target')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignStudentSchoolFilter === 'target' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignStudentSchoolFilter === 'target' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignStudentSchoolFilter === 'target' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      Enrolled in this School ({targetSchoolStudentCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignStudentSchoolFilter('unassigned')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignStudentSchoolFilter === 'unassigned' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignStudentSchoolFilter === 'unassigned' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignStudentSchoolFilter === 'unassigned' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      Unassigned / New ({unassignedStudentCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignStudentSchoolFilter('all')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignStudentSchoolFilter === 'all' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignStudentSchoolFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignStudentSchoolFilter === 'all' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      All Students / Cross-School ({allStudents.length})
                    </button>
                  </div>

                  {/* Class Filter & Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Class:</span>
                      <select
                        value={assignStudentClassFilter}
                        onChange={(e) => setAssignStudentClassFilter(e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.76rem',
                          fontWeight: 600
                        }}
                      >
                        <option value="match">Match Form ({assignmentFormData.className})</option>
                        <option value="all">All Classes</option>
                        <option value="Class 11">Class 11 Only</option>
                        <option value="Class 12">Class 12 Only</option>
                      </select>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={assignStudentSearch}
                        onChange={(e) => setAssignStudentSearch(e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem 0.25rem 1.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.76rem',
                          width: '150px'
                        }}
                      />
                      <Search size={12} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      {assignStudentSearch && (
                        <button
                          type="button"
                          onClick={() => setAssignStudentSearch('')}
                          style={{
                            position: 'absolute',
                            right: '4px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: 0
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Scrollable List */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--bg-subtle)' }}>
                  {filteredStudentsForAssignment.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {assignStudentSchoolFilter === 'target' && targetSchoolStudentCount === 0 ? (
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                            No students are currently enrolled in {selectedSchool?.name || 'this school'}.
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setAssignStudentSchoolFilter('unassigned')}
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem' }}
                            >
                              Show Unassigned Students ({unassignedStudentCount})
                            </button>
                            <button
                              type="button"
                              onClick={() => setAssignStudentSchoolFilter('all')}
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem' }}
                            >
                              Show All Students ({allStudents.length})
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span>No student records match the active filters.</span>
                      )}
                    </div>
                  ) : (
                    filteredStudentsForAssignment.map(st => {
                      const stId = st._id || st.id;
                      const isChecked = assignmentFormData.selectedStudentIds.includes(stId);
                      const stTenantId = getStudentTenantId(st);
                      const isCurrentSchool = Boolean(stTenantId && selectedSchoolId && stTenantId === selectedSchoolId.toString());
                      const isUnassigned = !stTenantId || !schoolMap.has(stTenantId);
                      const schoolAffiliationName = schoolMap.get(stTenantId) || 'Other School';
                      const stClass = getStudentClass(st);

                      return (
                        <label
                          key={stId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            marginBottom: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignmentFormData({
                                    ...assignmentFormData,
                                    selectedStudentIds: [...assignmentFormData.selectedStudentIds, stId]
                                  });
                                } else {
                                  setAssignmentFormData({
                                    ...assignmentFormData,
                                    selectedStudentIds: assignmentFormData.selectedStudentIds.filter(id => id !== stId)
                                  });
                                }
                              }}
                            />
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                              ({st.studentId})
                            </span>
                            {stClass && (
                              <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                                {stClass}
                              </span>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{st.email}</span>
                          </div>

                          <div>
                            {isCurrentSchool ? (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
                                ✓ In this School
                              </span>
                            ) : isUnassigned ? (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748B' }}>
                                Unassigned
                              </span>
                            ) : (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
                                Enrolled: {schoolAffiliationName}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Trainer Multi-Select & Filter Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Designate Trainers for this School ({assignmentFormData.selectedTrainerIds.length} selected)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredTrainersForAssignment.map(tr => tr._id || tr.id);
                        const merged = Array.from(new Set([...assignmentFormData.selectedTrainerIds, ...visibleIds]));
                        setAssignmentFormData({ ...assignmentFormData, selectedTrainerIds: merged });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Select All Visible ({filteredTrainersForAssignment.length})
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFormData({ ...assignmentFormData, selectedTrainerIds: [] });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Trainer Filter Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setAssignTrainerFilter('all')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignTrainerFilter === 'all' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignTrainerFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignTrainerFilter === 'all' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      All Educators ({allTrainers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignTrainerFilter('target')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignTrainerFilter === 'target' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignTrainerFilter === 'target' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignTrainerFilter === 'target' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      Assigned to this School ({targetSchoolTrainerCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignTrainerFilter('unassigned')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: assignTrainerFilter === 'unassigned' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)',
                        backgroundColor: assignTrainerFilter === 'unassigned' ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: assignTrainerFilter === 'unassigned' ? '#ffffff' : 'var(--text-primary)'
                      }}
                    >
                      Available / Unassigned ({unassignedTrainerCount})
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search educators..."
                      value={assignTrainerSearch}
                      onChange={(e) => setAssignTrainerSearch(e.target.value)}
                      style={{
                        padding: '0.25rem 0.5rem 0.25rem 1.6rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        width: '150px'
                      }}
                    />
                    <Search size={12} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    {assignTrainerSearch && (
                      <button
                        type="button"
                        onClick={() => setAssignTrainerSearch('')}
                        style={{
                          position: 'absolute',
                          right: '4px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Trainer Scrollable List */}
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--bg-subtle)' }}>
                  {filteredTrainersForAssignment.length === 0 ? (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      No educator records match the active filter.
                    </div>
                  ) : (
                    filteredTrainersForAssignment.map(tr => {
                      const trId = tr._id || tr.id;
                      const isChecked = assignmentFormData.selectedTrainerIds.includes(trId);
                      const trTenantId = getTrainerTenantId(tr);
                      const isCurrentSchool = Boolean(trTenantId && selectedSchoolId && trTenantId === selectedSchoolId.toString());
                      const isUnassigned = !trTenantId || !schoolMap.has(trTenantId);
                      const schoolAffiliationName = schoolMap.get(trTenantId) || 'Other School';

                      return (
                        <label
                          key={trId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.35rem 0.55rem',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            marginBottom: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignmentFormData({
                                    ...assignmentFormData,
                                    selectedTrainerIds: [...assignmentFormData.selectedTrainerIds, trId]
                                  });
                                } else {
                                  setAssignmentFormData({
                                    ...assignmentFormData,
                                    selectedTrainerIds: assignmentFormData.selectedTrainerIds.filter(id => id !== trId)
                                  });
                                }
                              }}
                            />
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tr.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{tr.email}</span>
                          </div>

                          <div>
                            {isCurrentSchool ? (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
                                ✓ Assigned: {selectedSchool?.name || 'This School'} {tr.batchName ? `(${tr.batchName})` : ''}
                              </span>
                            ) : isUnassigned ? (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748B' }}>
                                Available / Unassigned
                              </span>
                            ) : (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
                                Affiliated: {schoolAffiliationName}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.6rem 1.25rem',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Execute Member Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 4: COHORT CONTENT ASSIGNMENT */}
      {activeSection === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Assign Assessments, Homework & Announcements to Cohort
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
              Publish verified curriculum tasks and announcements strictly isolated to this participating school and cohort.
            </p>

            <form onSubmit={handleAssignContent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Target School
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => handleSelectSchool(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    {schools.map(sch => (
                      <option key={sch._id || sch.id} value={sch._id || sch.id}>{sch.name} ({sch.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Target Cohort
                  </label>
                  <select
                    value={contentFormData.cohortId}
                    onChange={(e) => setContentFormData({ ...contentFormData, cohortId: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Cohorts in School</option>
                    {(selectedSchool?.batches || []).map(b => (
                      <option key={b._id || b.id} value={b._id || b.id}>{b.name} ({b.targetClass || 'Class 11'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    Content Type
                  </label>
                  <select
                    value={contentFormData.contentType}
                    onChange={(e) => setContentFormData({ ...contentFormData, contentType: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="homework">Homework Exercise</option>
                    <option value="assessment">Scheduled Assessment / Test</option>
                    <option value="announcement">School Announcement</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Title / Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Functions & Loops Exercise"
                  value={contentFormData.title}
                  onChange={(e) => setContentFormData({ ...contentFormData, title: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Description / Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed instructions for students in this cohort..."
                  value={contentFormData.description}
                  onChange={(e) => setContentFormData({ ...contentFormData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.6rem 1.25rem',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Publish to Selected Cohort
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 5: SCHOOL REPORTS & PERFORMANCE */}
      {activeSection === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* School Selector Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <School size={20} color="var(--accent-blue)" />
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Inspect School Performance:
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  handleSelectSchool(e.target.value);
                  loadPerformance(e.target.value);
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                {schools.map(sch => (
                  <option key={sch._id || sch.id} value={sch._id || sch.id}>
                    {sch.name} ({sch.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Performance Summary Cards */}
          {schoolPerformance?.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attendance Rate</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981', margin: '0.25rem 0' }}>
                  {schoolPerformance.summary.attendanceRate != null ? `${schoolPerformance.summary.attendanceRate}%` : 'Pending'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Verified Session Attendance</div>
              </div>

              <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Test Score</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB', margin: '0.25rem 0' }}>
                  {schoolPerformance.summary.averageTestPercentage != null ? `${schoolPerformance.summary.averageTestPercentage}%` : 'Pending'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{schoolPerformance.summary.totalEvaluatedAttempts} Evaluated Tests</div>
              </div>

              <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Homework Completion</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706', margin: '0.25rem 0' }}>
                  {schoolPerformance.summary.homeworkCompletionRate != null ? `${schoolPerformance.summary.homeworkCompletionRate}%` : 'Pending'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{schoolPerformance.summary.totalGradedSubmissions} Graded Exercises</div>
              </div>
            </div>
          )}

          {/* Recent Records Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
            {/* Assessment Attempts */}
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--text-primary)' }}>
                Recent Assessment Attempts
              </h4>
              {(!schoolPerformance?.assessmentAttempts || schoolPerformance.assessmentAttempts.length === 0) ? (
                <div style={{ padding: '1rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>No test attempts recorded yet.</div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '0.4rem' }}>Student</th>
                        <th style={{ padding: '0.4rem' }}>Score</th>
                        <th style={{ padding: '0.4rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolPerformance.assessmentAttempts.slice(0, 15).map(att => (
                        <tr key={att._id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td style={{ padding: '0.4rem', fontWeight: 600 }}>{att.studentName || 'Student'}</td>
                          <td style={{ padding: '0.4rem' }}>{att.score != null ? `${att.score}/${att.maxScore}` : '—'}</td>
                          <td style={{ padding: '0.4rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: att.status === 'evaluated' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(217, 119, 6, 0.1)', color: att.status === 'evaluated' ? '#10B981' : '#D97706' }}>
                              {att.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attendance Records */}
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--text-primary)' }}>
                Recent Attendance Logs
              </h4>
              {(!schoolPerformance?.attendanceRecords || schoolPerformance.attendanceRecords.length === 0) ? (
                <div style={{ padding: '1rem', fontSize: '0.84rem', color: 'var(--text-muted)' }}>No attendance logs recorded yet.</div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '0.4rem' }}>Date</th>
                        <th style={{ padding: '0.4rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolPerformance.attendanceRecords.slice(0, 15).map(att => (
                        <tr key={att._id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td style={{ padding: '0.4rem' }}>{new Date(att.date).toLocaleDateString()}</td>
                          <td style={{ padding: '0.4rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: att.status === 'present' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: att.status === 'present' ? '#10B981' : '#EF4444' }}>
                              {att.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: CROSS-SCHOOL COMPARISON */}
      {activeSection === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Cross-School Aggregate Benchmark
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
              High-level comparative analysis across all participating schools. Strict privacy enforcement ensures no student lists or personal identities are mixed across schools.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-default)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>School</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Students</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Class 11</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Class 12</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Active Cohorts</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Avg Assessment</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Attendance Rate</th>
                    <th style={{ padding: '0.75rem 1rem' }}>HW Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map(sch => (
                    <tr key={sch.schoolId || sch.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div>{sch.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sch.code}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{sch.totalStudents}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{sch.class11Count}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{sch.class12Count}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: 700, fontSize: '0.76rem' }}>
                          {sch.activeCohortsCount} Active
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: sch.metrics?.averageAssessmentScore ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                        {sch.metrics?.averageAssessmentScore != null ? `${sch.metrics.averageAssessmentScore}%` : 'Pending'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: sch.metrics?.averageAttendanceRate ? '#10B981' : 'var(--text-muted)' }}>
                        {sch.metrics?.averageAttendanceRate != null ? `${sch.metrics.averageAttendanceRate}%` : 'Pending'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: sch.metrics?.homeworkCompletionRate ? '#2563EB' : 'var(--text-muted)' }}>
                        {sch.metrics?.homeworkCompletionRate != null ? `${sch.metrics.homeworkCompletionRate}%` : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Register New School */}
      {newSchoolModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            maxWidth: '520px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Register Participating School
              </h3>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-primary)'
              }}>
                School Mode
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Create a dedicated institutional tenant operating strictly in School Mode (Classes 11 & 12).
            </p>

            <div style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem'
            }}>
              <strong>Standard Setup:</strong> Automatically pre-configured with Class 11 & 12, standard science/commerce streams (MPC, BPC, Pure Science, Commerce), and specialized training modules.
            </div>

            <form onSubmit={handleCreateSchool} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  School Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Horizon Senior Secondary School"
                  value={newSchoolData.name}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    School Code * (e.g. HOR-01)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOR-01"
                    value={newSchoolData.code}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, code: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Academic Session *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-2027"
                    value={newSchoolData.academicSession || '2026-2027'}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, academicSession: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="admin@school.org"
                    value={newSchoolData.contactEmail}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, contactEmail: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={newSchoolData.contactPhone || ''}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPhone: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Campus Address / City
                </label>
                <input
                  type="text"
                  placeholder="Hyderabad, Telangana"
                  value={newSchoolData.address}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setNewSchoolModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.84rem', fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: '6px', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.84rem', fontWeight: 700, backgroundColor: 'var(--accent-primary)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Register School
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configure Training Cohort */}
      {newCohortModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            maxWidth: '560px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              {cohortFormData.cohortId ? 'Update Training Cohort Schedule' : 'Configure New Training Cohort'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
              Set session start/end times and training dates for {selectedSchool?.name || 'School'}.
            </p>

            <form onSubmit={handleSaveCohort} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Cohort Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11 - Batch A"
                  value={cohortFormData.name}
                  onChange={(e) => setCohortFormData({ ...cohortFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Target Class
                  </label>
                  <select
                    value={cohortFormData.targetClass}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, targetClass: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Cohort Status
                  </label>
                  <select
                    value={cohortFormData.status}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="active">Active (Ongoing Training)</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed (Preserve Historical Records)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Session Start Time (e.g. 11:00 AM)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="11:00 AM"
                    value={cohortFormData.sessionStartTime}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, sessionStartTime: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Session End Time (e.g. 12:00 PM)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="12:00 PM"
                    value={cohortFormData.sessionEndTime}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, sessionEndTime: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={cohortFormData.startDate}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, startDate: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={cohortFormData.endDate}
                    onChange={(e) => setCohortFormData({ ...cohortFormData, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Schedule Days (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Mon, Tue, Wed, Thu, Fri"
                  value={cohortFormData.scheduleDays}
                  onChange={(e) => setCohortFormData({ ...cohortFormData, scheduleDays: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setNewCohortModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.84rem', fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: '6px', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.84rem', fontWeight: 700, backgroundColor: 'var(--accent-primary)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {cohortFormData.cohortId ? 'Save Cohort Schedule' : 'Create Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add New Academic Stream Group */}
      {newGroupModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-default)',
            maxWidth: '500px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
              Add Academic Stream / Group
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Define a new subject combination offered at this school for Class 11 and Class 12.
            </p>

            <form onSubmit={handleAddGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Group Name * (e.g. Group I (MPC), Pure Science, Commerce)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Group I (MPC)"
                  value={newGroupForm.name}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Stream Category
                </label>
                <select
                  value={newGroupForm.stream}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, stream: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts / Humanities">Arts / Humanities</option>
                  <option value="Vocational">Vocational</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Core Subjects (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mathematics, Physics, Chemistry"
                  value={newGroupForm.subjects}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, subjects: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Brief Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maths, Physics, Chemistry stream"
                  value={newGroupForm.description}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setNewGroupModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.84rem', fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: '6px', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.84rem', fontWeight: 700, backgroundColor: 'var(--accent-primary)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Add Stream Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Permanently Delete School Confirmation */}
      {deleteSchoolModalOpen && schoolToDelete && (
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
            maxWidth: '540px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#EF4444', marginBottom: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Permanently Delete School
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#EF4444', fontWeight: 700 }}>
                  Irreversible Production Purge
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              You are about to permanently delete <strong>{schoolToDelete.name}</strong> ({schoolToDelete.code}).
            </p>

            {/* Inspection Breakdown */}
            <div style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Affected Scoped Records in Database:
              </div>
              {deleteInspectionLoading ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Inspecting school dependencies...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>Enrolled Students: <strong>{deleteInspectionData?.counts?.students || 0}</strong></div>
                  <div>Training Cohorts: <strong>{deleteInspectionData?.counts?.cohorts || 0}</strong></div>
                  <div>Attendance Marks: <strong>{deleteInspectionData?.counts?.attendanceRecords || 0}</strong></div>
                  <div>Submissions: <strong>{deleteInspectionData?.counts?.submissions || 0}</strong></div>
                  <div>Assignments: <strong>{deleteInspectionData?.counts?.assignments || 0}</strong></div>
                  <div>Total Scoped Records: <strong>{deleteInspectionData?.counts?.totalRecords || 0}</strong></div>
                </div>
              )}
            </div>

            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.25rem'
            }}>
              <strong>Safety Enforcement:</strong> A scoped JSON backup will automatically be archived to <code>server/scripts/backups/</code> prior to purge. Platform SuperAdmin accounts and global security policies will NOT be touched.
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                Type <span style={{ color: '#EF4444', fontFamily: 'var(--font-mono)' }}>{schoolToDelete.code}</span> to confirm permanent deletion:
              </label>
              <input
                type="text"
                placeholder={schoolToDelete.code}
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isDeletingSchool}
                onClick={() => {
                  setDeleteSchoolModalOpen(false);
                  setSchoolToDelete(null);
                  setDeleteConfirmCode('');
                }}
                style={{
                  padding: '0.6rem 1.1rem',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmCode.trim() !== schoolToDelete.code || isDeletingSchool}
                onClick={handleConfirmDeleteSchool}
                style={{
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  backgroundColor: deleteConfirmCode.trim() === schoolToDelete.code ? '#EF4444' : 'rgba(239, 68, 68, 0.4)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deleteConfirmCode.trim() === schoolToDelete.code && !isDeletingSchool ? 'pointer' : 'not-allowed',
                  boxShadow: deleteConfirmCode.trim() === schoolToDelete.code ? '0 2px 8px rgba(239, 68, 68, 0.35)' : 'none'
                }}
              >
                {isDeletingSchool ? 'Purging Records...' : 'Permanently Delete School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
