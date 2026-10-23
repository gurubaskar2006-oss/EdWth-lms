import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, BookOpen, Send, CheckCircle2, Paperclip, AlertCircle } from 'lucide-react';

export const SchoolHomeworkSubmitModal = ({ homework, isOpen, onClose }) => {
  const { submitSchoolHomework } = useLMS();
  const [submissionText, setSubmissionText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !homework) return null;

  const handleFileAttach = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files.map((f) => f.name)]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submissionText.trim()) return;
    setIsSubmitting(true);
    const success = await submitSchoolHomework(homework.id || homework._id, submissionText);
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '560px',
          padding: '1.75rem',
          borderRadius: '18px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB'
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#2563EB',
                  letterSpacing: '0.04em'
                }}
              >
                {homework.subject} Homework
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                {homework.title}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Homework Description Card */}
        <div
          style={{
            padding: '0.9rem 1.1rem',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            marginBottom: '1.25rem',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}
        >
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
            Teacher's Instructions:
          </strong>
          {homework.description}
          <div style={{ marginTop: '0.5rem', fontSize: '0.76rem', color: '#D97706', fontWeight: 600 }}>
            Due: {homework.dueDate} · Est. Time: {homework.estimatedTime}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Your Answers / Homework Notes
            </label>
            <textarea
              rows={5}
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Type your answers, solutions, or explanations here..."
              required
              style={{
                width: '100%',
                borderRadius: '10px',
                padding: '0.75rem',
                fontSize: '0.88rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Attached Files:
              </span>
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    border: '1px solid rgba(5, 150, 105, 0.2)',
                    fontSize: '0.8rem',
                    color: '#059669',
                    fontWeight: 600
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Paperclip size={14} />
                    {file}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File Attachment & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.9rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Paperclip size={15} />
              <span>Attach Homework File</span>
              <input type="file" multiple onChange={handleFileAttach} style={{ display: 'none' }} />
            </label>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{
                  backgroundColor: '#2563EB',
                  borderColor: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 700
                }}
              >
                <Send size={15} />
                <span>{isSubmitting ? 'Submitting...' : 'Turn In Homework'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
