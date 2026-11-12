import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { X, BookOpen, Send, CheckCircle2, Paperclip, AlertCircle } from 'lucide-react';

export const SchoolHomeworkSubmitModal = ({ homework, isOpen, onClose }) => {
  const { submitSchoolHomework } = useLMS();
  const [submissionText, setSubmissionText] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !homework) return null;

  const hasQuestions = Array.isArray(homework.questions) && homework.questions.length > 0;

  const getQKey = (q, idx) => q?.id || q?._id?.toString() || `q_${idx}`;

  const handleAnswerChange = (qKey, val) => {
    setQuestionAnswers((prev) => ({ ...prev, [qKey]: val }));
  };

  const handleFileAttach = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files.map((f) => f.name)]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalSubmission = submissionText.trim();
    if (hasQuestions) {
      const compiled = homework.questions.map((q, idx) => {
        const qKey = getQKey(q, idx);
        const val = questionAnswers[qKey];
        let answerDisplay = '(Unanswered)';
        if (q.type === 'mcq') {
          if (val !== undefined && val !== null && q.options && q.options[val] !== undefined) {
            answerDisplay = `${String.fromCharCode(65 + Number(val))}) ${q.options[val]}`;
          } else {
            answerDisplay = String(val ?? '(Unanswered)');
          }
        } else {
          answerDisplay = val ? String(val).trim() : '(Unanswered)';
        }
        return `### Question ${idx + 1} [${(q.type || 'descriptive').toUpperCase()}] (${q.marks || 5} Marks): ${q.title || ''}\n${q.prompt || ''}\nAnswer:\n${answerDisplay}\n`;
      }).join('\n----------------------------------------\n\n');

      finalSubmission = finalSubmission ? `${compiled}\n\nAdditional Notes:\n${finalSubmission}` : compiled;
    }

    if (!finalSubmission.trim()) return;

    setIsSubmitting(true);
    const success = await submitSchoolHomework(homework.id || homework._id, finalSubmission);
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
          maxWidth: hasQuestions ? '740px' : '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
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
          {/* If structured questions exist, render each interactive question */}
          {hasQuestions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.4rem' }}>
                Assignment Questions ({homework.questions.length})
              </div>

              {homework.questions.map((q, idx) => {
                const qKey = getQKey(q, idx);
                return (
                  <div
                    key={qKey}
                    style={{
                      padding: '0.9rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px',
                            textTransform: 'uppercase',
                            backgroundColor:
                              q.type === 'mcq'
                                ? 'rgba(5, 150, 105, 0.15)'
                                : q.type === 'coding'
                                ? 'rgba(124, 58, 237, 0.15)'
                                : 'rgba(217, 119, 6, 0.15)',
                            color:
                              q.type === 'mcq' ? '#059669' : q.type === 'coding' ? '#7C3AED' : '#D97706'
                          }}
                        >
                          Q{idx + 1} · {(q.type || 'descriptive').toUpperCase()}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {q.title || `Question ${idx + 1}`}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {q.marks || 5} Marks
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {q.prompt}
                    </p>

                    {/* MCQ Option Selection */}
                    {q.type === 'mcq' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {(q.options || []).map((opt, optIdx) => {
                          const isSelected = Number(questionAnswers[qKey]) === optIdx;
                          return (
                            <label
                              key={optIdx}
                              onClick={() => handleAnswerChange(qKey, optIdx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: isSelected ? '1.5px solid #2563EB' : '1px solid var(--border-default)',
                                backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                                cursor: 'pointer',
                                fontSize: '0.84rem',
                                color: isSelected ? '#2563EB' : 'var(--text-primary)',
                                fontWeight: isSelected ? 700 : 500
                              }}
                            >
                              <input
                                type="radio"
                                name={`answer_${qKey}`}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(qKey, optIdx)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span>{String.fromCharCode(65 + optIdx)}: {opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Paragraph Textarea */}
                    {(q.type === 'paragraph' || q.type === 'descriptive') && (
                      <div>
                        {q.guidelines && (
                          <div style={{ fontSize: '0.74rem', color: '#D97706', marginBottom: '0.3rem', fontStyle: 'italic' }}>
                            Rubric: {q.guidelines}
                          </div>
                        )}
                        <textarea
                          rows={3}
                          value={questionAnswers[qKey] || ''}
                          onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                          placeholder="Write your explanation / descriptive answer here..."
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            padding: '0.5rem 0.65rem',
                            fontSize: '0.84rem',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    )}

                    {/* Coding Solution Area */}
                    {q.type === 'coding' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Code Solution ({q.language || 'python'}):
                        </span>
                        <textarea
                          rows={4}
                          value={questionAnswers[qKey] !== undefined ? questionAnswers[qKey] : (q.starterCode || '')}
                          onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                          placeholder="Write your code implementation..."
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            padding: '0.5rem 0.65rem',
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            backgroundColor: '#0F172A',
                            color: '#F8FAFC',
                            border: '1px solid var(--border-default)',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Additional Notes / Comments (Optional)
                </label>
                <textarea
                  rows={2}
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Optional final comments or notes to the teacher..."
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    fontSize: '0.86rem',
                    resize: 'vertical',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>
            </div>
          ) : (
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
          )}

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
