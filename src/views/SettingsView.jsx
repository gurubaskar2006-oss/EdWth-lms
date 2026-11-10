import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { PasskeyManagementCard } from '../components/PasskeyManagementCard';
import {
  User,
  Phone,
  MapPin,
  HeartHandshake,
  AlertCircle,
  CheckCircle2,
  Lock,
  Shield,
  ShieldCheck,
  KeyRound,
  Bell,
  Save,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  AlertTriangle,
  GraduationCap,
  School,
  BookOpen,
  Sparkles,
  Hash,
  Mail,
  Building2
} from 'lucide-react';
import { apiService } from '../services/apiService';

export const SettingsView = ({ onCancel }) => {
  usePageTitle('Settings & Profile');
  const { user, setUser, handleMfaEnrolled, addToast, setActiveTab } = useLMS();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTrainer = role === 'trainer' || role === 'teacher' || role === 'faculty';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;

  // Personal & Academic profile fields initialized from current user object
  const [formData, setFormData] = useState({
    // Non-changeable (managed by admin/institution)
    name: user?.name || '',
    schoolName: user?.schoolName || user?.tenantName || user?.institutionName || '',
    studentId: user?.studentId || '',

    // Student self-service fields (Handwritten note details)
    standard: user?.standard || user?.schoolProfile?.standard || user?.className || '',
    group: user?.group || user?.schoolProfile?.group || user?.department || '',
    registrationNumber: user?.registrationNumber || user?.schoolProfile?.registrationNumber || user?.rollNumber || '',
    dreamCollege: user?.dreamCollege || user?.schoolProfile?.dreamCollege || '',
    dreamCourse: user?.dreamCourse || user?.schoolProfile?.dreamCourse || '',
    email: user?.email || '',
    phone: user?.phone || '',
    parentPhone: user?.parentPhone || user?.schoolProfile?.parentPhone || user?.emergencyContact?.phone || '',

    address: user?.address || '',
    emergencyContact: {
      name: user?.emergencyContact?.name || user?.parentName || '',
      phone: user?.parentPhone || user?.emergencyContact?.phone || '',
      relationship: user?.emergencyContact?.relationship || 'Parent/Guardian'
    }
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Phone format validation standard (7 to 25 characters, digits, +, -, ())
  const PHONE_REGEX = /^[\d\s+\-().]{7,25}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Notifications preferences (client-side persisted)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [studyStreakReminders, setStudyStreakReminders] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  // 2FA Security State
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Sync form state if user changes externally
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        schoolName: user.schoolName || user.tenantName || user.institutionName || '',
        studentId: user.studentId || '',

        standard: user.standard || user.schoolProfile?.standard || user.className || '',
        group: user.group || user.schoolProfile?.group || user.department || '',
        registrationNumber: user.registrationNumber || user.schoolProfile?.registrationNumber || user.rollNumber || '',
        dreamCollege: user.dreamCollege || user.schoolProfile?.dreamCollege || '',
        dreamCourse: user.dreamCourse || user.schoolProfile?.dreamCourse || '',
        email: user.email || '',
        phone: user.phone || '',
        parentPhone: user.parentPhone || user.schoolProfile?.parentPhone || user.emergencyContact?.phone || '',

        address: user.address || '',
        emergencyContact: {
          name: user.emergencyContact?.name || user.parentName || '',
          phone: user.parentPhone || user.emergencyContact?.phone || '',
          relationship: user.emergencyContact?.relationship || 'Parent/Guardian'
        }
      });
      setFieldErrors({});
    }
  }, [
    user?._id,
    user?.phone,
    user?.email,
    user?.standard,
    user?.group,
    user?.registrationNumber,
    user?.dreamCollege,
    user?.dreamCourse,
    user?.parentPhone,
    user?.address
  ]);

  // Profile completion calculation from the 3 required student fields (only calculated for students)
  const hasPhone = Boolean(formData.phone && formData.phone.trim() && PHONE_REGEX.test(formData.phone.trim()));
  const hasAddress = Boolean(formData.address && formData.address.trim());
  const hasEmergencyName = Boolean(formData.emergencyContact?.name && formData.emergencyContact.name.trim());
  const hasEmergencyPhone = Boolean((formData.parentPhone || formData.emergencyContact?.phone) && (formData.parentPhone || formData.emergencyContact?.phone).trim() && PHONE_REGEX.test((formData.parentPhone || formData.emergencyContact?.phone).trim()));
  const hasEmergency = hasEmergencyName && hasEmergencyPhone;

  const completedCount = (hasPhone ? 1 : 0) + (hasAddress ? 1 : 0) + (hasEmergency ? 1 : 0);
  const completionPercentage = Math.round((completedCount / 3) * 100);

  const studentTrackedFields = isStudent ? [
    { key: 'standard', label: 'STD (Standard / Class)', filled: Boolean(formData.standard && formData.standard.trim()) },
    { key: 'group', label: 'Group / Department', filled: Boolean(formData.group && formData.group.trim()) },
    { key: 'registrationNumber', label: 'Registration Number', filled: Boolean(formData.registrationNumber && formData.registrationNumber.trim()) },
    { key: 'dreamCollege', label: 'Dream College', filled: Boolean(formData.dreamCollege && formData.dreamCollege.trim()) },
    { key: 'dreamCourse', label: 'Dream Course', filled: Boolean(formData.dreamCourse && formData.dreamCourse.trim()) },
    { key: 'email', label: 'Mail ID', filled: Boolean(formData.email && formData.email.trim()) },
    { key: 'phone', label: 'Phone Number', filled: hasPhone },
    { key: 'parentPhone', label: "Parent's Number", filled: Boolean(formData.parentPhone && formData.parentPhone.trim() && PHONE_REGEX.test(formData.parentPhone.trim())) }
  ] : [
    { key: 'phone', label: 'Contact Phone Number', filled: hasPhone },
    { key: 'address', label: 'Residential Address', filled: hasAddress }
  ];

  const missingFields = studentTrackedFields.filter(f => !f.filled);

  const handleSetup2FA = async () => {
    setIsSettingUp2FA(true);
    setVerifyError('');
    const result = await apiService.setup2FA();
    setIsSettingUp2FA(false);
    if (result && result.success) {
      setTwoFactorData(result);
      addToast('2FA Credentials Generated', 'Scan the QR code and enter the 6-digit code to activate.', 'emerald');
    } else {
      addToast('2FA Setup Failed', result?.message || 'Could not initiate 2FA setup', 'error');
    }
  };

  const handleVerify2FASubmit = async (e) => {
    if (e) e.preventDefault();
    const clean = totpCode.replace(/\s+/g, '');
    if (!clean) {
      setVerifyError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setIsVerifying2FA(true);
      setVerifyError('');
      const res = await apiService.verify2FA(null, clean);
      if (res && res.success) {
        if (typeof handleMfaEnrolled === 'function') {
          handleMfaEnrolled(res.user);
        } else {
          setUser((prev) => ({ ...prev, isTwoFactorEnabled: true, mfaSetupRequired: false }));
          addToast('2FA Activated', 'Two-Factor Authentication is active.', 'emerald');
        }
        setTwoFactorData(null);
        setTotpCode('');
      } else {
        setVerifyError(res?.message || 'Invalid verification code. Please try again.');
      }
    } catch {
      setVerifyError('Network error verifying code.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        schoolName: user.schoolName || user.tenantName || user.institutionName || '',
        studentId: user.studentId || '',

        standard: user.standard || user.schoolProfile?.standard || user.className || '',
        group: user.group || user.schoolProfile?.group || user.department || '',
        registrationNumber: user.registrationNumber || user.schoolProfile?.registrationNumber || user.rollNumber || '',
        dreamCollege: user.dreamCollege || user.schoolProfile?.dreamCollege || '',
        dreamCourse: user.dreamCourse || user.schoolProfile?.dreamCourse || '',
        email: user.email || '',
        phone: user.phone || '',
        parentPhone: user.parentPhone || user.schoolProfile?.parentPhone || user.emergencyContact?.phone || '',

        address: user.address || '',
        emergencyContact: {
          name: user.emergencyContact?.name || user.parentName || '',
          phone: user.parentPhone || user.emergencyContact?.phone || '',
          relationship: user.emergencyContact?.relationship || 'Parent/Guardian'
        }
      });
      setFieldErrors({});
      setSaveError('');
    }
    if (onCancel) {
      onCancel();
    } else if (setActiveTab) {
      setActiveTab('dashboard');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    const errors = {};
    const trimmedPhone = (formData.phone || '').trim();
    const trimmedParentPhone = (formData.parentPhone || '').trim();
    const trimmedEmail = (formData.email || '').trim();
    const trimmedAddress = (formData.address || '').trim();

    if (isStudent) {
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        errors.phone = 'Please enter a valid student phone number (7-25 digits, +, -, () permitted).';
      }
      if (trimmedParentPhone && !PHONE_REGEX.test(trimmedParentPhone)) {
        errors.parentPhone = "Please enter a valid parent's phone number (7-25 digits, +, -, () permitted).";
      }
      if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
        errors.email = 'Please enter a valid email address.';
      }
      if (trimmedAddress && trimmedAddress.length > 300) {
        errors.address = 'Address cannot exceed 300 characters.';
      }
    } else {
      // Trainer / Staff / Admin validation (optional self-service fields)
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        errors.phone = 'Please enter a valid phone number (7-25 digits, +, -, () permitted).';
      }
      if (trimmedAddress && trimmedAddress.length > 300) {
        errors.address = 'Address cannot exceed 300 characters.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveError('Please correct the highlighted errors before saving.');
      addToast('Incomplete Details', 'Please correct the highlighted fields.', 'amber');
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      const payload = {};
      if (isStudent) {
        payload.standard = (formData.standard || '').trim();
        payload.group = (formData.group || '').trim();
        payload.registrationNumber = (formData.registrationNumber || '').trim();
        payload.dreamCollege = (formData.dreamCollege || '').trim();
        payload.dreamCourse = (formData.dreamCourse || '').trim();
        payload.email = trimmedEmail;
        payload.phone = trimmedPhone;
        payload.parentPhone = trimmedParentPhone;
        if (trimmedAddress) payload.address = trimmedAddress;
        payload.emergencyContact = {
          name: (formData.emergencyContact?.name || formData.parentName || 'Parent / Guardian').trim(),
          phone: trimmedParentPhone,
          relationship: (formData.emergencyContact?.relationship || 'Parent/Guardian').trim()
        };
      } else {
        if (trimmedPhone) payload.phone = trimmedPhone;
        if (trimmedAddress) payload.address = trimmedAddress;
      }

      const res = await apiService.updateProfile(payload);

      if (res && res.success && res.user) {
        setUser(res.user);
        setSaveSuccess(true);
        addToast(
          'Profile Updated',
          isTrainer
            ? 'Faculty profile details saved successfully.'
            : isStudent
            ? 'Your student profile details have been saved successfully.'
            : 'Administrator profile details saved successfully.',
          'emerald'
        );

        const freshProfile = await apiService.getProfile();
        if (freshProfile?.success && freshProfile.user) {
          setUser(freshProfile.user);
        }
      } else {
        const errorMsg = res?.message || res?.error?.message || (typeof res?.error === 'string' ? res.error : null) || 'Failed to save profile.';
        setSaveError(errorMsg);
        addToast('Update Failed', errorMsg, 'rose');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setSaveError('Network error while saving profile. Please check your connection and retry.');
      addToast('Network Error', 'Could not reach the server to save profile.', 'rose');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0 }}>
          {isSuperAdmin
            ? 'Platform Security & Access Policies'
            : isTrainer
            ? 'Account & Security Settings'
            : isAdmin
            ? 'Institution Administrator Profile'
            : 'Account & Student Profile'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
          {isSuperAdmin
            ? 'Manage platform administrator access, security credentials, and two-factor authentication (2FA).'
            : isTrainer
            ? 'Manage your direct contact details, password credentials, and account security.'
            : isAdmin
            ? 'Manage administrative contact details, system security credentials, and two-factor authentication.'
            : 'Manage your personal contact details, security credentials, and academic alert preferences.'}
        </p>
      </div>

      {/* ─── Profile Completion Status Card (Only for Students) ─── */}
      {isStudent && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            border: completionPercentage === 100
              ? '1px solid rgba(5, 150, 105, 0.35)'
              : '1px solid rgba(217, 119, 6, 0.35)',
            backgroundColor: completionPercentage === 100
              ? 'rgba(5, 150, 105, 0.04)'
              : 'rgba(217, 119, 6, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {completionPercentage === 100 ? (
                <CheckCircle2 size={22} color="#059669" />
              ) : (
                <AlertCircle size={22} color="#D97706" />
              )}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Student Profile Completion: {completionPercentage}%
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  {completionPercentage === 100
                    ? 'All required contact and emergency details are complete and verified.'
                    : `${completedCount} of 3 required contact fields completed.`}
                </p>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '100px',
                backgroundColor: completionPercentage === 100 ? 'rgba(5, 150, 105, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                color: completionPercentage === 100 ? '#059669' : '#D97706'
              }}
            >
              {completionPercentage === 100 ? 'Profile Complete ✓' : 'Completion Required'}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-default)', borderRadius: '100px', overflow: 'hidden', margin: '0.75rem 0' }}>
            <div
              style={{
                width: `${completionPercentage}%`,
                height: '100%',
                backgroundColor: completionPercentage === 100 ? '#059669' : '#D97706',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          {missingFields.length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong>Missing required details:</strong>
              {missingFields.map(f => (
                <span key={f.key} style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  • {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Save Status Notification */}
        {saveError && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#EF4444', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={17} />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: '10px', color: '#059669', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={17} />
            <span>Profile details saved successfully. Changes are persisted to your record.</span>
          </div>
        )}

        {/* ─── Academic / Staff Identity Card (Streamlined for SuperAdmin and Trainer) ─── */}
        {isSuperAdmin ? (
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#6366F1'
                }}
              >
                <Shield size={22} />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.name || 'Platform Administrator'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  6th Civilians Corporation · Platform Oversight · <span style={{ fontFamily: 'var(--font-mono)' }}>{user?.email}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <ShieldCheck size={15} color="#059669" />
              <span>Full Cross-Tenant Governance Active</span>
            </div>
          </div>
        ) : isTrainer ? (
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={user?.name || 'Trainer'}
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }}
              />
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.name || 'Faculty Member'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {user?.role === 'teacher' ? 'Class Teacher' : 'Faculty Trainer'} · {user?.tenantName || user?.institutionName || 'Assigned Institution'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shield size={14} color="#D97706" />
              <span>Official academic identity & cohort assignments are centrally managed</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Shield size={19} color="#D97706" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {isAdmin
                    ? 'Administrative Governance Identity'
                    : 'Company-Managed Academic Identity'}
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> Managed by 6th Civilians Corporation
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name || 'Account'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)' }}
                />
              ) : null}
              <div
                style={{
                  display: user?.avatar ? 'none' : 'flex',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  color: '#2563EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  border: '2px solid var(--border-default)',
                  flexShrink: 0
                }}
              >
                {(user?.name || 'A').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.name || 'Account'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {isAdmin ? (
                    <>Role: <strong>INSTITUTION ADMIN</strong></>
                  ) : (
                    <>Student ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{user?.studentId || 'N/A'}</strong> · Role: <strong>STUDENT</strong></>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '2px' }}>
                  Institution: {user?.tenantName || user?.institutionName || 'Academic Institution'}
                </div>
              </div>
            </div>

            {/* Non-changeable academic identity fields: Student Name, School Name, Student ID */}
            {isStudent ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    <Lock size={12} color="#D97706" /> Student Name (1. Stud Name)
                  </label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    disabled
                    style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Official enrolled student name (Non-changeable)
                  </span>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    <Lock size={12} color="#D97706" /> School Name (2. Schl Name)
                  </label>
                  <input
                    type="text"
                    value={user?.schoolName || user?.tenantName || user?.institutionName || 'Victory Matriculation Higher Secondary School'}
                    disabled
                    style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Assigned school / academic institution (Non-changeable)
                  </span>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    <Lock size={12} color="#D97706" /> Student ID
                  </label>
                  <input
                    type="text"
                    value={user?.studentId || 'N/A'}
                    disabled
                    style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Unique institutional registry number (Non-changeable)
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Official Account Name
                  </label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    disabled
                    style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Official Admin Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Institutional Tenant
                  </label>
                  <input
                    type="text"
                    value={user?.tenantName || 'Assigned Institution'}
                    disabled
                    style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-secondary)' }}
                  />
                </div>
              </div>
            )}

            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '1rem 0 0' }}>
              {isStudent
                ? '* Student Name, School Name, and Student ID are locked by institution administration. All other details below can be filled or changed.'
                : '* Academic assignments, credentials, and institutional tenancy are managed centrally by institution administration.'}
            </p>
          </div>
        )}

        {/* ─── Student Academic & Career Aspirations Card (Self-Service: Editable & Fillable) ─── */}
        {!isSuperAdmin && isStudent && (
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <GraduationCap size={19} color="#2563EB" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Academic Profile & Career Aspirations (Self-Service)
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Editable by Student
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  STD (Standard / Class)
                </label>
                <div style={{ position: 'relative' }}>
                  <BookOpen size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="e.g. Class 11, 10th Standard"
                    value={formData.standard}
                    onChange={(e) => setFormData({ ...formData, standard: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.88rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Current standard / class level
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Group / Department
                </label>
                <div style={{ position: 'relative' }}>
                  <GraduationCap size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="e.g. Computer Science, Bio-Maths, Commerce"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.88rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Academic stream or department
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Registration Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Hash size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="e.g. 2026-CS-042 / REG-001"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.88rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Official registration / board roll number
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Dream College
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="e.g. IIT Madras, MIT, Anna University"
                    value={formData.dreamCollege}
                    onChange={(e) => setFormData({ ...formData, dreamCollege: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.88rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Target higher education college / university
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Dream Course
                </label>
                <div style={{ position: 'relative' }}>
                  <Sparkles size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Computer Science, Artificial Intelligence"
                    value={formData.dreamCourse}
                    onChange={(e) => setFormData({ ...formData, dreamCourse: e.target.value })}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.88rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Target academic course or degree
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Personal Contact & Parent Details Card (Self-Service) ─── */}
        {!isSuperAdmin && (
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <User size={19} color="#059669" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {isStudent ? 'Contact & Parent Information (Self-Service)' : 'Personal Contact Details (Self-Service)'}
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Editable
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {isStudent && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: fieldErrors.email ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Mail ID (Email)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color={fieldErrors.email ? '#EF4444' : 'var(--text-muted)'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      placeholder="e.g. student@school.edu"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
                      }}
                      style={{
                        width: '100%',
                        paddingLeft: '2.4rem',
                        fontSize: '0.88rem',
                        borderColor: fieldErrors.email ? '#EF4444' : undefined
                      }}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                      {fieldErrors.email}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Official student email for notifications & communications
                    </span>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: fieldErrors.phone ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {isStudent ? 'Phone Number (Student)' : 'Contact Phone Number'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} color={fieldErrors.phone ? '#EF4444' : 'var(--text-muted)'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: null });
                    }}
                    style={{
                      width: '100%',
                      paddingLeft: '2.4rem',
                      fontSize: '0.88rem',
                      borderColor: fieldErrors.phone ? '#EF4444' : undefined
                    }}
                  />
                </div>
                {fieldErrors.phone ? (
                  <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                    {fieldErrors.phone}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isStudent ? 'Student personal mobile number' : 'Optional direct contact phone'}
                  </span>
                )}
              </div>

              {isStudent && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: fieldErrors.parentPhone ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Parent&apos;s Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} color={fieldErrors.parentPhone ? '#EF4444' : 'var(--text-muted)'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.parentPhone}
                      onChange={(e) => {
                        setFormData({ ...formData, parentPhone: e.target.value });
                        if (fieldErrors.parentPhone) setFieldErrors({ ...fieldErrors, parentPhone: null });
                      }}
                      style={{
                        width: '100%',
                        paddingLeft: '2.4rem',
                        fontSize: '0.88rem',
                        borderColor: fieldErrors.parentPhone ? '#EF4444' : undefined
                      }}
                    />
                  </div>
                  {fieldErrors.parentPhone ? (
                    <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                      {fieldErrors.parentPhone}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Parent or guardian contact number for critical updates
                    </span>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: fieldErrors.address ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {isStudent ? 'Residential / Mailing Address' : 'Campus / Office Address'}
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} color={fieldErrors.address ? '#EF4444' : 'var(--text-muted)'} style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input
                    type="text"
                    placeholder={isStudent ? 'e.g. 142 Elm Street, Suite 4B' : 'e.g. Faculty Building B, Office 302'}
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (fieldErrors.address) setFieldErrors({ ...fieldErrors, address: null });
                    }}
                    style={{
                      width: '100%',
                      paddingLeft: '2.4rem',
                      fontSize: '0.88rem',
                      borderColor: fieldErrors.address ? '#EF4444' : undefined
                    }}
                  />
                </div>
                {fieldErrors.address ? (
                  <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                    {fieldErrors.address}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isStudent ? 'Residential mailing address for student records' : 'Optional office or mailing address'}
                  </span>
                )}
              </div>
            </div>

          {/* Emergency Contact Block — Only for students */}
          {isStudent && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <HeartHandshake size={17} color="#2563EB" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Emergency Contact Details
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: fieldErrors.emergencyName ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Emergency Contact Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parent / Guardian Name"
                    value={formData.emergencyContact.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                      });
                      if (fieldErrors.emergencyName) setFieldErrors({ ...fieldErrors, emergencyName: null });
                    }}
                    style={{
                      width: '100%',
                      fontSize: '0.86rem',
                      borderColor: fieldErrors.emergencyName ? '#EF4444' : undefined
                    }}
                  />
                  {fieldErrors.emergencyName && (
                    <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                      {fieldErrors.emergencyName}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: fieldErrors.emergencyPhone ? '#EF4444' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Emergency Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={formData.emergencyContact.phone || formData.parentPhone}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                      });
                      if (fieldErrors.emergencyPhone) setFieldErrors({ ...fieldErrors, emergencyPhone: null });
                    }}
                    style={{
                      width: '100%',
                      fontSize: '0.86rem',
                      borderColor: fieldErrors.emergencyPhone ? '#EF4444' : undefined
                    }}
                  />
                  {fieldErrors.emergencyPhone && (
                    <span style={{ fontSize: '0.74rem', color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                      {fieldErrors.emergencyPhone}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Relationship
                  </label>
                  <select
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, relationship: e.target.value }
                    })}
                    style={{ width: '100%', fontSize: '0.86rem' }}
                  >
                    <option value="Parent/Guardian">Parent / Guardian</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Spouse">Spouse / Partner</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other Family Contact</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="btn-secondary"
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
              style={{
                backgroundColor: '#059669',
                borderColor: '#059669',
                padding: '0.65rem 1.5rem',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isSaving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
              <span>{isSaving ? 'Saving to Database...' : 'Save Profile Details'}</span>
            </button>
          </div>
        </div>
      )}
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* ─── Security & Two-Factor Authentication ─── */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <KeyRound size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Account Security & MFA
            </h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: '0 0 0.25rem', fontWeight: 700 }}>
                Two-Factor Authentication (2FA)
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>
                {user?.isTwoFactorEnabled
                  ? 'Two-Factor Authentication is currently active on your account.'
                  : 'Add an extra layer of security using an authenticator app (Google Authenticator, Authy).'}
              </p>
            </div>
            {!user?.isTwoFactorEnabled && (
              <button type="button" onClick={handleSetup2FA} disabled={isSettingUp2FA} className="btn-secondary">
                {isSettingUp2FA ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}
          </div>

          {twoFactorData && (
            <div style={{ marginTop: '1rem', padding: '1.25rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-primary)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 700 }}>Scan QR Code</h4>
                  <img src={twoFactorData.qrCode} alt="2FA QR Code" style={{ borderRadius: '8px', border: '1px solid var(--border-default)', background: '#FFFFFF', padding: '6px', width: '130px', height: '130px' }} />
                  {twoFactorData.secret && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <code style={{ fontSize: '0.72rem', color: '#FFB21A', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {twoFactorData.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(twoFactorData.secret);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedKey ? '#059669' : 'var(--text-secondary)' }}
                        title="Copy Secret"
                      >
                        {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 700 }}>Backup Recovery Codes</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: '0.65rem' }}>Store these in a safe location:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {twoFactorData.backupCodes?.map((code, idx) => (
                      <div key={idx} style={{ padding: '0.35rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', textAlign: 'center', fontWeight: 700 }}>
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Complete Setup Form */}
              <form onSubmit={handleVerify2FASubmit} style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Enter 6-Digit Authenticator Code to Activate:
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '340px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    disabled={isVerifying2FA}
                    style={{
                      flex: 1,
                      fontSize: '1.1rem',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.2em',
                      textAlign: 'center',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: verifyError ? '1px solid #EF4444' : '1px solid var(--border-default)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifying2FA || !totpCode.trim()}
                    className="btn-primary"
                    style={{ backgroundColor: '#F58212', borderColor: '#F58212', whiteSpace: 'nowrap' }}
                  >
                    {isVerifying2FA ? 'Verifying...' : 'Activate 2FA'}
                  </button>
                </div>
                {verifyError && (
                  <div style={{ color: '#EF4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} />
                    <span>{verifyError}</span>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* ─── SuperAdmin FIDO2 / WebAuthn Passkeys & Security Mailbox ─── */}
        {isSuperAdmin && (
          <PasskeyManagementCard addToast={addToast} />
        )}

        {/* ─── Notification Alerts Preferences ─── */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Bell size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Academic Notification Preferences
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { title: "Urgent Assignment Deadline Alerts", desc: "Send reminders 48h and 12h before project cutoff times", checked: deadlineAlerts, setter: setDeadlineAlerts },
              { title: "Daily Study Streak Reminders", desc: "Get notified to complete daily study goals and preserve streak", checked: studyStreakReminders, setter: setStudyStreakReminders },
              { title: "Grade & Evaluation Notifications", desc: "Receive alerts when homework, tests, or quizzes are graded", checked: emailNotifications, setter: setEmailNotifications },
              { title: "Interactive UI Sounds & Celebrations", desc: "Celebrate module completions with micro-haptic effects", checked: soundEffects, setter: setSoundEffects }
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.setter(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
