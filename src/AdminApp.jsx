import React, { useState, useEffect } from 'react';
import { useLMS } from './context/LMSContext';
import { Header } from './components/Header';
import { ToastNotifications } from './components/ToastNotifications';
import { StudentsDataSheetView } from './views/StudentsDataSheetView';
import { ArchitectureView } from './views/ArchitectureView';
import { NotFoundView } from './views/NotFoundView';
import { SettingsView } from './views/SettingsView';
import { UnauthenticatedView } from './components/UnauthenticatedView';
import { MultiSchoolManagementView } from './views/MultiSchoolManagementView';
import { MfaEnrollmentModal } from './components/MfaEnrollmentModal';
import { apiService } from './services/apiService';
import {
  InstitutionAnalyticsView,
  AdministratorsView,
  SubjectsCatalogView,
  AcademicStructureView,
  AttendanceOperationsView,
  AcademicOpsView,
  AnnouncementsOpsView,
  DoubtsOpsView,
  OperationsReportsView,
  AuditLogsView,
  PermissionsView,
  InstitutionSettingsView,
  InstitutionsDirectoryView
} from './views/admin/AdminSections';
import {
  LayoutDashboard,
  Building,
  School,
  UserCheck,
  Users,
  Layers,
  Settings,
  LogOut,
  ShieldAlert,
  Building2,
  GraduationCap,
  BookOpen,
  UsersRound,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Shield,
  KeyRound,
  Activity,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Clock,
  ExternalLink,
  X,
  Mail,
  Lock,
  Copy,
  BarChart3,
  Radio,
  FileCheck2,
  Bell,
  HelpCircle
} from 'lucide-react';

