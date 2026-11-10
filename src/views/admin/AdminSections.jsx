import React, { useState, useEffect } from 'react';
import { useLMS } from '../../context/LMSContext';
import { apiService } from '../../services/apiService';
import { socketService } from '../../services/socketService';
import {
  BarChart3,
  Users,
  Shield,
  Building,
  BookOpen,
  Layers,
  Radio,
  FileCheck2,
  Bell,
  FileText,
  KeyRound,
  Lock,
  Settings,
  Activity,
  Plus,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Building2,
  X,
  RefreshCw,
  HelpCircle,
  Trash2,
  Send,
  MessageSquare
} from 'lucide-react';

// ─── 1. Institution Analytics View ───────────────────────────────────────────
export const InstitutionAnalyticsView = () => {
  const { terms, institutionType } = useLMS();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await apiService.getAdminAnalytics();
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load institution analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAnalytics();
    return () => { mounted = false; };
  }, []);

  const stats = data?.stats || {};
  const breakdown = data?.batchBreakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Institution Analytics & Overview
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Server-authoritative academic metrics across student enrollment, attendance rates, and assessment grading
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading real-time institutional analytics...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          {error}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { 
                label: `Total Enrolled ${terms?.learnerPlural || 'Students'}`, 
                value: stats.studentsCount ?? 0, 
                sub: (stats.studentsCount || 0) > 0 ? 'Across active cohorts' : 'No students enrolled yet', 
                color: '#059669' 
              },
              { 
                label: 'Overall Attendance Rate', 
                value: stats.averageAttendanceRate != null ? `${stats.averageAttendanceRate}%` : '—', 
                sub: (stats.attendanceSessionsCount || 0) > 0 ? `${stats.attendanceSessionsCount} sessions verified` : 'No verified sessions yet', 
                color: '#6366F1' 
              },
              { 
                label: `${terms?.assignmentLabel || 'Evaluation'} SLA Rate`, 
                value: stats.evaluationRate != null ? `${stats.evaluationRate}%` : '—', 
                sub: (stats.submissionsCount || 0) > 0 ? `${stats.evaluationsCount ?? 0} evaluated of ${stats.submissionsCount}` : 'No submissions yet', 
                color: '#2563EB' 
              },
              { 
                label: `Active ${terms?.educatorPlural || 'Teachers'}`, 
                value: stats.trainersCount ?? 0, 
                sub: (stats.trainersCount || 0) > 0 ? 'Faculty roster' : 'No faculty assigned yet', 
                color: '#D97706' 
              }
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '1.4rem' }}>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.value}</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.74rem', color: item.color, fontWeight: 700, marginTop: '0.25rem' }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
              Cohort Enrollment Breakdown
            </h3>
            {breakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                No active cohorts found for this tenant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {breakdown.map((d, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.name} ({d.code})</span>
                      <span style={{ fontWeight: 800, color: '#6366F1' }}>{d.studentCount} {terms?.learnerPlural || 'Students'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── 2. Administrators Registry View ─────────────────────────────────────────
export const AdministratorsView = () => {
  const { addToast } = useLMS();
  const [administrators, setAdministrators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchAdmins = async () => {
      try {
        setLoading(true);
        const res = await apiService.getAdminAdministrators();
        if (mounted) {
          setAdministrators(res.administrators || []);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load administrator accounts');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAdmins();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Administrator Directory & Security Privileges
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Authorized institutional governance accounts and privileged access controls
          </p>
        </div>
        <button
          onClick={() => addToast('Admin Provisioning', 'Direct administrator provisioning requires corp super-admin authorization.', 'emerald')}
          className="btn-primary"
          style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} />
          <span>Provision New Admin</span>
        </button>
      </div>

      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Loading authorized administrator directory...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#EF4444' }}>{error}</div>
        ) : administrators.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No authorized administrators found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Administrator</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Role & Scope</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Institution / Tenant</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {administrators.map((adm, i) => (
                <tr key={adm._id || i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{adm.name || 'Administrator'}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{adm.email}</div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: adm.role === 'superadmin' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                      color: adm.role === 'superadmin' ? '#D97706' : '#6366F1'
                    }}>
                      {adm.role === 'superadmin' ? 'COMPANY SUPER ADMIN' : 'INSTITUTION ADMIN'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {adm.tenantId ? `${adm.tenantId} (${adm.institutionType || 'institution'})` : 'Global / Company Wide'}
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                      {adm.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── 3. Subjects / Courses Catalog Management View ────────────────────────────
export const SubjectsCatalogView = () => {
  const { terms, institutionType, addToast, selectedInstitution, user } = useLMS();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [newCourse, setNewCourse] = useState({ title: '', code: '', department: 'School of Computing', credits: '3', trainerId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getAdminCourses();
      setCourses(res.courses || []);
    } catch (err) {
      setError(err.message || 'Failed to load course catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiService.getAdminTrainers?.()
      .then(res => {
        if (res?.trainers) setTrainers(res.trainers);
      })
      .catch(() => {});
  }, [selectedInstitution]);

  useEffect(() => {
    if (modalOpen && user?.role === 'superadmin') {
      apiService.getAdminInstitutions()
        .then(res => {
          if (res?.institutions) {
            setInstitutions(res.institutions.filter(i => i.status === 'active' || !i.status));
          }
        })
        .catch(() => {});
      if (!selectedTenantId) {
        setSelectedTenantId(selectedInstitution?._id || selectedInstitution?.id || '');
      }
    }
  }, [modalOpen, user?.role, selectedInstitution]);

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Are you sure you want to delete course "${course.title}" (${course.code})?`)) {
      return;
    }
    setDeletingCourseId(course._id);
    try {
      const res = await apiService.deleteAdminCourse(course._id, false);
      if (res?.success) {
        addToast('Course Deleted', `Course ${course.title} was removed.`, 'emerald');
        fetchCourses();
      } else if (res?.hasDependencies) {
        if (window.confirm(`This course has active assignments or assessments linked to it.\n\nForce delete and cascade cleanup?`)) {
          const forceRes = await apiService.deleteAdminCourse(course._id, true);
          if (forceRes?.success) {
            addToast('Course Force Deleted', `Course and linked resources were removed.`, 'emerald');
            fetchCourses();
          } else {
            addToast('Deletion Error', forceRes?.message || 'Failed to force delete course.', 'rose');
          }
        }
      } else {
        addToast('Deletion Error', res?.message || 'Failed to delete course.', 'rose');
      }
    } catch (err) {
      addToast('Error', err?.message || 'Network error deleting course.', 'rose');
    } finally {
      setDeletingCourseId(null);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [selectedInstitution]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title.trim() || !newCourse.code.trim()) return;

    const effectiveTenantId = (user?.role === 'superadmin')
      ? (selectedTenantId || selectedInstitution?._id || selectedInstitution?.id)
      : (user?.tenantId?._id || user?.tenantId);

    if (!effectiveTenantId) {
      addToast('Institution Required', 'Please select a target institution before registering a course.', 'amber');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiService.createAdminCourse({
        title: newCourse.title.trim(),
        code: newCourse.code.trim().toUpperCase(),
        department: newCourse.department,
        credits: parseInt(newCourse.credits) || 3,
        trainerId: newCourse.trainerId || undefined,
        tenantId: effectiveTenantId,
        targetTenantId: effectiveTenantId
      });
      if (res?.success) {
        addToast('Course Created', `${newCourse.title} registered in curriculum catalog.`, 'emerald');
        setModalOpen(false);
        setNewCourse({ title: '', code: '', department: 'School of Computing', credits: '3', trainerId: '' });
        fetchCourses();
      } else {
        addToast('Creation Failed', res?.message || 'Could not register course.', 'amber');
      }
    } catch (err) {
      addToast('Network Error', err.message, 'amber');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {terms?.coursePlural || 'Course'} Catalog Directory
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Company-governed accredited curriculum, module specifications, and subject management
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary"
          style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} />
          <span>Add Academic {terms?.courseLabel || 'Course'}</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading course catalog from server...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={fetchCourses} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Retry</button>
        </div>
      ) : courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', borderRadius: '16px' }}>
          No academic courses currently registered in the curriculum for this tenant.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {courses.map((c, i) => (
            <div key={c._id || i} className="card card-interactive" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
                  {c.code || 'CRS'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669' }}>{c.status || 'Active'}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCourse(c);
                    }}
                    disabled={deletingCourseId === c._id}
                    className="btn-icon"
                    style={{ width: '26px', height: '26px', color: '#EF4444' }}
                    title="Delete Course"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
                {c.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <div>Department: <strong>{c.department || c.dept || 'General'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>Assigned Faculty:</span>
                  <select
                    value={c.assignedTrainer?._id || c.teacherId || ''}
                    onChange={async (e) => {
                      const val = e.target.value;
                      try {
                        const upRes = await apiService.updateAdminCourse(c._id, { trainerId: val || null });
                        if (upRes?.success) {
                          addToast('Trainer Assigned', `Updated educator for ${c.title}`, 'emerald');
                          fetchCourses();
                        } else {
                          addToast('Assignment Failed', upRes?.message || 'Could not update trainer', 'amber');
                        }
                      } catch (err) {
                        addToast('Error', err.message, 'rose');
                      }
                    }}
                    style={{
                      padding: '0.22rem 0.5rem',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      maxWidth: '180px'
                    }}
                  >
                    <option value="">-- Unassigned --</option>
                    {trainers.map((tr) => (
                      <option key={tr._id || tr.id} value={tr._id || tr.id}>
                        {tr.name} ({tr.email?.split('@')[0]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>Workload: <strong>{c.credits ? `${c.credits} Credits` : 'Standard'}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Subject Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Add Academic Subject / Course
              </h3>
              <button onClick={() => setModalOpen(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {user?.role === 'superadmin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Target Institution / School *
                  </label>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.86rem' }}
                  >
                    <option value="">-- Select Target Institution --</option>
                    {institutions.map((inst) => (
                      <option key={inst._id || inst.id} value={inst._id || inst.id}>
                        {inst.name} ({inst.institutionType === 'school' ? 'School' : 'College'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Subject Name</label>
                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="e.g. Distributed Operating Systems"
                  required
                  style={{ width: '100%', fontSize: '0.86rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Code</label>
                  <input
                    type="text"
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="e.g. CS-401"
                    required
                    style={{ width: '100%', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newCourse.credits}
                    onChange={(e) => setNewCourse({ ...newCourse, credits: e.target.value })}
                    style={{ width: '100%', fontSize: '0.86rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Assigned Trainer / Educator (Optional)
                </label>
                <select
                  value={newCourse.trainerId || ''}
                  onChange={(e) => setNewCourse({ ...newCourse, trainerId: e.target.value })}
                  style={{ width: '100%', fontSize: '0.86rem' }}
                >
                  <option value="">-- Unassigned / Assign Later --</option>
                  {trainers.map((tr) => (
                    <option key={tr._id || tr.id} value={tr._id || tr.id}>
                      {tr.name} ({tr.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Department</label>
                <input
                  type="text"
                  value={newCourse.department}
                  onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                  style={{ width: '100%', fontSize: '0.86rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ backgroundColor: '#D97706', borderColor: '#D97706' }}>
                  {submitting ? 'Creating...' : 'Register Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 4. Academic Structure View ───────────────────────────────────────────────
export const AcademicStructureView = () => {
  const { terms, institutionType, user } = useLMS();
  const [batches, setBatches] = useState([]);
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiService.getAdminBatches().catch(() => ({ batches: [] })),
      apiService.getAdminInstitutionProfile().catch(() => ({ institution: null }))
    ])
      .then(([batchesData, profileData]) => {
        if (mounted) {
          if (batchesData?.batches && Array.isArray(batchesData.batches)) {
            setBatches(batchesData.batches);
          }
          if (profileData?.institution) {
            setInstitution(profileData.institution);
          }
        }
      })
      .catch((err) => console.error('Failed to load academic structure data:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const academicConfig = institution?.settings?.academicConfig;
  const isConfigured = Boolean(
    institution &&
    academicConfig &&
    (academicConfig.academicSession || (academicConfig.gradingScale && academicConfig.gradingScale.length > 0))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Institutional Academic Structure
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Term calendars, active cohorts, grading criteria, academic standing guidelines, and attendance policies
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading academic structure configuration...
        </div>
      ) : !isConfigured ? (
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--border-default)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Institution configuration has not been completed.
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '620px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Academic terms, verified grading scales, and attendance criteria have not been provisioned for this tenant. 
            All academic setup must be configured by an authorized administrator through official institution management workflows.
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Active Tenant: <strong>{institution?.name || user?.tenantName || 'Unassigned / Global Console'}</strong> · Mode: <strong>{institution?.institutionType || institutionType || 'Unconfigured'}</strong>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>
              Active Term & Schedule
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              <div>Campus Institution: <strong style={{ color: 'var(--text-primary)' }}>{institution.name}</strong></div>
              <div>Active Cohorts in Session: <strong>{`${batches.length} ${terms?.groupPlural || 'Batches'}`}</strong></div>
              <div>Academic Session: <strong>{academicConfig.academicSession || 'Not Specified'}</strong></div>
              <div>Minimum Attendance Required: <strong>{academicConfig.minimumAttendance ? `${academicConfig.minimumAttendance}% Verified Calls` : 'Not Specified'}</strong></div>
              <div>Evaluation Turnaround Standard: <strong>{academicConfig.evaluationSlaHours ? `${academicConfig.evaluationSlaHours} Hours SLA` : 'Not Specified'}</strong></div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>
              Institutional Grading Scale
            </h3>
            {academicConfig.gradingScale && academicConfig.gradingScale.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                {academicConfig.gradingScale.map((gradeItem, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-default)' }}>
                    <span>{gradeItem.grade} {gradeItem.label ? `/ ${gradeItem.label}` : ''}</span>
                    <strong style={{ color: '#059669' }}>
                      {gradeItem.minPercentage}% – {gradeItem.maxPercentage}% {gradeItem.gpa !== undefined ? `(${gradeItem.gpa} GPA)` : ''}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No custom grading scale configured for this institution.</div>
            )}
          </div>
        </div>
      )}

      {/* Cohorts Structure Table */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
          Active Provisioned {terms?.groupPlural || 'Cohorts'} ({batches.length})
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading cohorts...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No cohorts currently provisioned.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {batches.map((b) => (
              <div key={b._id || b.id} style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{b.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Code: <code>{b.code}</code> · Dept: {b.department}</div>
                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: '0.4rem' }}>Capacity: {b.maxCapacity || 35} Students</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 5. Attendance Operations View ────────────────────────────────────────────
export const AttendanceOperationsView = () => {
  const { addToast } = useLMS();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getAdminAttendanceStats();
      if (res?.success) {
        setStats(res);
      } else {
        setError(res?.message || 'Failed to load attendance metrics');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Campus-Wide Attendance Operations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Real-time server-authoritative attendance records, verification windows, and live sessions
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Attendance</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading attendance metrics from server...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={fetchStats} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Retry</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Campus Average Attendance', value: `${stats?.averageRate ?? 0}%`, color: '#059669' },
              { label: 'Total Verified Sessions', value: stats?.totalSessions ?? 0, color: '#6366F1' },
              { label: 'Total Recorded Attendances', value: stats?.totalAttendanceRecords ?? 0, color: '#2563EB' },
              { label: 'Active Live Sessions', value: (stats?.activeSessions || []).length, color: '#D97706' }
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '1.35rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.value}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 600 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
              Live & Recent Attendance Sessions
            </h3>
            {(!stats?.activeSessions || stats.activeSessions.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                No active or recent attendance sessions recorded in this tenant scope.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats.activeSessions.map((s, idx) => (
                  <div key={s._id || idx} style={{ padding: '0.9rem 1.1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.batchName || s.subject || 'Session'}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Status: {s.status || 'Active'} · Window: {s.windowSeconds || 60}s</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>Verified</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── 6. Academic Operations View ──────────────────────────────────────────────
export const AcademicOpsView = () => {
  const [opsData, setOpsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOps = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getAdminAcademicOps();
      if (res?.success) {
        setOpsData(res);
      } else {
        setError(res?.message || 'Failed to load academic operations');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching academic operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOps();
  }, []);

  const batches = opsData?.batchBreakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Assignments & Assessment Operations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Monitor real-time submission turnarounds, pending evaluations across faculty, and grading completeness
          </p>
        </div>
        <button
          onClick={fetchOps}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Operations</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading assessment operations from server...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={fetchOps} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Retry</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Submissions Received', value: opsData?.totalSubmissions ?? 0, color: '#2563EB' },
              { label: 'Evaluated Submissions', value: opsData?.evaluatedSubmissions ?? 0, color: '#059669' },
              { label: 'Pending Faculty Grading', value: opsData?.pendingSubmissions ?? 0, color: '#D97706' },
              { label: 'Evaluation SLA Rate', value: `${opsData?.evaluationRate ?? 0}%`, color: '#6366F1' }
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '1.35rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.value}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 600 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
              Active Academic Cohort Evaluation Queue
            </h3>
            {batches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                No active cohorts or assessment submissions found for this tenant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {batches.map((item, i) => (
                  <div key={item.batchId || i} style={{ padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name} ({item.code})</strong>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {item.total} Submissions Received · {item.graded} Evaluated
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', backgroundColor: item.pending === 0 ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)', color: item.pending === 0 ? '#059669' : '#D97706' }}>
                      {item.pending === 0 ? 'All Evaluated ✓' : `${item.pending} Pending Review`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── 7. Announcements Operations View ─────────────────────────────────────────
export const AnnouncementsOpsView = () => {
  const { addToast, user, selectedInstitution } = useLMS();
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [targetBatchId, setTargetBatchId] = useState('all');
  const [batches, setBatches] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const [annRes, batchRes] = await Promise.all([
        apiService.getAdminAnnouncements(),
        apiService.getAdminBatches().catch(() => null)
      ]);
      if (annRes?.success && Array.isArray(annRes.announcements)) {
        setAnnouncements(annRes.announcements);
      }
      if (batchRes?.batches && Array.isArray(batchRes.batches)) {
        setBatches(batchRes.batches);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    const unsub = socketService.onAnnouncement(() => {
      loadAnnouncements();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!headline.trim() || !body.trim()) return;

    setSubmitting(true);
    try {
      const targetBatch = batches.find(b => String(b._id || b.id) === String(targetBatchId));
      const effectiveTenantId = (user?.role === 'superadmin')
        ? (selectedInstitution?._id || selectedInstitution?.id || undefined)
        : (user?.tenantId?._id || user?.tenantId);

      const payload = {
        title: headline.trim(),
        content: body.trim(),
        message: body.trim(),
        priority,
        batchId: targetBatchId !== 'all' ? targetBatchId : undefined,
        batchName: targetBatch ? targetBatch.name : undefined,
        status: 'published',
        tenantId: effectiveTenantId,
        targetTenantId: effectiveTenantId
      };

      const res = await apiService.createAdminAnnouncement(payload);
      if (res?.success) {
        addToast('Campus Circular Published', `"${headline}" broadcasted to all accounts.`, 'emerald');
        setHeadline('');
        setBody('');
        setPriority('normal');
        setTargetBatchId('all');
        loadAnnouncements();
      } else {
        addToast('Broadcast Notice', res?.message || 'Failed to publish campus circular.', 'rose');
      }
    } catch (err) {
      addToast('Network Error', 'Failed to reach announcement broadcast server.', 'rose');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await apiService.deleteAdminAnnouncement(id);
      if (res?.success) {
        setAnnouncements(prev => prev.filter(a => (a.id || a._id) !== id));
        addToast('Circular Removed', 'Announcement deleted from official noticeboard.', 'emerald');
      } else {
        addToast('Error', res?.message || 'Failed to delete announcement.', 'rose');
      }
    } catch (err) {
      addToast('Network Error', 'Could not reach server to delete circular.', 'rose');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Institution-Wide Circulars & Noticeboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Official bulletins broadcast to all students, faculty members, and campus departments
          </p>
        </div>
        <button
          onClick={loadAnnouncements}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Circulars</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.4fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Creation Form */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#D97706" />
            <span>Publish Campus Bulletin</span>
          </h3>
          <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Bulletin Title
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Schedule for Academic Term Finals & Campus Holidays"
                required
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Target Audience
                </label>
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.84rem' }}
                >
                  <option value="all">Entire Campus (All Students & Faculty)</option>
                  {batches.map(b => (
                    <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Broadcast Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.84rem' }}
                >
                  <option value="normal">Normal Bulletin</option>
                  <option value="important">Important Notice</option>
                  <option value="urgent">Urgent Alert / Campus Action</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Official Announcement Body
              </label>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type the full campus circular text..."
                required
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.88rem', resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ backgroundColor: '#D97706', borderColor: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700, padding: '0.75rem' }}
            >
              <Bell size={16} />
              <span>{submitting ? 'Broadcasting...' : 'Publish Campus Bulletin'}</span>
            </button>
          </form>
        </div>

        {/* Existing Announcements Feed */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Active Noticeboard Bulletins ({announcements.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real MongoDB Persisted</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Loading published announcements...
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1px dashed var(--border-default)', borderRadius: '12px' }}>
              <Bell size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Circulars Published Yet</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                Bulletins published via the form on the left will immediately broadcast to student and faculty portals.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {announcements.map((ann) => {
                const annId = ann.id || ann._id;
                const isUrgent = ann.priority === 'urgent';
                return (
                  <div
                    key={annId}
                    style={{
                      padding: '1.1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: isUrgent ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                            color: isUrgent ? '#EF4444' : '#D97706'
                          }}>
                            {ann.badge || (isUrgent ? 'Urgent Alert' : 'Campus Notice')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Audience: {ann.audience || ann.batchName || 'All Campus'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {ann.title}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleDelete(annId)}
                        disabled={deletingId === annId}
                        className="btn-icon"
                        title="Delete Announcement"
                        style={{ color: '#EF4444', width: '28px', height: '28px', flexShrink: 0 }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {ann.content || ann.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', paddingTop: '0.35rem', borderTop: '1px solid var(--border-default)' }}>
                      <span>By {ann.author || ann.authorName || 'School Administration'}</span>
                      <span>{ann.date || 'Recent'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 7b. Doubts & Student Mentoring Operations View ───────────────────────────
export const DoubtsOpsView = () => {
  const { addToast } = useLMS();
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadDoubts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAdminDoubts();
      if (res?.success && Array.isArray(res.doubts)) {
        setDoubts(res.doubts);
      } else {
        setError(res?.message || 'Failed to load student doubts.');
      }
    } catch (err) {
      setError('Network error loading student doubts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoubts();
    const unsubNew = socketService.onDoubtNew(() => {
      loadDoubts();
    });
    const unsubAnswered = socketService.onDoubtAnswered(() => {
      loadDoubts();
    });
    return () => {
      if (typeof unsubNew === 'function') unsubNew();
      if (typeof unsubAnswered === 'function') unsubAnswered();
    };
  }, []);

  const handleReply = async (id) => {
    const text = replyText[id];
    if (!text || !text.trim()) return;

    setSubmittingId(id);
    try {
      const res = await apiService.replyAdminDoubt(id, text.trim());
      if (res?.success) {
        setDoubts(prev => prev.map(d => (d.id === id || d._id === id ? { ...d, status: 'Answered', response: text.trim(), reply: text.trim() } : d)));
        setReplyText(prev => ({ ...prev, [id]: '' }));
        addToast('Reply Sent', 'Student has been notified of official administration reply.', 'emerald');
      } else {
        addToast('Error', res?.message || 'Failed to deliver reply.', 'rose');
      }
    } catch (err) {
      addToast('Network Error', 'Could not reach server to deliver reply.', 'rose');
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredDoubts = doubts.filter(d => {
    const matchStatus = statusFilter === 'ALL' || d.status?.toUpperCase() === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchQuery = !q ||
      d.studentName?.toLowerCase().includes(q) ||
      d.subject?.toLowerCase().includes(q) ||
      d.topic?.toLowerCase().includes(q) ||
      d.question?.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Student Inquiries & Academic Helpdesk
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Comprehensive institution oversight of student doubts, teacher replies, and resolution turnaround
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={loadDoubts}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh Inquiries</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries by student, topic, subject..."
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.86rem', color: 'var(--text-primary)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {['ALL', 'SUBMITTED', 'ANSWERED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="btn-ghost"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: statusFilter === status ? 'var(--bg-secondary)' : 'transparent',
                color: statusFilter === status ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
            >
              {status === 'ALL' ? 'All Inquiries' : status === 'SUBMITTED' ? 'Pending Action' : 'Answered'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
          Loading student inquiries from server...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={loadDoubts} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Retry</button>
        </div>
      ) : filteredDoubts.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '14px' }}>
          <CheckCircle2 size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
            No Student Doubts Found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>
            {statusFilter === 'ALL' ? 'No doubts or questions have been submitted by students in this institution yet.' : `No inquiries matching the "${statusFilter}" filter.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredDoubts.map(d => {
            const doubtId = d.id || d._id;
            const isAnswered = d.status === 'Answered';
            return (
              <div key={doubtId} className="card" style={{ padding: '1.4rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: isAnswered ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)', color: isAnswered ? '#059669' : '#D97706' }}>
                        {isAnswered ? 'Answered ✓' : 'Awaiting Reply'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Subject: <strong style={{ color: 'var(--text-primary)' }}>{d.subject}</strong>
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        · Topic: <strong style={{ color: 'var(--text-primary)' }}>{d.topic}</strong>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      From: <strong style={{ color: 'var(--text-primary)' }}>{d.studentName}</strong> ({d.studentId})
                    </div>
                  </div>

                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>

                <div style={{ padding: '0.9rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {d.question}
                </div>

                {isAnswered && (
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', backgroundColor: 'rgba(5, 150, 105, 0.06)', border: '1px solid rgba(5, 150, 105, 0.25)' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>
                      Official Reply from {d.teacherName || 'Faculty / Administration'}:
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {d.reply || d.response}
                    </div>
                  </div>
                )}

                {!isAnswered && (
                  <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Type official administration or faculty reply..."
                      value={replyText[doubtId] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [doubtId]: e.target.value })}
                      style={{ flex: 1, padding: '0.55rem 0.85rem', fontSize: '0.84rem', borderRadius: '8px' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleReply(doubtId);
                      }}
                    />
                    <button
                      onClick={() => handleReply(doubtId)}
                      disabled={submittingId === doubtId || !replyText[doubtId]?.trim()}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#059669', borderColor: '#059669' }}
                    >
                      <Send size={14} />
                      <span>{submittingId === doubtId ? 'Sending...' : 'Send Reply'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── 8. Reports & Compliance View ─────────────────────────────────────────────

// ─── 8. Reports & Compliance View ─────────────────────────────────────────────
export const OperationsReportsView = () => {
  const { addToast } = useLMS();
  const [exporting, setExporting] = useState('');

  const exportStudents = async () => {
    try {
      setExporting('students');
      const res = await apiService.getAdminStudents();
      const students = res?.students || [];
      if (students.length === 0) {
        addToast('Export Notice', 'No student records available to export.', 'amber');
        return;
      }
      const headers = ['ID', 'Name', 'Email', 'Role', 'Tenant', 'Phone', 'Address'];
      const rows = students.map(s => [s._id, s.name, s.email, s.role, s.tenantId, s.phone || '', s.address || '']);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${(x||'').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `students_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Export Successful', `Exported ${students.length} student records to CSV.`, 'emerald');
    } catch (err) {
      addToast('Export Failed', err.message, 'amber');
    } finally {
      setExporting('');
    }
  };

  const exportBatches = async () => {
    try {
      setExporting('batches');
      const data = await apiService.getAdminBatches();
      const batches = data?.batches || [];
      if (batches.length === 0) {
        addToast('Export Notice', 'No batch records available to export.', 'amber');
        return;
      }
      const headers = ['ID', 'Name', 'Code', 'Department', 'Semester', 'Capacity'];
      const rows = batches.map(b => [b._id, b.name, b.code, b.department || '', b.semester || '', b.maxCapacity || '']);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${(x||'').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `cohorts_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Export Successful', `Exported ${batches.length} cohorts to CSV.`, 'emerald');
    } catch (err) {
      addToast('Export Failed', err.message, 'amber');
    } finally {
      setExporting('');
    }
  };

  const exportAuditLogs = async () => {
    try {
      setExporting('audit');
      const res = await apiService.getAdminAuditLogs();
      const logs = res?.logs || [];
      if (logs.length === 0) {
        addToast('Export Notice', 'No audit logs available to export.', 'amber');
        return;
      }
      const headers = ['ID', 'Action', 'ActorEmail', 'ActorRole', 'Status', 'Timestamp'];
      const rows = logs.map(l => [l._id, l.action, l.actorEmail || l.actor || '', l.actorRole || l.role || '', l.status || '', l.createdAt || l.time || '']);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${(x||'').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `security_audit_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Export Successful', `Exported ${logs.length} audit records to CSV.`, 'emerald');
    } catch (err) {
      addToast('Export Failed', err.message, 'amber');
    } finally {
      setExporting('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Institutional Reports & Operational Data Exports
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Server-authoritative compliance filings, enrollment audits, and grading governance records
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {[
          { title: 'Enrolled Students Master Roster', desc: 'Active student accounts, identity records, and profile completion info', format: 'CSV', key: 'students', action: exportStudents },
          { title: 'Academic Cohorts & Batches Directory', desc: 'Provisioned classes, department affiliations, and enrollment caps', format: 'CSV', key: 'batches', action: exportBatches },
          { title: 'Security Audit & RBAC Access Log Export', desc: 'Privileged operations, login audits, and role verification trails', format: 'CSV', key: 'audit', action: exportAuditLogs }
        ].map((r, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {r.title}
                </h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {r.desc} · Format: {r.format}
                </div>
              </div>
            </div>

            <button
              onClick={r.action}
              disabled={exporting === r.key}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={15} />
              <span>{exporting === r.key ? 'Generating...' : 'Export Real Data'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── 9. Security Audit Logs View ──────────────────────────────────────────────
export const AuditLogsView = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const fetchLogs = async (targetPage = page, action = actionFilter, actor = actorFilter) => {
    try {
      setLoading(true);
      const res = await apiService.getAdminAuditLogs({
        page: targetPage,
        limit: 25,
        action: action || undefined,
        actor: actor || undefined
      });
      setAuditLogs(res.logs || []);
      setTotal(res.total || 0);
      setPage(res.page || targetPage);
      setTotalPages(res.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load security audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, actionFilter, actorFilter);
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1, actionFilter, actorFilter);
  };

  const handleResetFilters = () => {
    setActionFilter('');
    setActorFilter('');
    fetchLogs(1, '', '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Security & Identity Audit Trails
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Server-authoritative immutable audit logs for authentication, temporary password resets, and RBAC actions
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleFilterSubmit} className="card" style={{ padding: '1rem 1.25rem', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter by actor email..."
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          style={{ flex: '1 1 200px', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.84rem' }}
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ flex: '1 1 200px', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.84rem' }}
        >
          <option value="">All Security Actions</option>
          <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
          <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
          <option value="SUPERADMIN_LOGIN_PASSWORD_ONLY_TESTING">SUPERADMIN_LOGIN_PASSWORD_ONLY_TESTING</option>
          <option value="USER_PASSWORD_RESET">USER_PASSWORD_RESET</option>
          <option value="COMPANY_ADMIN_INSTITUTION_REGISTERED">COMPANY_ADMIN_INSTITUTION_REGISTERED</option>
          <option value="COMPANY_ADMIN_INSTITUTION_UPDATED">COMPANY_ADMIN_INSTITUTION_UPDATED</option>
          <option value="SECURITY_POLICY_UPDATED">SECURITY_POLICY_UPDATED</option>
        </select>
        <button type="submit" className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
          Apply Filter
        </button>
        {(actionFilter || actorFilter) && (
          <button type="button" onClick={handleResetFilters} className="btn-ghost" style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}>
            Clear
          </button>
        )}
      </form>

      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Loading audit trails from database...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#EF4444' }}>{error}</div>
        ) : auditLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No security audit log entries recorded in this tenant scope.
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Security Action</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Actor</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status / Result</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => {
                  const isBlocked = (log.action || '').includes('FAIL') || 
                                    (log.action || '').includes('BLOCKED') || 
                                    (log.action || '').includes('DENIED') ||
                                    log.details?.status === 'failed';
                  return (
                    <tr key={log._id || i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                        {log.actor?.email || log.actorEmail || log.actor || 'System'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textTransform: 'capitalize' }}>
                        {log.actor?.role || log.actorRole || log.role || 'System'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isBlocked
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(5, 150, 105, 0.1)',
                          color: isBlocked
                            ? '#f87171'
                            : '#059669'
                        }}>
                          {isBlocked ? 'Blocked' : 'Audited'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : (log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-default)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div>
                Showing <strong>{auditLogs.length}</strong> of <strong>{total}</strong> verified audit events
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => fetchLogs(page - 1, actionFilter, actorFilter)}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  Previous
                </button>
                <span>Page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => fetchLogs(page + 1, actionFilter, actorFilter)}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── 10. Platform Security Policies View (Active Policy Governance) ────────────
export const SecurityPoliciesView = () => {
  const { user, addToast } = useLMS();
  const isSuperAdmin = user?.role === 'superadmin';
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form states for SuperAdmin editing
  const [requireAdminMfa, setRequireAdminMfa] = useState(true);
  const [requireTrainerMfa, setRequireTrainerMfa] = useState(false);
  const [minLength, setMinLength] = useState(12);
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireNumbers, setRequireNumbers] = useState(true);
  const [requireSpecialChars, setRequireSpecialChars] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(120);
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(3);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      const res = await apiService.getSecurityPolicies();
      if (res?.success && res.policy) {
        setPolicyData(res.policy);
        const p = res.policy;
        if (p.mfaPolicy) {
          setRequireAdminMfa(p.mfaPolicy.requireAdminMfa ?? true);
          setRequireTrainerMfa(p.mfaPolicy.requireTrainerMfa ?? false);
        }
        if (p.passwordPolicy) {
          setMinLength(p.passwordPolicy.minLength ?? 12);
          setRequireUppercase(p.passwordPolicy.requireUppercase ?? true);
          setRequireNumbers(p.passwordPolicy.requireNumbers ?? true);
          setRequireSpecialChars(p.passwordPolicy.requireSpecialChars ?? true);
        }
        if (p.sessionPolicy) {
          setSessionTimeout(p.sessionPolicy.sessionTimeoutMinutes ?? 120);
          setMaxConcurrentSessions(p.sessionPolicy.maxConcurrentSessions ?? 3);
        }
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load security policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    try {
      setSaving(true);
      const payload = {
        mfaPolicy: {
          requireAdminMfa,
          requireTrainerMfa
        },
        passwordPolicy: {
          minLength: parseInt(minLength),
          requireUppercase,
          requireNumbers,
          requireSpecialChars
        },
        sessionPolicy: {
          sessionTimeoutMinutes: parseInt(sessionTimeout),
          maxConcurrentSessions: parseInt(maxConcurrentSessions)
        }
      };
      const res = await apiService.updateSecurityPolicies(payload);
      if (res?.success) {
        addToast('Security Policies Updated', 'Platform security policy configuration updated and audited.', 'emerald');
        fetchPolicy();
      } else {
        addToast('Update Failed', res.message || 'Could not update policies.', 'rose');
      }
    } catch (err) {
      addToast('Error', err.message || 'Failed to update security policies', 'rose');
    } finally {
      setSaving(false);
    }
  };

  const isFrozen = policyData?.runtimeContext?.superAdmin2FaFrozen;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Platform Security Policies & RBAC
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {isSuperAdmin
              ? 'Global Super-Administrator governance of authentication, session lifetimes, and tenant isolation'
              : 'Enforced server-side platform security configuration (Read-Only Organization View)'}
          </p>
        </div>
      </div>

      {isSuperAdmin && isFrozen && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', backgroundColor: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', color: '#D97706', fontSize: '0.84rem' }}>
          <strong>⚠️ Non-Production Failsafe Notice:</strong> SuperAdmin 2FA is temporarily frozen in development/staging via configuration (<code>ENABLE_SUPERADMIN_2FA=false</code>) to enable onboarding and testing. Mandatory production 2FA enforcement remains intact and cannot be disabled.
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading platform security policies...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '1.5rem', color: '#EF4444' }}>{error}</div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            
            {/* MFA Policy Card */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                Multi-Factor Authentication (MFA)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Super-Admin Mandatory MFA</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Passkey / TOTP / Email OTP verification</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: (isSuperAdmin && isFrozen) ? '#D97706' : '#059669', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: (isSuperAdmin && isFrozen) ? 'rgba(217, 119, 6, 0.1)' : 'rgba(5, 150, 105, 0.1)' }}>
                    {(isSuperAdmin && isFrozen) ? 'Frozen (Dev)' : 'Enforced (Prod)'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Require Admin MFA</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>School & College Administrators</div>
                  </div>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={requireAdminMfa}
                      onChange={(e) => setRequireAdminMfa(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  ) : (
                    <span style={{ fontWeight: 700, color: requireAdminMfa ? '#059669' : 'var(--text-muted)' }}>
                      {requireAdminMfa ? 'Active' : 'Optional'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Require Trainer / Faculty MFA</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Educator account security</div>
                  </div>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={requireTrainerMfa}
                      onChange={(e) => setRequireTrainerMfa(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  ) : (
                    <span style={{ fontWeight: 700, color: requireTrainerMfa ? '#059669' : 'var(--text-muted)' }}>
                      {requireTrainerMfa ? 'Active' : 'Optional'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Password Policy Card */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                Password Complexity & Expiration
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Minimum Password Length</span>
                  {isSuperAdmin ? (
                    <input
                      type="number"
                      min="8"
                      max="64"
                      value={minLength}
                      onChange={(e) => setMinLength(e.target.value)}
                      style={{ width: '70px', padding: '0.3rem', borderRadius: '6px', textAlign: 'center' }}
                    />
                  ) : (
                    <strong>{minLength} characters</strong>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Require Uppercase Letters</span>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={requireUppercase}
                      onChange={(e) => setRequireUppercase(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  ) : (
                    <span style={{ color: requireUppercase ? '#059669' : 'var(--text-muted)', fontWeight: 700 }}>
                      {requireUppercase ? '✓ Enforced' : 'Optional'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Require Numeric Digits</span>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={requireNumbers}
                      onChange={(e) => setRequireNumbers(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  ) : (
                    <span style={{ color: requireNumbers ? '#059669' : 'var(--text-muted)', fontWeight: 700 }}>
                      {requireNumbers ? '✓ Enforced' : 'Optional'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Require Special Characters</span>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={requireSpecialChars}
                      onChange={(e) => setRequireSpecialChars(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  ) : (
                    <span style={{ color: requireSpecialChars ? '#059669' : 'var(--text-muted)', fontWeight: 700 }}>
                      {requireSpecialChars ? '✓ Enforced' : 'Optional'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Policy Card */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                Session & Lifecycle Boundaries
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Session Timeout</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>JWT and cookie expiration</div>
                  </div>
                  {isSuperAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="number"
                        min="15"
                        max="1440"
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(e.target.value)}
                        style={{ width: '80px', padding: '0.3rem', borderRadius: '6px', textAlign: 'center' }}
                      />
                      <span>mins</span>
                    </div>
                  ) : (
                    <strong>{sessionTimeout} minutes</strong>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Max Concurrent Sessions</span>
                  {isSuperAdmin ? (
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxConcurrentSessions}
                      onChange={(e) => setMaxConcurrentSessions(e.target.value)}
                      style={{ width: '60px', padding: '0.3rem', borderRadius: '6px', textAlign: 'center' }}
                    />
                  ) : (
                    <strong>{maxConcurrentSessions} active sessions</strong>
                  )}
                </div>
              </div>
            </div>

            {/* Strict Tenant Isolation Card */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
                Multi-Tenant Isolation Architecture
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: 800 }}>
                  <span>✓</span>
                  <span>Strict Query-Level Tenant Scoping</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                  All queries for students, cohorts, attendance, submissions, and grades are bound to the authenticated <code>tenantId</code>. Cross-tenant access is structurally prohibited.
                </p>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Architecture Rule: <strong>Immutable Platform Security Constraint</strong>
                </div>
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.88rem' }}
              >
                {saving ? 'Updating Policies...' : 'Save Security Policies'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export const PermissionsView = SecurityPoliciesView;

// ─── 11. Institution Settings View (Tenant Configuration) ─────────────────────
export const InstitutionSettingsView = () => {
  const { portalConfig, updatePortalConfig, institutionType, user, addToast } = useLMS();
  const [institution, setInstitution] = useState(null);
  const [instName, setInstName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiService.getAdminInstitutionProfile()
      .then((res) => {
        if (mounted && res?.institution) {
          setInstitution(res.institution);
          setInstName(res.institution.name || portalConfig?.companyName || '');
          setShortCode(res.institution.code || portalConfig?.shortName || '');
        } else if (mounted) {
          setInstName(portalConfig?.companyName || 'EdWth Academy');
          setShortCode(portalConfig?.shortName || 'EDWTH');
        }
      })
      .catch(() => {
        if (mounted) {
          setInstName(portalConfig?.companyName || 'EdWth Academy');
          setShortCode(portalConfig?.shortName || 'EDWTH');
        }
      });
    return () => { mounted = false; };
  }, [portalConfig]);

  const activeMode = institution?.institutionType || institutionType;
  const isSchool = activeMode === 'school';
  const isCollege = activeMode === 'college';
  const isUnconfigured = !isSchool && !isCollege;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      updatePortalConfig({
        companyName: instName,
        shortName: shortCode
      });
      if (institution?._id) {
        await apiService.updateAdminInstitution(institution._id, {
          name: instName
        });
      }
      addToast('Institution Settings Saved', 'Branding parameters updated across portal views.', 'emerald');
    } catch (err) {
      addToast('Error', err.message || 'Could not update institution branding', 'rose');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Institution Configuration & Multi-Tenant Branding
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Server-governed tenant parameters, brand logos, and campus details
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Institution Type Display */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Institutional Tenant Mode
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
            Operating model provisioned and bound to your institution license.
          </p>

          {isUnconfigured && (
            <div style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706', fontSize: '0.82rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ Operating mode not configured
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: isCollege ? '2px solid #6366F1' : '1px solid var(--border-default)',
                backgroundColor: isCollege ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                opacity: isCollege ? 1 : 0.45
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                🏛️ College Mode {isCollege && '✓ Selected'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Batches, Courses, Assignments, Code Lab, Capstone Projects
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: isSchool ? '2px solid #2563EB' : '1px solid var(--border-default)',
                backgroundColor: isSchool ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-secondary)',
                opacity: isSchool ? 1 : 0.45
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                🏫 School Mode {isSchool && '✓ Selected'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Classes, Subjects, Homework, Tests, Marks, Clean Friendly UI
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
            Note: Tenant operating mode is server-authoritative and determined by your organization license. Tenant administrators cannot switch modes directly; contact your Super-Administrator to adjust provisioning.
          </p>
        </div>

        {/* Branding Form */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
            Institution Identity
          </h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Institution Name
              </label>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Short Code / Tenant ID
              </label>
              <input
                type="text"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                required
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontWeight: 700, padding: '0.75rem' }}
            >
              Save Institution Branding
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── 12. Institutions Directory & Onboarding Management ──────────────────────
export const InstitutionsDirectoryView = () => {
  const { addToast } = useLMS();
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    tenantId: '',
    operatingModel: 'college',
    contactEmail: ''
  });

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getAdminInstitutions();
      if (res?.success) {
        setInstitutions(res.institutions || []);
      } else {
        setError(res?.message || 'Failed to load institutions');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching institutions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.tenantId.trim()) return;
    try {
      setSubmitting(true);
      const res = await apiService.createAdminInstitution({
        name: form.name.trim(),
        tenantId: form.tenantId.trim().toLowerCase(),
        operatingModel: form.operatingModel,
        contactEmail: form.contactEmail.trim()
      });
      if (res?.success) {
        addToast('Institution Registered', `${form.name} registered under tenant ${form.tenantId}`, 'emerald');
        setModalOpen(false);
        setForm({ name: '', tenantId: '', operatingModel: 'college', contactEmail: '' });
        fetchInstitutions();
      } else {
        addToast('Registration Error', res?.message || 'Could not register institution', 'amber');
      }
    } catch (err) {
      addToast('Network Error', err.message, 'amber');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (inst) => {
    const nextStatus = inst.status === 'active' ? 'setup_pending' : 'active';
    try {
      const res = await apiService.updateAdminInstitution(inst._id, { status: nextStatus });
      if (res?.success) {
        addToast('Status Updated', `${inst.name} is now ${nextStatus}`, 'emerald');
        fetchInstitutions();
      }
    } catch (err) {
      addToast('Update Failed', err.message, 'amber');
    }
  };

  const filtered = institutions.filter(i =>
    (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.tenantId || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Managed Academic Institutions
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Multi-tenant institution registry operated centrally by 6th Civilians Corporation
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchInstitutions}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary"
            style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>Register Institution</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '400px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search institutions by name or tenant ID..."
          style={{ width: '100%', fontSize: '0.86rem' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading institution directory...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={fetchInstitutions} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', borderRadius: '16px' }}>
          No academic institutions registered yet. Click "Register Institution" to onboard an institution.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filtered.map((inst) => (
            <div key={inst._id || inst.tenantId} className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>
                    {inst.tenantId?.toUpperCase()}
                  </span>
                  <button
                    onClick={() => toggleStatus(inst)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '100px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: inst.status === 'active' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                      color: inst.status === 'active' ? '#059669' : '#D97706'
                    }}
                    title="Click to toggle active / setup_pending status"
                  >
                    {inst.status === 'active' ? 'Active ✓' : 'Setup Pending'}
                  </button>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                  {inst.name}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <div>Operating Model: <strong style={{ textTransform: 'capitalize' }}>{inst.operatingModel || 'College'}</strong></div>
                  <div>Enrolled Students: <strong>{inst.studentCount ?? inst.studentsCount ?? 0}</strong></div>
                  <div>Faculty / Trainers: <strong>{inst.trainerCount ?? inst.trainersCount ?? 0}</strong></div>
                  <div>Academic Cohorts: <strong>{inst.batchCount ?? inst.batchesCount ?? 0}</strong></div>
                  {inst.contactEmail && <div>Contact: <span>{inst.contactEmail}</span></div>}
                </div>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Created {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : 'Active'}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#6366F1', fontWeight: 700 }}>
                  Isolated Tenant Scope
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registration Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} color="#D97706" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Register Academic Institution
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Provision a new client tenant under central corporate governance
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Institution Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Metro Technical Academy or Horizon High School"
                  required
                  style={{ width: '100%', fontSize: '0.86rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Canonical Tenant ID
                  </label>
                  <input
                    type="text"
                    value={form.tenantId}
                    onChange={(e) => setForm({ ...form, tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    placeholder="e.g. metro-academy"
                    required
                    style={{ width: '100%', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Operating Model
                  </label>
                  <select
                    value={form.operatingModel}
                    onChange={(e) => setForm({ ...form, operatingModel: e.target.value })}
                    style={{ width: '100%', fontSize: '0.86rem' }}
                  >
                    <option value="college">College (Higher Ed)</option>
                    <option value="school">School (K-12)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Contact Email
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="admin@institution.edu"
                  style={{ width: '100%', fontSize: '0.86rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ backgroundColor: '#D97706', borderColor: '#D97706' }}>
                  {submitting ? 'Registering...' : 'Provision Institution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
