import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Bell, Calendar, User, Tag, HelpCircle, FileText, Download, CheckCircle2 } from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';
import { apiService } from '../../services/apiService';

export const SchoolAnnouncementsView = () => {
  usePageTitle('Announcements');
  const { user, schoolAnnouncements, portalConfig, addToast } = useLMS();
  const [showHelp, setShowHelp] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null);

  const handleDownloadAttachment = async (file) => {
    if (!file?.s3Key) return;
    setDownloadingKey(file.s3Key);
    try {
      const res = await apiService.getStorageDownloadUrl(file.s3Key);
      if (res?.success && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        addToast('File Retrieval Notice', res?.message || 'Storage file is not downloadable or mock mode active.', 'amber');
      }
    } catch (e) {
      addToast('Download Error', 'Failed to retrieve attachment URL.', 'red');
    } finally {
      setDownloadingKey(null);
    }
  };

  const notices = schoolAnnouncements || [];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              School Noticeboard
            </h1>
            <button
              onClick={() => setShowHelp(true)}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Noticeboard Help & Guidance"
            >
              <HelpCircle size={17} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Official announcements, activities, and campus updates from {user?.tenantName || portalConfig?.companyName || 'Campus Administration'}
          </p>
        </div>
      </div>

      {notices.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            border: '2px dashed var(--border-default)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#6366F1'
            }}
          >
            <Bell size={26} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            No announcements have been published.
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
            Official notices, examination reminders, and class broadcasts published by your teachers will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {notices.map((notice) => (
            <div
              key={notice.id || notice._id}
              className="card"
              style={{
                padding: '1.75rem',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor:
                        notice.priority === 'urgent'
                          ? 'rgba(239, 68, 68, 0.12)'
                          : notice.priority === 'important'
                          ? 'rgba(217, 119, 6, 0.12)'
                          : 'rgba(37, 99, 235, 0.12)',
                      color:
                        notice.priority === 'urgent'
                          ? '#EF4444'
                          : notice.priority === 'important'
                          ? '#D97706'
                          : '#2563EB',
                      letterSpacing: '0.03em'
                    }}
                  >
                    {notice.badge || 'Notice'}
                  </span>
                  {notice.audience && notice.audience !== 'All Classes' && (
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      {notice.audience}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} /> {notice.date}
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                {notice.title}
              </h2>

              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem', whiteSpace: 'pre-wrap' }}>
                {notice.content || notice.message}
              </p>

              {/* Attachments Section */}
              {Array.isArray(notice.attachments) && notice.attachments.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {notice.attachments.map((file, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => handleDownloadAttachment(file)}
                      disabled={downloadingKey === file.s3Key}
                      className="btn-secondary"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderRadius: '8px'
                      }}
                    >
                      <FileText size={14} color="#2563EB" />
                      <span>{file.originalName || 'Attachment'}</span>
                      <Download size={13} style={{ marginLeft: '4px' }} />
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <User size={14} />
                <span>Posted by <strong>{notice.author || notice.authorName || 'Educator'}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showHelp && (
        <SchoolContextualHelpModal
          section="announcements"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