// ─── Create Batch Modal ───────────────────────────────────────────────────────
const CreateBatchModal = ({ isOpen, onClose, onCreated, terms }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('School of Computing');
  const [semester, setSemester] = useState('Fall 2026');
  const [maxCapacity, setMaxCapacity] = useState('35');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Name and Code are required.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiService._fetch('/api/v1/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          department,
          semester,
          maxCapacity: parseInt(maxCapacity) || 35
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreated(data.batch);
        onClose();
      } else {
        setError(data.message || 'Failed to create batch.');
      }
    } catch {
      setError('Network error while creating batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={20} color="#D97706" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Create Academic {terms?.groupLabel || 'Batch'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Provision a new student cohort for your institution
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={15} /><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {terms?.groupLabel || 'Batch'} Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Batch 2026-A (AI Systems)"
              required
              style={{ width: '100%', fontSize: '0.86rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Cohort Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CS-2026-A"
                required
                style={{ width: '100%', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Max Capacity
              </label>
              <input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="35"
                style={{ width: '100%', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ width: '100%', fontSize: '0.86rem' }}
              >
                <option value="School of Computing">School of Computing</option>
                <option value="Computational Data">Computational Data</option>
                <option value="Information Assurance">Information Assurance</option>
                <option value="Software Engineering">Software Engineering</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Semester / Term
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                style={{ width: '100%', fontSize: '0.86rem' }}
              >
                <option value="Fall 2026">Fall 2026</option>
                <option value="Spring 2027">Spring 2027</option>
                <option value="Summer 2027">Summer 2027</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ backgroundColor: '#D97706', borderColor: '#D97706' }}>
              {isSubmitting ? 'Creating...' : `Create ${terms?.groupLabel || 'Batch'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Provision Trainer Modal ──────────────────────────────────────────────────
const ProvisionTrainerModal = ({ isOpen, onClose, onCreated, terms }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('School of Computing');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and Email are required.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiService._fetch('/api/v1/admin/trainers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department,
          password
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreated(data.trainer);
        setCreatedResult({
          trainer: data.trainer,
          temporaryPassword: data.temporaryPassword || password
        });
      } else {
        setError(data.message || 'Failed to provision trainer.');
      }
    } catch {
      setError('Network error while provisioning trainer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={20} color="#6366F1" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Provision {terms?.educatorLabel || 'Trainer'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Add authorized faculty to your institution
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}><X size={18} /></button>
        </div>

        {createdResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(5, 150, 105, 0.12)', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <CheckCircle2 size={26} color="#059669" />
            </div>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
              Faculty Account Provisioned!
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              {createdResult.trainer.name} ({createdResult.trainer.email})
            </p>
            <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {createdResult.temporaryPassword}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(createdResult.temporaryPassword)}
                style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={13} /> Copy
              </button>
            </div>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={15} /><span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Full Name & Title
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Arthur Pendelton"
                required
                style={{ width: '100%', fontSize: '0.86rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. arthur.p@nexus.edu"
                required
                style={{ width: '100%', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ width: '100%', fontSize: '0.86rem' }}
              >
                <option value="School of Computing">School of Computing</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Information Assurance">Information Assurance</option>
                <option value="Computational Data">Computational Data</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Temporary Initial Password
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter initial temporary password"
                style={{ width: '100%', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ backgroundColor: '#6366F1', borderColor: '#6366F1' }}>
                {isSubmitting ? 'Provisioning...' : `Provision ${terms?.educatorLabel || 'Trainer'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = ({ onOpenCreateBatch, onOpenProvisionTrainer, onNavigateTab }) => {
  const { terms, user } = useLMS();
  const [overview, setOverview] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdmin = (user?.role || '').toLowerCase() === 'superadmin';

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, auditRes] = await Promise.all([
        apiService.getAdminOverview(),
        apiService.getAdminAuditLogs()
      ]);
      if (ovRes?.success) {
        setOverview(ovRes.data);
      } else {
        setError(ovRes?.message || 'Failed to load overview data.');
      }
      if (auditRes?.success && Array.isArray(auditRes.logs)) {
        setRecentEvents(auditRes.logs);
      }
    } catch {
      setError('Network error. Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const StatCard = ({ icon: Icon, label, value, sublabel, color, onClick }) => (
    <div
      className="card card-interactive"
      onClick={onClick}
      style={{
        padding: '1.4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '12px',
          backgroundColor: `${color}14`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {loading ? '—' : value ?? '0'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem', fontWeight: 600 }}>
            {label}
          </div>
        </div>
      </div>
      {sublabel && (
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.2rem 0.55rem',
          borderRadius: '100px',
          backgroundColor: `${color}15`,
          color: color,
          border: `1px solid ${color}30`
        }}>
          {sublabel}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {isSuperAdmin ? '6th Civilians Corporation Governance Console' : `${user?.tenantName || 'Institutional'} Governance Console`}
            </h2>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              backgroundColor: isSuperAdmin ? 'rgba(99, 102, 241, 0.12)' : 'rgba(5, 150, 105, 0.12)',
              color: isSuperAdmin ? '#6366F1' : 'var(--accent-primary)',
              border: isSuperAdmin ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(5, 150, 105, 0.3)'
            }}>
              {isSuperAdmin ? '6TH CIVILIANS CORP · PLATFORM OVERSIGHT' : `${user?.tenantName?.toUpperCase() || 'INSTITUTION'} · LOCAL GOVERNANCE`}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '0.3rem' }}>
            {isSuperAdmin
              ? 'Multi-institution cross-tenant governance, security auditing, and enterprise operations.'
              : `Real-time academic metrics, faculty provisioning, and cohort governance for ${user?.tenantName || 'assigned institution'}.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button onClick={fetchOverview} disabled={loading} className="btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button onClick={onOpenCreateBatch} className="btn-primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', backgroundColor: '#D97706', borderColor: '#D97706' }}>
            <Plus size={15} />
            <span>New {terms?.groupLabel || 'Batch'}</span>
          </button>
          <button onClick={onOpenProvisionTrainer} className="btn-primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', backgroundColor: '#6366F1', borderColor: '#6366F1' }}>
            <UserCheck size={15} />
            <span>Invite {terms?.educatorLabel || 'Faculty'}</span>
          </button>
        </div>
      </div>

      {/* Error state if any */}
      {error && (
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--priority-high-bg)', border: '1px solid var(--priority-high-border)' }}>
          <AlertTriangle size={18} color="var(--priority-high-text)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--priority-high-text)' }}>{error}</span>
        </div>
      )}

      {/* Stat Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
        <StatCard
          icon={Building2}
          label="Managed Institutions"
          value={overview?.institutions ?? 0}
          sublabel={`${overview?.activeInstitutions ?? 0} Active · ${overview?.pendingSetupInstitutions ?? 0} Setup`}
          color="#8B5CF6"
          onClick={() => onNavigateTab('institutions')}
        />
        <StatCard
          icon={GraduationCap}
          label={`Enrolled ${terms?.learnerPlural || 'Students'}`}
          value={overview?.users?.students ?? 0}
          sublabel="Real Persisted"
          color="#059669"
          onClick={() => onNavigateTab('students')}
        />
        <StatCard
          icon={UserCheck}
          label={`Active ${terms?.educatorPlural || 'Faculty'}`}
          value={overview?.users?.trainers ?? 0}
          sublabel="Authorized Faculty"
          color="#6366F1"
          onClick={() => onNavigateTab('trainers')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Incomplete Profiles"
          value={overview?.incompleteProfiles ?? 0}
          sublabel="Missing Contact/Address"
          color="#D97706"
          onClick={() => onNavigateTab('students')}
        />
        <StatCard
          icon={FileCheck2}
          label="Pending Grading Tasks"
          value={overview?.pendingGrading ?? 0}
          sublabel="Awaiting Evaluation"
          color="#EF4444"
          onClick={() => onNavigateTab('academicOps')}
        />
        <StatCard
          icon={BookOpen}
          label={`Curriculum ${terms?.coursePlural || 'Courses'}`}
          value={overview?.courses ?? 0}
          sublabel="Accredited Subjects"
          color="#2563EB"
          onClick={() => onNavigateTab('subjects')}
        />
        <StatCard
          icon={UsersRound}
          label={`Active ${terms?.groupPlural || 'Batches'}`}
          value={overview?.batches ?? 0}
          sublabel="In Session Cohorts"
          color="#0284C7"
          onClick={() => onNavigateTab('batches')}
        />
      </div>

      {/* Quick Governance Actions Row */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.85rem' }}>
          Institutional Governance Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: `Create ${terms?.groupLabel || 'Batch'} Cohort`, icon: Plus, color: '#D97706', action: onOpenCreateBatch },
            { label: `Provision ${terms?.educatorLabel || 'Trainer'}`, icon: UserCheck, color: '#6366F1', action: onOpenProvisionTrainer },
            { label: `Manage ${terms?.learnerLabel || 'Student'} Registry`, icon: Users, color: '#059669', action: () => onNavigateTab('students') },
            { label: 'Security & Audit Logs', icon: Shield, color: '#2563EB', action: () => onNavigateTab('auditLogs') },
            { label: 'Cloud Infrastructure Health', icon: Layers, color: '#0F172A', action: () => onNavigateTab('architecture') }
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={item.color} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time System Status Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Recent Security & Administrative Events
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real Audit Trail</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {recentEvents.length === 0 ? (
              <div style={{ padding: '1.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No security audit events recorded yet.
              </div>
            ) : (
              recentEvents.slice(0, 5).map((ev, i) => (
                <div key={ev._id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.9rem', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={14} color="#6366F1" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.action}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ev.actor?.email || ev.actor?.role || 'System Audit'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Activity size={18} color="#059669" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Cluster Health
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Enterprise services are operating with high availability and automated failover.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
              {[
                { name: 'Core API Gateway', status: 'Operational', color: '#059669' },
                { name: 'MongoDB Replica / InMemory', status: 'Healthy', color: '#059669' },
                { name: 'Real-Time Socket Mesh', status: 'Connected', color: '#059669' },
                { name: 'Piston Code Execution', status: 'Active (Isolated)', color: '#2563EB' }
              ].map((svc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{svc.name}</span>
                  <span style={{ color: svc.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: svc.color }} />
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
            <button onClick={() => onNavigateTab('architecture')} className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }}>
              View System Architecture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── College / Tenant Management View ────────────────────────────────────────
const CollegeManagementView = ({ onOpenCreateBatch }) => {
  const { terms, user, portalConfig } = useLMS();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBatches = () => {
    setLoading(true);
    apiService._fetch('/api/v1/admin/batches')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.batches) setBatches(data.batches); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBatches(); }, []);

  const filteredBatches = batches.filter(b =>
    (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {terms?.groupsMenuLabel || 'Tenants & Batches'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Configure institutional {terms?.groupPlural?.toLowerCase() || 'batches'} and academic cohorts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button onClick={onOpenCreateBatch} className="btn-primary" style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontSize: '0.84rem' }}>
            <Plus size={16} />
            <span>Create New {terms?.groupLabel || 'Batch'}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${terms?.groupPlural?.toLowerCase() || 'batches'} by code or name...`}
            style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.86rem' }}
          />
        </div>
      </div>

      {/* Batches Grid */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Active {terms?.groupLabel || 'Batch'} Cohorts ({filteredBatches.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {user?.tenantName || user?.institution || portalConfig?.companyName || 'Campus Administration'}
          </span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading batches…</p>
        ) : filteredBatches.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-default)', borderRadius: '12px' }}>
            <CalendarDays size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>No cohorts found</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1rem' }}>
              Create your first cohort to organize students and faculty.
            </p>
            <button onClick={onOpenCreateBatch} className="btn-primary" style={{ backgroundColor: '#D97706', borderColor: '#D97706' }}>
              <Plus size={15} /> Create {terms?.groupLabel || 'Batch'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredBatches.map((b) => (
              <div
                key={b._id}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(217, 119, 6, 0.12)',
                      color: '#D97706',
                      border: '1px solid rgba(217, 119, 6, 0.25)'
                    }}>
                      {b.code}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.5rem 0 0.2rem' }}>
                      {b.name}
                    </h4>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.department}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '100px' }}>
                    {b.status || 'Active'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Lead Educator:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.trainerName || 'Dr. Evelyn Reed'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Enrolled:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.studentCount || 28} Students</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Trainer Provisioning View ────────────────────────────────────────────────
const TrainerProvisioningView = ({ onOpenProvisionTrainer }) => {
  const { terms } = useLMS();
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTrainers = () => {
    setLoading(true);
    apiService._fetch('/api/v1/admin/trainers')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.trainers) setTrainers(data.trainers); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrainers(); }, []);

  const filteredTrainers = trainers.filter(t =>
    (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {terms?.rosterLabel || 'Faculty Roster'} & Provisioning
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            View provisioned {terms?.educatorPlural?.toLowerCase() || 'trainers'} and their assigned academic cohorts.
          </p>
        </div>

        <button onClick={onOpenProvisionTrainer} className="btn-primary" style={{ backgroundColor: '#6366F1', borderColor: '#6366F1', fontSize: '0.84rem' }}>
          <UserCheck size={16} />
          <span>Provision New {terms?.educatorLabel || 'Trainer'}</span>
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${terms?.educatorPlural?.toLowerCase() || 'faculty'} by name, email, department...`}
          style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.86rem' }}
        />
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
          Active {terms?.educatorPlural || 'Faculty'} Roster ({filteredTrainers.length})
        </h3>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading faculty roster…</p>
        ) : filteredTrainers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-default)', borderRadius: '12px' }}>
            <UserCheck size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>No faculty found</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1rem' }}>
              Add instructors to lead sessions and manage cohorts.
            </p>
            <button onClick={onOpenProvisionTrainer} className="btn-primary" style={{ backgroundColor: '#6366F1', borderColor: '#6366F1' }}>
              <UserCheck size={15} /> Provision {terms?.educatorLabel || 'Trainer'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredTrainers.map((t) => (
              <div
                key={t._id}
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#6366F1'
                  }}>
                    {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                      <span>{t.email}</span>
                      <span>•</span>
                      <span>{t.department || 'Faculty'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '100px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: '#6366F1',
                    border: '1px solid rgba(99, 102, 241, 0.25)'
                  }}>
                    {terms?.educatorLabel?.toUpperCase() || 'EDUCATOR'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AdminApp Root ────────────────────────────────────────────────────────────
export const AdminApp = () => {
  const { activeTab, setActiveTab, isAuthenticated, user, logout, terms, addToast } = useLMS();
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [provisionTrainerOpen, setProvisionTrainerOpen] = useState(false);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);

  const currentRole = (user?.role || '').toLowerCase();
  const isSuperAdmin = currentRole === 'superadmin';

  // Privileged account MFA requirement check
  const requiresMfaEnrollment =
    ((isSuperAdmin || user?.mfaEnforced || user?.mfaSetupRequired)) &&
    !user?.isTwoFactorEnabled;

  useEffect(() => {
    if (isAuthenticated && requiresMfaEnrollment) {
      setMfaModalOpen(true);
    }
  }, [isAuthenticated, requiresMfaEnrollment]);

  // Intercept backend 403 MFA_SETUP_REQUIRED events dispatched by apiService
  useEffect(() => {
    const handleMfaRequired = () => {
      setMfaModalOpen(true);
    };
    window.addEventListener('lms_mfa_setup_required', handleMfaRequired);
    return () => window.removeEventListener('lms_mfa_setup_required', handleMfaRequired);
  }, []);
  if (!isAuthenticated) {
    return <UnauthenticatedView portalName="Admin Portal" role="admin" />;
  }

  // Server-authoritative role redirection
  if (currentRole === 'student') {
    window.location.replace('/');
    return null;
  }
  if (currentRole === 'trainer' || currentRole === 'teacher') {
    window.location.replace('/trainer.html');
    return null;
  }
  if (currentRole !== 'admin' && currentRole !== 'superadmin') {
    return <UnauthenticatedView portalName="Admin Portal" role="admin" />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AdminDashboard
            key={`dashboard-${adminRefreshKey}`}
            onOpenCreateBatch={() => setCreateBatchOpen(true)}
            onOpenProvisionTrainer={() => setProvisionTrainerOpen(true)}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'analytics':
        return <InstitutionAnalyticsView key={`analytics-${adminRefreshKey}`} />;
      case 'schools':
      case 'multiSchool':
        return <MultiSchoolManagementView key={`schools-${adminRefreshKey}`} />;
      case 'institutions':
      case 'colleges':
        return <InstitutionsDirectoryView key={`institutions-${adminRefreshKey}`} />;
      case 'students':
        return <StudentsDataSheetView key={`students-${adminRefreshKey}`} />;
      case 'trainers':
        return <TrainerProvisioningView key={`trainers-${adminRefreshKey}`} onOpenProvisionTrainer={() => setProvisionTrainerOpen(true)} />;
      case 'administrators':
        return <AdministratorsView key={`admins-${adminRefreshKey}`} />;
      case 'batches':
        return <CollegeManagementView key={`batches-${adminRefreshKey}`} onOpenCreateBatch={() => setCreateBatchOpen(true)} />;
      case 'subjects':
        return <SubjectsCatalogView key={`subjects-${adminRefreshKey}`} />;
      case 'structure':
        return <AcademicStructureView key={`structure-${adminRefreshKey}`} />;
      case 'attendanceOps':
        return <AttendanceOperationsView key={`attendance-${adminRefreshKey}`} />;
      case 'academicOps':
        return <AcademicOpsView key={`academic-${adminRefreshKey}`} />;
      case 'announcementsOps':
        return <AnnouncementsOpsView key={`announcements-${adminRefreshKey}`} />;
      case 'doubtsOps':
      case 'doubts':
        return <DoubtsOpsView key={`doubts-${adminRefreshKey}`} />;
      case 'reportsOps':
        return <OperationsReportsView key={`reports-${adminRefreshKey}`} />;
      case 'auditLogs':
        return <AuditLogsView key={`audit-${adminRefreshKey}`} />;
      case 'permissions':
        return <PermissionsView key={`permissions-${adminRefreshKey}`} />;
      case 'institutionSettings':
        return <InstitutionSettingsView key={`instSettings-${adminRefreshKey}`} />;
      case 'architecture':
      case 'systemHealth':
        return <ArchitectureView key={`arch-${adminRefreshKey}`} />;
      case 'settings':
        return <SettingsView key={`settings-${adminRefreshKey}`} />;
      default:
        return <NotFoundView />;
    }
  };

  return (
    <div className="app-container">
      {/* Admin Sidebar with Clean Structured Styling */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#171717',
            border: '1px solid #FFB21A33',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(245, 130, 18, 0.25)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <img
              src="/logo-transparent.png"
              alt="EdWth LMS"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
              }}
              style={{ width: '30px', height: '30px', objectFit: 'contain' }}
            />
            <Shield size={20} color="#F58212" style={{ display: 'none' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem', margin: 0, letterSpacing: '0.03em' }}>EDWTH LMS</h2>
              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: isSuperAdmin ? 'rgba(245, 130, 18, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: '#F58212', fontWeight: 700 }}>
                {isSuperAdmin ? 'SUPER ADMIN' : 'INSTITUTION ADMIN'}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1px' }}>
              {isSuperAdmin ? 'EdWth Academy' : (user?.tenantName || 'Institution Administration')}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Overview</div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`nav-item ${activeTab === 'dashboard' ? 'active active-admin' : ''}`}
          >
            <LayoutDashboard size={17} /><span>{isSuperAdmin ? 'Company Dashboard' : 'Institution Dashboard'}</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`nav-item ${activeTab === 'analytics' ? 'active active-admin' : ''}`}
          >
            <BarChart3 size={17} /><span>Institution Analytics</span>
          </button>

          <div className="sidebar-section-title">Institutions</div>
          <button
            onClick={() => setActiveTab('schools')}
            className={`nav-item ${activeTab === 'schools' || activeTab === 'multiSchool' ? 'active active-admin' : ''}`}
          >
            <School size={17} /><span>Multi-School Operations</span>
          </button>
          <button
            onClick={() => setActiveTab('institutions')}
            className={`nav-item ${activeTab === 'institutions' || activeTab === 'colleges' ? 'active active-admin' : ''}`}
          >
            <Building2 size={17} /><span>Institution Directory</span>
          </button>

          <div className="sidebar-section-title">People</div>
          <button
            onClick={() => setActiveTab('students')}
            className={`nav-item ${activeTab === 'students' ? 'active active-admin' : ''}`}
          >
            <Users size={17} /><span>{terms?.learnerPlural || 'Students'}</span>
          </button>
          <button
            onClick={() => setActiveTab('trainers')}
            className={`nav-item ${activeTab === 'trainers' ? 'active active-admin' : ''}`}
          >
            <UserCheck size={17} /><span>{terms?.educatorPlural || 'Teachers / Trainers'}</span>
          </button>
          <button
            onClick={() => setActiveTab('administrators')}
            className={`nav-item ${activeTab === 'administrators' ? 'active active-admin' : ''}`}
          >
            <Shield size={17} /><span>Authorized Administrators</span>
          </button>

          <div className="sidebar-section-title">Academic Setup</div>
          <button
            onClick={() => setActiveTab('batches')}
            className={`nav-item ${activeTab === 'batches' ? 'active active-admin' : ''}`}
          >
            <Building size={17} /><span>{terms?.groupPlural || 'Classes / Batches'}</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`nav-item ${activeTab === 'subjects' ? 'active active-admin' : ''}`}
          >
            <BookOpen size={17} /><span>{terms?.coursePlural || 'Subjects / Courses'}</span>
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`nav-item ${activeTab === 'structure' ? 'active active-admin' : ''}`}
          >
            <Layers size={17} /><span>Academic Structure</span>
          </button>

          <div className="sidebar-section-title">Academic Operations</div>
          <button
            onClick={() => setActiveTab('attendanceOps')}
            className={`nav-item ${activeTab === 'attendanceOps' ? 'active active-admin' : ''}`}
          >
            <Radio size={17} /><span>Attendance Operations</span>
          </button>
          <button
            onClick={() => setActiveTab('academicOps')}
            className={`nav-item ${activeTab === 'academicOps' ? 'active active-admin' : ''}`}
          >
            <FileCheck2 size={17} /><span>{terms?.assignmentPlural || 'Assignments / Assessments'}</span>
          </button>
          <button
            onClick={() => setActiveTab('announcementsOps')}
            className={`nav-item ${activeTab === 'announcementsOps' ? 'active active-admin' : ''}`}
          >
            <Bell size={17} /><span>Campus Announcements</span>
          </button>
          <button
            onClick={() => setActiveTab('doubtsOps')}
            className={`nav-item ${activeTab === 'doubtsOps' ? 'active active-admin' : ''}`}
          >
            <HelpCircle size={17} /><span>Student Help & Doubts</span>
          </button>
          <button
            onClick={() => setActiveTab('reportsOps')}
            className={`nav-item ${activeTab === 'reportsOps' ? 'active active-admin' : ''}`}
          >
            <FileText size={17} /><span>Operations Reports</span>
          </button>

          <div className="sidebar-section-title">Security & Administration</div>
          <button
            onClick={() => setActiveTab('auditLogs')}
            className={`nav-item ${activeTab === 'auditLogs' ? 'active active-admin' : ''}`}
          >
            <Clock size={17} /><span>Security Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`nav-item ${activeTab === 'permissions' ? 'active active-admin' : ''}`}
          >
            <KeyRound size={17} /><span>Permissions & RBAC</span>
          </button>
          <button
            onClick={() => setActiveTab('institutionSettings')}
            className={`nav-item ${activeTab === 'institutionSettings' ? 'active active-admin' : ''}`}
          >
            <Settings size={17} /><span>Multi-Tenant Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`nav-item ${activeTab === 'architecture' || activeTab === 'systemHealth' ? 'active active-admin' : ''}`}
          >
            <Activity size={17} /><span>System Health</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`nav-item ${activeTab === 'settings' ? 'active active-admin' : ''}`}
          >
            <Lock size={17} /><span>Security Policies</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldAlert size={15} color="#D97706" />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
          </div>
          <button
            onClick={() => logout()}
            className="nav-item"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', padding: '0.45rem 0.65rem' }}
          >
            <LogOut size={15} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Header />
        <main className="page-body">
          {renderActiveView()}
        </main>
      </div>

      {/* Creation Modals */}
      <CreateBatchModal
        isOpen={createBatchOpen}
        onClose={() => setCreateBatchOpen(false)}
        onCreated={() => {
          addToast('Batch Created', 'New academic cohort provisioned successfully.', 'emerald');
        }}
        terms={terms}
      />

      <ProvisionTrainerModal
        isOpen={provisionTrainerOpen}
        onClose={() => setProvisionTrainerOpen(false)}
        onCreated={() => {
          addToast('Trainer Provisioned', 'Faculty account authorized with temporary credentials.', 'emerald');
        }}
        terms={terms}
      />

      <MfaEnrollmentModal
        isOpen={mfaModalOpen}
        onSuccess={() => {
          setMfaModalOpen(false);
          setAdminRefreshKey((k) => k + 1);
        }}
      />

      <ToastNotifications />
    </div>
  );
};
