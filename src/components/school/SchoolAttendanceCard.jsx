import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { CheckCircle2, Radio, Clock, AlertCircle } from 'lucide-react';

export const SchoolAttendanceCard = () => {
  const {
    activeAttendancePrompt,
    setActiveAttendancePrompt,
    socketService,
    user,
    schoolAttendance,
    schoolTodayClasses,
    markSchoolAttendance,
    addToast,
    triggerConfetti
  } = useLMS();

  const [confirming, setConfirming] = useState(false);

  const handleConfirmLive = async () => {
    if (!activeAttendancePrompt) return;
    setConfirming(true);
    try {
      if (socketService) {
        socketService.confirmAttendance({
          sessionId: activeAttendancePrompt.sessionId,
          tenantId: user?.tenantId,
          studentId: user?.studentId || user?._id,
          studentName: user?.name
        });
      }
      // Update local subject class
      const subjectName = activeAttendancePrompt.batchName || 'General';
      markSchoolAttendance(subjectName);
      triggerConfetti();
      addToast('Attendance Recorded! ✓', `You are marked present for ${subjectName}.`, 'emerald');
      setActiveAttendancePrompt(null);
    } catch {
      addToast('Error', 'Could not confirm attendance. Please ask your teacher.', 'rose');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        borderRadius: '16px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(5, 150, 105, 0.12)',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669'
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Today's Attendance
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Daily classroom attendance log
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            color: '#059669',
            border: '1px solid rgba(5, 150, 105, 0.2)'
          }}
        >
          {schoolAttendance?.totalSessions > 0
            ? `${schoolAttendance.presentSessions} / ${schoolAttendance.totalSessions} Sessions (${schoolAttendance.attendanceRate}%)`
            : `${schoolTodayClasses?.filter((c) => c.attendanceStatus === 'Present').length || 0} / ${schoolTodayClasses?.length || 0} Today`}
        </span>
      </div>

      {/* Active Live Attendance Notification Banner if Teacher Started Session */}
      {activeAttendancePrompt && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '2px solid #6366F1',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#6366F1',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
              }}
            >
              <Radio size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                Your teacher is taking attendance now!
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {activeAttendancePrompt.batchName || 'Your Class'} · {activeAttendancePrompt.duration || 60}s window
              </div>
            </div>
          </div>
          <button
            onClick={handleConfirmLive}
            disabled={confirming}
            style={{
              padding: '0.65rem 1.3rem',
              borderRadius: '10px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{confirming ? 'Confirming...' : 'Mark Attendance'}</span>
          </button>
        </div>
      )}

      {/* Simple Subject Attendance List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {(schoolTodayClasses || []).map((c, i) => {
          const isPresent = c.attendanceStatus === 'Present';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                backgroundColor: isPresent ? 'rgba(5, 150, 105, 0.05)' : 'var(--bg-secondary)',
                border: isPresent ? '1px solid rgba(5, 150, 105, 0.2)' : '1px solid var(--border-default)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isPresent ? '#059669' : '#9CA3AF'
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {c.subject}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {c.teacher} · {c.time}
                  </div>
                </div>
              </div>

              <div>
                {isPresent ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: '#059669'
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Present</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Clock size={13} />
                    <span>{c.attendanceStatus || 'Upcoming'}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
