import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import { apiService } from '../services/apiService';
import {
  Users,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Send,
  Sparkles,
  Award,
  ListCheck,
  ShieldAlert,
  Download,
  FileCheck
} from 'lucide-react';

export const TrainerAttendanceView = () => {
  const { user, onlineStats, socketService, addToast } = useLMS();

  // Attendance Session Form & State
  const [topic, setTopic] = useState('Operating Systems & Concurrency');
  const [duration, setDuration] = useState(60);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [confirmedStudents, setConfirmedStudents] = useState([]);

  // Announcement State
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annUrgency, setAnnUrgency] = useState('info');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Subscribe to live tally updates from socket
  useEffect(() => {
    if (!socketService) return;

    const unsubTally = socketService.onAttendanceLiveTally((data) => {
      if (data && data.latestStudent) {
        setConfirmedStudents((prev) => {
          if (prev.some((s) => s.studentId === data.latestStudent.studentId)) {
            return prev;
          }
          return [data.latestStudent, ...prev];
        });
      }
    });

    const unsubClosed = socketService.onAttendanceClosed((data) => {
      setIsSessionActive(false);
      addToast(
        'Attendance Session Ended',
        `Verification completed: ${data.totalConfirmed} verified attendance records captured.`,
        'emerald'
      );
    });

    const unsubSessionStarted = socketService.onAttendanceSessionStarted((data) => {
      if (data) {
        setActiveSessionId(data.sessionId);
        setSessionTimeLeft(data.durationSeconds || 60);
        setIsSessionActive(true);
      }
    });

    const unsubError = socketService.onError((err) => {
      if (err?.message?.toLowerCase().includes('attendance') || err?.message?.toLowerCase().includes('unauthorized')) {
        setIsSessionActive(false);
        addToast('Attendance Error', err.message || 'Could not broadcast attendance', 'rose');
      }
    });

    return () => {
      unsubTally();
      unsubClosed();
      unsubSessionStarted();
      unsubError();
    };
  }, [socketService, addToast]);

  const handleExportCSV = () => {
    if (confirmedStudents.length === 0) {
      addToast('No Records', 'No verified attendance records available to export.', 'amber');
      return;
    }
    const headers = ['Student ID', 'Student Name', 'Timestamp', 'Topic', 'Session ID'];
    const rows = confirmedStudents.map((st) => [
      `"${st.studentId || ''}"`,
      `"${st.name || ''}"`,
      `"${new Date(st.confirmedAt || Date.now()).toISOString()}"`,
      `"${topic.replace(/"/g, '""')}"`,
      `"${activeSessionId || 'session'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_verification_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('CSV Exported', `Generated verification log for ${confirmedStudents.length} students.`, 'emerald');
  };

  // Session timer countdown
  useEffect(() => {
    let interval = null;
    if (isSessionActive && sessionTimeLeft > 0) {
      interval = setInterval(() => {
        setSessionTimeLeft((prev) => {
          if (prev <= 1) {
            setIsSessionActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive, sessionTimeLeft]);

  const handleStartAttendance = () => {
    if (isSessionActive) return;

    setConfirmedStudents([]);
    setIsSessionActive(true);
    setSessionTimeLeft(duration);
    const sid = `att-${Date.now()}`;
    setActiveSessionId(sid);

    socketService.startAttendanceSession({
      topic,
      durationSeconds: duration,
      batchId: user?.batchId || null
    });

    addToast(
      'Live Attendance Broadcasted',
      `Prompt sent to ${onlineStats?.students || 0} active students (${duration}s window).`,
      'emerald'
    );
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      await apiService.createAnnouncement({
        title: annTitle.trim(),
        content: annMessage.trim(),
        message: annMessage.trim(),
        priority: annUrgency === 'critical' ? 'urgent' : annUrgency === 'warning' ? 'important' : 'normal',
        status: 'published',
        batchId: user?.batchId || undefined
      });
      if (socketService) {
        socketService.broadcastAnnouncement({
          title: annTitle.trim(),
          message: annMessage.trim(),
          urgency: annUrgency,
          targetBatchId: user?.batchId || null
        });
      }
      addToast('Announcement Broadcasted', 'Saved to database and delivered live to students.', 'emerald');
      setAnnTitle('');
      setAnnMessage('');
    } catch (err) {
      addToast('Error', 'Failed to broadcast announcement to server.', 'rose');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.75rem 2rem',
          borderRadius: '1rem',
          background: '#FFFFFF',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-emerald">Real-Time Hub</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Multi-User Socket.io Concurrency</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Trainer Live Command Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Broadcast instant interactive attendance sessions and alerts to 100s of connected students simultaneously.
          </p>
        </div>

        {/* Live Active Students Counter Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            padding: '1rem 1.5rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-default)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {onlineStats?.students || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Live Students
            </div>
          </div>
          <div style={{ width: '1px', height: '36px', background: 'var(--border-default)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-learning)' }}>
              {onlineStats?.total || 1}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Online
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns (Live Attendance vs Live Announcements) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.75rem' }}>
        {/* Left Card: Live Attendance Manager */}
        <div
          className="card"
          style={{
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Radio size={22} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Real-Time Attendance Call
              </h3>
            </div>
            {isSessionActive && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '2rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                <Clock size={14} /> {sessionTimeLeft}s Remaining
              </span>
            )}
          </div>

          {/* Configuration Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Lecture / Session Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isSessionActive}
                className="input"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem' }}
                placeholder="e.g. Distributed Consensus & Raft Protocol"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Response Window Duration (Default: 60s)
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { sec: 30, label: '30s', hint: 'Quick Check' },
                  { sec: 60, label: '60s', hint: 'Normal (Default)' },
                  { sec: 120, label: '120s', hint: 'Large / Slower Net' }
                ].map(({ sec, label, hint }) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={isSessionActive}
                    onClick={() => setDuration(sec)}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.4rem',
                      borderRadius: '0.5rem',
                      border: duration === sec ? '2px solid #10b981' : '1px solid var(--border-default)',
                      background: duration === sec ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-main)',
                      color: duration === sec ? '#10b981' : 'var(--text-secondary)',
                      cursor: isSessionActive ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{label}</span>
                    <span style={{ fontSize: '0.66rem', opacity: 0.85 }}>{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartAttendance}
              disabled={isSessionActive}
              className="btn btn-primary"
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: isSessionActive ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                cursor: isSessionActive ? 'not-allowed' : 'pointer'
              }}
            >
              <Radio size={18} />
              {isSessionActive ? `Broadcasting Attendance (${sessionTimeLeft}s)` : 'Launch Live Attendance'}
            </button>
          </div>

          {/* Real-Time Responses Roster */}
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <ListCheck size={17} color="var(--accent-primary)" /> Verified Attendance Roster ({confirmedStudents.length})
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {confirmedStudents.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    ✓ Real-Time Synced
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={confirmedStudents.length === 0}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: confirmedStudents.length === 0 ? 0.5 : 1,
                    cursor: confirmedStudents.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                  title="Export verified attendance records to CSV"
                >
                  <Download size={13} />
                  Export CSV
                </button>
              </div>
            </div>

            <div
              style={{
                maxHeight: '230px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingRight: '0.35rem'
              }}
            >
              {confirmedStudents.length === 0 ? (
                <div
                  style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    border: '1px dashed var(--border-default)',
                    borderRadius: '0.5rem'
                  }}
                >
                  {isSessionActive
                    ? 'Awaiting student confirmations in real time...'
                    : 'No active session. Click "Launch Live Attendance" to start.'}
                </div>
              ) : (
                confirmedStudents.map((st, idx) => (
                  <div
                    key={st.studentId || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '0.5rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <CheckCircle2 size={16} color="var(--accent-primary)" />
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{st.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ID: {st.studentId}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(st.confirmedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Instant Broadcast Announcements */}
        <div
          className="card"
          style={{
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Megaphone size={22} color="var(--accent-learning)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Broadcast Live Announcement
            </h3>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Push a pop-up alert to all active student browser sessions without requiring them to refresh their page.
          </p>

          <form onSubmit={handleSendAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Alert Title
              </label>
              <input
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. Lab 4 Submission Window Extended"
                className="input"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Priority / Urgency
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { id: 'info', label: 'Info (Emerald)', color: '#10b981' },
                  { id: 'warning', label: 'Important (Amber)', color: '#f59e0b' },
                  { id: 'critical', label: 'Urgent (Rose)', color: '#ef4444' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAnnUrgency(item.id)}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      border: annUrgency === item.id ? `1px solid ${item.color}` : '1px solid var(--border-default)',
                      background: annUrgency === item.id ? `${item.color}20` : 'var(--bg-main)',
                      color: annUrgency === item.id ? item.color : 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                Announcement Message
              </label>
              <textarea
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                rows={4}
                placeholder="Write your message here. All logged-in students will receive an instant toast notification..."
                className="input"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', resize: 'none' }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isBroadcasting}
              className="btn btn-primary"
              style={{
                padding: '0.85rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                borderRadius: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                cursor: 'pointer'
              }}
            >
              <Send size={18} />
              {isBroadcasting ? 'Broadcasting...' : 'Broadcast to All Active Students'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
