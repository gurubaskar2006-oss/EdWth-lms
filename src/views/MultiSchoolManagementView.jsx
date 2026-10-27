import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { apiService } from '../services/apiService';
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
  ArrowRight
} from 'lucide-react';

export const MultiSchoolManagementView = () => {
  usePageTitle('Multi-School Training Management');
  const { user, addToast } = useLMS();

  const isSuperAdmin = user?.role === 'superadmin';
  const [activeSection, setActiveSection] = useState('schools'); // 'schools' | 'cohorts' | 'assign' | 'content' | 'performance' | 'comparison'
  const [loading, setLoading] = useState(true);

  // Core data states
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [schoolPerformance, setSchoolPerformance] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [allTrainers, setAllTrainers] = useState([]);

  // Modals / Forms
  const [newSchoolModalOpen, setNewSchoolModalOpen] = useState(false);
  const [newSchoolData, setNewSchoolData] = useState({
    name: '',
    code: '',
    contactEmail: '',
    contactPhone: '',
    address: ''
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

  // Load all schools
  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminSchools();
      if (res?.success && Array.isArray(res.schools)) {
        setSchools(res.schools);
        if (res.schools.length > 0) {
          const defaultId = selectedSchoolId || res.schools[0]._id || res.schools[0].id;
          setSelectedSchoolId(defaultId);
          loadSchoolDetail(defaultId);
        }
      }
    } catch (e) {
      console.error('Error loading schools:', e);
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
        setSelectedSchool(res.school);
      }
    } catch (e) {
      console.error('Error loading school details:', e);
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
    setSelectedSchoolId(schoolId);
    loadSchoolDetail(schoolId);
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
      alert('Please select at least one student or trainer to assign.');
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
        loadSchools();
        loadSchoolDetail(selectedSchoolId);
      } else {
        alert(res?.message || 'Failed to assign members');
      }
    } catch (err) {
      console.error('Assign members error:', err);
      alert('Failed to assign members.');
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
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>{totalParticipatingSchools}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>2–3 Schools Trained Weekly</div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Enrolled Students</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB', margin: '0.25rem 0' }}>{totalStudentsEnrolled}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>~20 Students per School</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {schools.map(sch => {
              const isSelected = (sch._id || sch.id) === selectedSchoolId;
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
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
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
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: sch.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: sch.status === 'active' ? '#10B981' : '#EF4444'
                      }}>
                        {sch.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                      {sch.name}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                      {sch.settings?.contact?.address || 'Institutional address pending'}
                    </p>

                    {/* Counts breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', padding: '0.65rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sch.totalStudents || 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Class 11 / 12</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563EB' }}>
                          {sch.class11Count || 0} / {sch.class12Count || 0}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cohorts</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>{sch.batchesCount || 0}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-default)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectSchool(sch._id || sch.id);
                        setActiveSection('cohorts');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Calendar size={14} /> Cohorts & Sessions
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectSchool(sch._id || sch.id);
                        setActiveSection('performance');
                        loadPerformance(sch._id || sch.id);
                      }}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

              {/* Student Multi-Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Select Students to Enroll in this School ({assignmentFormData.selectedStudentIds.length} selected)
                </label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--bg-subtle)' }}>
                  {allStudents.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No student records found in database.</div>
                  ) : (
                    allStudents.map(st => {
                      const stId = st._id || st.id;
                      const isChecked = assignmentFormData.selectedStudentIds.includes(stId);
                      return (
                        <label key={stId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.84rem', cursor: 'pointer' }}>
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
                          <span style={{ fontWeight: 600 }}>{st.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({st.studentId})</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{st.email}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Trainer Multi-Select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Designate Trainers for this School ({assignmentFormData.selectedTrainerIds.length} selected)
                </label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--bg-subtle)' }}>
                  {allTrainers.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No trainers found.</div>
                  ) : (
                    allTrainers.map(tr => {
                      const trId = tr._id || tr.id;
                      const isChecked = assignmentFormData.selectedTrainerIds.includes(trId);
                      return (
                        <label key={trId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.84rem', cursor: 'pointer' }}>
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
                          <span style={{ fontWeight: 600 }}>{tr.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{tr.email}</span>
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
            maxWidth: '500px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Register Participating School
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
              Create a dedicated institutional tenant for a participating school.
            </p>

            <form onSubmit={handleCreateSchool} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  School Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oakridge International School"
                  value={newSchoolData.name}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  School Code * (e.g. OAKRIDGE-HYD)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OAK-01"
                  value={newSchoolData.code}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Administrative Contact Email
                </label>
                <input
                  type="email"
                  placeholder="admin@oakridge.edu"
                  value={newSchoolData.contactEmail}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, contactEmail: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
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
    </div>
  );
};
